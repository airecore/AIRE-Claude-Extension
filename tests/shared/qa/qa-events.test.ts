import { describe, expect, it } from 'vitest'
import { QA_EVENTS } from '../../../src/shared/qa/events'
import { QA_EVENT_CATALOGUE } from '../../../backend/lib/qa'

describe('QA event catalogue', () => {
  it('matches the backend catalogue exactly, so the dashboard knows every event', () => {
    expect([...QA_EVENTS].sort()).toEqual([...QA_EVENT_CATALOGUE].sort())
  })

  it('uses names the backend accepts', () => {
    for (const name of QA_EVENTS) expect(name).toMatch(/^[a-z0-9_]{1,64}$/)
  })
})
