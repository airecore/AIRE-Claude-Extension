import { MAX_FEEDBACK_LENGTH, type FeedbackCategory, type FeedbackInput } from '../shared/qa/feedback'

export interface FeedbackState {
  /** What the tester has entered so far. Owned by main.ts and updated in
   * place as they type, so a re-render (or a failed send) never loses it. */
  draft: FeedbackInput
  sending: boolean
  error: string | null
  /** Set after a successful send; the form shows a thank-you instead. */
  sent: { id: string; issueUrl: string | null } | null
}

export interface FeedbackFormContext extends FeedbackState {
  signedIn: boolean
  buildLabel: string
  onSubmit: (input: FeedbackInput) => void
  onSendAnother: () => void
  onBack: () => void
}

const CATEGORIES: { value: FeedbackCategory; label: string }[] = [
  { value: 'bug', label: 'Something broke' },
  { value: 'suggestion', label: 'Suggestion' },
  { value: 'other', label: 'Other' },
]

function backButton(onBack: () => void): HTMLElement {
  const back = document.createElement('button')
  back.type = 'button'
  back.className = 'settings-back-button'
  back.innerHTML = '<span class="gi">←</span> Back'
  back.addEventListener('click', onBack)
  return back
}

export function renderFeedbackForm(context: FeedbackFormContext): HTMLElement {
  const container = document.createElement('div')
  container.className = 'settings-panel feedback-panel'

  const heading = document.createElement('h2')
  heading.className = 'settings-heading'
  heading.textContent = 'Send feedback'
  container.appendChild(heading)

  if (context.sent) {
    const thanks = document.createElement('p')
    thanks.className = 'settings-success'
    thanks.setAttribute('role', 'status')
    thanks.textContent = `Thanks, your feedback was sent (reference ${context.sent.id.slice(0, 8)}).`
    container.appendChild(thanks)
    const another = document.createElement('button')
    another.type = 'button'
    another.className = 'settings-action-button'
    another.textContent = 'Send more feedback'
    another.addEventListener('click', context.onSendAnother)
    container.appendChild(another)
    container.appendChild(backButton(context.onBack))
    return container
  }

  const intro = document.createElement('p')
  intro.className = 'settings-hint'
  intro.textContent =
    'Tell us what went wrong or what would make this better. Say what you clicked, what you expected and what happened instead.'
  container.appendChild(intro)

  if (!context.signedIn) {
    const notice = document.createElement('p')
    notice.className = 'settings-error'
    notice.textContent = 'Sign in from Settings first, so we know who sent it and can follow up.'
    container.appendChild(notice)
  }

  const form = document.createElement('form')
  form.className = 'edit-form feedback-form'

  const typeToggle = document.createElement('div')
  typeToggle.className = 'type-toggle'
  typeToggle.setAttribute('role', 'radiogroup')
  typeToggle.setAttribute('aria-label', 'Feedback type')
  const radios: HTMLInputElement[] = []
  for (const category of CATEGORIES) {
    const option = document.createElement('label')
    option.className = 'type-toggle-option'
    const radio = document.createElement('input')
    radio.type = 'radio'
    radio.name = 'feedback-category'
    radio.value = category.value
    radio.checked = category.value === context.draft.category
    radio.addEventListener('change', () => {
      if (radio.checked) context.draft.category = category.value
    })
    radios.push(radio)
    option.append(radio, document.createTextNode(category.label))
    typeToggle.appendChild(option)
  }
  form.appendChild(typeToggle)

  const descriptionLabel = document.createElement('label')
  descriptionLabel.textContent = 'What happened?'
  const description = document.createElement('textarea')
  description.required = true
  description.rows = 8
  description.maxLength = MAX_FEEDBACK_LENGTH
  description.setAttribute('aria-label', 'What happened?')
  description.value = context.draft.description
  description.addEventListener('input', () => {
    context.draft.description = description.value
  })
  descriptionLabel.appendChild(description)
  form.appendChild(descriptionLabel)

  const attachLabel = document.createElement('label')
  attachLabel.className = 'feedback-attach'
  const attach = document.createElement('input')
  attach.type = 'checkbox'
  attach.checked = context.draft.attachDiagnostics
  attach.addEventListener('change', () => {
    context.draft.attachDiagnostics = attach.checked
  })
  attachLabel.append(attach, document.createTextNode(' Attach my recent activity and errors (never prompt text)'))
  form.appendChild(attachLabel)

  if (context.error) {
    const error = document.createElement('p')
    error.className = 'settings-error'
    error.setAttribute('role', 'alert')
    error.textContent = context.error
    form.appendChild(error)
  }

  const actions = document.createElement('div')
  actions.className = 'edit-form-actions'
  const cancel = document.createElement('button')
  cancel.type = 'button'
  cancel.textContent = 'Cancel'
  cancel.addEventListener('click', context.onBack)
  const send = document.createElement('button')
  send.type = 'submit'
  send.textContent = context.sending ? 'Sending...' : 'Send'
  send.disabled = context.sending || !context.signedIn
  actions.append(cancel, send)
  form.appendChild(actions)

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    if (context.sending || !context.signedIn) return
    send.disabled = true
    send.textContent = 'Sending...'
    context.onSubmit({
      category: (radios.find((r) => r.checked)?.value ?? 'other') as FeedbackCategory,
      description: description.value,
      attachDiagnostics: attach.checked,
    })
  })

  container.appendChild(form)

  // The feedback repository is public, so testers should know before
  // writing anything personal or confidential.
  const visibility = document.createElement('p')
  visibility.className = 'settings-hint feedback-public-note'
  visibility.textContent =
    'Your message (without your email) may be posted as a public GitHub issue, so please leave out anything personal or confidential.'
  container.appendChild(visibility)

  const build = document.createElement('p')
  build.className = 'settings-hint'
  build.textContent = `Build ${context.buildLabel}`
  container.appendChild(build)

  return container
}
