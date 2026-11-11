// Opens a GitHub issue for a piece of tester feedback. Configured by two
// Vercel environment variables:
//
//   QA_GITHUB_TOKEN  fine-grained personal access token with
//                    "Issues: Read and write" on the repository only
//   QA_GITHUB_REPO   owner/name, e.g. airecore/AIRE-Claude-Extension
//
// Best-effort: feedback is always saved to the database first, so a
// missing token, a GitHub outage or a slow response just means no issue
// link -- never a lost report or a failed request for the tester.

export interface IssueRequest {
  title: string
  body: string
  labels: string[]
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>

const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/
const TIMEOUT_MS = 8000

export async function createGithubIssue(
  issue: IssueRequest,
  token: string,
  repo: string,
  fetchImpl: FetchLike = fetch,
): Promise<string | null> {
  if (!token || !REPO_PATTERN.test(repo)) return null

  const post = (payload: Partial<IssueRequest>) =>
    fetchImpl(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'aire-extension-qa',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

  try {
    let response = await post(issue)
    // 422 is what GitHub returns when the token may not apply labels;
    // the issue itself matters more than its labels, so retry bare.
    if (response.status === 422) {
      response = await post({ title: issue.title, body: issue.body })
    }
    if (!response.ok) {
      console.error('[github-issue] GitHub returned status', response.status)
      return null
    }
    const created = (await response.json()) as { html_url?: unknown }
    return typeof created.html_url === 'string' ? created.html_url : null
  } catch (error) {
    console.error('[github-issue] failed to create issue', error)
    return null
  }
}

export type GithubIssuesStatus =
  | { state: 'not_configured'; detail: string }
  | { state: 'working'; detail: string }
  | { state: 'failing'; detail: string }

/**
 * Checks, without creating anything, whether feedback can open issues:
 * the token is set, can see the repository, and can read its issues.
 * Shown at the top of the QA dashboard so a broken token isn't silent.
 * Never includes the token itself in what it returns.
 */
export async function checkGithubIssues(token: string, repo: string, fetchImpl: FetchLike = fetch): Promise<GithubIssuesStatus> {
  if (!token) return { state: 'not_configured', detail: 'QA_GITHUB_TOKEN is not set in Vercel, so feedback is saved here only.' }
  if (!REPO_PATTERN.test(repo)) return { state: 'failing', detail: `QA_GITHUB_REPO "${repo}" is not in owner/name form.` }
  try {
    const response = await fetchImpl(`https://api.github.com/repos/${repo}/issues?per_page=1`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'aire-extension-qa',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (response.ok) return { state: 'working', detail: `Feedback opens issues in ${repo}.` }
    const body = (await response.json().catch(() => ({}))) as { message?: unknown }
    const message = typeof body.message === 'string' ? body.message.slice(0, 200) : ''
    const hint =
      response.status === 401
        ? 'The token is invalid or has expired. Make a new one and update QA_GITHUB_TOKEN.'
        : response.status === 403
          ? 'The token is not allowed yet. If the repository belongs to an organisation, an owner must approve the token request.'
          : response.status === 404
            ? `The token can't see ${repo}. Check QA_GITHUB_REPO matches the repository exactly, and that the token was given access to it (with Issues: Read and write). An unapproved organisation token also looks like this.`
            : 'GitHub refused the request.'
    return { state: 'failing', detail: `${hint} (GitHub ${response.status}${message ? `: ${message}` : ''})` }
  } catch {
    return { state: 'failing', detail: "Couldn't reach GitHub to check the token." }
  }
}
