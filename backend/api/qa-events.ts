import type { VercelRequest, VercelResponse } from '@vercel/node'
import { neon } from '@neondatabase/serverless'
import { resolveEmail } from '../lib/resolve-email.js'
import { checkRateLimit } from '../lib/rate-limit.js'
import { errorFingerprint, parseQaEventBatch } from '../lib/qa.js'

const sql = neon(process.env.DATABASE_URL ?? '')

// POST /api/qa-events   { events: [ ... up to 50 ] }   (any signed-in tester)
//
// Usage events and defects from the tester build of the extension. The
// caller only needs a verified sign-in, not organisation membership:
// testers on public email domains each sit in their own organisation, and
// QA data spans all of them. Rows are keyed by the verified email; the
// extension can't claim anyone else's.
//
// 204 -> stored (malformed entries are skipped; see X-QA-Dropped)
// 400 -> body is not { events: [...] }

const RETENTION_DAYS = 90

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

  // The extension flushes at most once a minute in batches of up to 50;
  // this leaves room for bursts (sign-in, panel reopen) without letting
  // one tester flood the table.
  const limit = await checkRateLimit(sql, `qa-events:${email.toLowerCase()}`, 30, 60)
  if (!limit.ok) {
    res.setHeader('Retry-After', String(limit.retryAfter))
    res.status(429).json({ error: 'too many requests' })
    return
  }

  const batch = parseQaEventBatch(req.body)
  if (!batch) {
    res.status(400).json({ error: 'body must be { events: [...] }' })
    return
  }

  try {
    const owner = email.toLowerCase()
    if (batch.events.length > 0) {
      await sql.transaction(
        batch.events.map(
          (e) => sql`
            INSERT INTO qa_events (email, kind, name, source, occurred_at, version, browser, props, message, stack, fingerprint)
            VALUES (
              ${owner}, ${e.kind}, ${e.name}, ${e.source}, ${e.at.toISOString()}, ${e.version}, ${e.browser},
              ${JSON.stringify(e.props)}::jsonb, ${e.message}, ${e.stack},
              ${e.kind === 'error' ? errorFingerprint(e) : null}
            )
          `,
        ),
      )
    }

    // ~1% of writes prune rows past retention, so the table needs no cron.
    if (Math.random() < 0.01) {
      await sql`DELETE FROM qa_events WHERE received_at < now() - make_interval(days => ${RETENTION_DAYS})`
    }

    res.setHeader('X-QA-Dropped', String(batch.dropped))
    res.status(204).end()
  } catch (error) {
    console.error('[qa-events] database query failed', error)
    res.status(500).json({ error: 'internal error' })
  }
}
