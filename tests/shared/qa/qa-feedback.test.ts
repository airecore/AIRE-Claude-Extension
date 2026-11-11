import { describe, expect, it, vi } from 'vitest'
import { parseFeedbackResponse, sendFeedback } from '../../../src/shared/qa/feedback'

const input = { category: 'bug' as const, description: '  The button did nothing  ', attachDiagnostics: true }

describe('sendFeedback', () => {
  it('posts the trimmed feedback with build details', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: 'fb-1', issueUrl: 'https://github.com/a/b/issues/3' }), { status: 201 }))
    const result = await sendFeedback('tok', input, fetchImpl as unknown as typeof fetch)
    expect(result).toEqual({ ok: true, id: 'fb-1', issueUrl: 'https://github.com/a/b/issues/3' })
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toMatch(/\/api\/qa-feedback$/)
    expect(JSON.parse(init.body as string)).toMatchObject({
      category: 'bug', description: 'The button did nothing', attachDiagnostics: true, version: expect.stringContaining('+'),
    })
  })

  it('refuses empty or oversized descriptions without calling the server', async () => {
    const fetchImpl = vi.fn()
    expect((await sendFeedback('tok', { ...input, description: '   ' }, fetchImpl)).ok).toBe(false)
    expect((await sendFeedback('tok', { ...input, description: 'x'.repeat(4001) }, fetchImpl)).ok).toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('turns failures into readable messages', async () => {
    const offline = vi.fn(async () => { throw new Error('offline') }) as unknown as typeof fetch
    expect(await sendFeedback('tok', input, offline)).toMatchObject({ ok: false, error: expect.stringContaining('connection') })
    const limited = vi.fn(async () => new Response(null, { status: 429 })) as unknown as typeof fetch
    expect(await sendFeedback('tok', input, limited)).toMatchObject({ ok: false })
    const broken = vi.fn(async () => new Response(null, { status: 500 })) as unknown as typeof fetch
    expect(await sendFeedback('tok', input, broken)).toMatchObject({ ok: false, error: expect.stringContaining('500') })
  })
})

describe('parseFeedbackResponse', () => {
  it('only accepts GitHub issue links', () => {
    expect(parseFeedbackResponse({ id: 'a', issueUrl: 'https://evil.example/x' })).toEqual({ id: 'a', issueUrl: null })
    expect(parseFeedbackResponse({ id: 'a', issueUrl: null })).toEqual({ id: 'a', issueUrl: null })
    expect(parseFeedbackResponse({})).toBeNull()
  })
})
