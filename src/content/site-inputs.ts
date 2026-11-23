// The content script's copy of the supported sites, with each site's
// chat-box markers. It imports nothing at runtime on purpose: sharing a
// module with the side panel would make Vite split the content script into
// a loader plus chunks, which the chat sites would then have to fetch (see
// qa-report.ts). tests/shared/sites.test.ts checks this list matches
// src/shared/sites.ts, so the two cannot drift apart.

export type SiteId = 'claude' | 'chatgpt' | 'copilot' | 'gemini'

export interface ChatSite {
  id: SiteId
  /** Shown to the user: "Couldn't find ChatGPT's chat box". */
  name: string
  /** Exact hostnames the site is served from. */
  hosts: readonly string[]
  /** This site's own chat-box markers, most specific first. The shared
   * fallbacks in claude-adapter.ts are tried after these. */
  inputSelectors: readonly string[]
}

export const CHAT_SITES: readonly ChatSite[] = [
  {
    id: 'claude',
    name: 'Claude',
    hosts: ['claude.ai'],
    inputSelectors: [
      '[data-testid="chat-input"]',
      'div.ProseMirror[contenteditable="true"]',
      '[contenteditable="true"][aria-label*="Claude" i]',
    ],
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    hosts: ['chatgpt.com', 'chat.openai.com'],
    inputSelectors: [
      '#prompt-textarea',
      'div.ProseMirror[contenteditable="true"]',
      '[contenteditable="true"][aria-label*="ChatGPT" i]',
      'textarea[aria-label*="ChatGPT" i]',
      'textarea[placeholder*="ChatGPT" i]',
    ],
  },
  {
    id: 'copilot',
    name: 'Copilot',
    // Consumer Copilot (both addresses) and Microsoft 365 Copilot.
    hosts: ['copilot.microsoft.com', 'copilot.com', 'copilot.cloud.microsoft', 'm365.cloud.microsoft'],
    inputSelectors: [
      // Copilot's Lexical editor (copilot.com/chat, 2026-11).
      '#m365-chat-editor-target-element',
      'textarea#userInput',
      '[data-testid="composer-input"]',
      '[contenteditable="true"][aria-label*="Copilot" i]',
      'textarea[aria-label*="Copilot" i]',
      'textarea[placeholder*="Copilot" i]',
      '[contenteditable="true"][aria-label*="message" i]',
      'textarea[aria-label*="message" i]',
    ],
  },
  {
    id: 'gemini',
    name: 'Gemini',
    hosts: ['gemini.google.com'],
    inputSelectors: [
      'rich-textarea .ql-editor[contenteditable="true"]',
      '[contenteditable="true"][aria-label*="Gemini" i]',
    ],
  },
]

export function contentSiteForHost(hostname: string): ChatSite | null {
  return CHAT_SITES.find((site) => site.hosts.includes(hostname)) ?? null
}

/** Copy of CHAT_ONLY_PATHS in src/shared/sites.ts (see the note at the top
 * of this file); tests/shared/sites.test.ts keeps them equal. */
export const CHAT_ONLY_PATHS: Readonly<Record<string, string>> = {
  'm365.cloud.microsoft': '/chat',
}

/** Whether the current page is a chat. On the Microsoft 365 hub only
 * /chat is: prompts must never be typed into some other page's box. */
export function isChatPage(hostname: string = location.hostname, pathname: string = location.pathname): boolean {
  const prefix = CHAT_ONLY_PATHS[hostname]
  return !prefix || pathname === prefix || pathname.startsWith(`${prefix}/`)
}
