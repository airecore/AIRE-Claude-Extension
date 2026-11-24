import { test, expect, EXTENSION_ID } from './fixtures'

// The side panel's page can be opened as an ordinary tab (a pop-out, and
// the only way browser-automation tools like Claude in Chrome can reach
// it). There, prompts go to the chat tab used most recently -- with no
// test overrides of chrome.tabs here.

test('the panel opened as a tab types prompts into the most recently used chat tab', async ({ context }) => {
  for (const host of ['claude.ai', 'chatgpt.com']) {
    await context.route(`https://${host}/**`, (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><body><form><div id="box" contenteditable="true" role="textbox" aria-label="Write your prompt"></div></form></body>',
      }),
    )
  }
  const claude = await context.newPage()
  await claude.goto('https://claude.ai/new')
  const chatgpt = await context.newPage()
  const loaded = chatgpt.waitForEvent('console', (m) => m.text().includes('content script loaded'))
  await chatgpt.goto('https://chatgpt.com/')
  await loaded
  await chatgpt.bringToFront() // the most recently used chat tab

  const panel = await context.newPage()
  await panel.goto(`chrome-extension://${EXTENSION_ID}/src/sidepanel/index.html`)
  await panel.getByRole('button', { name: /add prompt/i }).click()
  await panel.getByRole('button', { name: /write your own/i }).click()
  await panel.getByLabel('Name').fill('Test')
  await panel.getByRole('textbox', { name: 'Prompt' }).fill('Summarise this.\nThen list three actions.')
  await panel.getByRole('button', { name: 'Save' }).click()
  await panel.getByRole('button', { name: 'Run Test' }).click()

  await expect(chatgpt.locator('#box')).toContainText('Summarise this.')
  await expect(claude.locator('#box')).toHaveText('')
  await expect(panel.getByText(/Couldn't|Open Claude/)).toHaveCount(0)
})
