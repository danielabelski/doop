import { useStore } from '../lib/store'
import { AgentIcon } from './AgentIcon'

/**
 * Placeholder artboards for agents that claimed a card but have not touched a
 * frame yet. The research/thinking phase of a run used to look like nothing
 * happening on the canvas even though the task panel showed a claim — a ghost
 * frame at the server's auto-placement spot shows where the work will land and
 * carries the agent's live status. Purely presentational: nothing persists,
 * and the ghost yields the moment the agent touches a real frame.
 */
export function GhostFrames() {
  const canvas = useStore((s) => s.canvas)
  const presences = useStore((s) => s.presences)
  const tasks = useStore((s) => s.tasks)
  if (!canvas) return null
  const working = Object.values(presences).filter(
    (p) =>
      p.kind === 'agent' &&
      p.status &&
      !p.activeFrameId &&
      tasks.some((t) => t.queuedBy && t.agentName === p.name && !t.endedAt && !t.failedAt),
  )
  if (working.length === 0) return null
  /* mirror store.createFrame's auto-placement: right of the right-most frame */
  const rightmost = canvas.frames.reduce((mx, f) => Math.max(mx, f.x + f.width), 0)
  const baseX = canvas.frames.length ? rightmost + 80 : 120
  return (
    <>
      {working.map((p, i) => (
        <div
          key={p.clientId}
          className="ghost-frame"
          style={
            {
              left: baseX + i * 720,
              top: 120,
              width: 640,
              height: 480,
              '--ghost-color': p.color,
            } as React.CSSProperties
          }
        >
          <div className="frame-label ghost-frame-label">
            <AgentIcon name={p.name} size={13} color={p.color} />
            <span className="fname">{p.name} is on it</span>
          </div>
          <div className="ghost-frame-body">
            <div className="ghost-frame-bars">
              <span />
              <span />
              <span />
            </div>
            <div className="ghost-frame-status">{p.status}</div>
          </div>
        </div>
      ))}
    </>
  )
}
