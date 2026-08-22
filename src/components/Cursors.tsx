import { memo } from 'react'
import { useStore } from '../lib/store'
import { getIdentity } from '../lib/identity'

/* Counter-scaling comes from the `--zoom` CSS variable (see .remote-cursor),
   so viewport changes never re-render this component. */
export const Cursors = memo(function Cursors() {
  const cursors = useStore((s) => s.cursors)
  const presences = useStore((s) => s.presences)
  const me = getIdentity().clientId

  return (
    <>
      {Object.entries(cursors).map(([clientId, pos]) => {
        if (clientId === me) return null
        const p = presences[clientId]
        if (!p) return null
        return (
          <div
            key={clientId}
            className="remote-cursor"
            style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(calc(1 / var(--zoom, 1)))` }}
          >
            <svg width="18" height="20" viewBox="0 0 18 20">
              <path
                d="M1 1 L16 8.5 L9 10.5 L6.5 18 Z"
                fill={p.color}
                stroke="#fff"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            </svg>
            <span className="tag" style={{ background: p.color }}>
              {p.kind === 'agent' ? '✦ ' : ''}
              {p.name}
            </span>
          </div>
        )
      })}
    </>
  )
})
