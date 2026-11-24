import type { InsertPromptRequest, InsertPromptResponse } from './messages'
import { siteForUrl } from './sites'

// Sends a prompt to the extension's script inside an AI chat tab.
//
// Chrome only adds that script to pages that load after the extension is
// installed, updated or reloaded. A chat tab that was already open
// has none, and sending to it fails with "Could not establish connection.
// Receiving end does not exist." Testers update often, so instead of
// telling them to reload the tab, this adds the script to the tab itself
// (chrome.scripting, limited to the supported chat sites by the manifest's host
// permissions) and tries once more.

export type SendResult =
  | { ok: true; response: InsertPromptResponse }
  | { ok: false; reason: 'unreachable' }

/** The content script's built file, as listed in the manifest. */
export function contentScriptFile(manifest: chrome.runtime.Manifest = chrome.runtime.getManifest()): string | null {
  return manifest.content_scripts?.[0]?.js?.[0] ?? null
}

/** Adds the content script to a tab that doesn't have it. False if Chrome
 * refuses (not a supported chat site, or the tab is still loading). */
export async function injectContentScript(tabId: number): Promise<boolean> {
  const file = contentScriptFile()
  if (!file) return false
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: [file] })
    return true
  } catch (error) {
    console.warn('[Claude Tools] could not add the content script to the tab', error)
    return false
  }
}

export async function sendToChatTab(tabId: number, request: InsertPromptRequest): Promise<SendResult> {
  try {
    return { ok: true, response: await chrome.tabs.sendMessage<InsertPromptRequest, InsertPromptResponse>(tabId, request) }
  } catch {
    // Expected for a tab opened before the extension (re)loaded.
  }
  if (!(await injectContentScript(tabId))) return { ok: false, reason: 'unreachable' }
  try {
    return { ok: true, response: await chrome.tabs.sendMessage<InsertPromptRequest, InsertPromptResponse>(tabId, request) }
  } catch (error) {
    console.error('[Claude Tools] content script still unreachable after adding it to the tab', error)
    return { ok: false, reason: 'unreachable' }
  }
}

/**
 * The tab prompts go to. In the side panel that's the active tab of its
 * window. The panel can also be opened as an ordinary tab (its page is
 * chrome-extension://<id>/src/sidepanel/index.html) -- handy as a pop-out,
 * and the only way browser-automation tools such as Claude in Chrome can
 * reach it. There the active tab is the panel itself, so prompts go to the
 * chat tab used most recently instead.
 */
export async function targetChatTab(): Promise<chrome.tabs.Tab | undefined> {
  const self = await chrome.tabs.getCurrent()
  if (!self) {
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true })
    return active
  }
  const tabs = await chrome.tabs.query({})
  return tabs
    .filter((tab) => tab.id !== self.id && siteForUrl(tab.url) !== null)
    .sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))[0]
}
