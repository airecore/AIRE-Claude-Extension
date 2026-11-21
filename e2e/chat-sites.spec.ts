import { test, expect, EXTENSION_ID } from './fixtures'

// The sidebar works on Claude, ChatGPT, Copilot and Gemini. Each site is
// served here at its real address from a local copy of its chat box
// (recorded from the live sites, 2026-11), so Chrome itself decides
// whether to inject the real content script -- proving the manifest's
// matches -- and the real script then has to find that site's chat box,
// type into it, and notice when the message is sent.

interface SiteCase {
  name: string
  url: string
  /** The site's chat box as the live site renders it. */
  html: string
  /** Locator for the element the text must land in. */
  input: string
  /** Empties the chat box the way the site does after Send. */
  clear: string
}

const SITES: SiteCase[] = [
  {
    name: 'Claude',
    url: 'https://claude.ai/new',
    html: '<fieldset><div class="ProseMirror" contenteditable="true" role="textbox" data-testid="chat-input"></div></fieldset>',
    input: '[data-testid="chat-input"]',
    clear: 'document.querySelector("[data-testid=chat-input]").textContent = ""',
  },
  {
    name: 'ChatGPT',
    url: 'https://chatgpt.com/',
    html:
      '<form><div id="prompt-textarea" class="ProseMirror" contenteditable="true" role="textbox"><p><br class="ProseMirror-trailingBreak"></p></div></form>',
    input: '#prompt-textarea',
    clear: 'document.querySelector("#prompt-textarea").innerHTML = "<p><br></p>"',
  },
  {
    name: 'ChatGPT (signed out)',
    url: 'https://chatgpt.com/',
    html: '<form><textarea id="mobile-composer-prompt" aria-label="Chat with ChatGPT" placeholder="Ask ChatGPT"></textarea></form>',
    input: '#mobile-composer-prompt',
    clear: 'document.querySelector("#mobile-composer-prompt").value = ""',
  },
  {
    name: 'Copilot',
    url: 'https://copilot.microsoft.com/',
    html: '<textarea id="userInput" data-testid="composer-input" placeholder="Message Copilot"></textarea>',
    input: '#userInput',
    clear: 'document.querySelector("#userInput").value = ""',
  },
  {
    // Copilot's Lexical editor drops typed line breaks; a paste keeps them.
    // This stand-in behaves the same way: it only handles paste events.
    name: 'Copilot (copilot.com, multi-line)',
    url: 'https://copilot.com/chat',
    html:
      '<span id="m365-chat-editor-target-element" contenteditable="true" role="textbox" aria-label="Message Copilot"></span>' +
      '<script>const e=document.getElementById("m365-chat-editor-target-element");' +
      'e.addEventListener("paste",(ev)=>{ev.preventDefault();e.innerText=ev.clipboardData.getData("text/plain")})</script>',
    input: '#m365-chat-editor-target-element',
    clear: 'document.querySelector("#m365-chat-editor-target-element").textContent = ""',
  },
  {
    name: 'Gemini',
    url: 'https://gemini.google.com/app',
    // The hidden-purpose .ql-clipboard editable comes FIRST on purpose:
    // it must never be picked over the real editor.
    html:
      '<rich-textarea><div class="ql-clipboard" contenteditable="true"></div>' +
      '<div class="ql-editor ql-blank textarea" contenteditable="true" role="textbox" aria-label="Enter a prompt for Gemini"><p><br></p></div></rich-textarea>',
    input: '.ql-editor',
    clear: 'document.querySelector(".ql-editor").innerHTML = "<p><br></p>"',
  },
]

for (const site of SITES) {
  test(`${site.name}: Chrome injects the content script, which types the prompt and sees it sent`, async ({
    context,
  }) => {
    const origin = new URL(site.url).origin
    await context.route(`${origin}/**`, (route) =>
      route.fulfill({ contentType: 'text/html', body: `<!doctype html><body>${site.html}</body>` }),
    )
    const page = await context.newPage()
    const loaded = page.waitForEvent('console', (m) => m.text().includes('content script loaded'))
    await page.goto(site.url)
    await loaded

    const ext = await context.newPage()
    await ext.goto(`chrome-extension://${EXTENSION_ID}/src/sidepanel/index.html`)
    // Collect PROMPT_SENT the way the side panel does.
    await ext.evaluate(() => {
      const w = window as unknown as { __sent: unknown[] }
      w.__sent = []
      chrome.runtime.onMessage.addListener((m: unknown) => {
        if ((m as { type?: string }).type === 'PROMPT_SENT') w.__sent.push(m)
      })
    })
    const result = await ext.evaluate(async (origin) => {
      const [tab] = await chrome.tabs.query({ url: `${origin}/*` })
      return chrome.tabs.sendMessage(tab.id!, { type: 'INSERT_PROMPT', prompt: 'Hello from AIRE', runToken: 'tok' })
    }, origin)

    expect(result).toEqual({ ok: true })
    const input = page.locator(site.input)
    if (site.html.startsWith('<textarea') || site.html.includes('><textarea')) {
      await expect(input).toHaveValue('Hello from AIRE')
    } else {
      await expect(input).toHaveText('Hello from AIRE')
    }

    // The usage rings read claude.ai's own numbers: Claude only.
    const hasWidget = await page.evaluate(() => Boolean(document.getElementById('claude-tools-usage-widget')))
    if (site.name !== 'Claude') expect(hasWidget).toBe(false)

    await page.waitForTimeout(400)
    await page.evaluate(site.clear)
    await expect
      .poll(() => ext.evaluate(() => (window as unknown as { __sent: unknown[] }).__sent))
      .toContainEqual({ type: 'PROMPT_SENT', runToken: 'tok' })
  })
}

test('a missing chat box names the site in the error', async ({ context }) => {
  await context.route('https://gemini.google.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><body><p>no editor</p></body>' }),
  )
  const page = await context.newPage()
  const loaded = page.waitForEvent('console', (m) => m.text().includes('content script loaded'))
  await page.goto('https://gemini.google.com/app')
  await loaded

  const ext = await context.newPage()
  await ext.goto(`chrome-extension://${EXTENSION_ID}/src/sidepanel/index.html`)
  const result = await ext.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ url: 'https://gemini.google.com/*' })
    return chrome.tabs.sendMessage(tab.id!, { type: 'INSERT_PROMPT', prompt: 'x' })
  })
  expect(result).toMatchObject({ ok: false, error: 'input_not_found', message: expect.stringContaining("Gemini's chat box") })
})
