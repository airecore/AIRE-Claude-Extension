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
