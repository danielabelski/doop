import { useState } from 'react'
import { authClient } from '../lib/auth'
import { setName } from '../lib/identity'
import { Logo } from '../App'
import { posthog } from '../lib/posthog'

/* If login interrupted an MCP OAuth authorize redirect, send the browser
   back into the flow so the agent connection completes. */
/* better-auth deliberately returns the same "invalid email or password" for
   unknown emails and wrong passwords; this tells the two apart so the login
   page can route would-be signups to the right form. */
async function accountExists(email: string): Promise<boolean> {
  try {
    const res = await fetch('/api/account-exists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    if (!res.ok) return true // unknown — fall back to the generic error
    return (await res.json()).exists
  } catch {
    return true
  }
}

function resumeOAuthFlow(): boolean {
  const params = new URLSearchParams(location.search)
  const target = params.get('redirect_to') || params.get('redirect_uri')
  if (target?.startsWith('/')) {
    location.href = target // relative only — never follow an absolute URL from a query param
    return true
  }
  if (params.has('client_id') && params.has('response_type')) {
    location.href = `/api/auth/mcp/authorize${location.search}`
    return true
  }
  return false
}

type AuthMode = 'signin' | 'signup' | 'forgot' | 'reset'

export function AuthPage() {
  /* better-auth lands password-reset links on /auth/reset?token=… */
  const resetToken = location.pathname === '/auth/reset' ? new URLSearchParams(location.search).get('token') : null
  const [mode, setMode] = useState<AuthMode>(resetToken ? 'reset' : 'signin')
  const [name, setNameField] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  /* informational state (not an error): "check your email" and friends */
  const [notice, setNotice] = useState<string | null>(null)
  /* signin failed on an unverified email — offer a resend */
  const [unverified, setUnverified] = useState(false)
  /* set when the error's real fix is the other mode: signin with an unknown
     email, or signup with an existing one */
  const [suggestMode, setSuggestMode] = useState<'signin' | 'signup' | null>(null)
  const [busy, setBusy] = useState(false)

  function switchMode(next: AuthMode) {
    setMode(next)
    setError(null)
    setNotice(null)
    setSuggestMode(null)
    setUnverified(false)
  }

  async function resendVerification() {
    setBusy(true)
    try {
      await authClient.sendVerificationEmail({ email, callbackURL: '/' })
      setError(null)
      setUnverified(false)
      setNotice('Verification email sent — check your inbox.')
    } finally {
      setBusy(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setSuggestMode(null)
    setUnverified(false)
    setBusy(true)
    try {
      if (mode === 'forgot') {
        await authClient.requestPasswordReset({ email, redirectTo: '/auth/reset' })
        /* same response either way — this must not confirm account existence */
        setNotice('If an account exists for that email, a reset link is on its way.')
        return
      }
      if (mode === 'reset') {
        const res = await authClient.resetPassword({ newPassword: password, token: resetToken ?? '' })
        if (res.error) {
          setError(res.error.message ?? 'This reset link is invalid or expired — request a new one.')
        } else {
          history.replaceState(null, '', '/auth')
          switchMode('signin')
          setNotice('Password updated — sign in with your new password.')
        }
        return
      }
      const res =
        mode === 'signup'
          ? await authClient.signUp.email({ name: name.trim() || email.split('@')[0], email, password })
          : await authClient.signIn.email({ email, password })
      if (res.error) {
        if (mode === 'signin' && res.error.code === 'EMAIL_NOT_VERIFIED') {
          setError('This email hasn’t been verified yet.')
          setUnverified(true)
        } else if (mode === 'signin' && !(await accountExists(email))) {
          setError('No account found for this email.')
          setSuggestMode('signup')
          posthog.capture('login_no_account_found')
        } else if (mode === 'signup' && res.error.code?.startsWith('USER_ALREADY_EXISTS')) {
          setError('An account with this email already exists.')
          setSuggestMode('signin')
        } else {
          setError(res.error.message ?? 'Something went wrong')
        }
      } else if (res.data?.user) {
        /* signup with verification required: the account exists but there is
           no session yet — better-auth returns a null token in that case */
        if (mode === 'signup' && !res.data.token) {
          posthog.capture('account_signed_up')
          setNotice(`Almost there — we sent a verification link to ${email}. Open it to activate your account.`)
          return
        }
        posthog.capture(mode === 'signup' ? 'account_signed_up' : 'account_signed_in')
        setName(res.data.user.name) // keep cursor/feed identity in sync with the account
        if (!resumeOAuthFlow() && mode === 'signup') {
          /* land new users on their auto-created first canvas, where the
             demo agent is waiting to perform */
          try {
            const canvases: { id: string; ownerId?: string }[] = await (await fetch('/api/canvases')).json()
            const own = canvases.find((c) => c.ownerId)
            if (own) location.href = `/c/${own.id}`
          } catch {
            /* fall through to the session-gated re-render */
          }
        }
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <div className="home-mark">
          <Logo /> Doop
        </div>
        <h1>
          {mode === 'signin' && 'Welcome back.'}
          {mode === 'signup' && 'Create your account.'}
          {mode === 'forgot' && 'Reset your password.'}
          {mode === 'reset' && 'Pick a new password.'}
        </h1>
        <p className="auth-sub">
          {mode === 'forgot' ? (
            <>Enter your account email and we&rsquo;ll send you a reset link.</>
          ) : mode === 'reset' ? (
            <>Choose a new password for your account.</>
          ) : (
            <>
              A shared canvas for humans <em>&amp; agents</em>. Sign{' '}
              {mode === 'signin' ? 'in to your canvases' : 'up to start designing'}.
            </>
          )}
        </p>
        {mode === 'signup' && (
          <label>
            Name
            <input
              value={name}
              onChange={(e) => setNameField(e.target.value)}
              placeholder="Kevin"
              autoComplete="name"
            />
          </label>
        )}
        {mode !== 'reset' && (
          <label>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>
        )}
        {mode !== 'forgot' && (
          <label>
            {mode === 'reset' ? 'New password' : 'Password'}
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signin' ? '••••••••' : 'At least 8 characters'}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />
          </label>
        )}
        {mode === 'signin' && (
          <button type="button" className="auth-forgot" onClick={() => switchMode('forgot')}>
            Forgot password?
          </button>
        )}
        {notice && <div className="auth-notice">{notice}</div>}
        {error && (
          <div className="auth-error">
            {error}
            {suggestMode && (
              <button type="button" className="auth-error-action" onClick={() => switchMode(suggestMode)}>
                {suggestMode === 'signup' ? 'Create an account instead →' : 'Sign in instead →'}
              </button>
            )}
            {unverified && (
              <button type="button" className="auth-error-action" onClick={resendVerification} disabled={busy}>
                Resend verification email →
              </button>
            )}
          </div>
        )}
        <button className="btn primary" type="submit" disabled={busy}>
          {busy
            ? '…'
            : mode === 'signin'
              ? 'Sign in'
              : mode === 'signup'
                ? 'Sign up'
                : mode === 'forgot'
                  ? 'Send reset link'
                  : 'Set new password'}
        </button>
        <button
          type="button"
          className="auth-switch"
          onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
        >
          {mode === 'signin' ? 'No account yet? Sign up' : 'Have an account? Sign in'}
        </button>
      </form>
    </div>
  )
}
