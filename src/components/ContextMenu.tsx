import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/** Context-menu shell: full-screen backdrop plus a menu clamped to the
 *  viewport. Rendered through a portal in screen coordinates — canvas
 *  content lives inside the zoomed .world transform, which would hijack
 *  position:fixed. Closes on outside press, right-click elsewhere, Escape. */
export function ContextMenu({
  at,
  onClose,
  children,
}: {
  at: { x: number; y: number }
  onClose: () => void
  children: React.ReactNode
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState(at)

  /* keep the menu on screen when opened near the viewport edge */
  useLayoutEffect(() => {
    const r = menuRef.current?.getBoundingClientRect()
    if (!r) return
    setPos({
      x: Math.max(8, Math.min(at.x, window.innerWidth - r.width - 8)),
      y: Math.max(8, Math.min(at.y, window.innerHeight - r.height - 8)),
    })
  }, [at])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      className="ctx-backdrop"
      onPointerDown={onClose}
      onContextMenu={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      <div
        ref={menuRef}
        className="ctx-menu"
        style={{ left: pos.x, top: pos.y }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

/** ⌘ on Mac, Ctrl elsewhere — for shortcut hints in menu items. */
export const MOD_KEY = /mac/i.test(navigator.platform) ? '⌘' : 'Ctrl+'
