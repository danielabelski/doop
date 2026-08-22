import { useEffect, useRef, useState } from 'react'
import { Home } from './pages/Home'
import { CanvasPage } from './pages/CanvasPage'
import { AuthPage } from './pages/AuthPage'
import { Landing } from './pages/Landing'
import { authClient } from './lib/auth'
import { setName } from './lib/identity'
import { posthog, syncReplayForUser } from './lib/posthog'

export function navigate(path: string) {
  history.pushState(null, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function App() {
  const [path, setPath] = useState(location.pathname)
  const { data: session, isPending } = authClient.useSession()
  const identifiedUserId = useRef<string | null>(null)

  useEffect(() => {
    const onPop = () => setPath(location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  /* The session is the auth boundary: this covers both successful login and
     restoring an existing session after a page refresh. */
  useEffect(() => {
    const user = session?.user
    if (!user) {
      if (identifiedUserId.current) {
        posthog.reset()
        identifiedUserId.current = null
      }
      return
    }

    if (identifiedUserId.current === user.id) return
    if (identifiedUserId.current) posthog.reset()
    posthog.identify(user.id, { email: user.email, name: user.name })
    syncReplayForUser(user.email)
    identifiedUserId.current = user.id
  }, [session?.user])

  /* the account name is the identity shown on cursors and in the feed */
  useEffect(() => {
    if (session?.user?.name) setName(session.user.name)
  }, [session?.user?.name])

  if (isPending) return <div className="auth-page" />
  if (!session) {
    /* an interrupted MCP OAuth authorize redirect must land on the sign-in
       form (its resume logic reads these params), never the marketing page */
    const params = new URLSearchParams(location.search)
    const oauthResume = (params.has('client_id') && params.has('response_type')) || params.has('redirect_to')
    /* share-link visitors (/c/…) go straight to sign-in so the deep link
       survives — the canvas renders right after the session appears */
    if (path.startsWith('/auth') || path.startsWith('/c/') || oauthResume) return <AuthPage />
    return <Landing />
  }

  const canvasMatch = path.match(/^\/c\/([^/]+)/)
  if (canvasMatch) return <CanvasPage canvasId={canvasMatch[1]} key={canvasMatch[1]} />
  return <Home />
}

/** The layered D: two stacked frames — the human's layer over the agent's —
 *  forming Doop's initial. (From the founder's sketch, identity round 7.) */
export function Logo({ className = 'logo' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden>
      <rect width="100" height="100" rx="20" fill="#1C1A15" />
      <path
        d="M37 31 H63 A10 10 0 0 1 73 41 V63 A10 10 0 0 1 63 73 H37 Z"
        fill="none"
        stroke="#E5533C"
        strokeWidth="6"
      />
      <path
        d="M28 22 H54 A10 10 0 0 1 64 32 V54 A10 10 0 0 1 54 64 H28 Z"
        fill="none"
        stroke="#F2EFE6"
        strokeWidth="6"
      />
    </svg>
  )
}
