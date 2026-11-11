import { test, expect, EXTENSION_ID } from './fixtures'

// A claude.ai tab that was open BEFORE the extension was installed,
// updated or reloaded has no content script, and the sidebar used to fail
// with "Could not establish connection. Receiving end does not exist." The
// sidebar now adds the script to the tab itself (src/shared/claude-tab.ts).
//
// The test browser can't reload an extension, so the retry logic is
// unit-tested (tests/shared/claude-tab.test.ts). This checks the real
// parts: Chrome accepts adding the manifest's content script file to a
// claude.ai tab, and adding it to a tab that already has a live copy
// doesn't make prompts type twice.

test('re-adding the content script to a claude.ai tab works and never types a prompt twice', async ({ context }) => {
  await context.route('https://claude.ai/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><body><div data-testid="chat-input" contenteditable="true" role="textbox"></div></body>',
    }),
  )
  const claude = await context.newPage()
  const loaded = claude.waitForEvent('console', (m) => m.text().includes('content script loaded'))
  await claude.goto('https://claude.ai/new')
  await loaded

  const ext = await context.newPage()
  await ext.goto(`chrome-extension://${EXTENSION_ID}/src/sidepanel/index.html`)
  const result = await ext.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ url: 'https://claude.ai/*' })
    const file = chrome.runtime.getManifest().content_scripts![0].js![0]
    // Exactly what claude-tab.ts does when the tab can't be reached.
    await chrome.scripting.executeScript({ target: { tabId: tab.id! }, files: [file] })
    return chrome.tabs.sendMessage(tab.id!, { type: 'INSERT_PROMPT', prompt: 'Typed once' })
  })

  expect(result).toEqual({ ok: true })
  await expect(claude.locator('[data-testid="chat-input"]')).toHaveText('Typed once')
})
