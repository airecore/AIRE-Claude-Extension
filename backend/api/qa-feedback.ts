import type { VercelRequest, VercelResponse } from '@vercel/node'
import { neon } from '@neondatabase/serverless'
import { resolveEmail } from '../lib/resolve-email.js'
import { checkRateLimit } from '../lib/rate-limit.js'
import { buildFeedbackIssue, parseQaFeedback, type DiagnosticLine } from '../lib/qa.js'
import { createGithubIssue, DEFAULT_FEEDBACK_REPO } from '../lib/github-issue.js'

const sql = neon(process.env.DATABASE_URL ?? '')

// POST /api/qa-feedback   (any signed-in tester)
// Body: { category: 'bug'|'suggestion'|'other', description, attachDiagnostics?, version, browser }
//
// Saves the report, then (if QA_GITHUB_TOKEN is set) opens a GitHub issue
// for it. With attachDiagnostics, the tester's own last 40 events from the
// past 24 hours are attached -- read from qa_events by their verified
// email, so a tester can only ever attach their own activity.
//
// 201 -> { id, issueUrl: string | null }
// 400 -> invalid body

const DIAGNOSTIC_EVENTS = 40

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }

  const email = await resolveEmail(req.headers.authorization)
  if (!email) {
    res.status(401).json({ error: 'invalid token' })
    return
  }

  const limit = await checkRateLimit(sql, `qa-feedback:${email.toLowerCase()}`, 10, 60 * 60)
  if (!limit.ok) {
    res.setHeader('Retry-After', String(limit.retryAfter))
    res.status(429).json({ error: 'too many requests' })
    return
  }

  const feedback = parseQaFeedback(req.body)
  if ('error' in feedback) {
    res.status(400).json({ error: feedback.error })
    return
  }

  const owner = email.toLowerCase()
  let id: string
  let diagnostics: DiagnosticLine[] | null = null
  try {
    if (feedback.attachDiagnostics) {
      const rows = (await sql`
        SELECT occurred_at, kind, name, source, message FROM qa_events
        WHERE email = ${owner} AND received_at > now() - interval '24 hours'
        ORDER BY occurred_at DESC
        LIMIT ${DIAGNOSTIC_EVENTS}
      `) as { occurred_at: string; kind: 'event' | 'error'; name: string; source: DiagnosticLine['source']; message: string | null }[]
      diagnostics = rows.reverse().map((r) => ({
        at: new Date(r.occurred_at).toISOString().replace('T', ' ').slice(0, 19),
        kind: r.kind,
        name: r.name,
        source: r.source,
        message: r.message ? r.message.split('\n')[0].slice(0, 200) : null,
      }))
    }

    const inserted = (await sql`
      INSERT INTO qa_feedback (email, category, description, diagnostics, version, browser)
      VALUES (${owner}, ${feedback.category}, ${feedback.description},
              ${diagnostics ? JSON.stringify(diagnostics) : null}::jsonb, ${feedback.version}, ${feedback.browser})
      RETURNING id
    `) as { id: string }[]
    id = inserted[0].id
  } catch (error) {
    console.error('[qa-feedback] database query failed', error)
    res.status(500).json({ error: 'internal error' })
    return
  }

  const issueUrl = await createGithubIssue(
    buildFeedbackIssue(id, feedback, diagnostics),
    process.env.QA_GITHUB_TOKEN ?? '',
    process.env.QA_GITHUB_REPO || DEFAULT_FEEDBACK_REPO,
  )
  if (issueUrl) {
    try {
      await sql`UPDATE qa_feedback SET github_issue_url = ${issueUrl} WHERE id = ${id}`
    } catch (error) {
      // The issue exists and the report is saved; only the link is missing.
      console.error('[qa-feedback] failed to store issue link', error)
    }
  }

  res.status(201).json({ id, issueUrl })
}
