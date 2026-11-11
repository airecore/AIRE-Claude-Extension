// Tester build defect capture for the content script on claude.ai.
//
// Deliberately imports nothing at runtime (types only): sharing a module
// with the side panel would make Vite split the content script into a
// loader plus chunks, which claude.ai would then have to fetch as web-
// accessible resources. Instead this forwards each defect to the service
// worker as a QA_REPORT message, and the worker queues it with the shared
// logger (src/shared/qa/logger.ts).
//
// Only errors whose stack points into the extension are forwarded, so
// claude.ai's own page errors are never recorded.

import type { QaReportMessage } from '../shared/messages'

const ENABLED = typeof __AIRE_QA__ !== 'undefined' && __AIRE_QA__ === true

function send(name: string, message: string, stack: string | undefined): void {
  const report: QaReportMessage = {
    type: 'QA_REPORT',
    name,
    message: message.slice(0, 1000),
    stack: stack?.slice(0, 4000),
  }
  try {
    chrome.runtime.sendMessage(report).catch(() => {
      /* extension reloading -- nothing to report to */
    })
  } catch {
    /* extension context invalidated */
  }
}

function describe(value: unknown): { message: string; stack: string | undefined } {
  if (value instanceof Error) return { message: `${value.name}: ${value.message}`, stack: value.stack }
  if (typeof value === 'string') return { message: value, stack: undefined }
  return { message: '[object]', stack: undefined }
}

const fromExtension = (stack: string | undefined) => (stack ?? '').includes('chrome-extension://')

/** Records a named defect (e.g. the chat box could not be found). */
export function qaContentDefect(name: string, message: string): void {
  if (ENABLED) send(name, message, new Error(message).stack)
}

export function installContentQaCapture(): void {
  if (!ENABLED) return

  const originalError = console.error.bind(console)
  console.error = (...args: unknown[]) => {
    originalError(...args)
    const parts = args.map((a) => describe(a))
    const stack = parts.find((p) => p.stack)?.stack ?? new Error().stack?.split('\n').slice(2).join('\n')
    if (fromExtension(stack)) send('console_error', parts.map((p) => p.message).join(' '), stack)
  }

  self.addEventListener('error', (event: ErrorEvent) => {
    const stack = event.error instanceof Error ? event.error.stack : `at ${event.filename}:${event.lineno}:${event.colno}`
    if (fromExtension(stack)) send('uncaught_error', event.message || 'Uncaught error', stack)
  })

  self.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const { message, stack } = describe(event.reason)
    if (fromExtension(stack)) send('unhandled_rejection', message, stack)
  })
}
