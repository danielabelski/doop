import { useEffect, useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { api } from '../lib/api'
import { posthog } from '../lib/posthog'
import { uploadImageFrames } from '../lib/frameClipboard'
import { MeterLine, isResidentLimit, useAllowance } from './TeamAllowance'

/**
 * The canvas's front door to the resident team: a prompt bar that queues a
 * board card without anyone having to discover the board first. Suggestions
 * show until the canvas has had its first human-queued card, so a brand-new
 * user is one click away from watching the team design live.
 *
 * Screenshots and images attach via the paperclip (or a paste into the
 * input); on send they land on the canvas as reference frames and the card
 * carries their ids so the agent looks at them before designing.
 */

const SUGGESTIONS = [
  'A landing page for a specialty coffee brand',
  'A mobile onboarding flow, three screens side by side',
  'A pricing page with three tiers, one highlighted',
]

const MAX_ATTACHMENTS = 4
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024 // mirrors the server's asset cap

/** How long after a submit a newly created frame still gets the camera. */
const FLY_WINDOW_MS = 3 * 60_000

function openFlyWindow(extraKnown: string[] = []): { known: Set<string>; until: number } {
  return {
    known: new Set([...(useStore.getState().canvas?.frames ?? []).map((f) => f.id), ...extraKnown]),
    until: Date.now() + FLY_WINDOW_MS,
  }
}

interface Attachment {
  file: File
  /** object URL for the thumbnail, revoked on removal/submit */
  preview: string
}

export function PromptBar({ canvasId }: { canvasId: string }) {
  const tasks = useStore((s) => s.tasks)
  const frames = useStore((s) => s.canvas?.frames)
  const { allowance, refresh } = useAllowance()
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  /* first-run: nobody has queued a card on this canvas yet */
  const fresh = !tasks.some((t) => t.queuedBy)

  /* after a submit, the first frame that wasn't on the canvas before gets a
     camera flight — the deliverable must stream in on-screen, never somewhere
     off-canvas the user has to go find */
  const awaiting = useRef<{ known: Set<string>; until: number } | null>(null)
  useEffect(() => {
    const a = awaiting.current
    if (!a || !frames) return
    if (Date.now() > a.until) {
      awaiting.current = null
      return
    }
    const arrived = frames.find((f) => !a.known.has(f.id))
    if (arrived) {
      awaiting.current = null
      useStore.getState().requestFlyTo(arrived.id)
    }
  }, [frames])

  /* previews are object URLs — release whatever is still held on unmount
     (via a ref: an empty-deps cleanup would close over the first render) */
  const attachmentsRef = useRef(attachments)
  useEffect(() => {
    attachmentsRef.current = attachments
  }, [attachments])
  useEffect(() => () => attachmentsRef.current.forEach((a) => URL.revokeObjectURL(a.preview)), [])

  function showError(msg: string) {
    setError(msg)
    window.setTimeout(() => setError(null), 5000)
  }

  function addFiles(list: Iterable<File>) {
    const images = [...list].filter((f) => f.type.startsWith('image/'))
    if (!images.length) return
    const oversize = images.find((f) => f.size > MAX_ATTACHMENT_BYTES)
    const fitting = images.filter((f) => f.size <= MAX_ATTACHMENT_BYTES)
    const room = MAX_ATTACHMENTS - attachments.length
    if (oversize) showError(`“${oversize.name}” exceeds the 5 MB limit`)
    else if (fitting.length > room) showError(`Up to ${MAX_ATTACHMENTS} images per request`)
    const ok = fitting.slice(0, Math.max(0, room))
    if (ok.length)
      setAttachments((cur) => [...cur, ...ok.map((file) => ({ file, preview: URL.createObjectURL(file) }))])
  }

  function removeAttachment(preview: string) {
    URL.revokeObjectURL(preview)
    setAttachments((cur) => cur.filter((a) => a.preview !== preview))
  }

  async function submit(prompt: string) {
    const clean = prompt.trim()
    if (!clean || busy) return
    setBusy(true)
    try {
      /* attachments first: each becomes a reference frame on the canvas, and
         the card carries the frame ids so the agent views them before
         designing. Known-ids include them so the camera saves its flight for
         the agent's deliverable, not the user's own screenshots. */
      const refFrames = await uploadImageFrames(
        canvasId,
        attachments.map((a) => a.file),
        'Attached image',
      )
      await api.addCard(
        canvasId,
        clean,
        ['doop'],
        refFrames.map((f) => f.id),
      )
      posthog.capture('prompt_bar_submitted', {
        suggested: SUGGESTIONS.includes(clean),
        attachments: refFrames.length,
      })
      awaiting.current = openFlyWindow(refFrames.map((f) => f.id))
      attachments.forEach((a) => URL.revokeObjectURL(a.preview))
      setAttachments([])
      setText('')
      setSent(true)
      window.setTimeout(() => setSent(false), 5000)
    } catch (err) {
      if (isResidentLimit(err)) useStore.getState().setLimitWall(true)
      else {
        console.error(err)
        showError(err instanceof Error ? err.message : 'Something went wrong — try again')
      }
    } finally {
      setBusy(false)
      refresh()
    }
  }

  return (
    <div className="prompt-bar">
      {fresh && !sent && (
        <div className="pb-chips">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              className="pb-chip"
              disabled={busy}
              onClick={() => {
                /* prefill only — the prompt stays theirs to edit and send */
                setText(s)
                inputRef.current?.focus()
              }}
            >
              ✦ {s}
            </button>
          ))}
        </div>
      )}
      {attachments.length > 0 && (
        <div className="pb-thumbs">
          {attachments.map((a) => (
            <div key={a.preview} className="pb-thumb">
              <img src={a.preview} alt={a.file.name} />
              <button
                type="button"
                className="pb-thumb-x"
                aria-label={`Remove ${a.file.name}`}
                disabled={busy}
                onClick={() => removeAttachment(a.preview)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <form
        className="pb-row"
        onSubmit={(e) => {
          e.preventDefault()
          submit(text)
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
          multiple
          hidden
          onChange={(e) => {
            addFiles(e.target.files ?? [])
            e.target.value = '' // same file can be re-picked after removal
          }}
        />
        <button
          type="button"
          className="pb-attach"
          aria-label="Attach images"
          title="Attach screenshots or images"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        </button>
        <input
          ref={inputRef}
          className="pb-input"
          value={text}
          disabled={busy}
          placeholder="Ask the Doop Agent to design something…"
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            const images = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'))
            if (images.length) {
              e.preventDefault()
              addFiles(images)
            }
          }}
        />
        <button className="pb-send" type="submit" disabled={busy || !text.trim()}>
          {busy ? '…' : 'Design it'}
        </button>
      </form>
      <div className="pb-meta">
        {error ? (
          <span className="pb-error">{error}</span>
        ) : sent ? (
          <span className="pb-sent">✦ The Doop Agent is on it — watch the canvas</span>
        ) : (
          <MeterLine allowance={allowance} />
        )}
      </div>
    </div>
  )
}
