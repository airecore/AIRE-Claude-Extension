import { describe, expect, it } from 'vitest'
import {
  buildFeedbackIssue,
  errorFingerprint,
  fenced,
  isDashboardKeyValid,
  MAX_EVENTS_PER_BATCH,
  normaliseMessage,
  parseQaEvent,
  parseQaEventBatch,
  parseQaFeedback,
  topStackFrame,
} from './qa'

const NOW = Date.UTC(2026, 10, 11, 12, 0, 0)

const goodEvent = {
  kind: 'event',
  name: 'button_run',
  source: 'sidepanel',
  at: NOW - 1000,
  version: '1.0.0+abc1234',
  browser: 'Chrome 131',
  props: { type: 'prompt' },
}

describe('parseQaEvent', () => {
  it('accepts a well-formed usage event', () => {
    const parsed = parseQaEvent(goodEvent, NOW)
    expect(parsed).toMatchObject({ kind: 'event', name: 'button_run', source: 'sidepanel', props: { type: 'prompt' } })
    expect(parsed?.at.getTime()).toBe(NOW - 1000)
    expect(parsed?.message).toBeNull()
  })

  it('rejects unknown kinds, sources and bad names', () => {
    expect(parseQaEvent({ ...goodEvent, kind: 'other' }, NOW)).toBeNull()
    expect(parseQaEvent({ ...goodEvent, source: 'page' }, NOW)).toBeNull()
    expect(parseQaEvent({ ...goodEvent, name: 'has spaces' }, NOW)).toBeNull()
    expect(parseQaEvent({ ...goodEvent, name: 'x'.repeat(65) }, NOW)).toBeNull()
    expect(parseQaEvent('nope', NOW)).toBeNull()
  })

  it('clamps future timestamps and drops ones older than 14 days', () => {
    expect(parseQaEvent({ ...goodEvent, at: NOW + 60_000 }, NOW)?.at.getTime()).toBe(NOW)
    expect(parseQaEvent({ ...goodEvent, at: NOW - 15 * 24 * 3600_000 }, NOW)).toBeNull()
  })

  it('keeps only primitive props with valid keys, capped in number and length', () => {
    const props: Record<string, unknown> = { nested: { a: 1 }, 'bad key': 'x', long: 'y'.repeat(500), n: 3, b: true }
    for (let i = 0; i < 20; i++) props[`k${i}`] = i
    const parsed = parseQaEvent({ ...goodEvent, props }, NOW)!
    expect(parsed.props.nested).toBeUndefined()
    expect(parsed.props['bad key']).toBeUndefined()
    expect((parsed.props.long as string).length).toBe(200)
    expect(parsed.props.n).toBe(3)
    expect(parsed.props.b).toBe(true)
    expect(Object.keys(parsed.props).length).toBeLessThanOrEqual(12)
  })

  it('keeps message and stack only on errors, truncated', () => {
    const err = parseQaEvent({ ...goodEvent, kind: 'error', name: 'console_error', message: 'm'.repeat(2000), stack: 's'.repeat(9000) }, NOW)!
    expect(err.message?.length).toBe(1000)
    expect(err.stack?.length).toBe(4000)
    const ev = parseQaEvent({ ...goodEvent, message: 'should go' }, NOW)!
    expect(ev.message).toBeNull()
  })
})

describe('parseQaEventBatch', () => {
  it('skips malformed entries and reports how many were dropped', () => {
    const result = parseQaEventBatch({ events: [goodEvent, { kind: 'nope' }, goodEvent] }, NOW)!
    expect(result.events).toHaveLength(2)
    expect(result.dropped).toBe(1)
  })

  it('caps the batch size', () => {
    const result = parseQaEventBatch({ events: Array(MAX_EVENTS_PER_BATCH + 10).fill(goodEvent) }, NOW)!
    expect(result.events).toHaveLength(MAX_EVENTS_PER_BATCH)
    expect(result.dropped).toBe(10)
  })

  it('rejects a body without an events array', () => {
    expect(parseQaEventBatch({}, NOW)).toBeNull()
    expect(parseQaEventBatch(null, NOW)).toBeNull()
  })
})

describe('parseQaFeedback', () => {
  it('accepts valid feedback and trims the description', () => {
    expect(parseQaFeedback({ category: 'bug', description: '  broke  ', attachDiagnostics: true, version: '1', browser: 'C' })).toEqual({
      category: 'bug',
      description: 'broke',
      attachDiagnostics: true,
      version: '1',
      browser: 'C',
    })
  })

  it('rejects bad categories and empty or oversized descriptions', () => {
    expect(parseQaFeedback({ category: 'rant', description: 'x' })).toHaveProperty('error')
    expect(parseQaFeedback({ category: 'bug', description: '   ' })).toHaveProperty('error')
    expect(parseQaFeedback({ category: 'bug', description: 'x'.repeat(4001) })).toHaveProperty('error')
  })

  it('only attaches diagnostics when explicitly true', () => {
    const parsed = parseQaFeedback({ category: 'other', description: 'x', attachDiagnostics: 'yes' })
    expect(parsed).toMatchObject({ attachDiagnostics: false })
  })
})

describe('error fingerprinting', () => {
  it('normalises ids, numbers and quoted values', () => {
    expect(normaliseMessage('Tab 12 "Writing" missing 3f2a1b4c-1111-2222-3333-444455556666')).toBe(
      'Tab <n> <str> missing <id>',
    )
  })

  it('strips build-specific parts of the top frame', () => {
    const stack =
      'TypeError: x is undefined\n    at refresh (chrome-extension://fhaeedmmhjjkhnopifppigddjbbmdegh/assets/index.html-p4_3IpWA.js:12:345)'
    expect(topStackFrame(stack)).toBe('at refresh (assets/index.html.js)')
    expect(topStackFrame(null)).toBe('')
  })

  it('groups the same bug across builds and separates different bugs', () => {
    const a = { source: 'sidepanel' as const, name: 'console_error', message: 'failed for tab 1', stack: 'E\n at f (chrome-extension://fhaeedmmhjjkhnopifppigddjbbmdegh/assets/a-AAAAAAAA.js:1:2)' }
    const b = { ...a, message: 'failed for tab 2', stack: 'E\n at f (chrome-extension://fhaeedmmhjjkhnopifppigddjbbmdegh/assets/a-BBBBBBBB.js:9:9)' }
    const c = { ...a, message: 'something else' }
    expect(errorFingerprint(a)).toBe(errorFingerprint(b))
    expect(errorFingerprint(a)).not.toBe(errorFingerprint(c))
  })
})

describe('isDashboardKeyValid', () => {
  it('accepts only the configured key', () => {
    expect(isDashboardKeyValid('Bearer secret-key', 'secret-key')).toBe(true)
    expect(isDashboardKeyValid('Bearer wrong', 'secret-key')).toBe(false)
    expect(isDashboardKeyValid(undefined, 'secret-key')).toBe(false)
    expect(isDashboardKeyValid('secret-key', 'secret-key')).toBe(false)
  })

  it('is never open when no key is configured', () => {
    expect(isDashboardKeyValid('Bearer ', '')).toBe(false)
    expect(isDashboardKeyValid('Bearer anything', '')).toBe(false)
  })
})

describe('GitHub issue text', () => {
  it('fences text so it cannot break out of the code block', () => {
    const text = 'look ``` @someone [link](x)'
    const out = fenced(text)
    expect(out.startsWith('````text\n')).toBe(true)
    expect(out.endsWith('\n````')).toBe(true)
  })

  it('builds a title without mentions and a body without the tester email', () => {
    const issue = buildFeedbackIssue(
      'fb-1',
      { category: 'bug', description: 'Ping @alice it broke\nsecond line', attachDiagnostics: true, version: '1.0.0', browser: 'Chrome 131' },
      [{ at: '2026-11-11 10:00:00', kind: 'error', name: 'chat_input_not_found', source: 'content', message: 'no box' }],
    )
    expect(issue.title).toBe('[Tester bug] Ping (at)alice it broke')
    expect(issue.body).toContain('fb-1')
    expect(issue.body).toContain('ERROR chat_input_not_found -- no box')
    // The tester's text keeps its @ only inside the code fence, where
    // GitHub never turns it into a mention.
    const outsideFences = issue.body.replace(/(`{3,})text\n[\s\S]*?\n\1/g, '')
    expect(outsideFences).not.toContain('@')
    expect(issue.body).not.toContain('example.com')
    expect(issue.labels).toEqual(['tester-feedback', 'bug'])
  })

  it('truncates long titles', () => {
    const issue = buildFeedbackIssue('fb-2', { category: 'suggestion', description: 'w'.repeat(200), attachDiagnostics: false, version: '1', browser: 'C' }, null)
    expect(issue.title.length).toBeLessThanOrEqual('[Tester suggestion] '.length + 70)
    expect(issue.labels[1]).toBe('enhancement')
  })
})
