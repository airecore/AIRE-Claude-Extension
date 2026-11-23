import { API_BASE_URL } from './org-prompts'
import type { UsageSnapshot } from './usage'

export interface UsageReportBody {
  /** Which chat site these figures are from: 'claude', 'gemini', ... */
  site: string
  sessionPercent: number | null
  weeklyPercent: number | null
  spendPercent: number | null
}

// claude.ai reports fractional percentages, but usage_snapshots' percent
// columns are `integer` -- sending a fractional value would make Postgres
// reject the insert and the whole report would fail. Round here, matching
// what the content-script usage widget already does for display.
function toIntegerPercent(percent: number | undefined): number | null {
  if (typeof percent !== 'number' || !Number.isFinite(percent)) return null
  return Math.round(percent)
}

export function usageSnapshotToReportBody(snapshot: UsageSnapshot, site = 'claude'): UsageReportBody {
  const session = snapshot.meters.find((m) => m.key === 'session')
  const weekly = snapshot.meters.find((m) => m.key === 'weekly')
  const spend = snapshot.meters.find((m) => m.key === 'spend')
  return {
    site,
    sessionPercent: toIntegerPercent(session?.percent),
    weeklyPercent: toIntegerPercent(weekly?.percent),
    spendPercent: toIntegerPercent(spend?.percent),
  }
}

/** False without sending when the site gives no percentages (ChatGPT's
 * counts are shown on the page but have nothing to report). */
export async function reportUsage(idToken: string, snapshot: UsageSnapshot, site = 'claude'): Promise<boolean> {
  const body = usageSnapshotToReportBody(snapshot, site)
  if (body.sessionPercent === null && body.weeklyPercent === null && body.spendPercent === null) return false
  try {
    const response = await fetch(`${API_BASE_URL}/api/usage-report`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return response.ok
  } catch (error) {
    console.warn('[Claude Tools] usage report not sent (offline?)', error)
    return false
  }
}

export interface OrgUsageSnapshot {
  email: string
  site: string
  sessionPercent: number | null
  weeklyPercent: number | null
  spendPercent: number | null
  updatedAt: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isPercentOrNull(value: unknown): value is number | null {
  return value === null || typeof value === 'number'
}

function parseSnapshot(entry: unknown): OrgUsageSnapshot | null {
  if (!isRecord(entry)) return null
  const email = entry.email
  const sessionPercent = entry.sessionPercent
  const weeklyPercent = entry.weeklyPercent
  const spendPercent = entry.spendPercent
  const updatedAt = entry.updatedAt
  // Snapshots from before sites were tracked are all Claude.
  const site = typeof entry.site === 'string' ? entry.site : 'claude'
  if (typeof email !== 'string' || typeof updatedAt !== 'string') return null
  if (!isPercentOrNull(sessionPercent) || !isPercentOrNull(weeklyPercent) || !isPercentOrNull(spendPercent)) {
    return null
  }
  return { email, site, sessionPercent, weeklyPercent, spendPercent, updatedAt }
}

export function parseOrgUsageResponse(raw: unknown): OrgUsageSnapshot[] {
  if (!isRecord(raw) || !Array.isArray(raw.snapshots)) return []
  const snapshots: OrgUsageSnapshot[] = []
  for (const entry of raw.snapshots) {
    const snapshot = parseSnapshot(entry)
    if (snapshot) snapshots.push(snapshot)
  }
  return snapshots
}

export async function fetchOrgUsage(idToken: string): Promise<OrgUsageSnapshot[] | null> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/api/org-usage`, {
      headers: { Authorization: `Bearer ${idToken}` },
    })
  } catch (error) {
    console.warn('[Claude Tools] org usage not loaded (offline?)', error)
    return null
  }
  if (!response.ok) {
    console.error('[Claude Tools] org-usage endpoint returned status', response.status)
    return null
  }
  let body: unknown
  try {
    body = await response.json()
  } catch (error) {
    console.error('[Claude Tools] org-usage response was not valid JSON', error)
    return null
  }
  return parseOrgUsageResponse(body)
}
