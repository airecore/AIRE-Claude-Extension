import type { InsertPromptResponse } from '../shared/messages'
import { CHAT_SITES, contentSiteForHost } from './site-inputs'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function pollFor<T>(
  find: () => T | null,
  intervalMs: number,
  timeoutMs: number,
): Promise<T | null> {
  const maxAttempts = Math.max(1, Math.ceil(timeoutMs / intervalMs) + 1)
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = find()
    if (result) return result
    if (attempt < maxAttempts - 1) {
      await sleep(intervalMs)
    }
  }
  return null
}

/** A textarea's text is its value; a contenteditable's is its textContent. */
export function inputText(input: Pick<HTMLElement, 'textContent'> & { value?: unknown }): string {
  return typeof input.value === 'string' ? input.value : (input.textContent ?? '')
}

export function isInputEmpty(input: Pick<HTMLElement, 'textContent'> & { value?: unknown }): boolean {
  return inputText(input).trim().length === 0
}

// How the chat box is found. Each site's own markers come first
// (src/shared/sites.ts), then these shared fallbacks. None of the sites
// promise their markup, and it differs between pages and changes over
// time, so one marker alone is too fragile. Claude and ChatGPT use a
// ProseMirror contenteditable, Gemini a Quill one, Copilot a textarea.
const FALLBACK_SELECTORS = [
  '[contenteditable="true"][aria-label*="prompt" i]',
  'fieldset [contenteditable="true"]',
  'form [contenteditable="true"]',
  '[contenteditable="true"][role="textbox"]',
  'form textarea',
] as const

/** The selectors to try on this page. An unknown host (a test page) uses
 * Claude's. */
export function chatInputSelectors(hostname: string = location.hostname): string[] {
  const site = contentSiteForHost(hostname) ?? CHAT_SITES[0]
  return [...site.inputSelectors, ...FALLBACK_SELECTORS]
}

/** "Claude", "ChatGPT", ... for messages; Claude on an unknown host. */
export function siteName(hostname: string = location.hostname): string {
  return (contentSiteForHost(hostname) ?? CHAT_SITES[0]).name
}

const INPUT_POLL_INTERVAL_MS = 150
const INPUT_POLL_TIMEOUT_MS = 3000

function isVisible(el: HTMLElement): boolean {
  return el.getClientRects().length > 0
}

// Gemini's editor keeps a hidden-purpose contenteditable (.ql-clipboard)
// next to the real one; it must never be picked.
const EDITABLE = '[contenteditable="true"]:not(.ql-clipboard), textarea'

function isEditable(el: HTMLElement): boolean {
  if (el.classList.contains('ql-clipboard')) return false
  return el.isContentEditable || el instanceof HTMLTextAreaElement
}

/** The editable element itself: a match may be a wrapper around it. */
function editableWithin(el: HTMLElement): HTMLElement | null {
  if (isEditable(el)) return el
  return el.querySelector<HTMLElement>(EDITABLE)
}

export function findChatInput(root: ParentNode = document): HTMLElement | null {
  for (const selector of chatInputSelectors()) {
    for (const match of Array.from(root.querySelectorAll<HTMLElement>(selector))) {
      const editable = editableWithin(match)
      if (editable && isVisible(editable)) return editable
    }
  }
  return null
}

/** Which kind of page this is ("new", "chat", "project", ...),
 * for defect reports. Only the first path segment: never ids. */
export function pageKind(pathname: string = location.pathname): string {
  const first = pathname.split('/').filter(Boolean)[0] ?? 'home'
  return /^[a-z-]{1,20}$/i.test(first) ? first : 'other'
}

/**
 * Types the prompt at the caret. Copilot's editor (Lexical) drops line
 * breaks from typed text but keeps them from a paste, so there the prompt
 * is handed over as a paste; everywhere else it is typed. (Claude and
 * ChatGPT turn long pastes into file attachments, so they must not get one.)
 */
function typeText(input: HTMLElement, prompt: string): boolean {
  if (contentSiteForHost(location.hostname)?.id === 'copilot' && input.isContentEditable) {
    const data = new DataTransfer()
    data.setData('text/plain', prompt)
    const paste = new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true })
    input.dispatchEvent(paste)
    // The editor took it (it cancels the browser's own paste when it does).
    if (paste.defaultPrevented && !isInputEmpty(input)) return true
  }
  return document.execCommand('insertText', false, prompt)
}

export async function insertPrompt(prompt: string): Promise<InsertPromptResponse> {
  const input = await pollFor(findChatInput, INPUT_POLL_INTERVAL_MS, INPUT_POLL_TIMEOUT_MS)
  if (!input) {
    // warn, not error: content-script.ts reports this as a named QA defect.
    console.warn('[Claude Tools] chat input not found within timeout')
    return {
      ok: false,
      error: 'input_not_found',
      message: `Couldn't find ${siteName()}'s chat box. Try reloading the page.`,
    }
  }

  input.focus()
  const inserted = typeText(input, prompt)
  if (!inserted || isInputEmpty(input)) {
    console.warn('[Claude Tools] prompt insertion did not take effect')
    return {
      ok: false,
      error: 'insert_failed',
      message: `Couldn't type the prompt into ${siteName()}'s chat box. Try reloading the page.`,
    }
  }

  return { ok: true }
}

const SEND_WATCH_TIMEOUT_MS = 5 * 60 * 1000
const SEND_WATCH_MIN_HOLD_MS = 250
const SEND_WATCH_POLL_MS = 200

/**
 * After a prompt is inserted, calls `onSent` once if the user is observed
 * to actually submit it: the chat box holds non-empty text for a beat and
 * then clears. Checked on a short timer rather than by watching the DOM,
 * because a textarea's text (Copilot) changes without any DOM mutation
 * and some sites swap the chat box for a new element when a message is
 * sent. Times out silently after 5 minutes (prompt edited away or
 * abandoned). Returns a cancel function.
 */
export function watchForSend(onSent: () => void, now: () => number = Date.now): () => void {
  let input = findChatInput()
  if (!input) return () => {}

  let done = false
  let heldNonEmptySince: number | null = isInputEmpty(input) ? null : now()

  const finish = (fire: boolean): void => {
    if (done) return
    done = true
    clearInterval(poll)
    clearTimeout(timer)
    if (fire) onSent()
  }

  const check = (): void => {
    if (done) return
    // The chat box was replaced: the new one is the one to watch.
    if (!input!.isConnected) input = findChatInput() ?? input
    const empty = !input!.isConnected || isInputEmpty(input!)
    if (!empty) {
      if (heldNonEmptySince === null) heldNonEmptySince = now()
      return
    }
    // Empty now. Count it as a send only if it had held our text for a
    // moment first (filters out transient states right after insert).
    if (heldNonEmptySince !== null && now() - heldNonEmptySince >= SEND_WATCH_MIN_HOLD_MS) {
      finish(true)
    }
  }

  const poll = setInterval(check, SEND_WATCH_POLL_MS)
  const timer = setTimeout(() => finish(false), SEND_WATCH_TIMEOUT_MS)

  return () => finish(false)
}
