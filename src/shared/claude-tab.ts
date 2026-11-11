import type { InsertPromptRequest, InsertPromptResponse } from './messages'

// Sends a prompt to the extension's script inside a claude.ai tab.
//
// Chrome only adds that script to pages that load after the extension is
// installed, updated or reloaded. A claude.ai tab that was already open
// has none, and sending to it fails with "Could not establish connection.
// Receiving end does not exist." Testers update often, so instead of
// telling them to reload the tab, this adds the script to the tab itself
// (chrome.scripting, limited to claude.ai by the manifest's host
// permissions) and tries once more.

export type SendResult =
  | { ok: true; response: InsertPromptResponse }
  | { ok: false; reason: 'unreachable' }

/** The content script's built file, as listed in the manifest. */
export function contentScriptFile(manifest: chrome.runtime.Manifest = chrome.runtime.getManifest()): string | null {
  return manifest.content_scripts?.[0]?.js?.[0] ?? null
}

/** Adds the content script to a tab that doesn't have it. False if Chrome
 * refuses (not a claude.ai page, or the tab is still loading). */
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

export async function sendToClaudeTab(tabId: number, request: InsertPromptRequest): Promise<SendResult> {
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
