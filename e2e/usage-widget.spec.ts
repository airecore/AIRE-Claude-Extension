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
