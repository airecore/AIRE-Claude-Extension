// The AI chat sites the sidebar works on. One list drives the manifest
// (host permissions, where the content script runs), the service worker
// (which tabs get the side panel), the side panel's messages and the
// content script's copy in src/content/site-inputs.ts, which also holds
// each site's chat-box markers. Adding a site means an entry in both;
// tests/shared/sites.test.ts fails until they match.

export type SiteId = 'claude' | 'chatgpt' | 'copilot' | 'gemini'

export interface ChatSite {
  id: SiteId
  /** Shown to the user: "Couldn't find ChatGPT's chat box". */
  name: string
  /** Exact hostnames the site is served from. */
  hosts: readonly string[]
}

export const CHAT_SITES: readonly ChatSite[] = [
  {
    id: 'claude',
    name: 'Claude',
    hosts: ['claude.ai'],
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    hosts: ['chatgpt.com', 'chat.openai.com'],
  },
  {
    id: 'copilot',
    name: 'Copilot',
    // Consumer Copilot (both addresses) and Microsoft 365 Copilot.
    hosts: ['copilot.microsoft.com', 'copilot.com', 'copilot.cloud.microsoft', 'm365.cloud.microsoft'],
  },
  {
    id: 'gemini',
    name: 'Gemini',
    hosts: ['gemini.google.com'],
  },
]

/** The supported site a URL belongs to, or null. */
export function siteForUrl(url: string | undefined | null): ChatSite | null {
  if (!url) return null
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:') return null
  if (!isChatPath(parsed.hostname, parsed.pathname)) return null
  return siteForHost(parsed.hostname)
}

/**
 * Hosts that serve much more than chat: only these paths are the chat.
 * m365.cloud.microsoft is the whole Microsoft 365 web hub; Copilot is at
 * /chat. Keep in step with CHAT_ONLY_PATHS in src/content/site-inputs.ts.
 */
export const CHAT_ONLY_PATHS: Readonly<Record<string, string>> = {
  'm365.cloud.microsoft': '/chat',
}

/** Whether this page of a supported host is its chat. */
export function isChatPath(hostname: string, pathname: string): boolean {
  const prefix = CHAT_ONLY_PATHS[hostname]
  return !prefix || pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function siteForHost(hostname: string): ChatSite | null {
  return CHAT_SITES.find((site) => site.hosts.includes(hostname)) ?? null
}

/** Match patterns for the manifest: https://<host>/* for every site. */
export function siteMatchPatterns(): string[] {
  return CHAT_SITES.flatMap((site) => site.hosts.map((host) => `https://${host}/*`))
}

/** "Claude, ChatGPT, Copilot or Gemini" */
export const SITE_NAMES_TEXT = (() => {
  const names = CHAT_SITES.map((site) => site.name)
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`
})()
