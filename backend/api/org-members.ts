import type { VercelRequest, VercelResponse } from '@vercel/node'
import { neon } from '@neondatabase/serverless'
import { resolveEmail } from '../lib/resolve-email.js'
import { resolveDirectorContext } from '../lib/require-director.js'
import { isLastActiveDirector } from '../lib/last-director-guard.js'
import { withRateLimit } from '../lib/with-rate-limit.js'

const sql = neon(process.env.DATABASE_URL ?? '')

// GET  /api/org-members                                            (director-only)
//   -> { members: [ { email, role, status, createdAt } ] }
// POST /api/org-members  { action, email, role? }                  (director-only)
//   action: "add" | "approve" | "remove" | "set-role"             -> 204 | 400 | 404
//
// The per-action endpoints (org-members-add / -approve / -remove /
// -set-role) were folded in here to stay under Vercel's 12-function
// Hobby cap.

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }

  const callerEmail = await resolveEmail(req.headers.authorization)
  if (!callerEmail) {
    res.status(401).json({ error: 'invalid token' })
    return
  }

  try {
    const director = await resolveDirectorContext(sql, callerEmail)
    if (!director) {
      res.status(403).json({ error: 'not a director' })
      return
    }
    const orgId = director.orgId

    if (req.method === 'GET') {
      const results = await sql.transaction([
        sql`SELECT set_config('app.current_org_id', ${orgId}, true)`,
        sql`SELECT email, role, status, created_at FROM org_members WHERE org_id = ${orgId} ORDER BY created_at ASC`,
      ])
      const members = results[1] as { email: string; role: string; status: string; created_at: string }[]
      res.status(200).json({
        members: members.map((m) => ({
          email: m.email,
          role: m.role,
          status: m.status,
          createdAt: m.created_at,
        })),
      })
      return
    }

    const body = req.body as { action?: unknown; email?: unknown; role?: unknown }
    if (typeof body.email !== 'string' || body.email.trim().length === 0) {
      res.status(400).json({ error: 'email is required' })
      return
    }
    const targetEmail = body.email.trim()

    if (body.action === 'add') {
      // Added as `invited`: the PERSON accepts on their next sign-in, not
      // the director. A director must not be able to put a stranger into
      // their org on their own say-so (that would expose the stranger's
      // reported usage / run counts the moment they sign in) -- and since
      // the director also holds the Approve button, a director-approved
      // `pending` protected nobody. DO NOTHING on conflict so an existing
      // member is never disturbed or knocked back to invited.
      await sql.transaction([
        sql`SELECT set_config('app.current_org_id', ${orgId}, true)`,
        sql`
          INSERT INTO org_members (org_id, email, role, status, invited_by)
          VALUES (${orgId}, ${targetEmail.toLowerCase()}, 'member', 'invited', ${callerEmail})
          ON CONFLICT (org_id, lower(email)) DO NOTHING
        `,
      ])
      res.status(204).end()
      return
    }

    if (body.action === 'approve') {
      // Only a join REQUEST (`pending`, from a same-domain sign-in) is the
      // director's to approve. An `invited` row waits for the invitee.
      const results = await sql.transaction([
        sql`SELECT set_config('app.current_org_id', ${orgId}, true)`,
        sql`UPDATE org_members SET status = 'active' WHERE org_id = ${orgId} AND lower(email) = lower(${targetEmail}) AND status = 'pending' RETURNING id`,
      ])
      if ((results[1] as { id: string }[]).length === 0) {
        res.status(404).json({ error: 'member not found' })
        return
      }
      res.status(204).end()
      return
    }

    if (body.action === 'remove' || body.action === 'set-role') {
      if (body.action === 'set-role' && body.role !== 'director' && body.role !== 'member') {
        res.status(400).json({ error: 'role must be "director" or "member"' })
        return
      }

      const targetRows = (await sql`
        SELECT role, status FROM org_members WHERE org_id = ${orgId} AND lower(email) = lower(${targetEmail})
      `) as { role: 'director' | 'member'; status: 'pending' | 'active' | 'invited' }[]
      const target = targetRows[0]
      if (!target) {
        res.status(404).json({ error: 'member not found' })
        return
      }
      // set-role also activates, so it must not become a way around the
      // invitee's own acceptance.
      if (body.action === 'set-role' && target.status === 'invited') {
        res.status(400).json({ error: 'they have not accepted the invite yet' })
        return
      }

      const wouldDropADirector =
        (body.action === 'remove' && target.role === 'director' && target.status === 'active') ||
        (body.action === 'set-role' && body.role === 'member' && target.role === 'director')
      if (wouldDropADirector) {
        const otherRows = (await sql`
          SELECT count(*)::int AS count FROM org_members
          WHERE org_id = ${orgId} AND role = 'director' AND status = 'active' AND lower(email) != lower(${targetEmail})
        `) as { count: number }[]
        if (isLastActiveDirector(target, otherRows[0]?.count ?? 0)) {
          res.status(400).json({
            error: body.action === 'remove' ? 'cannot remove the last admin' : 'cannot demote the last admin',
          })
          return
        }
      }

      if (body.action === 'remove') {
        await sql.transaction([
          sql`SELECT set_config('app.current_org_id', ${orgId}, true)`,
          sql`DELETE FROM org_members WHERE org_id = ${orgId} AND lower(email) = lower(${targetEmail})`,
        ])
      } else {
        await sql.transaction([
          sql`SELECT set_config('app.current_org_id', ${orgId}, true)`,
          sql`UPDATE org_members SET role = ${body.role}, status = 'active' WHERE org_id = ${orgId} AND lower(email) = lower(${targetEmail})`,
        ])
      }
      res.status(204).end()
      return
    }

    res.status(400).json({ error: 'unknown action' })
  } catch (error) {
    console.error('[org-members] request failed', error)
    res.status(500).json({ error: 'internal error' })
  }
}

export default withRateLimit(sql, 'org-members', 60, 60)(handler)
