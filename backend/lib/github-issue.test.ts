import { describe, expect, it, vi } from 'vitest'
import { checkGithubIssues, createGithubIssue } from './github-issue'

const issue = { title: 'T', body: 'B', labels: ['tester-feedback', 'bug'] }

function response(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), { status })
}

describe('createGithubIssue', () => {
  it('does nothing without a token or with a malformed repo', async () => {
    const fetchImpl = vi.fn()
    expect(await createGithubIssue(issue, '', 'a/b', fetchImpl)).toBeNull()
    expect(await createGithubIssue(issue, 't', 'not a repo', fetchImpl)).toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('returns the new issue URL', async () => {
    const fetchImpl = vi.fn(async () => response(201, { html_url: 'https://github.com/a/b/issues/7' }))
    expect(await createGithubIssue(issue, 'tok', 'a/b', fetchImpl)).toBe('https://github.com/a/b/issues/7')
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.github.com/repos/a/b/issues')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
    expect(JSON.parse(init.body as string).labels).toEqual(['tester-feedback', 'bug'])
  })

  it('retries without labels when GitHub rejects them', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response(422))
      .mockResolvedValueOnce(response(201, { html_url: 'https://github.com/a/b/issues/8' }))
    expect(await createGithubIssue(issue, 'tok', 'a/b', fetchImpl)).toBe('https://github.com/a/b/issues/8')
    expect(JSON.parse((fetchImpl.mock.calls[1][1] as RequestInit).body as string).labels).toBeUndefined()
  })

  it('returns null on GitHub errors or network failure instead of throwing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await createGithubIssue(issue, 'tok', 'a/b', vi.fn(async () => response(401)))).toBeNull()
    expect(await createGithubIssue(issue, 'tok', 'a/b', vi.fn(async () => { throw new Error('offline') }))).toBeNull()
  })
})

describe('checkGithubIssues', () => {
  it('says not configured without a token, without calling GitHub', async () => {
    const fetchImpl = vi.fn()
    expect((await checkGithubIssues('', 'a/b', fetchImpl)).state).toBe('not_configured')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('says working when the token can read the repository issues', async () => {
    const result = await checkGithubIssues('tok', 'a/b', vi.fn(async () => response(200, [])))
    expect(result).toEqual({ state: 'working', detail: 'Feedback opens issues in a/b.' })
  })

  it('explains each failure in plain words, with GitHub\'s own message, never the token', async () => {
    const forbidden = await checkGithubIssues('secret-tok', 'a/b', vi.fn(async () => response(403, { message: 'Resource not accessible' })))
    expect(forbidden.state).toBe('failing')
    expect(forbidden.detail).toMatch(/owner must approve/)
    expect(forbidden.detail).toContain('Resource not accessible')
    expect(forbidden.detail).not.toContain('secret-tok')
    expect((await checkGithubIssues('t', 'a/b', vi.fn(async () => response(401)))).detail).toMatch(/expired/)
    expect((await checkGithubIssues('t', 'a/b', vi.fn(async () => response(404)))).detail).toMatch(/QA_GITHUB_REPO/)
    expect((await checkGithubIssues('t', 'bad repo', vi.fn())).state).toBe('failing')
    expect((await checkGithubIssues('t', 'a/b', vi.fn(async () => { throw new Error('x') }))).state).toBe('failing')
  })
})
