import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// Route-level tests for the three QA endpoints. The database, sign-in
// verification, rate limiter and GitHub call are stubbed, so these check
// the handlers' own logic: who may call them, what they store, and what
// they return.

const { queries, mockResolveEmail, mockCreateIssue, mockOpenIssue, nextRows } = vi.hoisted(() => ({
  mockOpenIssue: vi.fn(),
  queries: [] as string[],
  mockResolveEmail: vi.fn(),
  mockCreateIssue: vi.fn(),
  nextRows: { value: [] as unknown[], events: [] as unknown[] },
}))

vi.mock('@neondatabase/serverless', () => {
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join('?')
    queries.push(text + ' :: ' + JSON.stringify(values))
    return Promise.resolve(text.includes('FROM qa_events') ? nextRows.events : nextRows.value)
  }
  sql.transaction = async (list: Promise<unknown>[]) => Promise.all(list).then((r) => r.map(() => [] as unknown[]))
  return { neon: () => sql }
})
vi.mock('./resolve-email.js', () => ({ resolveEmail: mockResolveEmail }))
vi.mock('./rate-limit.js', () => ({
  checkRateLimit: async () => ({ ok: true, retryAfter: 0 }),
  clientIp: () => 'test-ip',
}))
vi.mock('./github-issue.js', () => ({
  createGithubIssue: mockCreateIssue,
  openGithubIssue: mockOpenIssue,
  withMissingIssues: (status: unknown) => status,
  DEFAULT_FEEDBACK_REPO: 'airecore/AIRE-QA-Feedback',
  checkGithubIssues: async () => ({ state: 'not_configured', detail: 'not set' }),
}))

function makeReq(method: string, body: unknown, headers: Record<string, string> = {}, query: Record<string, string> = {}): VercelRequest {
  return { method, body, headers, query } as unknown as VercelRequest
}

function makeRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    status(code: number) { this.statusCode = code; return this },
    json(payload: unknown) { this.body = payload; return this },
    setHeader(name: string, value: string) { this.headers[name] = value; return this },
    end() { return this },
  }
  return res as typeof res & VercelResponse
}

beforeEach(() => {
  queries.length = 0
  nextRows.value = []
  nextRows.events = []
  mockResolveEmail.mockReset()
  mockCreateIssue.mockReset()
  process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/db'
})

const event = { kind: 'event', name: 'button_run', source: 'sidepanel', at: Date.now(), version: '1.0.0', browser: 'Chrome 131' }

describe('POST /api/qa-events', async () => {
  const handler = (await import('../api/qa-events.js')).default

  it('rejects callers who are not signed in', async () => {
    mockResolveEmail.mockResolvedValue(null)
    const res = makeRes()
    await handler(makeReq('POST', { events: [event] }), res)
    expect(res.statusCode).toBe(401)
    expect(queries.some((q) => q.includes('INSERT INTO qa_events'))).toBe(false)
  })

  it('stores valid events under the verified, lowercased email', async () => {
    mockResolveEmail.mockResolvedValue('Tester@Example.com')
    const res = makeRes()
    await handler(makeReq('POST', { events: [event, { kind: 'bogus' }] }), res)
    expect(res.statusCode).toBe(204)
    expect(res.headers['X-QA-Dropped']).toBe('1')
    const inserts = queries.filter((q) => q.includes('INSERT INTO qa_events'))
    expect(inserts).toHaveLength(1)
    expect(inserts[0]).toContain('"tester@example.com"')
  })

  it('gives errors a fingerprint', async () => {
    mockResolveEmail.mockResolvedValue('t@example.com')
    await handler(makeReq('POST', { events: [{ ...event, kind: 'error', name: 'console_error', message: 'boom' }] }), makeRes())
    const insert = queries.find((q) => q.includes('INSERT INTO qa_events'))!
    expect(insert).toMatch(/"[0-9a-f]{16}"\]$/)
  })

  it('400s on a malformed body', async () => {
    mockResolveEmail.mockResolvedValue('t@example.com')
    const res = makeRes()
    await handler(makeReq('POST', { nope: true }), res)
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /api/qa-feedback', async () => {
  const handler = (await import('../api/qa-feedback.js')).default
  const feedback = { category: 'bug', description: 'It broke', attachDiagnostics: false, version: '1.0.0', browser: 'Chrome 131' }

  it('rejects callers who are not signed in', async () => {
    mockResolveEmail.mockResolvedValue(null)
    const res = makeRes()
    await handler(makeReq('POST', feedback), res)
    expect(res.statusCode).toBe(401)
  })

  it('saves feedback, opens an issue and returns both', async () => {
    delete process.env.QA_GITHUB_REPO
    mockResolveEmail.mockResolvedValue('t@example.com')
    nextRows.value = [{ id: 'fb-1' }]
    mockCreateIssue.mockResolvedValue('https://github.com/a/b/issues/1')
    const res = makeRes()
    await handler(makeReq('POST', feedback), res)
    expect(res.statusCode).toBe(201)
    expect(res.body).toEqual({ id: 'fb-1', issueUrl: 'https://github.com/a/b/issues/1' })
    expect(queries.some((q) => q.includes('INSERT INTO qa_feedback'))).toBe(true)
    expect(queries.some((q) => q.includes('UPDATE qa_feedback SET github_issue_url'))).toBe(true)
    // With QA_GITHUB_REPO unset, issues go to the private feedback repo,
    // never the public code repo.
    expect(mockCreateIssue.mock.calls[0][2]).toBe('airecore/AIRE-QA-Feedback')
    expect(queries.some((q) => q.includes('FROM qa_events'))).toBe(false)
  })

  it("attaches only the caller's own recent events when asked", async () => {
    mockResolveEmail.mockResolvedValue('t@example.com')
    nextRows.value = [{ id: 'fb-2' }]
    nextRows.events = [{ occurred_at: '2026-11-11T10:00:00Z', kind: 'error', name: 'console_error', source: 'content', message: 'boom\nmore' }]
    mockCreateIssue.mockResolvedValue(null)
    const res = makeRes()
    await handler(makeReq('POST', { ...feedback, attachDiagnostics: true }), res)
    const read = queries.find((q) => q.includes('FROM qa_events'))!
    expect(read).toContain('"t@example.com"')
    expect(res.body).toMatchObject({ issueUrl: null })
    const [issue] = mockCreateIssue.mock.calls[0] as [{ body: string }]
    expect(issue.body).toContain('ERROR console_error -- boom')
  })

  it('400s on invalid feedback', async () => {
    mockResolveEmail.mockResolvedValue('t@example.com')
    const res = makeRes()
    await handler(makeReq('POST', { ...feedback, description: '' }), res)
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /api/qa-dashboard', async () => {
  const handler = (await import('../api/qa-dashboard.js')).default

  it('503s when no dashboard key is configured', async () => {
    delete process.env.QA_DASHBOARD_KEY
    const res = makeRes()
    await handler(makeReq('GET', undefined, { authorization: 'Bearer anything' }), res)
    expect(res.statusCode).toBe(503)
  })

  it('401s on a wrong key', async () => {
    process.env.QA_DASHBOARD_KEY = 'right-key'
    const res = makeRes()
    await handler(makeReq('GET', undefined, { authorization: 'Bearer wrong-key' }), res)
    expect(res.statusCode).toBe(401)
  })

  it('returns the report with every catalogue event listed as not exercised when empty', async () => {
    process.env.QA_DASHBOARD_KEY = 'right-key'
    const res = makeRes()
    await handler(makeReq('GET', undefined, { authorization: 'Bearer right-key' }, { days: '7' }), res)
    expect(res.statusCode).toBe(200)
    const body = res.body as { days: number; notExercised: string[]; defects: unknown[] }
    expect(body.days).toBe(7)
    expect(body.defects).toEqual([])
    expect(body.notExercised).toContain('button_run')
    expect((res.body as { github: { state: string } }).github.state).toBe('not_configured')
  })
})

describe('POST /api/qa-dashboard retry-issues', async () => {
  const handler = (await import('../api/qa-dashboard.js')).default
  const row = { id: 'fb-1', category: 'bug', description: 'broke', diagnostics: null, version: '1', browser: 'C' }

  it('needs the dashboard key', async () => {
    process.env.QA_DASHBOARD_KEY = 'right-key'
    const res = makeRes()
    await handler(makeReq('POST', { action: 'retry-issues' }, { authorization: 'Bearer wrong' }), res)
    expect(res.statusCode).toBe(401)
  })

  it('opens issues for feedback without one and stores the link', async () => {
    process.env.QA_DASHBOARD_KEY = 'right-key'
    nextRows.value = [row]
    mockOpenIssue.mockReset().mockResolvedValue({ url: 'https://github.com/a/b/issues/1' })
    const res = makeRes()
    await handler(makeReq('POST', { action: 'retry-issues' }, { authorization: 'Bearer right-key' }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ results: [{ id: 'fb-1', issueUrl: 'https://github.com/a/b/issues/1' }] })
    expect(queries.some((q) => q.includes('UPDATE qa_feedback SET github_issue_url'))).toBe(true)
  })

  it("reports GitHub's reason and stops at the first failure", async () => {
    process.env.QA_DASHBOARD_KEY = 'right-key'
    nextRows.value = [row, { ...row, id: 'fb-2' }]
    mockOpenIssue.mockReset().mockResolvedValue({ error: 'GitHub 403: nope.' })
    const res = makeRes()
    await handler(makeReq('POST', { action: 'retry-issues' }, { authorization: 'Bearer right-key' }), res)
    expect(res.body).toEqual({ results: [{ id: 'fb-1', error: 'GitHub 403: nope.' }] })
    expect(mockOpenIssue).toHaveBeenCalledTimes(1)
  })

  it('rejects unknown actions', async () => {
    process.env.QA_DASHBOARD_KEY = 'right-key'
    const res = makeRes()
    await handler(makeReq('POST', { action: 'drop-tables' }, { authorization: 'Bearer right-key' }), res)
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /api/qa-dashboard import-events', async () => {
  const handler = (await import('../api/qa-dashboard.js')).default
  const tourEvent = { kind: 'event', name: 'tab_deleted', source: 'sidepanel', at: Date.now(), version: '1.0.0+abc', browser: 'Chrome 131' }

  it('needs the dashboard key', async () => {
    process.env.QA_DASHBOARD_KEY = 'right-key'
    const res = makeRes()
    await handler(makeReq('POST', { action: 'import-events', events: [tourEvent] }, { authorization: 'Bearer nope' }), res)
    expect(res.statusCode).toBe(401)
    expect(queries.some((q) => q.includes('INSERT INTO qa_events'))).toBe(false)
  })

  it('files the events under the automated tester, labelled as automated', async () => {
    process.env.QA_DASHBOARD_KEY = 'right-key'
    const res = makeRes()
    await handler(makeReq('POST', { action: 'import-events', events: [tourEvent, { bad: true }] }, { authorization: 'Bearer right-key' }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ imported: 1, dropped: 1 })
    const insert = queries.find((q) => q.includes('INSERT INTO qa_events'))!
    expect(insert).toContain('"automated-tour"')
    expect(insert).toContain('Chrome 131 (automated tour)')
  })
})

describe('POST /api/qa-dashboard resolve-defect', async () => {
  const handler = (await import('../api/qa-dashboard.js')).default

  it('needs the dashboard key and a real defect id', async () => {
    process.env.QA_DASHBOARD_KEY = 'right-key'
    const noKey = makeRes()
    await handler(makeReq('POST', { action: 'resolve-defect', fingerprint: '0123456789abcdef' }, { authorization: 'Bearer x' }), noKey)
    expect(noKey.statusCode).toBe(401)
    const bad = makeRes()
    await handler(makeReq('POST', { action: 'resolve-defect', fingerprint: "x' OR 1=1" }, { authorization: 'Bearer right-key' }), bad)
    expect(bad.statusCode).toBe(400)
    expect(queries.some((q) => q.includes('DELETE FROM qa_events'))).toBe(false)
  })

  it("removes only that defect's error reports", async () => {
    process.env.QA_DASHBOARD_KEY = 'right-key'
    nextRows.events = [{ id: 1 }, { id: 2 }]
    const res = makeRes()
    await handler(makeReq('POST', { action: 'resolve-defect', fingerprint: '0123456789abcdef' }, { authorization: 'Bearer right-key' }), res)
    expect(res.body).toEqual({ resolved: 2 })
    const del = queries.find((q) => q.includes('DELETE FROM qa_events'))!
    expect(del).toContain("kind = 'error'")
    expect(del).toContain('"0123456789abcdef"')
  })
})
