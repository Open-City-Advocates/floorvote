import { hourKey } from './emailStats'
import { dbTsToEpoch } from '../../../shared/time'

// Pure decision logic for the email-health job: counters and state in, one
// verdict out. No I/O, so the thresholds are testable against the real
// 2026-09-23 outage (see emailHealth.test.ts).

export type HourStat = { hour: string; sent: number; failed: number; suppressed: number; lastError: string | null }
export type HealthState = { status: 'ok' | 'failing'; failingSince: string | null; lastAlertedAt: string | null; recoveredAt: string | null }
export type HealthDecision = 'trip' | 'remind' | 'recover' | 'none'

export const OK_STATE: HealthState = { status: 'ok', failingSince: null, lastAlertedAt: null, recoveredAt: null }

/** A lone failure is noise. Two, at half or more of attempts, is a provider problem. */
export const TRIP_MIN_FAILED = 2
/**
 * Recovery needs several successes, not one, and a failure rate of at most
 * RECOVER_MAX_FAILURE_RATE over the window. During the 2026-09-23 outage
 * Cloudflare still delivered to verified addresses, and the operator's is one,
 * so a single operator login would otherwise have declared it fixed.
 */
export const RECOVER_MIN_SENT = 3
/**
 * Recovery tolerates a few failures: one stray rate-limit error in a busy
 * tenant's daily digest must not pin it in `failing` forever. The
 * RECOVER_MIN_SENT minimum still blocks a lone operator login.
 */
export const RECOVER_MAX_FAILURE_RATE = 0.1
export const HEALTH_WINDOW_MS = 24 * 60 * 60 * 1000

export function windowStartHour(now: Date): string {
  return hourKey(new Date(now.getTime() - HEALTH_WINDOW_MS))
}

const sum = (rows: HourStat[], k: 'sent' | 'failed') => rows.reduce((n, r) => n + r[k], 0)

export function decideEmailHealth(now: Date, rows: HourStat[], state: HealthState): HealthDecision {
  const windowStart = windowStartHour(now)
  const inWindow = rows.filter(r => r.hour >= windowStart)

  if (state.status === 'ok') {
    // Only count failures after the last recovery, so the failures that caused
    // the previous alert can't immediately cause the next one.
    const recoveredHour = state.recoveredAt ? hourKey(new Date(dbTsToEpoch(state.recoveredAt))) : null
    const floor = recoveredHour && recoveredHour > windowStart ? recoveredHour : windowStart
    const counted = inWindow.filter(r => r.hour >= floor)
    const failed = sum(counted, 'failed')
    return failed >= TRIP_MIN_FAILED && failed >= sum(counted, 'sent') ? 'trip' : 'none'
  }

  const windowSent = sum(inWindow, 'sent')
  if (windowSent >= RECOVER_MIN_SENT && sum(inWindow, 'failed') <= windowSent * RECOVER_MAX_FAILURE_RATE) return 'recover'
  const alertedAt = state.lastAlertedAt ? dbTsToEpoch(state.lastAlertedAt) : null
  if (alertedAt === null || alertedAt <= now.getTime() - HEALTH_WINDOW_MS) return 'remind'
  return 'none'
}
