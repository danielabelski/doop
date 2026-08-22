import { useStore } from '../lib/store'
import { AgentIcon } from './AgentIcon'

/** Floating strip of live "what I'm working on" statuses (agents post via set_status). */
export function WorkingNow() {
  const working = useStore((s) => Object.values(s.presences).filter((p) => p.status))
  if (working.length === 0) return null
  return (
    <div className="working-now">
      {working.map((p) => (
        <div
          key={p.clientId}
          className="working-now-item"
          title={`${p.name}${p.owner ? ` (${p.owner}'s agent)` : ''}: ${p.status}`}
        >
          <span className="pulse-dot" style={{ background: p.color }} />
          <span className="who" style={{ color: p.color }}>
            {p.kind === 'agent' && <AgentIcon name={p.name} size={12} />} {p.name}
          </span>
          <span className="what">{p.status}</span>
        </div>
      ))}
    </div>
  )
}
