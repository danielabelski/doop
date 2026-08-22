import type { Frame } from '../../shared/types'
import { api } from '../lib/api'
import { copyFrame, duplicateFrame, hasFrameClip, pasteFrameAtScreen } from '../lib/frameClipboard'
import { deleteFrameTracked } from '../lib/history'
import { ContextMenu, MOD_KEY } from './ContextMenu'

/** Right-click menu for a frame. */
export function FrameContextMenu({
  frame,
  at,
  onClose,
}: {
  frame: Frame
  at: { x: number; y: number }
  onClose: () => void
}) {
  return (
    <ContextMenu at={at} onClose={onClose}>
      <button
        onClick={() => {
          copyFrame(frame)
          onClose()
        }}
      >
        Copy
        <span className="ctx-hint">{MOD_KEY}C</span>
      </button>
      <button
        disabled={!hasFrameClip()}
        onClick={() => {
          onClose()
          pasteFrameAtScreen(frame.canvasId, at.x, at.y)
        }}
      >
        Paste
        <span className="ctx-hint">{MOD_KEY}V</span>
      </button>
      <button
        onClick={() => {
          onClose()
          duplicateFrame(frame)
        }}
      >
        Duplicate
        <span className="ctx-hint">{MOD_KEY}D</span>
      </button>
      <hr />
      <button
        onClick={() => {
          navigator.clipboard.writeText(`${location.origin}/c/${frame.canvasId}?frame=${frame.id}`)
          onClose()
        }}
      >
        Copy link
      </button>
      <button
        onClick={() => {
          navigator.clipboard.writeText(`${location.origin}/i/${frame.id}.png?scale=2`)
          onClose()
        }}
      >
        Copy image URL
      </button>
      <a href={`/i/${frame.id}.png?scale=2&download`} onClick={onClose}>
        Download PNG
      </a>
      <a href={`/i/${frame.id}.jpg?scale=2&download`} onClick={onClose}>
        Download JPG
      </a>
      <hr />
      <button
        title="Will be used as reference — agents copy its style in new designs"
        onClick={() => {
          onClose()
          api.pinReference(frame.canvasId, frame.id).catch(console.error)
        }}
      >
        Add to design memory
      </button>
      <hr />
      <button
        className="danger"
        onClick={() => {
          onClose()
          deleteFrameTracked(frame)
        }}
      >
        Delete frame
        <span className="ctx-hint">⌫</span>
      </button>
    </ContextMenu>
  )
}
