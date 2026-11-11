import type { VercelRequest, VercelResponse } from '@vercel/node'
import { neon } from '@neondatabase/serverless'
import { resolveEmail } from '../lib/resolve-email.js'
import { resolveSessionState, type OrgMemberRecord } from '../lib/resolve-session.js'
import { isLastActiveDirector } from '../lib/last-director-guard.js'
import { resolveAnyMembership } from '../lib/resolve-membership.js'
import { withRateLimit } from '../lib/with-rate-limit.js'

const sql = neon(process.env.DATABASE_URL ?? '')

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }

  const email = await resolveEmail(req.headers.authorization)
  if (!email) {
    res.status(401).json({ error: 'invalid token' })
    return
  }

  // DELETE = "leave / withdraw from my current organisation". Drops the
  // caller's own membership row -- the one their session resolves to (see
  // resolve-membership.ts). Also how an invitee DECLINES an invite and how
  // a pending requester cancels. A member, invitee or requester can always leave;
  // the last active director cannot (they must promote someone first),
  // matching the guard on org-members remove/demote.
  if (req.method === 'DELETE') {
    try {
      const membership = await resolveAnyMembership(sql, email)
      if (!membership) {
        res.status(404).json({ error: 'not in an organisation' })
        return
      }

      if (membership.role === 'director' && membership.status === 'active') {
        const others = (await sql`
          SELECT count(*)::int AS count FROM org_members
          WHERE org_id = ${membership.orgId} AND role = 'director' AND status = 'active'
            AND lower(email) != lower(${email})
        `) as { count: number }[]
        if (isLastActiveDirector({ role: 'director', status: 'active' }, others[0]?.count ?? 0)) {
          res.status(400).json({ error: 'you are the last admin -- promote someone else first' })
          return
        }
      }

      await sql.transaction([
        sql`SELECT set_config('app.current_org_id', ${membership.orgId}, true)`,
        sql`DELETE FROM org_members WHERE org_id = ${membership.orgId} AND lower(email) = lower(${email})`,
        // Leaving takes your reported usage and per-prompt run counts with
        // you (the privacy policy promises this).
        sql`DELETE FROM usage_snapshots WHERE org_id = ${membership.orgId} AND lower(email) = lower(${email})`,
        sql`DELETE FROM org_prompt_usage WHERE org_id = ${membership.orgId} AND lower(email) = lower(${email})`,
      ])
      res.status(204).end()
    } catch (error) {
      console.error('[org-session] leave failed', error)
      res.status(500).json({ error: 'internal error' })
    }
    return
  }

  // POST { action: 'accept-invite' } -- the invitee says yes. Only flips
  // the caller's OWN `invited` row (their verified email), so nobody can
  // accept on someone else's behalf.
  const action = (req.body as { action?: unknown } | undefined)?.action
  if (action === 'accept-invite') {
    try {
      const membership = await resolveAnyMembership(sql, email)
      if (!membership || membership.status !== 'invited') {
        res.status(404).json({ error: 'no pending invite' })
        return
      }
      await sql.transaction([
        sql`SELECT set_config('app.current_org_id', ${membership.orgId}, true)`,
        sql`UPDATE org_members SET status = 'active' WHERE org_id = ${membership.orgId} AND lower(email) = lower(${email}) AND status = 'invited'`,
      ])
      const org = (await sql`SELECT name FROM organizations WHERE id = ${membership.orgId}`) as { name: string }[]
      res.status(200).json({ state: 'active', org: { id: membership.orgId, name: org[0]?.name ?? '' }, role: membership.role })
    } catch (error) {
      console.error('[org-session] accept invite failed', error)
      res.status(500).json({ error: 'internal error' })
    }
    return
  }

  try {
    // Any director can invite any email at any domain (by design --
    // cross-domain membership is supported), so this must rank an active
    // director row first: picking the newest row would let a director of
    // org X hijack the session of someone who already belongs to org Y,
    // and picking the oldest row of any role/status would show a director
    // someone ELSE's older, unrelated membership instead of the org they
    // actually manage.
    const membership = await resolveAnyMembership(sql, email)
    const existingMember: OrgMemberRecord | null = membership
      ? { orgId: membership.orgId, email, role: membership.role, status: membership.status }
      : null

    const resolution = resolveSessionState(existingMember)

    // No organisation: a personal account. Signing in never creates an
    // organisation or a join request on its own.
    if (resolution.state === 'none') {
      res.status(200).json({ state: 'none' })
      return
    }

    const orgRows = (await sql`SELECT name FROM organizations WHERE id = ${resolution.orgId}`) as { name: string }[]
    const org = { id: resolution.orgId, name: orgRows[0]?.name ?? '' }

    if (resolution.state === 'active') {
      res.status(200).json({ state: 'active', org, role: resolution.role })
      return
    }

    if (resolution.state === 'invited') {
      const inviter = (await sql`
        SELECT invited_by FROM org_members WHERE org_id = ${resolution.orgId} AND lower(email) = lower(${email})
      `) as { invited_by: string | null }[]
      res.status(200).json({ state: 'invited', org, invitedBy: inviter[0]?.invited_by ?? null })
      return
    }

    // A join request the caller chose to send (see org-onboarding.ts).
    res.status(200).json({ state: 'pending', org })
  } catch (error) {
    console.error('[org-session] database query failed', error)
    res.status(500).json({ error: 'internal error' })
  }
}

export default withRateLimit(sql, 'org-session', 60, 60)(handler)
