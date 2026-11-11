import type { VercelRequest, VercelResponse } from '@vercel/node'
import { neon } from '@neondatabase/serverless'
import { withRateLimit } from '../lib/with-rate-limit.js'
import { buildFeedbackIssue, errorFingerprint, isDashboardKeyValid, parseQaEventBatch, QA_EVENT_CATALOGUE, type DiagnosticLine, type FeedbackCategory } from '../lib/qa.js'
import { checkGithubIssues, DEFAULT_FEEDBACK_REPO, openGithubIssue, withMissingIssues } from '../lib/github-issue.js'

const sql = neon(process.env.DATABASE_URL ?? '')

// GET /api/qa-dashboard?days=14
// Authorization: Bearer <QA_DASHBOARD_KEY>
//
// Read side of tester QA logging, used by public/qa.html. Protected by a
// shared key (a Vercel environment variable) rather than Clerk sign-in so
// the page works in any browser, phone included, with no extension. The
// per-IP rate limit (checked before the key) makes guessing the key
// impractical.
//
// 200 -> { days, github, defects, feedback, usage, notExercised, testers, daily }
// 401 -> missing or wrong key
// 503 -> QA_DASHBOARD_KEY not configured
//
// POST /api/qa-dashboard  { action: 'retry-issues' }   (same key)
// Opens GitHub issues for recent feedback that doesn't have one (GitHub
// was misconfigured or down when it was sent), and reports GitHub's exact
// answer for each, so a failing token is diagnosable from the dashboard.
// 200 -> { results: [ { id, issueUrl } | { id, error } ] }

const RETRY_LIMIT = 20

// POST /api/qa-dashboard  { action: 'import-events', events: [...] }  (same key)
// Records events from the automated feature tour (e2e/feature-tour.spec.ts),
// which drives the real extension in Chromium but can't sign in for real.
// Always filed under this tester and with "(automated tour)" on the
// browser, so they're never mistaken for a real person's testing.
const AUTOMATED_TESTER = 'automated-tour'

async function importEvents(body: unknown, res: VercelResponse): Promise<void> {
  const batch = parseQaEventBatch(body)
  if (!batch) {
    res.status(400).json({ error: 'body must include events: [...]' })
    return
  }
  if (batch.events.length > 0) {
    await sql.transaction(
      batch.events.map(
        (e) => sql`
          INSERT INTO qa_events (email, kind, name, source, occurred_at, version, browser, props, message, stack, fingerprint)
          VALUES (
            ${AUTOMATED_TESTER}, ${e.kind}, ${e.name}, ${e.source}, ${e.at.toISOString()}, ${e.version},
            ${`${e.browser} (automated tour)`.slice(0, 80)}, ${JSON.stringify(e.props)}::jsonb, ${e.message}, ${e.stack},
            ${e.kind === 'error' ? errorFingerprint(e) : null}
          )
        `,
      ),
    )
  }
  res.status(200).json({ imported: batch.events.length, dropped: batch.dropped })
}

async function retryIssues(res: VercelResponse): Promise<void> {
  const rows = (await sql`
    SELECT id, category, description, diagnostics, version, browser
    FROM qa_feedback
    WHERE github_issue_url IS NULL AND created_at > now() - interval '30 days'
    ORDER BY created_at ASC
    LIMIT ${RETRY_LIMIT}
  `) as { id: string; category: FeedbackCategory; description: string; diagnostics: DiagnosticLine[] | null; version: string; browser: string }[]

  const token = process.env.QA_GITHUB_TOKEN ?? ''
  const repo = process.env.QA_GITHUB_REPO || DEFAULT_FEEDBACK_REPO
  const results: ({ id: string; issueUrl: string } | { id: string; error: string })[] = []
  for (const row of rows) {
    const issue = buildFeedbackIssue(
      row.id,
      { category: row.category, description: row.description, attachDiagnostics: row.diagnostics !== null, version: row.version, browser: row.browser },
      row.diagnostics,
    )
    const opened = await openGithubIssue(issue, token, repo)
    if ('url' in opened) {
      await sql`UPDATE qa_feedback SET github_issue_url = ${opened.url} WHERE id = ${row.id}`
      results.push({ id: row.id, issueUrl: opened.url })
    } else {
      results.push({ id: row.id, error: opened.error })
      // Same cause for the rest -- don't hammer GitHub with it.
      break
    }
  }
  res.status(200).json({ results })
}

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }

  const configuredKey = process.env.QA_DASHBOARD_KEY ?? ''
  if (!configuredKey) {
    res.status(503).json({ error: 'QA_DASHBOARD_KEY is not configured on the server' })
    return
  }
  if (!isDashboardKeyValid(req.headers.authorization, configuredKey)) {
    res.status(401).json({ error: 'invalid dashboard key' })
    return
  }

  if (req.method === 'POST') {
    const action = (req.body as { action?: unknown } | undefined)?.action
    if (action !== 'retry-issues' && action !== 'import-events') {
      res.status(400).json({ error: 'unknown action' })
      return
    }
    try {
      if (action === 'retry-issues') await retryIssues(res)
      else await importEvents(req.body, res)
    } catch (error) {
      console.error(`[qa-dashboard] ${action} failed`, error)
      res.status(500).json({ error: 'internal error' })
    }
    return
  }

  const requested = Number(Array.isArray(req.query.days) ? req.query.days[0] : req.query.days)
  const days = Number.isInteger(requested) && requested >= 1 && requested <= 90 ? requested : 14

  const githubCheck = checkGithubIssues(
    process.env.QA_GITHUB_TOKEN ?? '',
    process.env.QA_GITHUB_REPO || DEFAULT_FEEDBACK_REPO,
  )

  try {
    const [defects, feedback, usage, testers, daily] = (await sql.transaction([
      sql`
        SELECT fingerprint, source, name,
               (array_agg(message ORDER BY occurred_at DESC))[1] AS message,
               (array_agg(stack ORDER BY occurred_at DESC))[1] AS stack,
               (array_agg(version ORDER BY occurred_at DESC))[1] AS latest_version,
               count(*)::int AS occurrences,
               count(DISTINCT email)::int AS testers,
               min(occurred_at) AS first_seen,
               max(occurred_at) AS last_seen
        FROM qa_events
        WHERE kind = 'error' AND received_at > now() - make_interval(days => ${days})
        GROUP BY fingerprint, source, name
        ORDER BY max(occurred_at) DESC
        LIMIT 200
      `,
      sql`
        SELECT id, created_at, email, category, description, diagnostics, version, browser, github_issue_url
        FROM qa_feedback
        WHERE created_at > now() - make_interval(days => ${days})
        ORDER BY created_at DESC
        LIMIT 200
      `,
      sql`
        SELECT name, count(*)::int AS count, count(DISTINCT email)::int AS testers, max(occurred_at) AS last_seen
        FROM qa_events
        WHERE kind = 'event' AND received_at > now() - make_interval(days => ${days})
        GROUP BY name
        ORDER BY count(*) DESC
      `,
      sql`
        SELECT email,
               count(*) FILTER (WHERE kind = 'event')::int AS events,
               count(*) FILTER (WHERE kind = 'error')::int AS errors,
               max(occurred_at) AS last_seen,
               (array_agg(version ORDER BY occurred_at DESC))[1] AS latest_version,
               (array_agg(browser ORDER BY occurred_at DESC))[1] AS latest_browser
        FROM qa_events
        WHERE received_at > now() - make_interval(days => ${days})
        GROUP BY email
        ORDER BY max(occurred_at) DESC
      `,
      sql`
        SELECT to_char(date_trunc('day', occurred_at), 'YYYY-MM-DD') AS day,
               count(*) FILTER (WHERE kind = 'event')::int AS events,
               count(*) FILTER (WHERE kind = 'error')::int AS errors
        FROM qa_events
        WHERE received_at > now() - make_interval(days => ${days})
        GROUP BY 1
        ORDER BY 1
      `,
    ])) as unknown as [
      Record<string, unknown>[],
      Record<string, unknown>[],
      { name: string; count: number; testers: number; last_seen: string }[],
      Record<string, unknown>[],
      Record<string, unknown>[],
    ]

    const seen = new Set(usage.map((u) => u.name))
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({
      days,
      github: withMissingIssues(await githubCheck, feedback.filter((f) => !f.github_issue_url).length),
      defects: defects.map((d) => ({
        fingerprint: d.fingerprint,
        source: d.source,
        name: d.name,
        message: d.message,
        stack: d.stack,
        latestVersion: d.latest_version,
        occurrences: d.occurrences,
        testers: d.testers,
        firstSeen: d.first_seen,
        lastSeen: d.last_seen,
      })),
      feedback: feedback.map((f) => ({
        id: f.id,
        createdAt: f.created_at,
        email: f.email,
        category: f.category,
        description: f.description,
        diagnostics: f.diagnostics,
        version: f.version,
        browser: f.browser,
        issueUrl: f.github_issue_url,
      })),
      usage: usage.map((u) => ({ name: u.name, count: u.count, testers: u.testers, lastSeen: u.last_seen })),
      notExercised: QA_EVENT_CATALOGUE.filter((name) => !seen.has(name)),
      testers: testers.map((t) => ({
        email: t.email,
        events: t.events,
        errors: t.errors,
        lastSeen: t.last_seen,
        latestVersion: t.latest_version,
        latestBrowser: t.latest_browser,
      })),
      daily: daily.map((d) => ({ day: d.day, events: d.events, errors: d.errors })),
    })
  } catch (error) {
    console.error('[qa-dashboard] database query failed', error)
    res.status(500).json({ error: 'internal error' })
  }
}

export default withRateLimit(sql, 'qa-dashboard', 30, 60)(handler)
