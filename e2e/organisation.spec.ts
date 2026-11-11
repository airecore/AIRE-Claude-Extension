import { test, expect, EXTENSION_ID } from './fixtures'
import { mockClerkAndBackend, type OrgScenario } from './mock-backend'
import type { Page, BrowserContext } from '@playwright/test'

// Extends E2E past sign-in via mocked Clerk + backend responses -- see
// mock-backend.ts for exactly what is and isn't real here. Mocks must be
// installed before the page's first navigation, so every test opens its
// own fresh page rather than using the `sidepanel` fixture.

async function openMockedSidepanel(context: BrowserContext, scenario: OrgScenario): Promise<Page> {
  const page = await context.newPage()
  await mockClerkAndBackend(page, scenario)
  await page.goto(`chrome-extension://${EXTENSION_ID}/src/sidepanel/index.html`)
  await page.waitForSelector('.wordmark')
  return page
}

test('signing in as a director shows shared prompts, roster, and analytics', async ({ context }) => {
  const page = await openMockedSidepanel(context, {
    email: 'director@acme.test',
    orgSession: { state: 'active', org: { id: 'org-1', name: 'Acme Inc' }, role: 'director' },
    orgPrompts: {
      org: { name: 'Acme Inc' },
      tabs: [{ id: 'tab-1', name: 'General', emoji: null, sort_order: 0 }],
      prompts: [
        {
          id: 'p-1',
          name: 'Shared prompt',
          prompt_text: 'Summarize the above.',
          type: 'prompt',
          tab_id: 'tab-1',
          sort_order: 0,
        },
      ],
    },
    members: [
      { email: 'director@acme.test', role: 'director', status: 'active', createdAt: new Date().toISOString() },
      { email: 'newperson@acme.test', role: 'member', status: 'pending', createdAt: new Date().toISOString() },
    ],
    analytics: {
      topPrompts: [{ promptId: 'p-1', name: 'Shared prompt', runCount: 4 }],
      perMember: [{ email: 'director@acme.test', runCount: 4, lastUsedAt: new Date().toISOString() }],
      dailyRuns: [],
    },
  })

  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.locator('.settings-hint').getByText('Signed in as director@acme.test')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Manage Organisation' })).toBeVisible()

  // The main list's Team section shows the shared prompt too.
  await page.getByRole('button', { name: 'Back to tools' }).click()
  await expect(page.getByText('Acme Inc')).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: 'Shared prompt' })).toBeVisible()

  // Manage Organisation: roster (including the pending member), the
  // shared prompt, and analytics all render from the mocked responses.
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Manage Organisation' }).click()
  const pendingRow = page.getByRole('listitem').filter({ hasText: 'newperson@acme.test' })
  await expect(pendingRow).toBeVisible()
  await expect(pendingRow.getByText('Wants to join')).toBeVisible()
  await expect(pendingRow.getByRole('button', { name: 'Approve' })).toBeVisible()
  // Appears twice by design here: once in the prompt-management list,
  // once in the Top prompts analytics list -- both are real, so just
  // confirm the data made it to the screen at all.
  await expect(page.getByRole('listitem').filter({ hasText: 'Shared prompt' })).toHaveCount(2)
  await expect(page.getByText('4', { exact: true })).toBeVisible() // the Prompt runs stat tile
})

test('typing in Add member survives Manage Organisation finishing its background load', async ({ context }) => {
  const page = await openMockedSidepanel(context, {
    email: 'director@acme.test',
    orgSession: { state: 'active', org: { id: 'org-1', name: 'Acme Inc' }, role: 'director' },
    members: [{ email: 'director@acme.test', role: 'director', status: 'active', createdAt: new Date().toISOString() }],
  })
  // Hold analytics back so the panel redraws AFTER the user starts typing --
  // the redraw used to replace the input, wiping text and Chrome's autofill.
  await page.route('**/api/org-analytics', async (route) => {
    await new Promise((r) => setTimeout(r, 1500))
    await route.fulfill({ json: { topPrompts: [], perMember: [], dailyRuns: [] } })
  })
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByRole('button', { name: 'Manage Organisation' }).click()

  const input = page.getByPlaceholder('teammate@company.com')
  await input.click()
  await input.pressSequentially('new@acme')
  await expect(page.getByText('Prompt runs')).toBeVisible({ timeout: 5000 }) // analytics landed + redrew
  await expect(input).toHaveValue('new@acme')
  await expect(input).toBeFocused()
})

test('a plain member sees the Team section but not Manage Organisation, and can leave', async ({ context }) => {
  const page = await openMockedSidepanel(context, {
    email: 'member@acme.test',
    orgSession: { state: 'active', org: { id: 'org-1', name: 'Acme Inc' }, role: 'member' },
    orgPrompts: {
      org: { name: 'Acme Inc' },
      tabs: [{ id: 'tab-1', name: 'General', emoji: null, sort_order: 0 }],
      prompts: [
        { id: 'p-1', name: 'Team prompt', prompt_text: 'x', type: 'prompt', tab_id: 'tab-1', sort_order: 0 },
      ],
    },
  })

  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText('Member of Acme Inc.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Manage Organisation' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Leave organisation' })).toBeVisible()

  await page.getByRole('button', { name: 'Back to tools' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Team prompt' })).toBeVisible()
})

test('a pending invitee sees a waiting message and can cancel', async ({ context }) => {
  const page = await openMockedSidepanel(context, {
    email: 'waiting@acme.test',
    orgSession: { state: 'pending', org: { id: 'org-1', name: 'Acme Inc' } },
  })

  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText('Waiting for approval from Acme Inc.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cancel request' })).toBeVisible()
})

test('an invited person sees who invited them and can accept, landing as a member', async ({ context }) => {
  const page = await openMockedSidepanel(context, {
    email: 'new@outlook.com',
    orgSession: { state: 'invited', org: { id: 'org-1', name: 'Acme Inc' }, invitedBy: 'director@acme.test' },
    acceptedSession: { state: 'active', org: { id: 'org-1', name: 'Acme Inc' }, role: 'member' },
    orgPrompts: {
      org: { name: 'Acme Inc' },
      tabs: [{ id: 'tab-1', name: 'General', emoji: null, sort_order: 0 }],
      prompts: [{ id: 'p-1', name: 'Shared prompt', prompt_text: 'Hi', type: 'prompt', tab_id: 'tab-1', sort_order: 0 }],
    },
  })
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText('director@acme.test invited you to join Acme Inc.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Accept invite' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Decline' })).toBeVisible()

  // The list view shows the invite card; nothing shared is visible yet.
  await page.getByRole('button', { name: 'Back to tools' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Shared prompt' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Accept', exact: true }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Shared prompt' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Accept', exact: true })).toHaveCount(0)
})

test('a new account is a personal account: signing in never forces creating an organisation', async ({ context }) => {
  const page = await openMockedSidepanel(context, { email: 'newbie@example.test', orgSession: { state: 'none' } })

  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.locator('.settings-hint').getByText('Signed in as newbie@example.test')).toBeVisible()
  await expect(page.getByText(/Personal account/)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Create an organisation' })).toHaveCount(0)

  // Personal buttons work as normal while signed in.
  await page.getByRole('button', { name: 'Back to tools' }).click()
  await page.getByRole('button', { name: /add tool/i }).click()
  await page.getByRole('button', { name: /write your own/i }).click()
  await page.getByRole('textbox').first().fill('Mine')
  await page.locator('textarea').fill('My own prompt')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Mine' })).toBeVisible()

  // Creating an organisation is optional, and cancelling keeps you signed in.
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Create an organisation' }).click()
  await expect(page.getByRole('heading', { name: 'Create an organisation' })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.locator('.settings-hint').getByText('Signed in as newbie@example.test')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create an organisation' })).toBeVisible()
})

test('a personal account can choose to create an organisation and becomes its admin', async ({ context }) => {
  const page = await openMockedSidepanel(context, {
    email: 'founder@newco.test',
    orgSession: { state: 'none' },
    onboardingResult: { outcome: 'created', org: { id: 'org-9', name: 'NewCo' }, role: 'director' },
    sessionAfterOnboarding: { state: 'active', org: { id: 'org-9', name: 'NewCo' }, role: 'director' },
  })

  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByRole('button', { name: 'Create an organisation' }).click()
  await page.getByRole('textbox', { name: 'Organisation name' }).fill('NewCo')
  await page.getByRole('button', { name: 'Create organisation' }).click()

  await expect(page.getByRole('button', { name: 'Manage Organisation' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create an organisation' })).toHaveCount(0)
})
