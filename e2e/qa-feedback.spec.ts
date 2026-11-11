import { test, expect, EXTENSION_ID } from './fixtures'
import { mockClerkAndBackend, type OrgScenario } from './mock-backend'

// Tester build QA logging: the real feedback form and the real event
// queue, against the mocked backend (see mock-backend.ts). `pnpm run
// build` produces the tester build, which is what dist/ holds here.

const scenario = (): OrgScenario => ({
  email: 'tester@example.test',
  orgSession: { state: 'active', org: { id: 'org-1', name: 'Tester Org' }, role: 'member' },
})

test('a signed-in tester can send feedback, with queued usage events sent first', async ({ context }) => {
  const s = scenario()
  const page = await context.newPage()
  await mockClerkAndBackend(page, s)
  await page.goto(`chrome-extension://${EXTENSION_ID}/src/sidepanel/index.html`)
  await page.waitForSelector('.wordmark')

  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByText('Tester build', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.locator('.settings-hint').getByText('Signed in as tester@example.test')).toBeVisible()

  await page.getByRole('button', { name: 'Send feedback or report a problem' }).click()
  await page.getByRole('radio', { name: 'Suggestion' }).check()
  await page.getByRole('textbox', { name: 'What happened?' }).fill('The sort toggle is hard to find.')
  await page.getByRole('button', { name: 'Send', exact: true }).click()

  await expect(page.getByText(/Thanks, your feedback was sent \(reference fb-12345\)/)).toBeVisible()
  expect(s.qaFeedback).toHaveLength(1)
  expect(s.qaFeedback![0]).toMatchObject({
    category: 'suggestion',
    description: 'The sort toggle is hard to find.',
    attachDiagnostics: true,
    version: expect.stringMatching(/^1\.0\.0\+/),
  })

  // Attaching diagnostics flushes the queue first, so the server has the
  // events this session produced.
  const names = (s.qaEvents ?? []).map((e) => e.name)
  expect(names).toEqual(expect.arrayContaining(['panel_opened', 'settings_opened', 'sign_in_succeeded', 'feedback_opened']))
  // Never anything but primitive props, and never the tester's email.
  expect(JSON.stringify(s.qaEvents)).not.toContain('tester@example.test')
})

test('feedback cannot be sent until the tester signs in', async ({ sidepanel }) => {
  await sidepanel.getByRole('button', { name: 'Settings' }).click()
  await sidepanel.getByRole('button', { name: 'Send feedback or report a problem' }).click()
  await expect(sidepanel.getByText('Sign in from Settings first')).toBeVisible()
  await expect(sidepanel.getByRole('button', { name: 'Send', exact: true })).toBeDisabled()
})

test('a failed send keeps what the tester wrote', async ({ context }) => {
  const s = scenario()
  const page = await context.newPage()
  await mockClerkAndBackend(page, s)
  // Registered after the scenario mock, so it takes precedence for this route.
  await page.route('**/api/qa-feedback', (route) => route.fulfill({ status: 500 }))
  await page.goto(`chrome-extension://${EXTENSION_ID}/src/sidepanel/index.html`)
  await page.waitForSelector('.wordmark')

  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.locator('.settings-hint').getByText('Signed in as tester@example.test')).toBeVisible()
  await page.getByRole('button', { name: 'Send feedback or report a problem' }).click()
  await page.getByRole('checkbox').uncheck()
  await page.getByRole('textbox', { name: 'What happened?' }).fill('Import froze.')
  await page.getByRole('button', { name: 'Send', exact: true }).click()

  await expect(page.getByRole('alert')).toContainText('error 500')
  await expect(page.getByRole('textbox', { name: 'What happened?' })).toHaveValue('Import froze.')
  await expect(page.getByRole('checkbox')).not.toBeChecked()
})

test('the feedback form tells testers their message may be public', async ({ sidepanel }) => {
  await sidepanel.getByRole('button', { name: 'Settings' }).click()
  await sidepanel.getByRole('button', { name: 'Send feedback or report a problem' }).click()
  await expect(sidepanel.getByText(/may be posted as a public GitHub issue/)).toBeVisible()
})
