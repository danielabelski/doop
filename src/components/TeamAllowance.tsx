import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'
import { posthog } from '../lib/posthog'
import { ConnectBody, AgentArrival } from './ConnectModal'

/**
 * Free-tier metering UI for the resident team: the shared allowance hook,
 * the "n free team tasks left" line, and the wall that appears when they're
 * gone. Server-enforced; this is only the mirror of /api/agent-allowance.
 */

export interface Allowance {
  used: number
  limit: number
  connected: boolean
}

export function useAllowance(): { allowance: Allowance | null; refresh: () => void } {
  const [allowance, setAllowance] = useState<Allowance | null>(null)
  const refresh = useCallback(() => {
    api.agentAllowance().then(setAllowance, () => {})
  }, [])
  useEffect(refresh, [refresh])
  return { allowance, refresh }
}

/** True when this failure is the free tier running out (shows the wall). */
export function isResidentLimit(err: unknown): boolean {
  return err instanceof ApiError && err.status === 403 && err.body.error === 'resident_limit'
}

export function MeterLine({ allowance }: { allowance: Allowance | null }) {
  if (!allowance || allowance.connected || allowance.limit <= 0) return null
  const left = Math.max(0, allowance.limit - allowance.used)
  return (
    <span className={`meter-line${left === 0 ? ' out' : ''}`}>
      {left === 0
        ? 'free Doop Agent tasks used up — connect your own agent'
        : `${left} of ${allowance.limit} free Doop Agent task${allowance.limit === 1 ? '' : 's'} left`}
    </span>
  )
}

export function LimitWall({ canvasId, onClose }: { canvasId: string; onClose: () => void }) {
  useEffect(() => {
    posthog.capture('resident_limit_hit')
  }, [])
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Your free Doop Agent tasks are used up</h2>
        <p className="lede">
          The Doop Agent's first designs were on the house. To keep designing, connect your own agent —{' '}
          <b>Claude Code</b> or <b>Codex</b> takes a minute and runs on your existing subscription, with no limits here.
          Once it arrives, the Doop Agent unlocks again too.
        </p>
        <ConnectBody canvasId={canvasId} />
        <div className="close-row">
          <AgentArrival />
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
