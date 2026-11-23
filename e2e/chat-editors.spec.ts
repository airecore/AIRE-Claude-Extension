import type { BrowserContext, Page } from '@playwright/test'
import { test, expect, EXTENSION_ID } from './fixtures'

// Modern chat editors (ProseMirror on Claude/ChatGPT, Quill on Gemini,
// Lexical on Copilot) don't behave like a plain contenteditable: they take
// over typing themselves, update the page a moment later, or swap the chat
// box for a new element. Inserting must succeed in all of these -- and say
// so -- instead of reporting "Couldn't type the prompt" while the prompt
// is in fact there.
//
// Each page here is served at the real site address, so Chrome injects the
// real content script, and the prompt is sent the way the side panel does.

/** Editors under test. Each script makes the box at #box behave one way. */
const EDITORS: { name: string; host: string; script: string }[] = [
  {
    // Copilot's Lexical editor: handles the paste itself and draws it on
    // its next render.
    name: 'takes the paste itself and draws it a moment later (Lexical)',
    host: 'copilot.microsoft.com',
    script: `
      const box = document.getElementById('box')
      box.addEventListener('paste', (e) => {
        e.preventDefault()
        const text = e.clipboardData.getData('text/plain')
        setTimeout(() => { box.textContent += text }, 60)
      })`,
  },
  {
    // ProseMirror/React: on input, the editor throws away the browser's
    // change and redraws from its own state just after.
    name: 'redraws typed text from its own state just after (ProseMirror, React)',
    host: 'chatgpt.com',
    script: `
      const box = document.getElementById('box')
      let state = '' // the editor's own copy of the text
      box.addEventListener('input', () => {
        if (box.textContent) state = box.textContent
        box.textContent = ''
        queueMicrotask(() => { box.textContent = state })
      })`,
  },
  {
    name: 'swaps the chat box for a new element when focused',
    host: 'claude.ai',
    script: `
      const box = document.getElementById('box')
      box.addEventListener('focus', () => {
        const fresh = box.cloneNode()
        fresh.id = 'box'
        box.replaceWith(fresh)
        fresh.focus()
      }, { once: true })`,
  },
  {
    // Quill: redraws on the next animation frames.
    name: 'redraws typed text a couple of frames later (Quill)',
    host: 'gemini.google.com',
    script: `
      const box = document.getElementById('box')
      let state = ''
      box.addEventListener('input', () => {
        if (box.textContent) state = box.textContent
        box.textContent = ''
        requestAnimationFrame(() => requestAnimationFrame(() => { box.textContent = state }))
      })`,
  },
]

async function openSite(context: BrowserContext, host: string, script: string): Promise<Page> {
  await context.route(`https://${host}/**`, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><body><form><div id="box" contenteditable="true" role="textbox" aria-label="Write your prompt"></div></form><script>${script}</script></body>`,
    }),
  )
  const page = await context.newPage()
  const loaded = page.waitForEvent('console', (m) => m.text().includes('content script loaded'))
  await page.goto(`https://${host}/`)
  await loaded
  return page
}

async function sendPrompt(context: BrowserContext, host: string, prompt: string): Promise<unknown> {
  const ext = await context.newPage()
  await ext.goto(`chrome-extension://${EXTENSION_ID}/src/sidepanel/index.html`)
  return ext.evaluate(
    async ({ host, prompt }) => {
      const [tab] = await chrome.tabs.query({ url: `https://${host}/*` })
      return chrome.tabs.sendMessage(tab.id!, { type: 'INSERT_PROMPT', prompt })
    },
    { host, prompt },
  )
}

for (const editor of EDITORS) {
  test(`inserting works and reports success when the editor ${editor.name}`, async ({ context }) => {
    const page = await openSite(context, editor.host, editor.script)
    const prompt = 'Summarise this.\nThen list three actions.'

    const response = await sendPrompt(context, editor.host, prompt)

    expect(response).toEqual({ ok: true })
    // Typed exactly once -- never twice because a slow editor looked empty.
    await expect.poll(() => page.locator('#box').textContent()).toContain('Summarise this.')
    await page.waitForTimeout(300)
    const text = (await page.locator('#box').textContent()) ?? ''
    expect(text.split('Summarise this.').length - 1).toBe(1)
  })
}

test('a box that really stays empty is still reported, so real failures are not hidden', async ({ context }) => {
  // A box that throws away anything put in it.
  await openSite(
    context,
    'claude.ai',
    `const box = document.getElementById('box')
     new MutationObserver(() => { if (box.textContent) box.textContent = '' })
       .observe(box, { childList: true, subtree: true, characterData: true })`,
  )
  const response = await sendPrompt(context, 'claude.ai', 'Hello')
  expect(response).toMatchObject({ ok: false, error: 'insert_failed' })
})
