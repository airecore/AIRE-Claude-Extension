export interface OrgMemberRecord {
  orgId: string
  email: string
  role: 'director' | 'member'
  status: 'pending' | 'active' | 'invited'
}

export type SessionResolution =
  | { state: 'active'; orgId: string; role: 'director' | 'member' }
  | { state: 'pending'; orgId: string }
  | { state: 'invited'; orgId: string }
  | { state: 'none' }

/**
 * Where the caller stands, from their own membership row alone.
 *
 * Signing in never puts anyone into an organisation or a join queue: with
 * no row, the caller simply has a personal account ('none'). They get into
 * an organisation only by accepting an admin's invite, or by choosing to
 * create one (POST /api/org-onboarding, which sends a join request instead
 * if their company domain already has an organisation).
 */
export function resolveSessionState(existingMember: OrgMemberRecord | null): SessionResolution {
  if (!existingMember) return { state: 'none' }
  if (existingMember.status === 'active') {
    return { state: 'active', orgId: existingMember.orgId, role: existingMember.role }
  }
  // An admin added them; nothing is shared until they accept.
  if (existingMember.status === 'invited') return { state: 'invited', orgId: existingMember.orgId }
  return { state: 'pending', orgId: existingMember.orgId }
}
