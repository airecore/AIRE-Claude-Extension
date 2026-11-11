import type { OrgSessionState } from '../shared/org-session'
import { enabledProviders } from '../shared/auth/providers'
import type { ProviderId } from '../shared/auth/providers'
import { LINKS, extensionVersion } from '../shared/links'
import { QA_ENABLED } from '../shared/qa/config'

export interface SettingsPanelContext {
  onExport: () => void
  onImport: (file: File) => void
  onBack: () => void
  importError: string | null
  importSuccessCount: number | null
  session: { email: string } | null
  /** An interactive sign-in flow is running. */
  signingIn: boolean
  /** Signed in; the org session (and role) is still being fetched. */
  orgResolving: boolean
  onSignIn: (providerId: ProviderId) => void
  onSignOut: () => void
  orgSession: OrgSessionState | null
  onOpenManageOrg: () => void
  /** Withdraw from the current org (member), cancel a pending request, or decline an invite. */
  onLeaveOrg: () => void
  onAcceptInvite: () => void
  /** Opens the optional "Create an organisation" form. */
  onCreateOrg?: () => void
  /** Tester build only: the feedback entry point and build label. */
  qa?: { buildLabel: string; onOpenFeedback: () => void } | null
}

export function inviteText(orgName: string, invitedBy: string | null): string {
  return invitedBy ? `${invitedBy} invited you to join ${orgName}.` : `You've been invited to join ${orgName}.`
}

const PRODUCT_NAME = 'AI Ready Tools Extension'

// Short in-panel guide. It covers the main tasks, so the extension does not
// need a separate help page.
const HELP_STEPS = [
  'Open a chat on claude.ai, then click the extension icon in the toolbar to open this panel.',
  "Click a tool to type its prompt into Claude's chat box. Check it, then press Send. The extension never sends a message for you.",
  'Click Add tool to choose from the AIRE library or to write your own.',
  'Click + New to add a tab. Double-click a tab to rename it. Use the ⋯ menu to move or delete it.',
  'Use Export tools to keep a backup of your tools.',
]

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function actionButton(label: string, onClick: () => void, primary = false): HTMLButtonElement {
  const b = el('button', primary ? 'settings-action-button settings-action-primary' : 'settings-action-button', label)
  b.type = 'button'
  b.addEventListener('click', onClick)
  return b
}

/** A titled card. Returns the card and its body. */
function card(id: string, title: string): { section: HTMLElement; body: HTMLElement } {
  const section = el('section', 'settings-card')
  section.setAttribute('aria-labelledby', id)
  const heading = el('h3', 'eyebrow settings-card-title', title)
  heading.id = id
  const body = el('div', 'settings-card-body')
  section.append(heading, body)
  return { section, body }
}

/** One row: a title and hint on the left, a control on the right. */
function row(title: string, hint: string, control: HTMLElement): HTMLElement {
  const r = el('div', 'settings-row')
  const text = el('div', 'settings-row-text')
  text.append(el('span', 'settings-row-title', title), el('p', 'settings-hint', hint))
  r.append(text, control)
  return r
}

/** A row that opens a page in a new browser tab. */
function linkRow(title: string, hint: string, href: string): HTMLAnchorElement {
  const a = el('a', 'settings-row settings-link-row')
  a.href = href
  a.target = '_blank'
  a.rel = 'noopener'
  const text = el('span', 'settings-row-text')
  text.append(el('span', 'settings-row-title', title), el('span', 'settings-hint', hint))
  const arrow = el('span', 'settings-link-arrow gi', '↗')
  arrow.setAttribute('aria-hidden', 'true')
  const newTab = el('span', 'sr-only', ' (opens in a new tab)')
  a.append(text, arrow, newTab)
  return a
}

function renderAccount(context: SettingsPanelContext): HTMLElement {
  const { section, body } = card('settings-account', 'Account')

  const loadingLine = (text: string): HTMLElement => el('p', 'loading-line', text)

  if (context.signingIn) {
    body.appendChild(loadingLine('Signing in...'))
    return section
  }

  if (!context.session) {
    body.appendChild(
      el(
        'p',
        'settings-hint',
        "Sign in to get your organisation's shared tools. Your own tools work without an account.",
      ),
    )
    const actions = el('div', 'settings-actions')
    for (const provider of enabledProviders()) {
      actions.appendChild(actionButton(provider.label, () => context.onSignIn(provider.id), true))
    }
    body.appendChild(actions)
    return section
  }

  const who = el('div', 'settings-identity')
  const avatar = el('span', 'settings-avatar', context.session.email.charAt(0).toUpperCase())
  avatar.setAttribute('aria-hidden', 'true')
  const whoText = el('div', 'settings-row-text')
  whoText.appendChild(el('p', 'settings-hint', `Signed in as ${context.session.email}`))
  who.append(avatar, whoText)
  body.appendChild(who)

  const actions = el('div', 'settings-actions')
  const org = context.orgSession
  const status = (text: string): void => {
    whoText.appendChild(el('p', 'settings-row-title', text))
  }

  if (org?.state === 'active' && org.role === 'director') {
    status(`Admin of ${org.org.name}`)
    actions.appendChild(actionButton('Manage Organisation', context.onOpenManageOrg, true))
    actions.appendChild(actionButton('Leave organisation', context.onLeaveOrg))
  } else if (org?.state === 'active') {
    status(`Member of ${org.org.name}.`)
    actions.appendChild(actionButton('Leave organisation', context.onLeaveOrg))
  } else if (org?.state === 'invited') {
    status(inviteText(org.org.name, org.invitedBy))
    const accept = actionButton(
      'Accept invite',
      () => {
        accept.disabled = true
        accept.textContent = 'Joining...'
        context.onAcceptInvite()
      },
      true,
    )
    actions.appendChild(accept)
    actions.appendChild(actionButton('Decline', context.onLeaveOrg))
  } else if (org?.state === 'pending') {
    status(`Waiting for approval from ${org.org.name}.`)
    actions.appendChild(actionButton('Cancel request', context.onLeaveOrg))
  } else if (context.orgResolving) {
    whoText.appendChild(loadingLine('Checking organisation...'))
  } else if (org?.state === 'none') {
    // A personal account: everything works as before; an organisation is
    // something you're invited to, or optionally create.
    body.appendChild(
      el(
        'p',
        'settings-hint',
        'Personal account. If an admin invites you to an organisation, the invite will show up here.',
      ),
    )
    if (context.onCreateOrg) actions.appendChild(actionButton('Create an organisation', context.onCreateOrg))
  }

  actions.appendChild(actionButton('Sign out', context.onSignOut))
  body.appendChild(actions)
  return section
}

function renderBackup(context: SettingsPanelContext): HTMLElement {
  const { section, body } = card('settings-backup', 'Your tools')

  body.appendChild(row('Back up', 'Downloads all your tools as a .json file.', actionButton('Export tools', context.onExport)))

  const fileInput = document.createElement('input')
  fileInput.type = 'file'
  fileInput.accept = 'application/json'
  fileInput.className = 'settings-file-input'
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0]
    if (file) context.onImport(file)
    fileInput.value = ''
  })
  const importRow = row(
    'Restore or share',
    'Adds tools from a .json file to your list.',
    actionButton('Import tools', () => fileInput.click()),
  )
  importRow.appendChild(fileInput)
  body.appendChild(importRow)

  if (context.importError) {
    const error = el('p', 'settings-error', context.importError)
    error.setAttribute('role', 'alert')
    body.appendChild(error)
  } else if (context.importSuccessCount !== null) {
    const n = context.importSuccessCount
    const success = el('p', 'settings-success', `Imported ${n} tool${n === 1 ? '' : 's'}.`)
    success.setAttribute('role', 'status')
    body.appendChild(success)
  }
  return section
}

/** Tester build only. The store build has no QA config and never shows it. */
function renderTesterCard(qa: { buildLabel: string; onOpenFeedback: () => void }): HTMLElement {
  const { section, body } = card('settings-tester', 'Tester build')
  const actions = el('div', 'settings-actions')
  actions.appendChild(actionButton('Send feedback or report a problem', qa.onOpenFeedback, true))
  body.appendChild(actions)
  body.appendChild(
    el(
      'p',
      'settings-hint',
      `This build reports errors and which features you use to the AIRE team while you're signed in, to help testing. ` +
        `It never sends your prompts, buttons or Claude conversations. Build ${qa.buildLabel}.`,
    ),
  )
  return section
}

function renderHelp(): HTMLElement {
  const { section, body } = card('settings-help', 'Help and support')

  const guide = el('details', 'settings-guide')
  const summary = el('summary', 'settings-row settings-guide-summary')
  const text = el('span', 'settings-row-text')
  text.append(
    el('span', 'settings-row-title', 'How to use the extension'),
    el('span', 'settings-hint', 'Five steps to get started.'),
  )
  const chevron = el('span', 'settings-guide-chevron gi', '›')
  chevron.setAttribute('aria-hidden', 'true')
  summary.append(text, chevron)
  const steps = el('ol', 'settings-guide-steps')
  for (const step of HELP_STEPS) steps.appendChild(el('li', '', step))
  guide.append(summary, steps)
  body.appendChild(guide)

  body.appendChild(linkRow('Contact AIRE', 'Questions, feedback or ideas for new tools.', LINKS.contact))
  body.appendChild(linkRow('AI training', 'Claude, ChatGPT, Copilot and Gemini courses.', LINKS.training))
  body.appendChild(linkRow('Privacy policy', 'What the extension stores and why.', LINKS.privacy))
  return section
}

function renderAbout(): HTMLElement {
  const about = el('footer', 'settings-about')
  const name = el('p', 'settings-about-name', PRODUCT_NAME)
  const version = extensionVersion()
  if (version) name.appendChild(el('span', 'settings-version', `v${version}`))
  about.appendChild(name)
  about.appendChild(
    el(
      'p',
      'settings-hint',
      'Saved prompts and skills for claude.ai, one click away. Your tools are stored in this browser.',
    ),
  )
  const by = el('p', 'settings-hint')
  by.append('Made by AIRE · ')
  const site = el('a', 'settings-about-link', 'getaiready.now')
  site.href = LINKS.homeFromAbout
  site.target = '_blank'
  site.rel = 'noopener'
  by.appendChild(site)
  about.appendChild(by)
  return about
}

export function renderSettingsPanel(context: SettingsPanelContext): HTMLElement {
  const container = el('div', 'settings-panel')

  const backButton = el('button', 'settings-back-button')
  backButton.type = 'button'
  backButton.innerHTML = '<span class="gi" aria-hidden="true">←</span> Back to tools'
  backButton.addEventListener('click', context.onBack)
  container.appendChild(backButton)

  container.appendChild(el('h2', 'settings-heading', 'Settings'))
  container.appendChild(renderAccount(context))
  container.appendChild(renderBackup(context))
  if (QA_ENABLED && context.qa) container.appendChild(renderTesterCard(context.qa))
  container.appendChild(renderHelp())
  container.appendChild(renderAbout())
  return container
}
