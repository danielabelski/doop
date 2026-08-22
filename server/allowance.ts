import { eq, sql } from 'drizzle-orm'
import { db } from './db/index.ts'
import { residentUsage } from './db/schema.ts'
import { oauthAccessToken } from './db/auth-schema.ts'

/**
 * Free-tier metering for the resident design team. Initiating team work — a
 * board card or an element comment that @mentions a resident — consumes one
 * of RESIDENT_TASK_LIMIT free tasks. A user who has connected their own MCP
 * agent (Claude Code, Codex — i.e. their own model subscription) is
 * unmetered, and that also re-opens the resident team for them. Feedback
 * replies and retries on existing work never count: iteration stays free.
 */

export const RESIDENT_TASK_LIMIT = Math.max(0, Number(process.env.RESIDENT_TASK_LIMIT ?? 5))

export interface Allowance {
  used: number
  limit: number
  /** the user has completed the MCP OAuth flow with their own agent */
  connected: boolean
}

/** An OAuth access token ever issued to this user = an agent of their own
 *  completed the connect flow. Expired rows still count — the point is proof
 *  they can connect, not a live session. */
async function hasOwnAgent(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: oauthAccessToken.id })
    .from(oauthAccessToken)
    .where(eq(oauthAccessToken.userId, userId))
    .limit(1)
  return !!row
}

async function usedCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ used: residentUsage.used })
    .from(residentUsage)
    .where(eq(residentUsage.userId, userId))
  return row?.used ?? 0
}

export async function getAllowance(userId: string): Promise<Allowance> {
  const [connected, used] = await Promise.all([hasOwnAgent(userId), usedCount(userId)])
  return { used, limit: RESIDENT_TASK_LIMIT, connected }
}

/** Spend one resident task. ok:false = the free tier is used up and the user
 *  has not connected an agent of their own. */
export async function consumeResidentTask(userId: string): Promise<Allowance & { ok: boolean }> {
  const current = await getAllowance(userId)
  if (current.connected) return { ...current, ok: true }
  if (current.used >= current.limit) return { ...current, ok: false }
  /* guarded upsert: concurrent requests can never push `used` past the limit */
  const rows = await db
    .insert(residentUsage)
    .values({ userId, used: 1, updatedAt: Date.now() })
    .onConflictDoUpdate({
      target: residentUsage.userId,
      set: { used: sql`${residentUsage.used} + 1`, updatedAt: Date.now() },
      setWhere: sql`${residentUsage.used} < ${RESIDENT_TASK_LIMIT}`,
    })
    .returning({ used: residentUsage.used })
  const applied = rows[0]
  if (!applied) return { ...current, used: current.limit, ok: false }
  return { used: applied.used, limit: RESIDENT_TASK_LIMIT, connected: false, ok: true }
}
