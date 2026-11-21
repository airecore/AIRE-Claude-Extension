export interface UsageMeter {
  label: string
  percent: number
  severity: string
  resetsAt: string | null
  /** Set when this meter exists but claude.ai has turned it off (e.g. out of
   * credits) — a friendly explanation to show instead of a percentage. Null
   * for a normal, active meter. */
  disabledReason: string | null
  /** Which reported figure this is, for the admin dashboard. Unset for a
   * meter that is only shown (ChatGPT's per-feature counts). */
  key?: 'session' | 'weekly' | 'spend'
  /** A count instead of a percentage: ChatGPT says "4 left", not "60% used". */
  remaining?: number
  /** The site's own reset wording when it gives no timestamp (Gemini:
   * "Resets at 1:04 PM"). Shown instead of a computed "resets in 3h". */
  resetText?: string
}

export interface UsageSnapshot {
  meters: UsageMeter[]
}

const LIMIT_LABELS: Record<string, string> = {
  session: 'Session',
  weekly_all: 'Weekly',
}

const DISABLED_REASON_LABELS: Record<string, string> = {
  out_of_credits: 'Out of credits',
}

function friendlyDisabledReason(reason: string): string {
  return DISABLED_REASON_LABELS[reason] ?? reason.replace(/_/g, ' ')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseLimitEntry(entry: unknown): UsageMeter | null {
  if (!isRecord(entry)) return null
  const kind = entry.kind
  const percent = entry.percent
  const severity = entry.severity
  if (typeof kind !== 'string' || typeof percent !== 'number' || typeof severity !== 'string') return null
  const resetsAt = typeof entry.resets_at === 'string' ? entry.resets_at : null
  const key = kind === 'session' ? 'session' : kind === 'weekly_all' ? 'weekly' : undefined
  return { label: limitLabel(kind, entry.scope), percent, severity, resetsAt, disabledReason: null, key }
}

/** Known kinds get a fixed label; a model-scoped limit (e.g. `weekly_scoped`)
 * is named after its model; anything else is humanized, never shown raw. */
function limitLabel(kind: string, scope: unknown): string {
  if (LIMIT_LABELS[kind]) return LIMIT_LABELS[kind]
  const model = isRecord(scope) && isRecord(scope.model) ? scope.model.display_name : null
  if (typeof model === 'string' && model) return kind.startsWith('weekly') ? `Weekly · ${model}` : model
  const words = kind.replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function parseSpendMeter(spend: unknown): UsageMeter | null {
  if (!isRecord(spend)) return null
  const percent = spend.percent
  const severity = spend.severity
  if (typeof percent !== 'number' || typeof severity !== 'string') return null

  if (spend.enabled === true) {
    return { label: 'Extra usage', percent, severity, resetsAt: null, disabledReason: null, key: 'spend' }
  }

  const disabledReason = typeof spend.disabled_reason === 'string' ? spend.disabled_reason : null
  if (!disabledReason) return null
  return { label: 'Extra usage', percent, severity, resetsAt: null, disabledReason: friendlyDisabledReason(disabledReason), key: 'spend' }
}

export function formatResetLabel(resetsAt: string | null, nowMs: number): string | null {
  if (resetsAt === null) return null
  const resetMs = Date.parse(resetsAt)
  if (Number.isNaN(resetMs)) return null

  const diffMs = resetMs - nowMs
  if (diffMs < 60_000) return 'resets soon'

  const diffMinutes = Math.floor(diffMs / 60_000)
  if (diffMinutes < 60) return `resets in ${diffMinutes}m`

  const diffHours = Math.floor(diffMs / 3_600_000)
  if (diffHours < 24) return `resets in ${diffHours}h`

  const diffDays = Math.floor(diffMs / 86_400_000)
  return `resets in ${diffDays}d`
}

export function parseUsageResponse(raw: unknown): UsageSnapshot {
  if (!isRecord(raw)) return { meters: [] }

  const meters: UsageMeter[] = []

  if (Array.isArray(raw.limits)) {
    for (const entry of raw.limits) {
      const meter = parseLimitEntry(entry)
      if (meter) meters.push(meter)
    }
  }

  const spendMeter = parseSpendMeter(raw.spend)
  if (spendMeter) meters.push(spendMeter)

  return { meters }
}

/** Severity from a percentage, for sites that only give the number. */
export function severityFor(percent: number): string {
  if (percent >= 90) return 'critical'
  if (percent >= 70) return 'warning'
  return 'normal'
}

const CHATGPT_FEATURES: Record<string, string> = {
  deep_research: 'Deep research',
  image_gen: 'Images',
  reason: 'Thinking',
  file_upload: 'File uploads',
}

/** ChatGPT's `limits_progress` (from /backend-api/conversation/init):
 * uses left per feature and when each resets. Unknown and internal
 * features are skipped. */
export function parseChatGptLimits(raw: unknown): UsageSnapshot {
  if (!isRecord(raw) || !Array.isArray(raw.limits_progress)) return { meters: [] }
  const meters: UsageMeter[] = []
  for (const entry of raw.limits_progress) {
    if (!isRecord(entry)) continue
    const label = typeof entry.feature_name === 'string' ? CHATGPT_FEATURES[entry.feature_name] : undefined
    if (!label || typeof entry.remaining !== 'number') continue
    meters.push({
      label,
      percent: 0,
      severity: entry.remaining === 0 ? 'critical' : entry.remaining <= 2 ? 'warning' : 'normal',
      resetsAt: typeof entry.reset_after === 'string' ? entry.reset_after : null,
      disabledReason: null,
      remaining: entry.remaining,
    })
  }
  return { meters }
}

/** One window from Gemini's Usage page, as its text reads:
 * "Current usage | 0% used | Resets at 1:04 PM". */
export function parseGeminiUsageItem(text: string): UsageMeter | null {
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean)
  const used = text.match(/(\d+(?:\.\d+)?)\s*% used/i)
  if (lines.length === 0 || !used) return null
  const name = lines[0]
  const weekly = /week/i.test(name)
  const percent = Number(used[1])
  const reset = lines.find((line) => /^resets?(\s|$)/i.test(line))
  return {
    label: weekly ? 'Weekly' : /current|session|daily/i.test(name) ? 'Current' : name,
    percent,
    severity: severityFor(percent),
    resetsAt: null,
    disabledReason: null,
    key: weekly ? 'weekly' : /current|session|daily/i.test(name) ? 'session' : undefined,
    resetText: reset ? reset.charAt(0).toLowerCase() + reset.slice(1) : undefined,
  }
}
