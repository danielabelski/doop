import { useEffect, useState } from 'react'
import type { GuidelineDoc, MemoryReference } from '../../shared/types'
import { useStore } from '../lib/store'
import { api } from '../lib/api'
import { timeAgo } from '../lib/time'

const MAX_GUIDELINE_CHARS = 24_000
const MAX_TITLE_CHARS = 80

/** Pretty display name: explicit title, else the prettified slug. */
function guideTitle(doc: Pick<GuidelineDoc, 'name' | 'title'>): string {
  return doc.title ?? doc.name.replace(/-/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase())
}

function summarize(markdown: string): string {
  for (const raw of markdown.split('\n')) {
    const line = raw.replace(/^#+\s*/, '').trim()
    if (line) return line.length > 90 ? line.slice(0, 87) + '…' : line
  }
  return ''
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

/** The Memory tab in the side panel: the canvas's design brain. References
 *  (pinned exemplar frames), Rules (the style guides), Decisions (captured
 *  feedback) — plus pending distiller proposals to accept or dismiss. */
export function MemoryPanel() {
  const canvasId = useStore((s) => s.canvas?.id)
  const docs = useStore((s) => s.canvas?.guidelines ?? [])
  const references = useStore((s) => s.canvas?.references ?? [])
  const decisions = useStore((s) => s.decisions)
  const proposals = useStore((s) => s.proposals)
  /** slug of the open guide, '' = create a new one, null = closed */
  const [openGuide, setOpenGuide] = useState<string | null>(null)
  const [openRef, setOpenRef] = useState<string | null>(null)

  if (!canvasId) return null

  const pending = proposals.filter((p) => p.status === 'pending')
  const empty = docs.length === 0 && references.length === 0 && decisions.length === 0 && pending.length === 0

  return (
    <div className="activity-list memory-panel">
      {empty && (
        <div className="mp-tutorial">
          <p className="mp-tutorial-lede">
            Memory is how this canvas remembers your taste — and how every agent designs with it.
          </p>
          <ul>
            <li>
              <b>References</b> — pin a frame you love (the 🧠 on its corner). Agents copy its colors, type and layout
              when they design something new.
            </li>
            <li>
              <b>Rules</b> — style guides agents read before designing. Write them, or let them grow.
            </li>
            <li>
              <b>Decisions</b> — feedback you give agents is captured here automatically once it’s addressed. When a
              preference keeps recurring, Doop suggests adding it to your rules.
            </li>
          </ul>
        </div>
      )}

      {pending.map((p) => (
        <div key={p.id} className="mp-proposal">
          <div className="mp-proposal-tag">✦ Memory suggestion</div>
          <div className="mp-proposal-rule">{p.rule.replace(/^-\s*/, '')}</div>
          <div className="mp-proposal-meta">
            {p.rationale} · from {p.basedOn.length} decision{p.basedOn.length === 1 ? '' : 's'} → “
            {p.guideTitle ?? guideTitle({ name: p.guideName })}”
          </div>
          <div className="mp-proposal-actions">
            <button
              className="btn ghost"
              onClick={() => api.resolveProposal(canvasId, p.id, false).catch(console.error)}
            >
              Dismiss
            </button>
            <button
              className="btn primary"
              onClick={() => api.resolveProposal(canvasId, p.id, true).catch(console.error)}
            >
              Add to rules
            </button>
          </div>
        </div>
      ))}

      <div className="mp-section">
        <span>References</span>
      </div>
      {references.length === 0 ? (
        <div className="mp-hint">
          No references yet. Pin a frame you like (the 🧠 on its corner) and agents will copy its colors, type and
          layout in new designs.
        </div>
      ) : (
        references.map((r) => (
          <button key={r.id} className="mp-ref" onClick={() => setOpenRef(r.id)}>
            <RefThumb reference={r} />
            <span className="mp-ref-title">{r.title}</span>
            <span className="gp-item-meta">
              {r.pinnedBy} · {timeAgo(r.pinnedAt)}
            </span>
          </button>
        ))
      )}

      <div className="mp-section">
        <span>Rules</span>
        <button className="gp-new" onClick={() => setOpenGuide('')}>
          + New
        </button>
      </div>
      {docs.length === 0 && <div className="mp-hint">Style guides every agent reads before designing here.</div>}
      {docs.map((d) => (
        <button key={d.name} className="gp-item" onClick={() => setOpenGuide(d.name)}>
          <span className="gp-item-title">{guideTitle(d)}</span>
          <span className="gp-item-summary">{summarize(d.markdown)}</span>
          <span className="gp-item-meta">
            {d.updatedBy} · {timeAgo(d.updatedAt)}
          </span>
        </button>
      ))}

      {decisions.length > 0 && (
        <>
          <div className="mp-section">
            <span>Decisions</span>
          </div>
          {decisions.slice(0, 20).map((d) => (
            <div key={d.id} className="mp-decision" title={d.summary ? `${d.from}: “${d.text}”` : undefined}>
              <span className="mp-decision-text">{d.summary ?? `“${d.text}”`}</span>
              <span className="gp-item-meta">
                {d.from}
                {d.agentName ? ` → ${d.agentName}` : ''} · {timeAgo(d.at)}
                {d.distilledAt ? ' · distilled' : ''}
              </span>
            </div>
          ))}
        </>
      )}

      {openGuide !== null && (
        <GuideModal canvasId={canvasId} name={openGuide || null} onClose={() => setOpenGuide(null)} />
      )}
      {openRef !== null && (
        <RefModal
          canvasId={canvasId}
          reference={references.find((r) => r.id === openRef) ?? null}
          onClose={() => setOpenRef(null)}
        />
      )}
    </div>
  )
}

/** Live thumbnail of a pinned reference: its snapshotted HTML, scaled down. */
function RefThumb({ reference }: { reference: MemoryReference }) {
  const w = 264 // panel content width
  const scale = w / reference.width
  return (
    <span className="mp-ref-thumb" style={{ height: Math.min(reference.height * scale, 150) }}>
      <iframe
        title={reference.title}
        srcDoc={reference.html}
        sandbox=""
        tabIndex={-1}
        style={{ width: reference.width, height: reference.height, transform: `scale(${scale})` }}
      />
    </span>
  )
}

/** One pinned reference in a modal: full-size preview + unpin. */
function RefModal({
  canvasId,
  reference,
  onClose,
}: {
  canvasId: string
  reference: MemoryReference | null
  onClose: () => void
}) {
  if (!reference) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal guide-modal" onClick={(e) => e.stopPropagation()}>
          <p className="lede">This reference is no longer pinned.</p>
          <div className="close-row">
            <button className="btn ghost" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }
  const w = Math.min(696, window.innerWidth - 110)
  const scale = Math.min(1, w / reference.width)
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal guide-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gm-head">
          <h2>{reference.title}</h2>
          <span className="gp-slug">
            {Math.round(reference.width)}×{Math.round(reference.height)}
          </span>
        </div>
        <div className="gp-meta">
          pinned by {reference.pinnedBy} · {new Date(reference.pinnedAt).toLocaleString()} — agents copy this design’s
          colors, type and layout in new work
        </div>
        <div
          className="mp-ref-preview"
          style={{ height: Math.min(reference.height * scale, window.innerHeight * 0.55) }}
        >
          <iframe
            title={reference.title}
            srcDoc={reference.html}
            sandbox=""
            tabIndex={-1}
            style={{ width: reference.width, height: reference.height, transform: `scale(${scale})` }}
          />
        </div>
        <div className="close-row">
          <button
            className="btn ghost"
            onClick={() => {
              api.unpinReference(canvasId, reference.id).catch(console.error)
              onClose()
            }}
          >
            Unpin
          </button>
          <span className="gm-spacer" />
          <button className="btn ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

type Mode = 'read' | 'edit' | 'history'

/** One design guide in a modal: read, edit (title + markdown), version
 *  history with restore, delete. name = null opens in create mode. */
function GuideModal({ canvasId, name, onClose }: { canvasId: string; name: string | null; onClose: () => void }) {
  const doc = useStore((s) => s.canvas?.guidelines?.find((d) => d.name === name) ?? null)
  const creating = name === null
  const [mode, setMode] = useState<Mode>('read')
  const [titleDraft, setTitleDraft] = useState('')
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(slug: string, markdown: string, title?: string) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await api.setGuideline(canvasId, slug, markdown, title)
      if (markdown.trim() && !creating) setMode('read')
      else onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^\d+\s*/, '') : 'save failed')
    } finally {
      setBusy(false)
    }
  }

  const editing = creating || mode === 'edit'

  return (
    <div className="modal-backdrop" onClick={() => !busy && onClose()}>
      <div className="modal guide-modal" onClick={(e) => e.stopPropagation()}>
        {editing ? (
          <>
            <input
              className="gm-title-input"
              autoFocus={creating}
              placeholder="Name, e.g. “Featured Images”"
              value={titleDraft}
              maxLength={MAX_TITLE_CHARS}
              disabled={busy}
              onChange={(e) => setTitleDraft(e.target.value)}
            />
            <div className="gp-meta">id: {creating ? slugify(titleDraft) || '…' : doc?.name}</div>
            <textarea
              className="gm-editor"
              autoFocus={!creating}
              placeholder={'# Rules\n\nPalette, fonts, layout recipes, asset URLs…'}
              value={draft}
              maxLength={MAX_GUIDELINE_CHARS}
              disabled={busy}
              onChange={(e) => setDraft(e.target.value)}
            />
            {error && <p className="import-error">{error}</p>}
            <div className="close-row">
              <span className="gp-meta">
                {draft.length.toLocaleString()} / {MAX_GUIDELINE_CHARS.toLocaleString()}
              </span>
              <span className="gm-spacer" />
              <button className="btn ghost" disabled={busy} onClick={() => (creating ? onClose() : setMode('read'))}>
                Cancel
              </button>
              <button
                className="btn primary"
                disabled={busy || !draft.trim() || (creating && !slugify(titleDraft))}
                onClick={() =>
                  creating
                    ? save(slugify(titleDraft), draft, titleDraft.trim())
                    : save(doc!.name, draft, titleDraft.trim() || undefined)
                }
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </>
        ) : !doc ? (
          /* deleted while open (possibly by someone else) */
          <>
            <p className="lede">This design guide no longer exists.</p>
            <div className="close-row">
              <button className="btn ghost" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        ) : mode === 'history' ? (
          <GuideHistory
            canvasId={canvasId}
            doc={doc}
            busy={busy}
            onRestore={(markdown) => save(doc.name, markdown)}
            onBack={() => setMode('read')}
          />
        ) : (
          <>
            <div className="gm-head">
              <h2>{guideTitle(doc)}</h2>
              <span className="gp-slug">{doc.name}</span>
            </div>
            <div className="gp-meta">
              edited by {doc.updatedBy} · {new Date(doc.updatedAt).toLocaleString()}
            </div>
            <pre className="gm-markdown">{doc.markdown}</pre>
            {error && <p className="import-error">{error}</p>}
            <div className="close-row">
              <button
                className="btn ghost"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(`Delete the design guide “${guideTitle(doc)}”?`)) save(doc.name, '')
                }}
              >
                Delete
              </button>
              <span className="gm-spacer" />
              <button className="btn ghost" disabled={busy} onClick={onClose}>
                Close
              </button>
              <button className="btn ghost" disabled={busy} onClick={() => setMode('history')}>
                History
              </button>
              <button
                className="btn primary"
                disabled={busy}
                onClick={() => {
                  setTitleDraft(guideTitle(doc))
                  setDraft(doc.markdown)
                  setError(null)
                  setMode('edit')
                }}
              >
                Edit
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function GuideHistory({
  canvasId,
  doc,
  busy,
  onRestore,
  onBack,
}: {
  canvasId: string
  doc: GuidelineDoc
  busy: boolean
  onRestore: (markdown: string) => void
  onBack: () => void
}) {
  const [versions, setVersions] = useState<{ markdown: string; savedAt: number; savedBy: string }[] | null>(null)
  const [previewIdx, setPreviewIdx] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    api
      .guidelineHistory(canvasId, doc.name)
      .then((h) => alive && setVersions(h))
      .catch((e) => alive && setError(e instanceof Error ? e.message.replace(/^\d+\s*/, '') : 'could not load history'))
    return () => {
      alive = false
    }
  }, [canvasId, doc.name])

  const preview = previewIdx !== null ? versions?.[previewIdx] : undefined

  return (
    <>
      <div className="gm-head">
        <h2>{guideTitle(doc)} — history</h2>
      </div>
      {error && <p className="import-error">{error}</p>}
      {preview ? (
        <>
          <div className="gp-meta">
            {preview.markdown ? 'saved' : 'deleted'} by {preview.savedBy} · {new Date(preview.savedAt).toLocaleString()}
          </div>
          {preview.markdown ? (
            <pre className="gm-markdown">{preview.markdown}</pre>
          ) : (
            <p className="lede">This version marks a deletion — there is nothing to show.</p>
          )}
          <div className="close-row">
            <button className="btn ghost" disabled={busy} onClick={() => setPreviewIdx(null)}>
              Back
            </button>
            <span className="gm-spacer" />
            <button
              className="btn primary"
              disabled={busy || !preview.markdown || preview.markdown === doc.markdown}
              onClick={() => onRestore(preview.markdown)}
            >
              {busy ? 'Restoring…' : 'Restore this version'}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="gm-versions">
            {versions?.length === 0 && <p className="lede">No versions recorded yet.</p>}
            {(versions ?? []).map((v, i) => (
              <button key={v.savedAt + v.savedBy} className="gp-item" onClick={() => setPreviewIdx(i)}>
                <span className="gp-item-title">
                  {v.markdown === ''
                    ? 'deleted'
                    : v.markdown === doc.markdown
                      ? 'current'
                      : `v${(versions?.length ?? 0) - i}`}
                </span>
                <span className="gp-item-summary">{v.markdown ? summarize(v.markdown) : '—'}</span>
                <span className="gp-item-meta">
                  {v.savedBy} · {new Date(v.savedAt).toLocaleString()}
                </span>
              </button>
            ))}
          </div>
          <div className="close-row">
            <button className="btn ghost" disabled={busy} onClick={onBack}>
              Back
            </button>
          </div>
        </>
      )}
    </>
  )
}
