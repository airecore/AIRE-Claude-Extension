import { describe, expect, it, vi } from 'vitest'
import { checkGithubIssues, createGithubIssue } from './github-issue'

const issue = { title: 'T', body: 'B', labels: ['tester-feedback', 'bug'] }

function response(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), { status })
}

/** A fetch that answers GitHub's "get repository" call with the given
 * visibility, and every other call with `rest` in order. */
function github(isPrivate: boolean, ...rest: (Response | Error)[]) {
  const queue = [...rest]
  return vi.fn(async (url: string, _init?: RequestInit) => {
    if (/\/repos\/[^/]+\/[^/?]+$/.test(url)) return response(200, { private: isPrivate })
    const next = queue.shift()
    if (next instanceof Error) throw next
    return next ?? response(500)
  })
}

describe('createGithubIssue', () => {
  it('does nothing without a token or with a malformed repo', async () => {
    const fetchImpl = vi.fn()
    expect(await createGithubIssue(issue, '', 'a/b', fetchImpl)).toBeNull()
    expect(await createGithubIssue(issue, 't', 'not a repo', fetchImpl)).toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('returns the new issue URL after confirming the repository is private', async () => {
    const fetchImpl = github(true, response(201, { html_url: 'https://github.com/a/b/issues/7' }))
    expect(await createGithubIssue(issue, 'tok', 'a/b', fetchImpl)).toBe('https://github.com/a/b/issues/7')
    const [url, init] = fetchImpl.mock.calls[1] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.github.com/repos/a/b/issues')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
    expect(JSON.parse(init.body as string).labels).toEqual(['tester-feedback', 'bug'])
  })

  it('never posts feedback to a public repository', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchImpl = github(false, response(201, { html_url: 'https://github.com/a/b/issues/9' }))
    expect(await createGithubIssue(issue, 'tok', 'a/b', fetchImpl)).toBeNull()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("doesn't post when it can't confirm the repository is private", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const notFound = vi.fn(async () => response(404))
    expect(await createGithubIssue(issue, 'tok', 'a/b', notFound)).toBeNull()
    expect(notFound).toHaveBeenCalledTimes(1)
  })

  it('retries without labels when GitHub rejects them', async () => {
    const fetchImpl = github(true, response(422), response(201, { html_url: 'https://github.com/a/b/issues/8' }))
    expect(await createGithubIssue(issue, 'tok', 'a/b', fetchImpl)).toBe('https://github.com/a/b/issues/8')
    expect(JSON.parse((fetchImpl.mock.calls[2][1] as RequestInit).body as string).labels).toBeUndefined()
  })

  it('returns null on GitHub errors or network failure instead of throwing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await createGithubIssue(issue, 'tok', 'a/b', github(true, response(401)))).toBeNull()
    expect(await createGithubIssue(issue, 'tok', 'a/b', github(true, new Error('offline')))).toBeNull()
  })
})

describe('checkGithubIssues', () => {
  it('says not configured without a token, without calling GitHub', async () => {
    const fetchImpl = vi.fn()
    expect((await checkGithubIssues('', 'a/b', fetchImpl)).state).toBe('not_configured')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('says working when the private repository issues are readable', async () => {
    const result = await checkGithubIssues('tok', 'a/b', github(true, response(200, [])))
    expect(result).toEqual({ state: 'working', detail: 'Feedback opens issues in a/b (private).' })
  })

  it('flags a public repository as failing, since feedback is not posted there', async () => {
    const result = await checkGithubIssues('tok', 'a/b', github(false, response(200, [])))
    expect(result.state).toBe('failing')
    expect(result.detail).toMatch(/is public/)
    expect(result.detail).toContain('QA_GITHUB_REPO')
  })

  it("explains each failure in plain words, with GitHub's own message, never the token", async () => {
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
