import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { BrowserContext, Page } from '@playwright/test'
import { test, expect, EXTENSION_ID } from './fixtures'
import { mockClerkAndBackend, type OrgScenario } from './mock-backend'
import { QA_EVENTS, type QaEventName } from '../src/shared/qa/events'
import { API_BASE_URL } from '../src/shared/api-base'

// A full tour of every feature the QA dashboard tracks ("Features not yet
// tried"), driven through the REAL extension in real Chromium: personal
// prompts and tabs, backup, sign-in, the admin's Manage Organisation, team
// prompts, invites, leaving, creating an organisation and feedback.
//
// Each test checks the feature did what it should on screen AND that it
// fired its QA event, so a feature that silently stops reporting is caught
// too. The last test checks the tours together cover every tracked event.
//
// The backend and Clerk are stand-ins (mock-backend.ts), and claude.ai is a
// local page served at https://claude.ai/ (Chrome injects the real content
// script into it). So this can't empty the live dashboard's list -- that
// needs real signed-in people -- but it proves every feature works.

// Each tour walks through a lot of features.
test.describe.configure({ timeout: 120_000 })

const FIXTURE_DIR = fileURLToPath(new URL('./fixtures-data', import.meta.url))
const SIDEPANEL = `chrome-extension://${EXTENSION_ID}/src/sidepanel/index.html`

const PERSONAL: QaEventName[] = [
  'panel_opened', 'button_created', 'button_edited', 'button_run', 'button_sent', 'buttons_reordered',
  'sort_toggled', 'tab_created', 'tab_renamed', 'tabs_reordered', 'default_tab_set', 'tab_deleted',
  'button_deleted', 'settings_opened', 'tools_exported', 'tools_imported', 'feedback_opened',
]
const ADMIN: QaEventName[] = [
  'sign_in_started', 'sign_in_succeeded', 'team_prompt_run', 'team_prompt_sent', 'manage_org_opened',
  'member_approved', 'member_role_changed', 'member_removed', 'member_invited',
  'org_tab_created', 'org_tab_renamed', 'org_tabs_reordered', 'org_tab_deleted',
  'org_prompt_created', 'org_prompt_edited', 'org_prompt_deleted', 'feedback_sent', 'signed_out',
]
const MEMBERSHIP: QaEventName[] = ['invite_accepted', 'org_left', 'org_onboarding_submitted']
const SIGN_IN_CANCELLED: QaEventName[] = ['sign_in_failed']

/** Every QA event this context produced: still queued, or already sent. */
async function emitted(page: Page, scenario?: OrgScenario): Promise<Set<string>> {
  const queued = await page.evaluate(async () =>
    Object.entries(await chrome.storage.local.get(null))
      .filter(([key]) => key.startsWith('qa:'))
      .map(([, value]) => (value as { name: string }).name),
  )
  return new Set([...queued, ...(scenario?.qaEvents ?? []).map((e) => e.name)])
}

/**
 * With QA_LIVE_DASHBOARD_KEY set, sends this tour's real QA events to the
 * live dashboard (filed under the "automated-tour" tester). Off by
 * default, so CI and normal runs never touch the live backend.
 *   QA_LIVE_DASHBOARD_KEY=... pnpm exec playwright test e2e/feature-tour.spec.ts
 */
async function uploadToLiveDashboard(page: Page, scenario?: OrgScenario): Promise<void> {
  const key = process.env.QA_LIVE_DASHBOARD_KEY
  if (!key) return
  const queued = await page.evaluate(async () =>
    Object.entries(await chrome.storage.local.get(null))
      .filter(([k]) => k.startsWith('qa:'))
      .map(([, v]) => v),
  )
  const events = [...queued, ...(scenario?.qaEvents ?? [])]
  for (let i = 0; i < events.length; i += 50) {
    // curl, because it follows this machine's proxy settings.
    const out = execFileSync('curl', [
      '-sS', '-X', 'POST', `${API_BASE_URL}/api/qa-dashboard`,
      '-H', `Authorization: Bearer ${key}`, '-H', 'Content-Type: application/json',
      '--data-binary', '@-',
    ], { input: JSON.stringify({ action: 'import-events', events: events.slice(i, i + 50) }) }).toString()
    expect(out, 'live dashboard import').toContain('"imported"')
  }
}

async function expectEvents(page: Page, names: QaEventName[], scenario?: OrgScenario): Promise<void> {
  // Events are written to storage asynchronously; give them a moment.
  await expect
    .poll(async () => {
      const seen = await emitted(page, scenario)
      return names.filter((name) => !seen.has(name))
    }, { message: 'features that did not report their QA event', timeout: 5000 })
    .toEqual([])
  await uploadToLiveDashboard(page, scenario)
}

/** A stand-in claude.ai tab with the real content script, and a side panel
 * whose "active tab" is that page. */
async function openWithClaude(context: BrowserContext, scenario?: OrgScenario): Promise<{ panel: Page; claude: Page }> {
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

  const panel = await context.newPage()
  panel.on('dialog', (dialog) => void dialog.accept())
  if (scenario) await mockClerkAndBackend(panel, scenario)
  await panel.addInitScript(() => {
    const realQuery = chrome.tabs.query.bind(chrome.tabs)
    chrome.tabs.query = ((info: chrome.tabs.QueryInfo) =>
      info.active ? realQuery({ url: 'https://claude.ai/*' }) : realQuery(info)) as typeof chrome.tabs.query
  })
  await panel.goto(SIDEPANEL)
  await panel.waitForSelector('.wordmark')
  return { panel, claude }
}

/** Waits for the prompt to land in Claude's chat box, then "sends" it the
 * way claude.ai does (the box clears), so the extension counts a send. */
async function sendInClaude(claude: Page, text: string): Promise<void> {
  const input = claude.locator('[data-testid="chat-input"]')
  await expect(input).toHaveText(text)
  await claude.waitForTimeout(400)
  await input.evaluate((el) => {
    el.textContent = ''
  })
}

async function addPrompt(page: Page, name: string, text: string): Promise<void> {
  await page.getByRole('button', { name: /add prompt/i }).click()
  await page.getByRole('button', { name: /write your own/i }).click()
  await page.getByLabel('Name').fill(name)
  await page.getByRole('textbox', { name: 'Prompt' }).fill(text)
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: name })).toBeVisible()
}

const row = (page: Page, name: string) => page.getByRole('listitem').filter({ hasText: name })

test('tour: every personal feature', async ({ context }) => {
  const { panel: page, claude } = await openWithClaude(context)

  // Prompts: add, edit, run and send.
  await addPrompt(page, 'Alpha', 'alpha text')
  await addPrompt(page, 'Beta', 'beta text')
  await row(page, 'Alpha').getByRole('button', { name: 'More actions for Alpha' }).click()
  await row(page, 'Alpha').getByRole('menuitem', { name: 'Edit' }).click()
  await page.getByRole('textbox', { name: 'Prompt' }).fill('alpha edited')
  await page.getByRole('button', { name: 'Save' }).click()

  // Reorder with the keyboard.
  const namesInOrder = () => page.locator('.button-row-name').allInnerTexts()
  await page.getByRole('button', { name: /^Reorder Beta/ }).focus()
  await page.keyboard.press('ArrowUp')
  await expect.poll(namesInOrder).toEqual(['Beta', 'Alpha'])

  // Run and send.
  await row(page, 'Alpha').getByRole('button', { name: 'Run Alpha' }).click()
  await sendInClaude(claude, 'alpha edited')

  // Sort by most used.
  await page.getByRole('button', { name: 'Most used first' }).click()
  await expect(page.getByRole('button', { name: 'Most used first' })).toHaveAttribute('aria-pressed', 'true')

  // Tabs: create, rename, move, open first, delete.
  await page.getByRole('button', { name: 'Add tab' }).click()
  await expect(page.getByRole('textbox', { name: /tab name/i })).toBeFocused()
  await page.keyboard.type('Second')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('tab', { name: /Second/ })).toBeVisible()
  await page.getByRole('tab', { name: /Second/ }).dblclick()
  await expect(page.getByRole('textbox', { name: /tab name/i })).toBeFocused()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type('Renamed')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('tab', { name: /Renamed/ })).toBeVisible()
  await page.getByRole('button', { name: 'Tab options for Renamed' }).click()
  await page.getByRole('menuitem', { name: 'Move left' }).click()
  await expect(page.getByRole('tab').first()).toContainText('Renamed')
  await page.getByRole('button', { name: 'Tab options for Renamed' }).click()
  await page.getByRole('menuitem', { name: 'Open this tab first' }).click()
  await page.getByRole('button', { name: 'Tab options for Renamed' }).click()
  await expect(page.getByRole('menuitem', { name: 'Opens first ✓' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Tab options for Renamed' }).click()
  await page.getByRole('menuitem', { name: 'Delete tab Renamed' }).click()
  await expect(page.getByRole('tab')).toHaveCount(1)

  // Delete a prompt.
  await row(page, 'Beta').getByRole('button', { name: 'More actions for Beta' }).click()
  await row(page, 'Beta').getByRole('menuitem', { name: 'Delete' }).click()
  await expect(row(page, 'Beta')).toHaveCount(0)

  // Settings: export, import, feedback form.
  await page.getByRole('button', { name: 'Settings' }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export prompts' }).click()
  await download
  await page.locator('.settings-file-input').setInputFiles(join(FIXTURE_DIR, 'sample-backup.json'))
  await expect(page.locator('.settings-success')).toHaveText(/imported/i)
  await page.getByRole('button', { name: 'Send feedback or report a problem' }).click()
  await expect(page.getByRole('heading', { name: 'Send feedback' })).toBeVisible()

  await expectEvents(page, PERSONAL)
})

const ADMIN_SCENARIO = (): OrgScenario => ({
  email: 'director@acme.test',
  orgSession: { state: 'active', org: { id: 'org-1', name: 'Acme Inc' }, role: 'director' },
  orgPrompts: {
    org: { name: 'Acme Inc' },
    tabs: [
      { id: 'tab-1', name: 'General', emoji: null, sort_order: 0 },
      { id: 'tab-2', name: 'Sales', emoji: null, sort_order: 1 },
    ],
    prompts: [{ id: 'p-1', name: 'Shared prompt', prompt_text: 'Team hello', type: 'prompt', tab_id: 'tab-1', sort_order: 0 }],
  },
  members: [
    { email: 'director@acme.test', role: 'director', status: 'active', createdAt: new Date().toISOString() },
    { email: 'wants@acme.test', role: 'member', status: 'pending', createdAt: new Date().toISOString() },
    { email: 'member@acme.test', role: 'member', status: 'active', createdAt: new Date().toISOString() },
    { email: 'leaving@acme.test', role: 'member', status: 'active', createdAt: new Date().toISOString() },
  ],
})

test('tour: every admin feature', async ({ context }) => {
  const scenario = ADMIN_SCENARIO()
  const { panel: page, claude } = await openWithClaude(context, scenario)

  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('button', { name: 'Manage Organisation' })).toBeVisible()

  // A team prompt: run and send.
  await page.getByRole('button', { name: 'Back to prompts' }).click()
  await page.getByRole('button', { name: 'Run Shared prompt' }).click()
  await sendInClaude(claude, 'Team hello')

  // Members: approve, promote, remove, invite.
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Manage Organisation' }).click()
  await row(page, 'wants@acme.test').getByRole('button', { name: 'Approve' }).click()
  await row(page, 'member@acme.test').getByRole('button', { name: 'Make admin' }).click()
  await row(page, 'leaving@acme.test').getByRole('button', { name: 'Remove', exact: true }).click()
  await page.getByPlaceholder('teammate@company.com').fill('new@acme.test')
  await page.getByRole('button', { name: 'Invite' }).click()

  // Shared tabs: add, rename, reorder, delete.
  await page.getByPlaceholder('New shared tab name').fill('Marketing')
  await page.getByRole('button', { name: 'Add tab' }).click()
  await page.getByRole('button', { name: 'Rename Sales' }).click()
  const nameInput = page.getByRole('textbox', { name: /Name for Sales/ })
  await nameInput.fill('Sales team')
  await nameInput.press('Enter')
  await page.getByRole('button', { name: /^Reorder General/ }).focus()
  await page.keyboard.press('ArrowDown')
  await page.getByRole('button', { name: 'Delete Sales', exact: true }).click()

  // Shared prompts: add, edit, delete.
  const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Add prompt', exact: true }) })
  await form.getByLabel('Name').fill('New shared')
  await form.getByLabel('Prompt text').fill('shared text')
  await form.getByRole('button', { name: 'Add prompt', exact: true }).click()
  await row(page, 'Shared prompt').first().getByRole('button', { name: 'Edit' }).click()
  await page.getByLabel('Prompt text').fill('edited shared text')
  await page.getByRole('button', { name: 'Save prompt' }).click()
  await row(page, 'Shared prompt').first().getByRole('button', { name: 'Delete' }).click()

  // Feedback (sends the queued events first), then sign out.
  await page.getByRole('button', { name: /^\W*Back$/ }).click()
  await page.getByRole('button', { name: 'Send feedback or report a problem' }).click()
  await page.getByRole('textbox', { name: 'What happened?' }).fill('Tour feedback')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(page.getByText(/Thanks, your feedback was sent/)).toBeVisible()
  await page.getByRole('button', { name: /^\W*Back$/ }).click()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()

  await expectEvents(page, ADMIN, scenario)
})

test('tour: accepting an invite, leaving, and creating an organisation', async ({ context }) => {
  const invited: OrgScenario = {
    email: 'new@outlook.com',
    orgSession: { state: 'invited', org: { id: 'org-1', name: 'Acme Inc' }, invitedBy: 'director@acme.test' },
    acceptedSession: { state: 'active', org: { id: 'org-1', name: 'Acme Inc' }, role: 'member' },
  }
  const page = await context.newPage()
  page.on('dialog', (dialog) => void dialog.accept())
  await mockClerkAndBackend(page, invited)
  await page.goto(SIDEPANEL)
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByRole('button', { name: 'Accept invite' }).click()
  await expect(page.getByText('Member of Acme Inc.')).toBeVisible()

  // Leave: the server now says there's no organisation.
  invited.orgSession = { state: 'none' }
  invited.acceptedSession = undefined
  await page.getByRole('button', { name: 'Leave organisation' }).click()
  await expect(page.getByText(/Personal account/)).toBeVisible()

  // Optionally create an organisation.
  invited.onboardingResult = { outcome: 'created', org: { id: 'org-9', name: 'NewCo' }, role: 'director' }
  invited.sessionAfterOnboarding = { state: 'active', org: { id: 'org-9', name: 'NewCo' }, role: 'director' }
  await page.getByRole('button', { name: 'Create an organisation' }).click()
  await page.getByRole('textbox', { name: 'Organisation name' }).fill('NewCo')
  await page.getByRole('button', { name: 'Create organisation' }).click()
  await expect(page.getByRole('button', { name: 'Manage Organisation' })).toBeVisible()

  await expectEvents(page, MEMBERSHIP, invited)
})

test('tour: a cancelled sign-in is reported as a failed sign-in, not an error', async ({ context }) => {
  const page = await context.newPage()
  await mockClerkAndBackend(page, { email: 'x@example.test', orgSession: { state: 'none' } })
  // Runs after the mock's own override: the person closes the sign-in window.
  await page.addInitScript(() => {
    chrome.identity.launchWebAuthFlow = () => Promise.reject(new Error('The user did not approve access.'))
  })
  await page.goto(SIDEPANEL)
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()

  await expectEvents(page, SIGN_IN_CANCELLED)
  const errors = await page.evaluate(async () =>
    Object.values(await chrome.storage.local.get(null)).filter((v) => (v as { kind?: string }).kind === 'error'),
  )
  expect(errors).toEqual([])
})

test('the tours cover every feature the QA dashboard tracks', () => {
  const covered = new Set([...PERSONAL, ...ADMIN, ...MEMBERSHIP, ...SIGN_IN_CANCELLED])
  expect(QA_EVENTS.filter((name) => !covered.has(name))).toEqual([])
})
