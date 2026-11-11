import { API_BASE_URL } from '../api-base'
import { browserLabel, buildLabel } from './config'

export type FeedbackCategory = 'bug' | 'suggestion' | 'other'

export const MAX_FEEDBACK_LENGTH = 4000

export interface FeedbackInput {
  category: FeedbackCategory
  description: string
  /** Attach the tester's own recent activity and errors (never prompt text). */
  attachDiagnostics: boolean
}

export type FeedbackResult =
  | { ok: true; id: string; issueUrl: string | null }
  | { ok: false; error: string }

export function parseFeedbackResponse(raw: unknown): { id: string; issueUrl: string | null } | null {
  if (typeof raw !== 'object' || raw === null) return null
  const { id, issueUrl } = raw as Record<string, unknown>
  if (typeof id !== 'string') return null
  return { id, issueUrl: typeof issueUrl === 'string' && issueUrl.startsWith('https://github.com/') ? issueUrl : null }
}

export async function sendFeedback(token: string, input: FeedbackInput, fetchImpl: typeof fetch = fetch): Promise<FeedbackResult> {
  const description = input.description.trim()
  if (!description) return { ok: false, error: 'Describe what happened first.' }
  if (description.length > MAX_FEEDBACK_LENGTH) {
    return { ok: false, error: `Keep it under ${MAX_FEEDBACK_LENGTH} characters.` }
  }
  let response: Response
  try {
    response = await fetchImpl(`${API_BASE_URL}/api/qa-feedback`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: input.category,
        description,
        attachDiagnostics: input.attachDiagnostics,
        version: buildLabel(),
        browser: browserLabel(),
      }),
    })
  } catch {
    return { ok: false, error: "Couldn't reach the server. Check your connection and try again." }
  }
  if (response.status === 429) return { ok: false, error: "You've sent a lot of feedback recently. Try again in a while." }
  if (response.status === 401) return { ok: false, error: 'Please sign in again, then resend.' }
  if (!response.ok) return { ok: false, error: `Something went wrong sending feedback (error ${response.status}).` }
  const parsed = parseFeedbackResponse(await response.json().catch(() => null))
  return parsed ? { ok: true, ...parsed } : { ok: false, error: 'The server sent an unexpected reply.' }
}
