import type { Button, ButtonType, ToolTab } from '../shared/types'
import type { ButtonUsageMap } from '../shared/prompt-usage'

import { LINKS } from '../shared/links'
import { renderButtonRow } from './ButtonRow'
import { renderEditForm } from './EditForm'
import { renderSettingsPanel, inviteText } from './SettingsPanel'
import { renderTeamSection, TEAM_RUN_KEY } from './TeamSection'
import { renderOrgOnboarding } from './OrgOnboarding'
import { renderManageOrganisation, type ManageOrgState } from './ManageOrganisation'
import { renderTabStrip, folderTabDomId, FOLDER_PANEL_ID } from './TabStrip'
import { renderPopoverMenu } from './PopoverMenu'
import { renderLibrary } from './Library'
import { AIRE_LIBRARY, type LibraryItem } from '../shared/library'
import { renderFeedbackForm, type FeedbackState } from './FeedbackForm'
import type { FeedbackInput } from '../shared/qa/feedback'
import type { OrgPrompt, OrgPromptsResult } from '../shared/org-prompts'
import type { OrgSessionState } from '../shared/org-session'
import type { ProviderId } from '../shared/auth/providers'

export type View =
  | { mode: 'list' }
  | { mode: 'form'; button: Button | null }
  | { mode: 'settings' }
  | { mode: 'org-onboarding' }
  | { mode: 'manage-org' }
  | { mode: 'library' }
  | { mode: 'feedback' }

/** Tester-build state. Absent in the Chrome Web Store build, which then
 * renders no feedback entry point at all. */
export interface QaViewState {
  buildLabel: string
  feedback: FeedbackState
}

export interface TabViewState {
  tabs: ToolTab[]
  activeTabId: string | null
  defaultTabId: string | null
  /** The tab whose name is being typed in place on the tab itself. */
  editingTabId: string | null
  sortMode: 'manual' | 'most-used'
  buttonUsage: ButtonUsageMap
  /** Every personal button across all tabs -- for tab counts and the
   * library's "Added" state. */
  allButtons: Button[]
}

export interface RunState {
  isRunning: boolean
  error: string | null
}

export interface SettingsState {
  error: string | null
  successCount: number | null
  signingIn: boolean
  orgResolving: boolean
  /** Create-organisation form: last error, and whether a request is in flight. */
  onboardingError?: string | null
  onboardingBusy?: boolean
}

export interface RenderContext {
  onRun: (button: Button) => void
  onEdit: (button: Button) => void
  onDelete: (button: Button) => void
  onDrop: (draggedId: string, targetId: string, position: 'before' | 'after') => void
  onArrowMove: (id: string, direction: 'up' | 'down') => void
  onAddClick: () => void
  onSave: (data: { id: string | null; name: string; prompt: string; type: ButtonType; tabId: string }) => void
  onCancel: () => void
  onSelectTab: (tabId: string) => void
  onToggleSort: () => void
  onAddTab: () => void
  onReorderTabs: (orderedIds: string[]) => void
  onStartRenameTab: (id: string) => void
  onRenameTab: (id: string, name: string, emoji: string | null) => void
  onCancelRenameTab: (id: string) => void
  onMoveTab: (id: string, direction: 'up' | 'down') => void
  onDeleteTab: (id: string) => void
  onSetDefaultTab: (id: string) => void
  onLibraryAdd: (item: LibraryItem) => void
  onWriteOwnTool: () => void
  onLibraryDone: () => void
  onOpenSettings: () => void
  onExport: () => void
  onImport: (file: File) => void
  onSettingsBack: () => void
  onSignIn: (providerId: ProviderId) => void
  onSignOut: () => void
  onRunTeamPrompt: (prompt: OrgPrompt) => void
  onSelectTeamTab: (tabId: string) => void
  onOnboardingSubmit: (data: { orgName: string; initialMemberEmails: string[] }) => void
  onOnboardingCancel: () => void
  onOpenCreateOrg: () => void
  onOpenManageOrg: () => void
  onLeaveOrg: () => void
  onAcceptInvite: () => void
  onManageOrgBack: () => void
  onApproveMember: (email: string) => void
  onRemoveMember: (email: string) => void
  onPromoteMember: (email: string) => void
  onDemoteMember: (email: string) => void
  onAddMember: (email: string) => void
  onCreateOrgTab: (name: string) => void
  onRenameOrgTab: (id: string, name: string, emoji: string | null) => void
  onDeleteOrgTab: (id: string) => void
  onReorderOrgTabs: (orderedIds: string[]) => void
  onCreatePrompt: (data: { name: string; promptText: string; type: 'prompt' | 'skill'; tabId: string }) => void
  onUpdatePrompt: (
    id: string,
    data: { name: string; promptText: string; type: 'prompt' | 'skill'; tabId: string },
  ) => void
  onDeletePrompt: (id: string) => void
  onEditPromptClick: (prompt: OrgPrompt) => void
  onCancelEditPrompt: () => void
  onOpenFeedback: () => void
  onFeedbackSubmit: (input: FeedbackInput) => void
  onFeedbackSendAnother: () => void
  onFeedbackBack: () => void
}

export function withMovedId(
  ids: string[],
  draggedId: string,
  targetId: string,
  position: 'before' | 'after',
): string[] {
  const remaining = ids.filter((id) => id !== draggedId)
  const targetIndex = remaining.indexOf(targetId)
  const insertAt = position === 'before' ? targetIndex : targetIndex + 1
  remaining.splice(insertAt, 0, draggedId)
  return remaining
}

export function withSwappedAdjacent(ids: string[], id: string, direction: 'up' | 'down'): string[] | null {
  const index = ids.indexOf(id)
  const swapWith = direction === 'up' ? index - 1 : index + 1
  if (index === -1 || swapWith < 0 || swapWith >= ids.length) return null
  const next = [...ids]
  ;[next[index], next[swapWith]] = [next[swapWith], next[index]]
  return next
}

export function renderApp(
  root: HTMLElement,
  buttons: Button[],
  tabState: TabViewState,
  view: View,
  runState: Map<string, RunState>,
  settingsState: SettingsState,
  session: { email: string } | null,
  orgSession: OrgSessionState | null,
  teamPrompts: OrgPromptsResult,
  teamActiveTabId: string | null,
  manageOrgState: ManageOrgState,
  context: RenderContext,
  qa: QaViewState | null = null,
): void {
  root.innerHTML = ''

  // Persistent AI Ready logo, top-left of every view. It opens the AI Ready
  // site in a new browser tab.
  const appHeader = document.createElement('div')
  appHeader.className = 'app-header'
  const brand = document.createElement('a')
  brand.className = 'wordmark'
  brand.href = LINKS.homeFromLogo
  brand.target = '_blank'
  brand.rel = 'noopener'
  brand.title = 'Visit AI Ready (getaiready.now)'
  brand.setAttribute('aria-label', 'AI Ready website (opens in a new tab)')
  const mark = document.createElement('span')
  mark.className = 'wordmark-mark'
  mark.setAttribute('aria-hidden', 'true')
  brand.appendChild(mark)
  appHeader.appendChild(brand)
  root.appendChild(appHeader)

  if (view.mode === 'form') {
    root.appendChild(
      renderEditForm(view.button, tabState.tabs, tabState.activeTabId, {
        onSave: context.onSave,
        onCancel: context.onCancel,
      }),
    )
    return
  }

  if (view.mode === 'library') {
    const tab = tabState.tabs.find((t) => t.id === tabState.activeTabId) ?? null
    root.appendChild(
      renderLibrary(AIRE_LIBRARY, tab, tabState.allButtons, {
        onAdd: context.onLibraryAdd,
        onWriteOwn: context.onWriteOwnTool,
        onDone: context.onLibraryDone,
      }),
    )
    return
  }

  if (view.mode === 'feedback' && qa) {
    root.appendChild(
      renderFeedbackForm({
        ...qa.feedback,
        signedIn: session !== null,
        buildLabel: qa.buildLabel,
        onSubmit: context.onFeedbackSubmit,
        onSendAnother: context.onFeedbackSendAnother,
        onBack: context.onFeedbackBack,
      }),
    )
    return
  }

  if (view.mode === 'settings') {
    root.appendChild(
      renderSettingsPanel({
        qa: qa ? { buildLabel: qa.buildLabel, onOpenFeedback: context.onOpenFeedback } : null,
        onExport: context.onExport,
        onImport: context.onImport,
        onBack: context.onSettingsBack,
        importError: settingsState.error,
        importSuccessCount: settingsState.successCount,
        session,
        signingIn: settingsState.signingIn,
        orgResolving: settingsState.orgResolving,
        onSignIn: context.onSignIn,
        onSignOut: context.onSignOut,
        orgSession,
        onOpenManageOrg: context.onOpenManageOrg,
        onLeaveOrg: context.onLeaveOrg,
        onAcceptInvite: context.onAcceptInvite,
        onCreateOrg: context.onOpenCreateOrg,
      }),
    )
    return
  }

  if (view.mode === 'org-onboarding') {
    root.appendChild(
      renderOrgOnboarding({
        onSubmit: context.onOnboardingSubmit,
        onCancel: context.onOnboardingCancel,
        error: settingsState.onboardingError,
        busy: settingsState.onboardingBusy,
      }),
    )
    return
  }

  if (view.mode === 'manage-org') {
    root.appendChild(
      renderManageOrganisation(manageOrgState, {
        onApprove: context.onApproveMember,
        onRemove: context.onRemoveMember,
        onPromote: context.onPromoteMember,
        onDemote: context.onDemoteMember,
        onAdd: context.onAddMember,
        onCreateOrgTab: context.onCreateOrgTab,
        onRenameOrgTab: context.onRenameOrgTab,
        onDeleteOrgTab: context.onDeleteOrgTab,
        onReorderOrgTabs: context.onReorderOrgTabs,
        onCreatePrompt: context.onCreatePrompt,
        onUpdatePrompt: context.onUpdatePrompt,
        onDeletePrompt: context.onDeletePrompt,
        onEditPromptClick: context.onEditPromptClick,
        onCancelEditPrompt: context.onCancelEditPrompt,
        onBack: context.onManageOrgBack,
      }),
    )
    return
  }

  // Settings lives in the wordmark row, labelled, so nobody has to guess
  // what a bare gear means.
  const settingsButton = document.createElement('button')
  settingsButton.type = 'button'
  settingsButton.className = 'icon-button settings-button'
  settingsButton.innerHTML = '<span class="gi" aria-hidden="true">⚙</span> Settings'
  settingsButton.addEventListener('click', context.onOpenSettings)
  appHeader.appendChild(settingsButton)

  const hasTabs = tabState.tabs.length > 0
  const activeTab = tabState.tabs.find((t) => t.id === tabState.activeTabId) ?? null

  const folder = document.createElement('div')
  folder.className = 'folder'

  if (hasTabs) {
    const countByTab: Record<string, number> = {}
    for (const button of tabState.allButtons) {
      countByTab[button.tabId] = (countByTab[button.tabId] ?? 0) + 1
    }
    folder.appendChild(
      renderTabStrip(tabState.tabs, {
        activeTabId: tabState.activeTabId,
        editingTabId: tabState.editingTabId,
        countByTab,
        onSelect: context.onSelectTab,
        onAdd: context.onAddTab,
        onReorder: context.onReorderTabs,
        onStartRename: context.onStartRenameTab,
        onRename: context.onRenameTab,
        onCancelRename: context.onCancelRenameTab,
      }),
    )
  }

  // The panel the active tab opens onto. Everything for this tab -- its
  // tools, sorting, and "Add tool to <tab>" -- lives inside it.
  const panel = document.createElement('section')
  panel.className = hasTabs ? 'folder-panel' : 'folder-panel folder-panel-standalone'
  panel.id = FOLDER_PANEL_ID
  if (activeTab) {
    panel.setAttribute('role', 'tabpanel')
    panel.setAttribute('aria-labelledby', folderTabDomId(activeTab.id))
  }

  // `buttons` arrives already scoped to the active tab and already sorted
  // (manual order or most-used) by main.ts.
  const visibleButtons = buttons

  const panelHead = document.createElement('div')
  panelHead.className = 'folder-head'
  const title = document.createElement('h2')
  title.className = 'folder-title'
  title.textContent = activeTab
    ? activeTab.emoji
      ? `${activeTab.emoji} ${activeTab.name}`
      : activeTab.name
    : 'Your tools'
  panelHead.appendChild(title)
  const count = document.createElement('span')
  count.className = 'folder-count'
  count.textContent = visibleButtons.length === 1 ? '1 tool' : `${visibleButtons.length} tools`
  panelHead.appendChild(count)

  const headActions = document.createElement('div')
  headActions.className = 'folder-head-actions'
  if (visibleButtons.length > 1 || tabState.sortMode === 'most-used') {
    const sortToggle = document.createElement('button')
    sortToggle.type = 'button'
    sortToggle.className = 'folder-link'
    sortToggle.textContent = 'Most used first'
    sortToggle.setAttribute('aria-pressed', String(tabState.sortMode === 'most-used'))
    sortToggle.addEventListener('click', context.onToggleSort)
    headActions.appendChild(sortToggle)
  }
  if (activeTab) {
    // Everything you can do to a tab, in place: no separate tab screen.
    const index = tabState.tabs.findIndex((t) => t.id === activeTab.id)
    const isDefault = tabState.defaultTabId === activeTab.id
    headActions.appendChild(
      renderPopoverMenu(`tab-${activeTab.id}`, `Tab options for ${activeTab.name}`, [
        { label: 'Rename tab', onSelect: () => context.onStartRenameTab(activeTab.id) },
        {
          label: 'Move left',
          disabled: index <= 0,
          onSelect: () => context.onMoveTab(activeTab.id, 'up'),
        },
        {
          label: 'Move right',
          disabled: index >= tabState.tabs.length - 1,
          onSelect: () => context.onMoveTab(activeTab.id, 'down'),
        },
        {
          label: isDefault ? 'Opens first ✓' : 'Open this tab first',
          disabled: isDefault,
          onSelect: () => context.onSetDefaultTab(activeTab.id),
        },
        {
          label: 'Delete tab',
          ariaLabel: `Delete tab ${activeTab.name}`,
          danger: true,
          disabled: tabState.tabs.length <= 1,
          onSelect: () => context.onDeleteTab(activeTab.id),
        },
      ]),
    )
  }
  panelHead.appendChild(headActions)
  panel.appendChild(panelHead)

  if (visibleButtons.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'empty-state'
    empty.textContent = hasTabs ? 'No tools in this tab yet.' : 'No tools yet.'
    panel.appendChild(empty)
  } else {
  const list = document.createElement('ul')
  list.className = 'button-list'
  visibleButtons.forEach((button) => {
    const state = runState.get(button.id) ?? { isRunning: false, error: null }
    list.appendChild(
      renderButtonRow(button, {
        isRunning: state.isRunning,
        runError: state.error,
        reorderable: tabState.sortMode === 'manual',
        onRun: () => context.onRun(button),
        onEdit: () => context.onEdit(button),
        onDelete: () => context.onDelete(button),
        onDrop: (draggedId, position) => context.onDrop(draggedId, button.id, position),
        onArrowMove: (direction) => context.onArrowMove(button.id, direction),
      }),
    )
  })
  panel.appendChild(list)
  }

  // "Add tool" sits inside the tab and names it, so it is clear where the
  // new tool will go. The edit form already defaults to the active tab.
  const addButton = document.createElement('button')
  addButton.type = 'button'
  addButton.className = 'add-tool-button'
  addButton.innerHTML = '<span class="gi" aria-hidden="true">+</span> '
  addButton.append(activeTab ? `Add tool to ${activeTab.name}` : 'Add tool')
  addButton.addEventListener('click', context.onAddClick)
  panel.appendChild(addButton)

  folder.appendChild(panel)
  root.appendChild(folder)

  if (orgSession?.state === 'invited') {
    const card = document.createElement('div')
    card.className = 'org-pending-banner org-invite'
    const text = document.createElement('p')
    text.textContent = `${inviteText(orgSession.org.name, orgSession.invitedBy)} Joining shares its prompts with you, and your usage with its admins.`
    card.appendChild(text)
    const actions = document.createElement('div')
    actions.className = 'org-invite-actions'
    const accept = document.createElement('button')
    accept.type = 'button'
    accept.className = 'add-button'
    accept.textContent = 'Accept'
    const decline = document.createElement('button')
    decline.type = 'button'
    decline.className = 'settings-action-button'
    decline.textContent = 'Decline'
    decline.addEventListener('click', context.onLeaveOrg)
    // Accepting can take a few seconds (backend + loading shared prompts);
    // show it's working so nobody clicks twice.
    accept.addEventListener('click', () => {
      accept.disabled = decline.disabled = true
      accept.textContent = 'Joining...'
      context.onAcceptInvite()
    })
    actions.append(accept, decline)
    card.appendChild(actions)
    root.appendChild(card)
  } else if (orgSession?.state === 'pending') {
    const banner = document.createElement('p')
    banner.className = 'org-pending-banner'
    banner.textContent = "You're signed in. Waiting for an admin to approve you."
    root.appendChild(banner)
  } else if (
    // `orgSession === null` means unresolved -- the /api/org-session call
    // never came back (offline, backend down), which is different from a
    // resolved non-active state. In that case fall back to whatever
    // loadOrgPrompts recovered from its local cache, so the Team section
    // stays usable offline instead of vanishing.
    (orgSession?.state === 'active' || orgSession === null) &&
    teamPrompts.prompts.length > 0
  ) {
    root.appendChild(
      renderTeamSection(
        teamPrompts.orgName ?? 'Team',
        teamPrompts.tabs,
        teamPrompts.prompts,
        teamActiveTabId,
        context.onSelectTeamTab,
        context.onRunTeamPrompt,
        runState.get(TEAM_RUN_KEY)?.error ?? null,
      ),
    )
  }
}
