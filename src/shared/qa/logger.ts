import { API_BASE_URL } from '../api-base'
import { QA_ENABLED, browserLabel, buildLabel } from './config'
import type { QaEventName } from './events'

// Tester QA logging: usage events and defects, queued in
// chrome.storage.local and sent to the backend in batches by the side
// panel (the only context that holds a sign-in token). The content script
// and service worker only queue.
//
// Each queued entry is its own storage key ("qa:<time>-<random>"), so the
// side panel, content script and service worker can all append at once
// without a read-modify-write race, and a flush removes exactly the keys
// it sent.
//
// Privacy: entries hold an event name, a few primitive props, and for
// errors a message and stack trace. Call sites never pass prompt text,
// button contents, emails or anything from a Claude conversation; console
// arguments that are objects are recorded only as "[object]".
//
// Everything is a no-op unless QA_ENABLED (the tester build).

export type QaSource = 'sidepanel' | 'content' | 'background'
export type QaProps = Record<string, string | number | boolean>

export interface QaEntry {
  kind: 'event' | 'error'
  name: string
  source: QaSource
  at: number
  version: string
  browser: string
  props?: QaProps
  message?: string
  stack?: string
}

export interface QaStorage {
  getAll(): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
  remove(keys: string[]): Promise<void>
}

export interface QaLoggerDeps {
  enabled: boolean
  storage: QaStorage
  fetch: typeof fetch
  now: () => number
  version: string
  browser: string
}

const KEY_PREFIX = 'qa:'
export const BATCH_SIZE = 50
/** Oldest entries beyond this are discarded at flush time (a tester who
 * never signs in shouldn't grow storage without bound). */
export const MAX_QUEUED = 500
/** Per context: stop recording errors after this many in ERROR_WINDOW_MS,
 * so a render loop that throws on every frame can't flood the queue. */
const MAX_ERRORS_PER_WINDOW = 50
const ERROR_WINDOW_MS = 10 * 60 * 1000
/** Identical errors closer together than this are recorded once. */
const DUPLICATE_WINDOW_MS = 5000

export function formatConsoleArgs(args: unknown[]): { message: string; stack: string | undefined } {
  let stack: string | undefined
  const parts = args.map((arg) => {
    if (arg instanceof Error) {
      stack ??= arg.stack
      return `${arg.name}: ${arg.message}`
    }
    if (typeof arg === 'string') return arg
    if (typeof arg === 'number' || typeof arg === 'boolean' || arg === null || arg === undefined) return String(arg)
    return '[object]'
  })
  return { message: parts.join(' ').slice(0, 1000), stack: stack?.slice(0, 4000) }
}

export function createQaLogger(deps: QaLoggerDeps) {
  let errorWindowStart = 0
  let errorsInWindow = 0
  let lastError = { message: '', at: 0 }
  let flushing: Promise<void> | null = null

  function enqueue(entry: Omit<QaEntry, 'at' | 'version' | 'browser'>): void {
    if (!deps.enabled) return
    const at = deps.now()
    const full: QaEntry = { ...entry, at, version: deps.version, browser: deps.browser }
    const key = `${KEY_PREFIX}${at.toString(36).padStart(9, '0')}-${Math.random().toString(36).slice(2, 8)}`
    deps.storage.set({ [key]: full }).catch(() => {
      /* storage unavailable (extension reloading) -- drop silently */
    })
  }

  function track(name: QaEventName, source: QaSource, props?: QaProps): void {
    enqueue({ kind: 'event', name, source, props })
  }

  /** Records a defect. `name` groups it on the dashboard
   * (e.g. "console_error", "uncaught_error", "insert_input_not_found"). */
  function reportError(name: string, source: QaSource, message: string, stack?: string, props?: QaProps): void {
    if (!deps.enabled) return
    const now = deps.now()
    if (message === lastError.message && now - lastError.at < DUPLICATE_WINDOW_MS) return
    lastError = { message, at: now }
    if (now - errorWindowStart > ERROR_WINDOW_MS) {
      errorWindowStart = now
      errorsInWindow = 0
    }
    if (++errorsInWindow > MAX_ERRORS_PER_WINDOW) return
    enqueue({ kind: 'error', name, source, message: message.slice(0, 1000), stack: stack?.slice(0, 4000), props })
  }

  async function pendingKeys(): Promise<{ keys: string[]; all: Record<string, unknown> }> {
    const all = await deps.storage.getAll()
    const keys = Object.keys(all).filter((k) => k.startsWith(KEY_PREFIX)).sort()
    return { keys, all }
  }

  async function flushOnce(token: string): Promise<void> {
    let { keys, all } = await pendingKeys()
    if (keys.length > MAX_QUEUED) {
      const overflow = keys.slice(0, keys.length - MAX_QUEUED)
      await deps.storage.remove(overflow)
      keys = keys.slice(overflow.length)
    }
    for (let i = 0; i < keys.length; i += BATCH_SIZE) {
      const batchKeys = keys.slice(i, i + BATCH_SIZE)
      const events = batchKeys.map((k) => all[k])
      let response: Response
      try {
        response = await deps.fetch(`${API_BASE_URL}/api/qa-events`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ events }),
        })
      } catch {
        return // offline -- keep everything for the next flush
      }
      if (response.status === 400) {
        // The server will never accept this batch; don't retry it forever.
        await deps.storage.remove(batchKeys)
        continue
      }
      if (!response.ok) return // 401/429/5xx -- try again later
      await deps.storage.remove(batchKeys)
    }
  }

  /** Sends everything queued. Concurrent calls share one flush. */
  function flush(token: string): Promise<void> {
    if (!deps.enabled) return Promise.resolve()
    flushing ??= flushOnce(token)
      .catch(() => {
        /* never let QA logging surface as an error of its own */
      })
      .finally(() => {
        flushing = null
      })
    return flushing
  }

  async function queuedCount(): Promise<number> {
    if (!deps.enabled) return 0
    return (await pendingKeys()).keys.length
  }

  return { track, reportError, flush, queuedCount }
}

export type QaLogger = ReturnType<typeof createQaLogger>

const chromeStorage: QaStorage = {
  getAll: () => chrome.storage.local.get(null),
  set: (items) => chrome.storage.local.set(items),
  remove: (keys) => chrome.storage.local.remove(keys),
}

let defaultLogger: QaLogger | null = null

function logger(): QaLogger {
  defaultLogger ??= createQaLogger({
    enabled: QA_ENABLED,
    storage: chromeStorage,
    fetch: (...args) => fetch(...args),
    now: () => Date.now(),
    version: buildLabel(),
    browser: browserLabel(),
  })
  return defaultLogger
}

let currentSource: QaSource = 'sidepanel'

export function qaTrack(name: QaEventName, props?: QaProps): void {
  if (QA_ENABLED) logger().track(name, currentSource, props)
}

export function qaDefect(name: string, message: string, props?: QaProps): void {
  if (QA_ENABLED) logger().reportError(name, currentSource, message, new Error(message).stack, props)
}

/** A defect the content script forwarded (see src/content/qa-report.ts). */
export function qaReportFromContent(name: string, message: string, stack?: string, props?: unknown): void {
  if (QA_ENABLED && /^[a-z0-9_]{1,64}$/.test(name)) {
    logger().reportError(name, 'content', message, stack, primitiveProps(props))
  }
}

/** Keeps at most 8 string/number/boolean props with short keys. */
function primitiveProps(raw: unknown): QaProps | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const out: QaProps = {}
  for (const [key, value] of Object.entries(raw).slice(0, 8)) {
    if (!/^[a-z0-9_]{1,40}$/i.test(key)) continue
    if (typeof value === 'string') out[key] = value.slice(0, 100)
    else if (typeof value === 'number' || typeof value === 'boolean') out[key] = value
  }
  return out
}

export function qaFlush(token: string): Promise<void> {
  return QA_ENABLED ? logger().flush(token) : Promise.resolve()
}

export function qaQueuedCount(): Promise<number> {
  return QA_ENABLED ? logger().queuedCount() : Promise.resolve(0)
}

/**
 * Installs defect capture for the side panel or service worker: every
 * console.error (the extension already logs every caught failure that
 * way), uncaught errors and unhandled promise rejections. Call once, first
 * thing, in the entry point. The content script uses its own dependency-
 * free version, src/content/qa-report.ts.
 */
export function installQaCapture(source: Exclude<QaSource, 'content'>): void {
  currentSource = source
  if (!QA_ENABLED) return
  const log = logger()

  const originalError = console.error.bind(console)
  let inside = false
  console.error = (...args: unknown[]) => {
    originalError(...args)
    if (inside) return
    inside = true
    try {
      const { message, stack } = formatConsoleArgs(args)
      const callSite = stack ?? new Error().stack?.split('\n').slice(2).join('\n')
      log.reportError('console_error', source, message, callSite)
    } finally {
      inside = false
    }
  }

  self.addEventListener('error', (event: ErrorEvent) => {
    const stack = event.error instanceof Error ? event.error.stack : `at ${event.filename}:${event.lineno}:${event.colno}`
    log.reportError('uncaught_error', source, event.message || 'Uncaught error', stack)
  })

  self.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const { message, stack } = formatConsoleArgs([event.reason])
    log.reportError('unhandled_rejection', source, message, stack)
  })
}
