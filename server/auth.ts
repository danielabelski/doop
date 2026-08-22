import { betterAuth } from 'better-auth'
import { eq } from 'drizzle-orm'
import { mcp } from 'better-auth/plugins'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from './db/index.ts'
import * as authSchema from './db/auth-schema.ts'
import { store } from './store.ts'
import * as demo from './demo.ts'
import { mailerConfigured, sendMail } from './mailer.ts'

/**
 * better-auth on our own database: email/password + cookie sessions now;
 * the MCP OAuth plugin (agent identity) lands on top of this instance later.
 */

/** The canonical public origin: OAuth authorize/token/login URLs live here. */
export const PUBLIC_ORIGIN = process.env.BETTER_AUTH_URL || 'http://localhost:4300'

function buildAuth() {
  if (!process.env.BETTER_AUTH_SECRET && process.env.NODE_ENV === 'production') {
    throw new Error('BETTER_AUTH_SECRET must be set in production')
  }
  const prod = process.env.NODE_ENV === 'production'
  if (prod && !process.env.BETTER_AUTH_URL) {
    throw new Error('BETTER_AUTH_URL (the public origin, e.g. https://doop.app) must be set in production')
  }
  return betterAuth({
    /* the public origin — OAuth discovery/authorize/token URLs are built on
       it, so in dev it must be the web port that proxies /api and /mcp */
    baseURL: PUBLIC_ORIGIN,
    secret: process.env.BETTER_AUTH_SECRET || 'doop-dev-secret-not-for-production',
    /* prod: the public origin, plus any extras from env. dev: trust whichever
       origin the request came from (localhost, 127.0.0.1, LAN IP — all fine). */
    trustedOrigins: prod
      ? [PUBLIC_ORIGIN, ...(process.env.TRUSTED_ORIGINS || '').split(',').filter(Boolean)]
      : (request) => {
          const origin = request?.headers.get('origin')
          return origin ? [origin] : []
        },
    database: drizzleAdapter(db, { provider: 'pg', schema: authSchema }),
    /* Verification is enforced only when an SMTP mailer is configured —
       without one (dev, tiny self-hosts) signup stays open and every email
       is printed to the server log instead, links included. */
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: mailerConfigured,
      sendResetPassword: async ({ user, url }) => {
        await sendMail({
          to: user.email,
          subject: 'Reset your doop password',
          text: `Hi ${user.name || 'there'},\n\nSomeone asked to reset the password for this doop account. If that was you, open this link (valid for 1 hour):\n\n${url}\n\nIf it wasn't you, ignore this email — nothing changes.`,
        })
      },
    },
    emailVerification: {
      sendOnSignUp: mailerConfigured,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendMail({
          to: user.email,
          subject: 'Verify your doop email',
          text: `Hi ${user.name || 'there'},\n\nConfirm this email address to activate your doop account:\n\n${url}\n\nIf you didn't sign up for doop, ignore this email.`,
        })
      },
    },
    /* onboarding: every new user gets a canvas, and the demo agent performs
       on it the first time they arrive (see server/demo.ts) */
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            const first = (user.name || 'Your').split(/\s+/)[0]
            const canvas = store.createCanvas(`${first}'s first canvas`, user.id)
            demo.markPending(canvas.id)
          },
        },
      },
    },
    /* OAuth provider for MCP clients: agents connect to /mcp with a bearer
       token their human approved in the browser. The SPA login gate lives
       at every path, so "/" works as the login page. */
    plugins: [mcp({ loginPage: '/' })],
  })
}

export let auth: ReturnType<typeof buildAuth>

/** Must run after initDb() — the drizzle adapter captures the live db. */
export function initAuth() {
  auth = buildAuth()
}

/* userId -> display name, cached briefly: looked up on every authed MCP
   call, and a short TTL means account renames show up within a minute */
const userNames = new Map<string, { name: string; at: number }>()
const NAME_TTL_MS = 60_000

export async function getUserName(userId: string): Promise<string | undefined> {
  const cached = userNames.get(userId)
  if (cached && Date.now() - cached.at < NAME_TTL_MS) return cached.name
  const [row] = await db
    .select({ name: authSchema.user.name })
    .from(authSchema.user)
    .where(eq(authSchema.user.id, userId))
  if (row?.name) userNames.set(userId, { name: row.name, at: Date.now() })
  return row?.name
}
