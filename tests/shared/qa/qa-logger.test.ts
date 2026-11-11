import { describe, expect, it, vi } from 'vitest'
import { BATCH_SIZE, MAX_QUEUED, createQaLogger, formatConsoleArgs, type QaStorage } from '../../../src/shared/qa/logger'

function memoryStorage(): QaStorage & { data: Record<string, unknown> } {
  const data: Record<string, unknown> = { buttons: ['not qa data'] }
  return {
    data,
    getAll: async () => ({ ...data }),
    set: async (items) => void Object.assign(data, items),
    remove: async (keys) => keys.forEach((k) => delete data[k]),
  }
}

function setup(fetchImpl: typeof fetch = vi.fn(async () => new Response(null, { status: 204 })), enabled = true) {
  const storage = memoryStorage()
  let clock = 1_700_000_000_000
  const logger = createQaLogger({
    enabled,
    storage,
    fetch: fetchImpl,
    now: () => clock,
    version: '1.0.0+test',
    browser: 'Chrome 131',
  })
  const tick = (ms: number) => { clock += ms }
  return { storage, logger, tick, fetchImpl: fetchImpl as ReturnType<typeof vi.fn> }
}

const flushMicrotasks = () => new Promise((r) => setTimeout(r, 0))
const qaKeys = (data: Record<string, unknown>) => Object.keys(data).filter((k) => k.startsWith('qa:'))

describe('createQaLogger', () => {
  it('does nothing at all when disabled (the store build)', async () => {
    const { storage, logger, fetchImpl } = setup(undefined, false)
    logger.track('button_run', 'sidepanel')
    logger.reportError('console_error', 'sidepanel', 'boom')
    await logger.flush('tok')
    expect(qaKeys(storage.data)).toHaveLength(0)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('queues each event under its own key with version and browser', async () => {
    const { storage, logger, tick } = setup()
    logger.track('button_run', 'sidepanel', { type: 'prompt' })
    tick(1)
    logger.track('button_sent', 'sidepanel')
    await flushMicrotasks()
    const keys = qaKeys(storage.data)
    expect(keys).toHaveLength(2)
    expect(storage.data[keys.sort()[0]]).toMatchObject({
      kind: 'event', name: 'button_run', source: 'sidepanel', version: '1.0.0+test', browser: 'Chrome 131', props: { type: 'prompt' },
    })
  })

  it('sends queued events in batches and removes only what was sent', async () => {
    const { storage, logger, tick, fetchImpl } = setup()
    for (let i = 0; i < BATCH_SIZE + 5; i++) { logger.track('button_run', 'sidepanel'); tick(1) }
    await flushMicrotasks()
    await logger.flush('tok')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toMatch(/\/api\/qa-events$/)
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
    expect(JSON.parse(init.body as string).events).toHaveLength(BATCH_SIZE)
    expect(qaKeys(storage.data)).toHaveLength(0)
    expect(storage.data.buttons).toEqual(['not qa data'])
  })

  it('keeps events queued when offline or the server fails, for the next flush', async () => {
    const offline = vi.fn(async () => { throw new Error('offline') })
    const { storage, logger } = setup(offline as unknown as typeof fetch)
    logger.track('button_run', 'sidepanel')
    await flushMicrotasks()
    await logger.flush('tok')
    expect(qaKeys(storage.data)).toHaveLength(1)

    const failing = setup(vi.fn(async () => new Response(null, { status: 503 })))
    failing.logger.track('button_run', 'sidepanel')
    await flushMicrotasks()
    await failing.logger.flush('tok')
    expect(qaKeys(failing.storage.data)).toHaveLength(1)
  })

  it('drops a batch the server rejects as malformed instead of retrying forever', async () => {
    const { storage, logger } = setup(vi.fn(async () => new Response(null, { status: 400 })))
    logger.track('button_run', 'sidepanel')
    await flushMicrotasks()
    await logger.flush('tok')
    expect(qaKeys(storage.data)).toHaveLength(0)
  })

  it('caps the queue, discarding the oldest entries', async () => {
    const { storage, logger, tick } = setup(vi.fn(async () => { throw new Error('offline') }) as unknown as typeof fetch)
    for (let i = 0; i < MAX_QUEUED + 20; i++) { logger.track('button_run', 'sidepanel', { i }); tick(1) }
    await flushMicrotasks()
    await logger.flush('tok')
    const keys = qaKeys(storage.data).sort()
    expect(keys).toHaveLength(MAX_QUEUED)
    expect((storage.data[keys[0]] as { props: { i: number } }).props.i).toBe(20)
  })

  it('shares one flush between concurrent callers', async () => {
    const { logger, fetchImpl } = setup()
    logger.track('button_run', 'sidepanel')
    await flushMicrotasks()
    await Promise.all([logger.flush('tok'), logger.flush('tok')])
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('records an identical error once in quick succession, and caps error floods', async () => {
    const { storage, logger, tick } = setup()
    logger.reportError('console_error', 'sidepanel', 'same')
    logger.reportError('console_error', 'sidepanel', 'same')
    tick(6000)
    logger.reportError('console_error', 'sidepanel', 'same')
    for (let i = 0; i < 100; i++) logger.reportError('console_error', 'sidepanel', `flood ${i}`)
    await flushMicrotasks()
    expect(qaKeys(storage.data)).toHaveLength(50)
  })
})

describe('formatConsoleArgs', () => {
  it('keeps strings and error messages but never object contents', () => {
    const error = new TypeError('x is undefined')
    const out = formatConsoleArgs(['[Claude Tools] failed', error, { prompt: 'secret prompt text' }, 42])
    expect(out.message).toBe('[Claude Tools] failed TypeError: x is undefined [object] 42')
    expect(out.message).not.toContain('secret')
    expect(out.stack).toBe(error.stack)
  })
})
