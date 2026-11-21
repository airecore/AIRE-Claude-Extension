// Where each site keeps its usage numbers, and where the usage box goes in
// its sidebar. Content-script only: no runtime imports shared with the side
// panel (see site-inputs.ts for why).
//
//   Claude  -- /api/organizations/<org>/usage: session, weekly, extra usage %.
//   ChatGPT -- /backend-api/conversation/init (the call ChatGPT itself makes
//              when a chat opens): uses left per feature, and reset times.
//   Gemini  -- its Usage page (gemini.google.com/usage): current and weekly %.
//              Read from that page whenever it is open and kept, so the box
//              shows the latest numbers on every other Gemini page.
//   Copilot -- shows no usage anywhere, so it gets no box.

import { fetchUsage, type FetchUsageResult } from './usage-client'
import { parseChatGptLimits, parseGeminiUsageItem, type UsageMeter } from '../shared/usage'
import type { SiteId } from './site-inputs'

export interface SiteUsage {
  /** Finds the element the box is inserted before, in the site's sidebar. */
  anchor: () => Element | null
  fetch: () => Promise<FetchUsageResult>
  /** What the refresh button does when re-reading isn't possible. */
  refreshHint?: string
}

async function fetchChatGptUsage(): Promise<FetchUsageResult> {
  try {
    const session = (await (await fetch('/api/auth/session', { credentials: 'include' })).json()) as {
      accessToken?: unknown
    }
    if (typeof session.accessToken !== 'string') return { ok: false }
    const response = await fetch('/backend-api/conversation/init', {
      method: 'POST',
      credentials: 'include',
      headers: { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gizmo_id: null,
        requested_default_model: null,
        conversation_id: null,
        timezone_offset_min: new Date().getTimezoneOffset(),
      }),
    })
    if (!response.ok) {
      console.warn('[Claude Tools] ChatGPT usage returned status', response.status)
      return { ok: false }
    }
    return { ok: true, usage: parseChatGptLimits(await response.json()) }
  } catch (error) {
    console.warn('[Claude Tools] ChatGPT usage could not be read', error)
    return { ok: false }
  }
}

const GEMINI_KEY = 'aire.geminiUsage'

/** On Gemini's Usage page, reads its usage windows and keeps them. */
export async function captureGeminiUsage(): Promise<boolean> {
  if (location.pathname !== '/usage') return false
  const list = document.querySelector('[aria-label="Usage windows"]')
  if (!list) return false
  const meters = Array.from(list.querySelectorAll('li'))
    .map((item) => parseGeminiUsageItem((item as HTMLElement).innerText))
    .filter((meter): meter is UsageMeter => meter !== null)
  if (meters.length === 0) return false
  await chrome.storage.local.set({ [GEMINI_KEY]: { meters, savedAt: Date.now() } })
  return true
}

async function fetchGeminiUsage(): Promise<FetchUsageResult> {
  await captureGeminiUsage()
  const saved = (await chrome.storage.local.get(GEMINI_KEY))[GEMINI_KEY] as
    | { meters: UsageMeter[]; savedAt: number }
    | undefined
  if (!saved || saved.meters.length === 0) return { ok: false }
  return { ok: true, usage: { meters: saved.meters }, savedAt: saved.savedAt }
}

export const SITE_USAGE: Partial<Record<SiteId, SiteUsage>> = {
  claude: {
    anchor: () => document.querySelector('[data-testid="sidebar-recents"]'),
    fetch: fetchUsage,
  },
  chatgpt: {
    // Above the first sidebar section (Projects / Recents).
    anchor: () => document.querySelector('nav[aria-label="Chat history"] [class~="group/nav-section"]'),
    fetch: fetchChatGptUsage,
  },
  gemini: {
    // Above the Notebooks / chats sections.
    anchor: () =>
      document.querySelector('[data-test-id="overflow-container"] expandable-section') ??
      document.querySelector('expandable-section[data-test-id="chats-expandable-section"]'),
    fetch: fetchGeminiUsage,
    refreshHint: 'Open Gemini’s usage page to update',
  },
}
