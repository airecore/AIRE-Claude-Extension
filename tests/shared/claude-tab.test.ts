import { afterEach, describe, expect, it, vi } from 'vitest'
import { contentScriptFile, sendToClaudeTab } from '../../src/shared/claude-tab'

const request = { type: 'INSERT_PROMPT' as const, prompt: 'Hi' }
const unreachable = () => Promise.reject(new Error('Could not establish connection. Receiving end does not exist.'))

function fakeChrome(sendMessage: ReturnType<typeof vi.fn>, executeScript: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('chrome', {
    runtime: { getManifest: () => ({ content_scripts: [{ js: ['assets/content-script.js'], matches: [] }] }) },
    tabs: { sendMessage },
    scripting: { executeScript },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('sendToClaudeTab', () => {
  it('sends straight away when the tab already has the content script', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ ok: true })
    const executeScript = vi.fn()
    fakeChrome(sendMessage, executeScript)
    expect(await sendToClaudeTab(7, request)).toEqual({ ok: true, response: { ok: true } })
    expect(executeScript).not.toHaveBeenCalled()
  })

  it('adds the content script to a stale tab and tries again', async () => {
    const sendMessage = vi.fn().mockImplementationOnce(unreachable).mockResolvedValueOnce({ ok: true })
    const executeScript = vi.fn().mockResolvedValue([])
    fakeChrome(sendMessage, executeScript)
    expect(await sendToClaudeTab(7, request)).toEqual({ ok: true, response: { ok: true } })
    expect(executeScript).toHaveBeenCalledWith({ target: { tabId: 7 }, files: ['assets/content-script.js'] })
    expect(sendMessage).toHaveBeenCalledTimes(2)
  })

  it('gives up cleanly when Chrome refuses to add the script (e.g. not a claude.ai page)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const sendMessage = vi.fn().mockImplementation(unreachable)
    const executeScript = vi.fn().mockRejectedValue(new Error('Cannot access contents of the page'))
    fakeChrome(sendMessage, executeScript)
    expect(await sendToClaudeTab(7, request)).toEqual({ ok: false, reason: 'unreachable' })
    expect(sendMessage).toHaveBeenCalledTimes(1)
  })

  it('reports unreachable if the tab still does not answer after adding the script', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const sendMessage = vi.fn().mockImplementation(unreachable)
    fakeChrome(sendMessage, vi.fn().mockResolvedValue([]))
    expect(await sendToClaudeTab(7, request)).toEqual({ ok: false, reason: 'unreachable' })
  })
})

describe('contentScriptFile', () => {
  it("reads the content script's built file from the manifest", () => {
    expect(contentScriptFile({ content_scripts: [{ js: ['a.js'], matches: [] }] } as unknown as chrome.runtime.Manifest)).toBe('a.js')
    expect(contentScriptFile({} as chrome.runtime.Manifest)).toBeNull()
  })
})
