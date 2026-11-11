import { createHash, timingSafeEqual } from 'node:crypto'

// Shared logic for the tester QA logging routes (qa-events, qa-feedback,
// qa-dashboard). Pure functions only -- no database or network -- so all
// of it is unit-tested in qa.test.ts.
//
// Privacy rule for everything in here: the extension never sends prompt
// text, button contents or anything from a Claude conversation. The
// parsers below enforce a fixed shape and length caps so a buggy call site
// can't smuggle a large blob through either.

/**
 * Every usage event the extension can send. The QA dashboard lists any
 * that no tester has triggered yet ("not yet exercised"), so a feature
 * nobody tried is visible before sign-off. Keep in step with
 * `src/shared/qa/events.ts` -- tests/shared/qa-events.test.ts fails if the
 * two lists drift apart.
 */
export const QA_EVENT_CATALOGUE = [
  'panel_opened',
  'button_run',
  'button_sent',
  'button_created',
  'button_edited',
  'button_deleted',
  'buttons_reordered',
  'tab_created',
  'tab_renamed',
  'tab_deleted',
  'tabs_reordered',
  'default_tab_set',
  'sort_toggled',
  'settings_opened',
  'tools_exported',
  'tools_imported',
  'sign_in_started',
  'sign_in_succeeded',
  'sign_in_failed',
  'signed_out',
  'org_onboarding_submitted',
  'invite_accepted',
  'org_left',
  'manage_org_opened',
  'member_approved',
  'member_removed',
  'member_role_changed',
  'member_invited',
  'org_tab_created',
  'org_tab_renamed',
  'org_tab_deleted',
  'org_tabs_reordered',
  'org_prompt_created',
  'org_prompt_edited',
  'org_prompt_deleted',
  'team_prompt_run',
  'team_prompt_sent',
  'feedback_opened',
  'feedback_sent',
] as const

export type QaSource = 'sidepanel' | 'content' | 'background'
export type QaKind = 'event' | 'error'
export type FeedbackCategory = 'bug' | 'suggestion' | 'other'

export interface QaEvent {
  kind: QaKind
  name: string
  source: QaSource
  /** When it happened on the tester's machine. */
  at: Date
  version: string
  browser: string
  props: Record<string, string | number | boolean>
  message: string | null
  stack: string | null
}

export interface QaFeedback {
  category: FeedbackCategory
  description: string
  attachDiagnostics: boolean
  version: string
  browser: string
}

export const MAX_EVENTS_PER_BATCH = 50
export const MAX_DESCRIPTION_LENGTH = 4000
const MAX_PROPS = 12
const MAX_PROP_KEY = 40
const MAX_PROP_STRING = 200
const MAX_MESSAGE = 1000
const MAX_STACK = 4000
const NAME_PATTERN = /^[a-z0-9_.:-]{1,64}$/i
const SOURCES: readonly QaSource[] = ['sidepanel', 'content', 'background']
const CATEGORIES: readonly FeedbackCategory[] = ['bug', 'suggestion', 'other']
/** Events queued offline for longer than this are dropped as stale. */
const MAX_EVENT_AGE_MS = 14 * 24 * 60 * 60 * 1000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function shortString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed.slice(0, max)
}

function parseProps(raw: unknown): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {}
  if (!isRecord(raw)) return out
  for (const [key, value] of Object.entries(raw).slice(0, MAX_PROPS)) {
    if (!NAME_PATTERN.test(key) || key.length > MAX_PROP_KEY) continue
    if (typeof value === 'string') out[key] = value.slice(0, MAX_PROP_STRING)
    else if (typeof value === 'number' && Number.isFinite(value)) out[key] = value
    else if (typeof value === 'boolean') out[key] = value
  }
  return out
}

/** One event from the extension, or null if it is malformed. `now` is
 * injected for tests. Timestamps from the future (clock skew) or older
 * than 14 days are clamped to now / dropped respectively. */
export function parseQaEvent(raw: unknown, now: number = Date.now()): QaEvent | null {
  if (!isRecord(raw)) return null
  const kind = raw.kind === 'event' || raw.kind === 'error' ? raw.kind : null
  const name = typeof raw.name === 'string' && NAME_PATTERN.test(raw.name) ? raw.name : null
  const source = SOURCES.includes(raw.source as QaSource) ? (raw.source as QaSource) : null
  if (!kind || !name || !source) return null

  let at = typeof raw.at === 'number' && Number.isFinite(raw.at) ? raw.at : now
  if (at > now) at = now
  if (now - at > MAX_EVENT_AGE_MS) return null

  return {
    kind,
    name,
    source,
    at: new Date(at),
    version: shortString(raw.version, 40) ?? 'unknown',
    browser: shortString(raw.browser, 60) ?? 'unknown',
    props: parseProps(raw.props),
    message: kind === 'error' ? shortString(raw.message, MAX_MESSAGE) : null,
    stack: kind === 'error' ? shortString(raw.stack, MAX_STACK) : null,
  }
}

/** Parses a POST /api/qa-events body. Malformed entries are skipped, not
 * fatal -- one bad event must not lose the rest of a tester's batch. */
export function parseQaEventBatch(body: unknown, now: number = Date.now()): { events: QaEvent[]; dropped: number } | null {
  if (!isRecord(body) || !Array.isArray(body.events)) return null
  const raw = body.events.slice(0, MAX_EVENTS_PER_BATCH)
  const events: QaEvent[] = []
  for (const entry of raw) {
    const parsed = parseQaEvent(entry, now)
    if (parsed) events.push(parsed)
  }
  return { events, dropped: body.events.length - events.length }
}

export function parseQaFeedback(body: unknown): QaFeedback | { error: string } {
  if (!isRecord(body)) return { error: 'body must be an object' }
  if (!CATEGORIES.includes(body.category as FeedbackCategory)) {
    return { error: 'category must be bug, suggestion or other' }
  }
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  if (description.length === 0) return { error: 'description is required' }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return { error: `description must be at most ${MAX_DESCRIPTION_LENGTH} characters` }
  }
  return {
    category: body.category as FeedbackCategory,
    description,
    attachDiagnostics: body.attachDiagnostics === true,
    version: shortString(body.version, 40) ?? 'unknown',
    browser: shortString(body.browser, 60) ?? 'unknown',
  }
}

/** Strips the parts of an error message that vary between occurrences of
 * the same bug (ids, numbers, quoted values) so they group together. */
export function normaliseMessage(message: string): string {
  return message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<id>')
    .replace(/(["'`]).*?\1/g, '<str>')
    .replace(/\d+/g, '<n>')
    .trim()
}

/** First stack frame, minus what changes from build to build: the
 * extension origin, Vite's content hash in bundle names, line/column. */
export function topStackFrame(stack: string | null): string {
  if (!stack) return ''
  const frame = stack.split('\n').map((l) => l.trim()).find((l) => l.startsWith('at '))
  if (!frame) return ''
  return frame
    .replace(/chrome-extension:\/\/[a-p]{32}\//g, '')
    .replace(/-[A-Za-z0-9_-]{8}(?=\.js)/g, '')
    .replace(/:\d+(:\d+)?/g, '')
}

/** Groups errors: same source, name, normalised message and top frame =
 * same defect. */
export function errorFingerprint(event: Pick<QaEvent, 'source' | 'name' | 'message' | 'stack'>): string {
  const basis = [event.source, event.name, normaliseMessage(event.message ?? ''), topStackFrame(event.stack)].join('|')
  return createHash('sha1').update(basis).digest('hex').slice(0, 16)
}

/** Constant-time check of the dashboard key. False when no key is
 * configured, so an unset QA_DASHBOARD_KEY can never mean "open". */
export function isDashboardKeyValid(authorizationHeader: string | undefined, configuredKey: string): boolean {
  if (configuredKey.length === 0) return false
  if (typeof authorizationHeader !== 'string' || !authorizationHeader.startsWith('Bearer ')) return false
  const given = createHash('sha256').update(authorizationHeader.slice('Bearer '.length).trim()).digest()
  const expected = createHash('sha256').update(configuredKey).digest()
  return timingSafeEqual(given, expected)
}

/** Wraps untrusted text in a Markdown code fence that it cannot break out
 * of, so a tester's text can't @mention people, link-spam, or inject
 * formatting into the GitHub issue. */
export function fenced(text: string): string {
  const longestRun = Math.max(2, ...(text.match(/`+/g) ?? []).map((run) => run.length))
  const fence = '`'.repeat(longestRun + 1)
  return `${fence}text\n${text}\n${fence}`
}

export interface DiagnosticLine {
  at: string
  kind: QaKind
  name: string
  source: QaSource
  message: string | null
}

const CATEGORY_LABEL: Record<FeedbackCategory, string> = {
  bug: 'Bug',
  suggestion: 'Suggestion',
  other: 'Feedback',
}

/** Title and body for the GitHub issue a piece of feedback opens. Tester
 * emails are deliberately left out (the repository may be visible to
 * people who shouldn't see them); the QA dashboard shows who sent it. */
export function buildFeedbackIssue(
  feedbackId: string,
  feedback: QaFeedback,
  diagnostics: DiagnosticLine[] | null,
): { title: string; body: string; labels: string[] } {
  const firstLine = feedback.description.split('\n')[0].replace(/@/g, '(at)').replace(/\s+/g, ' ').trim()
  const summary = firstLine.length > 70 ? `${firstLine.slice(0, 67)}...` : firstLine
  const title = `[Tester ${CATEGORY_LABEL[feedback.category].toLowerCase()}] ${summary}`

  const lines = [
    `**Type:** ${CATEGORY_LABEL[feedback.category]}`,
    `**Extension version:** \`${feedback.version.replace(/`/g, '')}\``,
    `**Browser:** \`${feedback.browser.replace(/`/g, '')}\``,
    `**Feedback ID:** \`${feedbackId}\` (tester details are on the QA dashboard)`,
    '',
    '### What the tester wrote',
    '',
    fenced(feedback.description),
  ]

  if (diagnostics && diagnostics.length > 0) {
    const log = diagnostics
      .map((d) => `${d.at}  ${d.source.padEnd(10)} ${d.kind === 'error' ? 'ERROR ' : ''}${d.name}${d.message ? ` -- ${d.message}` : ''}`)
      .join('\n')
    lines.push('', `### Recent activity (last ${diagnostics.length} events, oldest first)`, '', fenced(log))
  } else if (feedback.attachDiagnostics) {
    lines.push('', '_Diagnostics were requested but no recent activity was recorded for this tester._')
  }

  lines.push('', '---', '_Opened automatically from the AIRE Extension tester build._')
  const labels = ['tester-feedback', feedback.category === 'bug' ? 'bug' : feedback.category === 'suggestion' ? 'enhancement' : 'question']
  return { title, body: lines.join('\n'), labels }
}
