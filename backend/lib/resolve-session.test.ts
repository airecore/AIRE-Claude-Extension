import { describe, expect, it } from 'vitest'
import { resolveSessionState } from './resolve-session'

describe('resolveSessionState', () => {
  it('returns active with role for an existing active member', () => {
    const member = { orgId: 'org-1', email: 'alice@acme.com', role: 'director' as const, status: 'active' as const }
    expect(resolveSessionState(member)).toEqual({ state: 'active', orgId: 'org-1', role: 'director' })
  })

  it('returns pending for an existing join request', () => {
    const member = { orgId: 'org-1', email: 'bob@acme.com', role: 'member' as const, status: 'pending' as const }
    expect(resolveSessionState(member)).toEqual({ state: 'pending', orgId: 'org-1' })
  })

  it('returns invited for an admin-added row -- the person accepts, not the admin', () => {
    const member = { orgId: 'org-1', email: 'frank@outlook.com', role: 'member' as const, status: 'invited' as const }
    expect(resolveSessionState(member)).toEqual({ state: 'invited', orgId: 'org-1' })
  })

  it('returns none (a personal account) for anyone with no membership, whatever their email domain', () => {
    // Signing in alone never creates an organisation or a join request.
    expect(resolveSessionState(null)).toEqual({ state: 'none' })
  })
})
