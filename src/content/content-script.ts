import { insertPrompt, watchForSend, pageKind } from './claude-adapter'
import { initUsageWidget, refreshWidget } from './usage-widget'
import { fetchUsage } from './usage-client'
import type { GetUsageRequest, InsertPromptRequest, PromptSentMessage } from '../shared/messages'
import { installContentQaCapture, qaContentDefect } from './qa-report'

// The side panel adds this script to an already-open claude.ai tab when it
// can't reach one (src/shared/claude-tab.ts). If a live copy is already
// running in this tab, don't set up a second one -- two copies would type
// every prompt twice. A copy left over from before the extension was
// reloaded is dead (its chrome.runtime is gone), so it doesn't count.
const marker = window as unknown as { __aireContentAlive?: () => boolean }
const liveCopyRunning = (() => {
  try {
    return marker.__aireContentAlive?.() === true
  } catch {
    return false
  }
})()

if (!liveCopyRunning) {
  marker.__aireContentAlive = () => {
    try {
      return Boolean(chrome.runtime?.id)
    } catch {
      return false
    }
  }
  start()
}

function start(): void {
  // Tester build: record this script's own errors (never claude.ai's).
  installContentQaCapture()

  console.log('[Claude Tools] content script loaded on', window.location.href)

  initUsageWidget().catch((error) => {
    console.warn('[Claude Tools] usage box could not start', error)
  })

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || (message as InsertPromptRequest).type !== 'INSERT_PROMPT') return undefined
    const { prompt, runToken } = message as InsertPromptRequest
    insertPrompt(prompt)
      .then((response) => {
        sendResponse(response)
        // The extension's most likely break: claude.ai changing its chat box.
        if (!response.ok) {
          qaContentDefect(`insert_${response.error}`, response.message, {
            page: pageKind(),
            editables: document.querySelectorAll('[contenteditable="true"]').length,
          })
        }
        void refreshWidget()
        if (response.ok && runToken) {
          watchForSend(() => {
            const sent: PromptSentMessage = { type: 'PROMPT_SENT', runToken }
            chrome.runtime.sendMessage(sent).catch(() => {
              /* sidebar closed -- nothing to report to */
            })
          })
        }
      })
      .catch((error) => {
        console.error('[Claude Tools] unexpected error during insertPrompt', error)
        sendResponse({
          ok: false,
          error: 'insert_failed',
          message: 'Something went wrong inserting the prompt. Check the console for details.',
        })
      })
    return true
  })

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || (message as GetUsageRequest).type !== 'GET_USAGE') return undefined
    fetchUsage()
      .then((result) => sendResponse(result))
      .catch((error) => {
        console.error('[Claude Tools] unexpected error during fetchUsage', error)
        sendResponse({ ok: false })
      })
    return true
  })
}
