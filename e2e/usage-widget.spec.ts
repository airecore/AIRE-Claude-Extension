import { test, expect } from './fixtures'
import type { BrowserContext } from '@playwright/test'

// The usage box on claude.ai's sidebar, injected by the REAL extension
// (Chrome injects the content script because the page is served at
// https://claude.ai/, intercepted here so no real account is needed).
// Checks the box takes its colours from claude.ai's theme instead of
// always being a dark box.

const USAGE = {
  limits: [
    { kind: 'session', group: 'session', percent: 12, severity: 'normal', resets_at: null, scope: null, is_active: true },
    { kind: 'weekly_all', group: 'weekly', percent: 64, severity: 'warning', resets_at: null, scope: null, is_active: true },
  ],
  spend: null,
}

const THEMES = {
  light: { background: 'rgb(250, 249, 245)', color: 'rgb(31, 30, 29)' },
  dark: { background: 'rgb(38, 38, 36)', color: 'rgb(240, 238, 230)' },
}

async function openClaude(context: BrowserContext, theme: keyof typeof THEMES) {
  const { background, color } = THEMES[theme]
  await context.addCookies([{ name: 'lastActiveOrg', value: 'org-test', domain: 'claude.ai', path: '/' }])
  await context.route('https://claude.ai/**', (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/usage')) return route.fulfill({ json: USAGE })
    return route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html><body style="margin:0;background:${background};color:${color};font-family:serif">
        <nav id="sidebar" style="width:260px;padding:8px"><div data-testid="sidebar-recents">Recents</div></nav>
        <main><div data-testid="chat-input" contenteditable="true"></div></main></body></html>`,
    })
  })
  const page = await context.newPage()
  await page.goto('https://claude.ai/new')
  await page.locator('#claude-tools-usage-widget').waitFor()
  return page
}

for (const theme of ['light', 'dark'] as const) {
  test(`the usage box follows claude.ai's ${theme} theme`, async ({ context }) => {
    const page = await openClaude(context, theme)
    const widget = page.locator('#claude-tools-usage-widget')
    await expect(widget.locator('.ctu-ring')).toHaveCount(2)

    const styles = await widget.evaluate((el) => {
      const pct = el.querySelector('.ctu-pct') as HTMLElement
      return {
        text: getComputedStyle(pct).color,
        font: getComputedStyle(el).fontFamily,
        background: getComputedStyle(el).backgroundColor,
      }
    })
    // Text is the sidebar's own colour, the font is claude.ai's, and the
    // background is only a faint tint of that colour -- never a solid dark box.
    expect(styles.text).toBe(THEMES[theme].color)
    expect(styles.font).toBe('serif')
    expect(styles.background).not.toBe('rgb(19, 18, 16)')
    await page.locator('#sidebar').screenshot({ path: `test-results/usage-widget-${theme}.png` })
  })
}

// ChatGPT and Gemini get the same box, in their own sidebar, from their own
// numbers (shapes recorded from the live sites, 2026-11). Copilot shows no
// usage anywhere, so it gets none.

test("ChatGPT: the box shows uses left per feature, from ChatGPT's own numbers", async ({ context }) => {
  await context.route('https://chatgpt.com/**', (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth/session') return route.fulfill({ json: { accessToken: 'test-token' } })
    if (url.pathname === '/backend-api/conversation/init') {
      if (route.request().headers()['authorization'] !== 'Bearer test-token') return route.fulfill({ status: 401 })
      return route.fulfill({
        json: {
          limits_progress: [
            { feature_name: 'deep_research', remaining: 4, reset_after: '2099-01-01T00:00:00+00:00' },
            { feature_name: 'image_gen', remaining: 0, reset_after: '2099-01-01T00:00:00+00:00' },
            { feature_name: 'paste_text_to_file', remaining: 3, reset_after: '2099-01-01T00:00:00+00:00' },
          ],
        },
      })
    }
    return route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><body style="background:#181818;color:rgb(237, 237, 237);font-family:monospace">
        <nav aria-label="Chat history"><div class="group/nav-section">Recents</div></nav>
        <div class="ProseMirror" contenteditable="true" aria-label="Ask ChatGPT"></div></body>`,
    })
  })
  const page = await context.newPage()
  await page.goto('https://chatgpt.com/')
  const widget = page.locator('#claude-tools-usage-widget')
  await expect(widget.locator('.ctu-ring')).toHaveCount(2)
  await expect(widget.locator('.ctu-ring').first()).toHaveAttribute('aria-label', /Deep research: 4 left/)
  await expect(widget.locator('.ctu-pct').nth(1)).toHaveText('0')
  // Inside ChatGPT's sidebar, above its first section, in its font and colour.
  expect(await widget.evaluate((el) => el.nextElementSibling?.textContent)).toBe('Recents')
  expect(await widget.evaluate((el) => getComputedStyle(el).fontFamily)).toBe('monospace')
  expect(await widget.evaluate((el) => getComputedStyle(el.querySelector('.ctu-pct')!).color)).toBe('rgb(237, 237, 237)')
})

test("Gemini: its Usage page's numbers are kept and shown on every Gemini page", async ({ context }) => {
  // Like the real Gemini, the font is set on the sidebar items, not the page.
  const sidebar = `<div data-test-id="overflow-container"><expandable-section><span style="font-family:fantasy">Notebooks</span></expandable-section></div>`
  await context.route('https://gemini.google.com/**', (route) => {
    const url = new URL(route.request().url())
    const usage =
      url.pathname === '/usage'
        ? `<ul aria-label="Usage windows">
             <li><div>Current usage</div><div>35% used</div><div>Resets at 1:04 PM</div></li>
             <li><div>Weekly limit</div><div>Resets Nov 28 at 11:04 AM</div><div>80% used</div></li></ul>`
        : '<rich-textarea><div class="ql-editor" contenteditable="true"></div></rich-textarea>'
    return route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><body style="font-family:cursive">${sidebar}${usage}</body>`,
    })
  })
  const page = await context.newPage()
  await page.goto('https://gemini.google.com/usage')
  const widget = page.locator('#claude-tools-usage-widget')
  await expect(widget.locator('.ctu-ring')).toHaveCount(2)

  await page.goto('https://gemini.google.com/app')
  await expect(widget.locator('.ctu-pct')).toHaveText(['35%', '80%'])
  await expect(widget.locator('.ctu-reset').first()).toHaveText('resets at 1:04 PM')
  await expect(widget.locator('.ctu-updated')).toHaveText(/updated/)
  expect(await widget.evaluate((el) => getComputedStyle(el).fontFamily)).toBe('fantasy')
})

test('Copilot shows no usage anywhere, so it gets no box', async ({ context }) => {
  await context.route('https://copilot.microsoft.com/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><body><span contenteditable="true" aria-label="Message Copilot"></span></body>',
    }),
  )
  const page = await context.newPage()
  const loaded = page.waitForEvent('console', (m) => m.text().includes('content script loaded'))
  await page.goto('https://copilot.microsoft.com/')
  await loaded
  await page.waitForTimeout(1500)
  await expect(page.locator('#claude-tools-usage-widget')).toHaveCount(0)
})

// The usage box must not hammer a site, or the QA dashboard, when it
// can't show anything -- nor redraw itself in a loop.

test('when usage cannot be loaded, the usage box does not retry on every page change', async ({ context }) => {
  let usageCalls = 0
  await context.addCookies([{ name: 'lastActiveOrg', value: 'org-test', domain: 'claude.ai', path: '/' }])
  await context.route('https://claude.ai/**', (route) => {
    if (new URL(route.request().url()).pathname.endsWith('/usage')) {
      usageCalls++
      return route.fulfill({ status: 500, body: 'down' })
    }
    return route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><body><nav><div data-testid="sidebar-recents">Recents</div></nav><main id="chat"></main></body>',
    })
  })
  const page = await context.newPage()
  await page.goto('https://claude.ai/new')
  // A reply streaming in: the page changes constantly for several seconds.
  await page.evaluate(() => {
    let n = 0
    const timer = setInterval(() => {
      document.getElementById('chat')!.append(`word ${n++} `)
      if (n > 40) clearInterval(timer)
    }, 100)
  })
  await page.waitForTimeout(5000)
  expect(usageCalls).toBeLessThanOrEqual(1)
})

test("on Gemini's Usage page the box saves the numbers once instead of redrawing in a loop", async ({ context }) => {
  await context.route('https://gemini.google.com/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><body>
        <nav><div data-test-id="overflow-container"><expandable-section>Chats</expandable-section></div></nav>
        <ul aria-label="Usage windows">
          <li>Current usage\n35% used\nResets at 1:04 PM</li>
          <li>Weekly limit\nResets Nov 28 at 11:04 AM\n60% used</li>
        </ul></body>`,
    }),
  )
  const page = await context.newPage()
  await page.goto('https://gemini.google.com/u/1/usage')
  const widget = page.locator('#claude-tools-usage-widget')
  await expect(widget.locator('.ctu-ring')).toHaveCount(2) // works for a second Google account too
  // Mark the box; a redraw would replace it with a fresh, unmarked one.
  await widget.evaluate((el) => el.setAttribute('data-test-mark', '1'))
  await page.waitForTimeout(3500)
  await expect(page.locator('#claude-tools-usage-widget[data-test-mark="1"]')).toHaveCount(1)
})
