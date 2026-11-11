import { join } from 'node:path'
import { readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Page, BrowserContext } from '@playwright/test'
import { test, expect, EXTENSION_ID } from '../fixtures'
import { mockClerkAndBackend, type OrgScenario } from '../mock-backend'

// Chrome Web Store screenshots (1280x800) and the small promo tile
// (440x280), rendered from the REAL extension UI with demo data -- re-run
// after UI changes:  pnpm run store-assets
// Not part of the normal e2e run (see playwright.config.ts testIgnore).

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const OUT = join(ROOT, 'store-assets')
mkdirSync(OUT, { recursive: true })
const ICON = readFileSync(join(ROOT, 'src/icons/icon-128.png')).toString('base64')
const now = new Date().toISOString()

const TEAM: OrgScenario = {
  email: 'alex@northwind.example',
  orgSession: { state: 'active', org: { id: 'org-1', name: 'Northwind' }, role: 'director' },
  orgPrompts: {
    org: { name: 'Northwind' },
    tabs: [
      { id: 't1', name: 'Sales', emoji: null, sort_order: 0 },
      { id: 't2', name: 'Support', emoji: null, sort_order: 1 },
      { id: 't3', name: 'Marketing', emoji: null, sort_order: 2 },
    ],
    prompts: [
      { id: 'p1', name: 'Follow-up email after a demo', prompt_text: 'x', type: 'prompt', tab_id: 't1', sort_order: 0 },
      { id: 'p2', name: 'Summarise a discovery call', prompt_text: 'x', type: 'prompt', tab_id: 't1', sort_order: 1 },
      { id: 'p3', name: 'Objection handling', prompt_text: 'x', type: 'prompt', tab_id: 't1', sort_order: 2 },
      { id: 'p4', name: 'Proposal outline', prompt_text: '/proposal', type: 'skill', tab_id: 't1', sort_order: 3 },
      { id: 'p5', name: 'Polite refund reply', prompt_text: 'x', type: 'prompt', tab_id: 't2', sort_order: 0 },
    ],
  },
  members: [
    { email: 'alex@northwind.example', role: 'director', status: 'active', createdAt: now },
    { email: 'sam@northwind.example', role: 'member', status: 'active', createdAt: now },
    { email: 'priya@northwind.example', role: 'member', status: 'active', createdAt: now },
    { email: 'jordan@northwind.example', role: 'member', status: 'pending', createdAt: now },
    { email: 'casey@partner.example', role: 'member', status: 'invited', createdAt: now },
  ],
  analytics: {
    topPrompts: [
      { promptId: 'p1', name: 'Follow-up email after a demo', runCount: 142 },
      { promptId: 'p2', name: 'Summarise a discovery call', runCount: 97 },
      { promptId: 'p5', name: 'Polite refund reply', runCount: 64 },
    ],
    perMember: [
      { email: 'sam@northwind.example', runCount: 131, lastUsedAt: now },
      { email: 'priya@northwind.example', runCount: 104, lastUsedAt: now },
      { email: 'alex@northwind.example', runCount: 68, lastUsedAt: now },
    ],
    dailyRuns: [],
  },
  usageSnapshots: [
    { email: 'sam@northwind.example', sessionPercent: 42, weeklyPercent: 61, spendPercent: 0, updatedAt: now },
    { email: 'priya@northwind.example', sessionPercent: 18, weeklyPercent: 35, spendPercent: 0, updatedAt: now },
    { email: 'alex@northwind.example', sessionPercent: 7, weeklyPercent: 22, spendPercent: 0, updatedAt: now },
  ],
}

async function openPanel(context: BrowserContext, scenario?: OrgScenario): Promise<Page> {
  const page = await context.newPage()
  if (scenario) await mockClerkAndBackend(page, scenario)
  await page.setViewportSize({ width: 380, height: 740 })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto(`chrome-extension://${EXTENSION_ID}/src/sidepanel/index.html`)
  await page.waitForSelector('.wordmark')
  await page.addStyleTag({ content: '::-webkit-scrollbar { display: none }' })
  return page
}



async function importShowcase(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.locator('.settings-file-input').setInputFiles(join(ROOT, 'examples/showcase.json'))
  await expect(page.locator('.settings-success')).toBeVisible()
  await page.getByRole('button', { name: /back/i }).click()
  await page.locator('.folder-tab', { hasText: 'Writing' }).first().click()
}

async function signIn(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('button', { name: 'Manage Organisation' })).toBeVisible()
}

/** Lays a panel capture out on a 1280x800 branded canvas and saves it. */
async function compose(context: BrowserContext, panel: Buffer, file: string, eyebrow: string, title: string, body: string) {
  const page = await context.newPage()
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.setContent(`<!doctype html><html><body style="margin:0;width:1280px;height:800px;background:#16130f;color:#f2efe9;
    font-family:-apple-system,'Segoe UI',system-ui,Roboto,Arial,sans-serif;display:flex;align-items:center;gap:72px;padding:0 96px;box-sizing:border-box">
    <div style="flex:1">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:28px">
        <img src="data:image/png;base64,${ICON}" width="40" height="40" style="border-radius:10px">
        <span style="font-weight:800;font-size:20px;letter-spacing:-0.01em">AI Ready Tools Extension</span></div>
      <div style="font:13px ui-monospace,Consolas,monospace;letter-spacing:.14em;color:#8b7fd4;text-transform:uppercase;margin-bottom:14px">${eyebrow}</div>
      <div style="font-size:52px;font-weight:800;line-height:1.04;letter-spacing:-0.025em;margin-bottom:20px">${title}</div>
      <div style="font-size:20px;line-height:1.5;color:#bdb6ac;max-width:500px">${body}</div>
    </div>
    <img src="data:image/png;base64,${panel.toString('base64')}" style="width:380px;height:740px;border-radius:16px;border:1px solid #3a342e;box-shadow:0 30px 80px rgba(0,0,0,.5)">
  </body></html>`)
  await page.screenshot({ path: join(OUT, file) })
  await page.close()
}

test('store screenshots and promo tile', async ({ context }) => {
  test.setTimeout(120_000)

  // 1. Personal buttons, no sign-in.
  const personal = await openPanel(context)
  await importShowcase(personal)
  await compose(context, await personal.screenshot(), '1-your-prompts.png', 'Your prompt library',
    'Your best prompts, one click away.',
    'Save prompts and skills as buttons, sorted into tabs. Click one and it is typed into Claude for you to review. Nothing is ever sent automatically.')

  // 2. Team prompts (member view of shared tabs).
  // Same browser profile as scene 1, so the demo buttons are already there.
  const team = await openPanel(context, TEAM)
  await signIn(team)
  await team.getByRole('button', { name: /back/i }).click()
  await team.locator('.folder-tab', { hasText: 'Writing' }).first().click()
  await expect(team.getByText('Follow-up email after a demo')).toBeVisible()
  await compose(context, await team.screenshot(), '2-team-prompts.png', 'Shared team prompts',
    'One prompt library for the whole team.',
    'Admins publish shared prompts in tabs like Sales and Support. Everyone in the organisation gets them instantly, alongside their own.')

  // 3. Admin: members and invites.
  await team.getByRole('button', { name: 'Settings' }).click()
  await team.getByRole('button', { name: 'Manage Organisation' }).click()
  await expect(team.getByText('casey@partner.example')).toBeVisible()
  await compose(context, await team.screenshot(), '3-manage-team.png', 'Simple administration',
    'Invite people. They choose to join.',
    'Invite teammates by email, approve colleagues who ask to join, and manage admins. Nobody is added to a team without accepting.')

  // 4. Admin: analytics.
  await team.evaluate(() =>
    Array.from(document.querySelectorAll('h3')).find((h) => h.textContent === 'Analytics')?.scrollIntoView({ block: 'start' }),
  )
  await expect(team.getByText('142 runs', { exact: false })).toBeVisible()
  await compose(context, await team.screenshot(), '4-analytics.png', 'See what works',
    'Know which prompts your team actually uses.',
    'Prompt runs, top prompts and per-member activity, so you can keep the library focused on what helps.')

  // Small promo tile, 440x280.
  const tile = await context.newPage()
  await tile.setViewportSize({ width: 440, height: 280 })
  await tile.setContent(`<!doctype html><html><body style="margin:0;width:440px;height:280px;background:#16130f;color:#f2efe9;box-sizing:border-box;padding:36px;
    font-family:-apple-system,'Segoe UI',system-ui,Roboto,Arial,sans-serif;display:flex;flex-direction:column;justify-content:center">
    <img src="data:image/png;base64,${ICON}" width="56" height="56" style="border-radius:14px;margin-bottom:18px">
    <div style="font-size:32px;font-weight:800;letter-spacing:-0.02em;line-height:1.05">AI Ready Tools Extension</div>
    <div style="font-size:16px;color:#bdb6ac;margin-top:10px;line-height:1.4">Saved prompts and team prompt sharing<br>for claude.ai</div>
  </body></html>`)
  await tile.screenshot({ path: join(OUT, 'promo-tile-440x280.png') })
})
