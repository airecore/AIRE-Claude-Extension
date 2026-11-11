export interface OrgOnboardingContext {
  onSubmit: (data: { orgName: string; initialMemberEmails: string[] }) => void
  onCancel: () => void
  /** Shown under the form after a failed attempt. */
  error?: string | null
  /** A create request is in flight. */
  busy?: boolean
}

// What's been typed, kept across re-renders (a failed attempt redraws the
// panel) and cleared on Cancel.
const draft = { orgName: '', emails: '' }

/**
 * Optional "Create an organisation" screen, opened from Settings. Signing
 * in never leads here on its own: everyone starts with a personal account
 * and joins an organisation by accepting an invite.
 */
export function renderOrgOnboarding(context: OrgOnboardingContext): HTMLElement {
  const container = document.createElement('div')
  container.className = 'org-onboarding'

  const heading = document.createElement('h2')
  heading.className = 'settings-heading'
  heading.textContent = 'Create an organisation'
  container.appendChild(heading)

  const hint = document.createElement('p')
  hint.className = 'settings-hint'
  hint.textContent =
    "Only if you want to share prompts with a team. You'll be its admin and can invite people. " +
    'If your company already has one, this sends its admins a request to join instead.'
  container.appendChild(hint)

  const form = document.createElement('form')
  form.className = 'edit-form'

  const nameLabel = document.createElement('label')
  nameLabel.textContent = 'Organisation name'
  const nameInput = document.createElement('input')
  nameInput.type = 'text'
  nameInput.required = true
  nameInput.value = draft.orgName
  nameInput.addEventListener('input', () => {
    draft.orgName = nameInput.value
  })
  nameLabel.appendChild(nameInput)
  form.appendChild(nameLabel)

  const emailsLabel = document.createElement('label')
  const emailsLabelText = document.createElement('span')
  emailsLabelText.textContent = 'Invite teammates now (optional)'
  emailsLabel.appendChild(emailsLabelText)
  const emailsInput = document.createElement('textarea')
  emailsInput.rows = 4
  emailsInput.placeholder = 'One email per line'
  emailsInput.value = draft.emails
  emailsInput.addEventListener('input', () => {
    draft.emails = emailsInput.value
  })
  emailsLabel.appendChild(emailsInput)
  form.appendChild(emailsLabel)

  if (context.error) {
    const error = document.createElement('p')
    error.className = 'settings-error'
    error.setAttribute('role', 'alert')
    error.textContent = context.error
    form.appendChild(error)
  }

  const actions = document.createElement('div')
  actions.className = 'edit-form-actions'

  const cancelButton = document.createElement('button')
  cancelButton.type = 'button'
  cancelButton.textContent = 'Cancel'
  cancelButton.addEventListener('click', () => {
    draft.orgName = ''
    draft.emails = ''
    context.onCancel()
  })
  actions.appendChild(cancelButton)

  const submitButton = document.createElement('button')
  submitButton.type = 'submit'
  submitButton.textContent = context.busy ? 'Creating...' : 'Create organisation'
  submitButton.disabled = context.busy === true
  actions.appendChild(submitButton)

  form.appendChild(actions)

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const orgName = nameInput.value.trim()
    if (!orgName || context.busy) return
    const initialMemberEmails = emailsInput.value
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
    context.onSubmit({ orgName, initialMemberEmails })
  })

  container.appendChild(form)
  return container
}
