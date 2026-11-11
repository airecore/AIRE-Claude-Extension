import { test, expect } from './fixtures'

// Covers docs/qa-checklist.md sections 1-2 (lifecycle, personal buttons) --
// the parts that need no sign-in, no backend, and no claude.ai tab.

test('starts empty with the add button visible', async ({ sidepanel: page }) => {
  await expect(page.getByText(/no prompts in this tab yet/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /add prompt/i })).toBeVisible()
})

test('add, edit, and delete a button', async ({ sidepanel: page }) => {
  await page.getByRole('button', { name: /add prompt/i }).click()
  await page.getByRole('button', { name: /write your own/i }).click()
  await page.getByLabel('Name').fill('My Test Prompt')
  await page.getByRole('textbox', { name: 'Prompt' }).fill('Summarize the above in three bullets.')
  await page.getByRole('button', { name: 'Save' }).click()

  const row = page.getByRole('listitem').filter({ hasText: 'My Test Prompt' })
  await expect(row).toBeVisible()

  // Edit and Delete live in the row's ⋯ menu.
  await row.getByRole('button', { name: 'More actions for My Test Prompt' }).click()
  await row.getByRole('menuitem', { name: 'Edit' }).click()
  await page.getByLabel('Name').fill('My Renamed Prompt')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'My Renamed Prompt' })).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: 'My Test Prompt' })).toHaveCount(0)

  page.once('dialog', (dialog) => dialog.accept())
  const renamed = page.getByRole('listitem').filter({ hasText: 'My Renamed Prompt' })
  await renamed.getByRole('button', { name: 'More actions for My Renamed Prompt' }).click()
  await renamed.getByRole('menuitem', { name: 'Delete' }).click()
  await expect(page.getByRole('listitem')).toHaveCount(0)
  await expect(page.getByText(/no prompts in this tab yet/i)).toBeVisible()
})

test('a skill button shows the / badge and inserts as typed', async ({ sidepanel: page }) => {
  await page.getByRole('button', { name: /add prompt/i }).click()
  await page.getByRole('button', { name: /write your own/i }).click()
  await page.getByRole('radio', { name: 'Skill' }).check()
  await page.getByLabel('Name').fill('Doc summary')
  await page.getByLabel('Skill invocation').fill('/doc-summary')
  await page.getByRole('button', { name: 'Save' }).click()

  const row = page.getByRole('listitem').filter({ hasText: 'Doc summary' })
  await expect(row).toBeVisible()
  await expect(row.locator('.skill-badge')).toHaveText('/')
})

test('reorders buttons with the keyboard (Arrow Down on the drag handle)', async ({ sidepanel: page }) => {
  for (const name of ['First', 'Second']) {
    await page.getByRole('button', { name: /add prompt/i }).click()
    await page.getByRole('button', { name: /write your own/i }).click()
    await page.getByLabel('Name').fill(name)
    await page.getByRole('textbox', { name: 'Prompt' }).fill('placeholder text')
    await page.getByRole('button', { name: 'Save' }).click()
  }

  const namesInOrder = () => page.locator('.button-row-name').allInnerTexts()
  await expect.poll(namesInOrder).toEqual(['First', 'Second'])

  await page.getByRole('button', { name: /reorder first/i }).focus()
  await page.keyboard.press('ArrowDown')

  await expect.poll(namesInOrder).toEqual(['Second', 'First'])
})

test('creating a tab and moving a button to it filters the list by tab', async ({ sidepanel: page }) => {
  await page.getByRole('button', { name: /add prompt/i }).click()
  await page.getByRole('button', { name: /write your own/i }).click()
  await page.getByLabel('Name').fill('General item')
  await page.getByRole('textbox', { name: 'Prompt' }).fill('placeholder text')
  await page.getByRole('button', { name: 'Save' }).click()

  // Add tab -> the new tab's name is typed in place on the tab itself,
  // already focused with "New tab" selected.
  await page.getByRole('button', { name: 'Add tab' }).click()
  const nameInput = page.getByRole('textbox', { name: /tab name/i })
  await expect(nameInput).toBeFocused()
  await page.keyboard.type('Research')
  await page.keyboard.press('Enter')

  // Both tabs now show as chips in the main strip; the new one is active
  // (onAddTab switches to it), so the tab we just made should be empty.
  await expect(page.getByRole('tab', { name: 'Research' })).toBeVisible()
  await expect(page.getByText(/no prompts in this tab yet/i)).toBeVisible()

  // Move "General item" into Research via its edit form's tab picker.
  await page.getByRole('tab', { name: 'General' }).click()
  const generalItem = page.getByRole('listitem').filter({ hasText: 'General item' })
  await generalItem.getByRole('button', { name: 'More actions for General item' }).click()
  await generalItem.getByRole('menuitem', { name: 'Edit' }).click()
  // Exact: the list view's "Add tab" button also contains "Tab", and can
  // still be on screen for a moment before the form renders.
  await page.getByRole('button', { name: 'Tab', exact: true }).click() // dropdown trigger
  await page.getByRole('option', { name: 'Research' }).click()
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page.getByRole('listitem').filter({ hasText: 'General item' })).toHaveCount(0)
  await page.getByRole('tab', { name: 'Research' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'General item' })).toBeVisible()
})

test('Escape on a just-made tab removes it; double-click renames a tab in place', async ({ sidepanel: page }) => {
  await page.getByRole('button', { name: 'Add tab' }).click()
  await expect(page.getByRole('textbox', { name: /tab name/i })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('tab')).toHaveCount(1)
  await expect(page.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'true')

  await page.getByRole('tab', { name: 'General' }).dblclick()
  await page.keyboard.type('📌 Pinned')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('tab', { name: '📌 Pinned' })).toBeVisible()
})

test('tab menu moves a tab and deletes it', async ({ sidepanel: page }) => {
  await page.getByRole('button', { name: 'Add tab' }).click()
  await expect(page.getByRole('textbox', { name: /tab name/i })).toBeFocused()
  await page.keyboard.type('Second')
  await page.keyboard.press('Enter')

  const tabNames = () => page.getByRole('tab').allInnerTexts()
  await page.getByRole('button', { name: 'Tab options for Second' }).click()
  await page.getByRole('menuitem', { name: 'Move left' }).click()
  await expect.poll(async () => (await tabNames()).map((t) => t.replace(/\d+$/, '').trim())).toEqual([
    'Second',
    'General',
  ])

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Tab options for Second' }).click()
  await page.getByRole('menuitem', { name: 'Delete tab Second' }).click()
  await expect(page.getByRole('tab')).toHaveCount(1)
})

test('adds tools from the library into the active tab', async ({ sidepanel: page }) => {
  await page.getByRole('button', { name: /add prompt/i }).click()
  await expect(page.getByRole('heading', { name: /add prompts to general/i })).toBeVisible()

  await page.getByRole('button', { name: 'Add Rewrite in plain English' }).click()
  await expect(page.getByRole('button', { name: 'Rewrite in plain English is added' })).toBeVisible()
  await page.getByRole('button', { name: 'Add Create a Word document' }).click()

  await page.getByRole('button', { name: /back to general/i }).click()
  await expect(page.locator('.button-row-name')).toHaveText(['Rewrite in plain English', 'Create a Word document'])
})
