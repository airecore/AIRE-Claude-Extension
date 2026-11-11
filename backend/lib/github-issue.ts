// Opens a GitHub issue for a piece of tester feedback. Configured by two
// Vercel environment variables:
//
//   QA_GITHUB_TOKEN  fine-grained personal access token with
//                    "Issues: Read and write" on the repository only
//   QA_GITHUB_REPO   owner/name; defaults to airecore/AIRE-QA-Feedback
//
// The repository may be public (the team chose that for
// AIRE-QA-Feedback): issues never include the tester's email, the feedback
// form tells testers their message may be public, and the dashboard's
// status line says when the repository is public.
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

export const DEFAULT_FEEDBACK_REPO = 'airecore/AIRE-QA-Feedback'

function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'aire-extension-qa',
  }
}

/** true = private, false = public, or the failing HTTP status / null when
 * GitHub couldn't be asked. */
async function repoVisibility(token: string, repo: string, fetchImpl: FetchLike): Promise<boolean | number | null> {
  try {
    const response = await fetchImpl(`https://api.github.com/repos/${repo}`, {
      method: 'GET',
      headers: githubHeaders(token),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!response.ok) return response.status
    const body = (await response.json().catch(() => ({}))) as { private?: unknown }
    return body.private === true
  } catch {
    return null
  }
}

export type OpenIssueResult = { url: string } | { error: string }

/** Opens the issue, or says in plain words why GitHub refused (never
 * including the token). */
export async function openGithubIssue(
  issue: IssueRequest,
  token: string,
  repo: string,
  fetchImpl: FetchLike = fetch,
): Promise<OpenIssueResult> {
  if (!token) return { error: 'QA_GITHUB_TOKEN is not set in Vercel.' }
  if (!REPO_PATTERN.test(repo)) return { error: `QA_GITHUB_REPO "${repo}" is not in owner/name form.` }

  const post = (payload: Partial<IssueRequest>) =>
    fetchImpl(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: { ...githubHeaders(token), 'Content-Type': 'application/json' },
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
      const body = (await response.json().catch(() => ({}))) as { message?: unknown }
      const message = typeof body.message === 'string' ? `: ${body.message.slice(0, 200)}` : ''
      const hint =
        response.status === 403 || response.status === 404
          ? ' The token can read issues but not create them. Give it Issues: Read and write (not Read-only) on this repository, and if the organisation requires it, have an owner approve the change.'
          : response.status === 401
            ? ' The token is invalid or has expired.'
            : response.status === 410
              ? ' Issues are turned off for this repository (Settings > General > Features > Issues).'
              : ''
      return { error: `GitHub ${response.status}${message}.${hint}` }
    }
    const created = (await response.json()) as { html_url?: unknown }
    return typeof created.html_url === 'string' ? { url: created.html_url } : { error: 'GitHub did not return the new issue link.' }
  } catch {
    return { error: "Couldn't reach GitHub." }
  }
}

/** Opens the issue; null (and a log line) when it can't. Feedback is
 * always saved first, so a failure only means no issue link. */
export async function createGithubIssue(
  issue: IssueRequest,
  token: string,
  repo: string,
  fetchImpl: FetchLike = fetch,
): Promise<string | null> {
  if (!token || !REPO_PATTERN.test(repo)) return null
  const result = await openGithubIssue(issue, token, repo, fetchImpl)
  if ('url' in result) return result.url
  console.error('[github-issue] could not create issue --', result.error)
  return null
}

export type GithubIssuesStatus =
  | { state: 'not_configured'; detail: string }
  | { state: 'warning'; detail: string }
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
  const visibility = await repoVisibility(token, repo, fetchImpl)
  try {
    const response = await fetchImpl(`https://api.github.com/repos/${repo}/issues?per_page=1`, {
      method: 'GET',
      headers: githubHeaders(token),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (response.ok) {
      return {
        state: 'working',
        detail:
          visibility === false
            ? `Feedback opens issues in ${repo}. It's a public repository, so anyone on the internet can read them (testers' emails are never included).`
            : `Feedback opens issues in ${repo} (private).`,
      }
    }
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

/**
 * The read-only check above can't prove the token may CREATE issues. If
 * recent feedback is still missing its issue, say so instead of "working".
 */
export function withMissingIssues(status: GithubIssuesStatus, missing: number): GithubIssuesStatus {
  if (status.state !== 'working' || missing === 0) return status
  return {
    state: 'warning',
    detail:
      `The token can read issues, but ${missing} recent report${missing === 1 ? ' has' : 's have'} no issue, ` +
      'so creating them may be failing. Press "Retry GitHub issues" under Feedback to see GitHub\'s reason.',
  }
}
