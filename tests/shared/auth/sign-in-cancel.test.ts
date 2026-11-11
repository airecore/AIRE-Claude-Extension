import { describe, expect, it } from 'vitest'
import { isUserCancel } from '../../../src/shared/auth/clerk-auth-adapter'

describe('isUserCancel', () => {
  it("recognises Chrome's message for a closed sign-in window, which isn't a defect", () => {
    expect(isUserCancel(new Error('The user did not approve access.'))).toBe(true)
  })

  it('treats anything else as a real failure', () => {
    expect(isUserCancel(new Error('Authorization page could not be loaded.'))).toBe(false)
    expect(isUserCancel('network down')).toBe(false)
  })
})
