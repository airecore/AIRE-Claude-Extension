import { installQaCapture, qaTrack, qaFlush } from '../shared/qa/logger'
import { QA_ENABLED, buildLabel } from '../shared/qa/config'
import { sendFeedback, type FeedbackInput } from '../shared/qa/feedback'
import type { FeedbackState } from './FeedbackForm'
import { ToolService } from '../shared/tool-service'
import { sendToClaudeTab } from '../shared/claude-tab'
import { ChromeLocalStorageAdapter } from '../shared/storage/chrome-local-adapter'
import { ClerkAuthAdapter } from '../shared/auth/clerk-auth-adapter'
import type { ProviderId } from '../shared/auth/providers'
import {
  renderApp,
  withMovedId,
  withSwappedAdjacent,
  type View,
  type RunState,
  type SettingsState,
} from './render'
import type { Button, ToolTab } from '../shared/types'
import type { LibraryItem } from '../shared/library'
import type { InsertPromptRequest, GetUsageRequest, GetUsageResponse } from '../shared/messages'
import { parseBackup, serializeBackup } from '../shared/backup'
import { getTabPrefs, setActiveTab, setDefaultTab, resolveActiveTabId } from '../shared/tab-prefs'
import {
  getButtonUsage,
  recordButtonRun,
  pruneButtonUsage,
  sortButtonsByMostUsed,
  type ButtonUsageMap,
} from '../shared/prompt-usage'
import {
  reportPromptRun,
  fetchOrgAnalytics,
  type OrgAnalytics,
} from '../shared/org-analytics'
import {
  loadOrgPrompts,
  getCachedOrgPrompts,
  clearCachedOrgPrompts,
  createOrgPrompt,
  updateOrgPrompt,
  deleteOrgPrompt,
  createOrgTab,
  updateOrgTab,
  deleteOrgTab,
  reorderOrgTabs,
  type OrgPrompt,
  type OrgPromptsResult,
} from '../shared/org-prompts'
import { fetchOrgSession, submitOrgOnboarding, leaveOrg, acceptInvite, type OrgSessionState } from '../shared/org-session'
import {
  fetchOrgMembers,
  approveOrgMember,
  removeOrgMember,
  addOrgMember,
  setOrgMemberRole,
  type OrgMember,
} from '../shared/org-members'
import type { ManageOrgState } from './ManageOrganisation'
import { TEAM_RUN_KEY } from './TeamSection'
import { reportUsage, fetchOrgUsage, type OrgUsageSnapshot } from '../shared/usage-report'

// First, so errors anywhere below are captured in the tester build.
installQaCapture('sidepanel')

const toolService = new ToolService(new ChromeLocalStorageAdapter())
const authAdapter = new ClerkAuthAdapter()
const rootElement = document.getElementById('app')

if (!rootElement) {
  throw new Error('[Claude Tools] sidepanel root element (#app) is missing')
}

const root: HTMLElement = rootElement

let view: View = { mode: 'list' }
let tabs: ToolTab[] = []
let activeTabId: string | null = null
let defaultTabId: string | null = null
// The tab being renamed in place on the tab strip, and (if it was just
// made with "+ New") that tab's id, so Escape can undo the creation.
let editingTabId: string | null = null
let freshTabId: string | null = null
let tabBeforeFresh: string | null = null
let sortMode: 'manual' | 'most-used' = 'manual'
let buttonUsage: ButtonUsageMap = {}
let orgAnalytics: OrgAnalytics | null = null
let session: { email: string } | null = null
let teamPrompts: OrgPromptsResult = { orgName: null, tabs: [], prompts: [] }
// Which shared tab's prompts the Team section shows. Falls back to the
// first tab (in TeamSection.ts) if this is null or points at a tab that
// no longer exists.
let teamActiveTabId: string | null = null
let orgSession: OrgSessionState | null = null
let orgMembers: OrgMember[] = []
let manageOrgLoading = false
let manageOrgBusy = false
let manageOrgAddError: string | null = null
let orgPrompts: OrgPrompt[] = []
let editingPromptId: string | null = null
let promptFormError: string | null = null
let orgUsageSnapshots: OrgUsageSnapshot[] = []
const USAGE_REPORT_INTERVAL_MS = 15 * 60 * 1000
let usageReportTimer: ReturnType<typeof setInterval> | null = null
const runState = new Map<string, RunState>()

// Analytics fire when an inserted prompt is actually sent, not on click.
// The content script watches the chat input and posts PROMPT_SENT with
// the run token; the callback stored here then records the run.
const pendingRuns = new Map<string, { fire: () => void; timer: ReturnType<typeof setTimeout> }>()

// A prompt that is inserted and then never sent (edited away, abandoned)
// gets no PROMPT_SENT, so its entry would sit in this map for the life of
// the side panel. The content-script send watcher gives up after 5
// minutes; drop our entry a little after that so the map can't grow
// without bound over a long session.
const PENDING_RUN_TTL_MS = 6 * 60 * 1000

function registerPendingRun(runToken: string, fire: () => void): void {
  const timer = setTimeout(() => pendingRuns.delete(runToken), PENDING_RUN_TTL_MS)
  pendingRuns.set(runToken, { fire, timer })
}

chrome.runtime.onMessage.addListener((message) => {
  const m = message as { type?: unknown; runToken?: unknown }
  if (m?.type === 'PROMPT_SENT' && typeof m.runToken === 'string') {
    const entry = pendingRuns.get(m.runToken)
    if (entry) {
      clearTimeout(entry.timer)
      pendingRuns.delete(m.runToken)
      entry.fire()
    }
  }
})
const settingsState: SettingsState = {
  error: null,
  successCount: null,
  signingIn: false,
  orgResolving: false,
  onboardingError: null,
  onboardingBusy: false,
}
let focusHandleId: string | null = null

// --- Tester build: feedback + sending queued QA events ---------------
const QA_BUILD_LABEL = buildLabel()
const QA_FLUSH_INTERVAL_MS = 60 * 1000
const emptyDraft = (): FeedbackInput => ({ category: 'bug', description: '', attachDiagnostics: true })
const feedbackState: FeedbackState = { draft: emptyDraft(), sending: false, error: null, sent: null }

/** Sends queued QA events if signed in. Safe to call often. */
async function flushQa(): Promise<void> {
  if (!QA_ENABLED || !session) return
  const token = await authAdapter.getValidToken()
  if (token) await qaFlush(token)
}

function startQaFlushing(): void {
  if (!QA_ENABLED) return
  setInterval(() => void flushQa(), QA_FLUSH_INTERVAL_MS)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushQa()
  })
}

function clearRunErrors(): void {
  for (const [id, state] of runState) {
    if (state.error && !state.isRunning) {
      runState.delete(id)
    }
  }
}

function announce(message: string): void {
  const region = document.getElementById('live-status')
  if (region) region.textContent = message
}

async function resolveOrgSession(root: HTMLElement): Promise<void> {
  settingsState.orgResolving = true
  if (view.mode === 'settings') void refresh(root)
  try {
    await resolveOrgSessionInner(root)
  } finally {
    settingsState.orgResolving = false
    if (view.mode === 'settings') void refresh(root)
  }
}

async function resolveOrgSessionInner(root: HTMLElement): Promise<void> {
  const startedForSession = session
  const idToken = await authAdapter.getValidToken()
  if (session !== startedForSession) return
  if (!idToken) {
    const stillSignedIn = await authAdapter.getCurrentSession()
    if (session !== startedForSession) return
    if (session && !stillSignedIn) {
      session = null
      await clearCachedOrgPrompts()
      announce('Please sign in again to see your organisation.')
    }
    // The org session is unresolved, not resolved-inactive: a token refresh
    // can fail transiently (offline). Keep any cached team prompts so the
    // Team section survives. If the session actually ended above the cache
    // was just cleared, so `cached` is null and the section disappears.
    const cached = session ? await getCachedOrgPrompts() : null
    if (session !== startedForSession) return
    orgSession = null
    teamPrompts = cached ?? { orgName: null, tabs: [], prompts: [] }
    stopUsageReportTimer()
    if (view.mode === 'list' || view.mode === 'settings') await refresh(root)
    return
  }

  const resolution = await fetchOrgSession(idToken)
  if (session !== startedForSession) return
  orgSession = resolution

  if (resolution?.state === 'active') {
    const result = await loadOrgPrompts(idToken)
    if (session !== startedForSession) return
    teamPrompts = result
    startUsageReportTimer()
  } else if (resolution === null) {
    // Same unresolved case as above: /api/org-session was unreachable. Fall
    // back to the cache rather than clearing, matching the pre-Phase-2D
    // behaviour where the Team section came straight from loadOrgPrompts.
    const cached = await getCachedOrgPrompts()
    if (session !== startedForSession) return
    teamPrompts = cached ?? { orgName: null, tabs: [], prompts: [] }
    stopUsageReportTimer()
  } else {
    teamPrompts = { orgName: null, tabs: [], prompts: [] }
    stopUsageReportTimer()
  }
  if (view.mode === 'list' || view.mode === 'settings') await refresh(root)
}

async function refreshOrgMembers(root: HTMLElement, rerender = true): Promise<void> {
  const idToken = await authAdapter.getValidToken()
  if (!idToken) return
  const members = await fetchOrgMembers(idToken)
  if (members) orgMembers = members
  if (rerender && view.mode === 'manage-org') await refresh(root)
}

async function refreshOrgPrompts(root: HTMLElement, rerender = true): Promise<void> {
  const idToken = await authAdapter.getValidToken()
  if (!idToken) return
  const result = await loadOrgPrompts(idToken)
  orgPrompts = result.prompts
  teamPrompts = result
  if (rerender && view.mode === 'manage-org') await refresh(root)
}

async function refreshOrgUsage(root: HTMLElement, rerender = true): Promise<void> {
  const idToken = await authAdapter.getValidToken()
  if (!idToken) return
  const snapshots = await fetchOrgUsage(idToken)
  if (snapshots) orgUsageSnapshots = snapshots
  if (rerender && view.mode === 'manage-org') await refresh(root)
}

async function refreshOrgAnalytics(root: HTMLElement, rerender = true): Promise<void> {
  const idToken = await authAdapter.getValidToken()
  if (!idToken) return
  const analytics = await fetchOrgAnalytics(idToken)
  if (analytics) orgAnalytics = analytics
  if (rerender && view.mode === 'manage-org') await refresh(root)
}

/** Runs a shared-tab / shared-prompt write with a "Saving..." spinner in
 * the Manage Organisation view, then reloads the org data. */
async function runOrgWrite(
  root: HTMLElement,
  fn: (idToken: string) => Promise<void>,
): Promise<void> {
  const idToken = await authAdapter.getValidToken()
  if (!idToken) return
  manageOrgBusy = true
  if (view.mode === 'manage-org') await refresh(root)
  try {
    await fn(idToken)
  } finally {
    manageOrgBusy = false
    await refreshOrgPrompts(root)
  }
}

async function reportCurrentUsage(): Promise<void> {
  const idToken = await authAdapter.getValidToken()
  if (!idToken) return
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    // Only a claude.ai tab has the content script that answers GET_USAGE.
    // Anything else (or a claude.ai tab opened before the last extension
    // reload) just has no receiver -- skip quietly, this is a background poll.
    if (!tab?.id || !tab.url?.startsWith('https://claude.ai/')) return
    const response = await chrome.tabs.sendMessage<GetUsageRequest, GetUsageResponse>(tab.id, {
      type: 'GET_USAGE',
    })
    if (response.ok) await reportUsage(idToken, response.usage)
  } catch (error) {
    console.debug('[Claude Tools] usage report skipped (no content script in the active tab)', error)
  }
}

function startUsageReportTimer(): void {
  if (usageReportTimer) return
  void reportCurrentUsage()
  usageReportTimer = setInterval(() => void reportCurrentUsage(), USAGE_REPORT_INTERVAL_MS)
}

function stopUsageReportTimer(): void {
  if (usageReportTimer) {
    clearInterval(usageReportTimer)
    usageReportTimer = null
  }
}

/** The text field the user is typing in, so a full re-render (background
 * org loads redraw the whole panel) doesn't wipe it or steal focus.
 * Matched by placeholder / aria-label / label text. A field whose form was
 * just submitted is skipped -- that form is meant to come back empty. */
interface TypingSnapshot { key: string; value: string; start: number | null; end: number | null }

function fieldKey(el: HTMLInputElement | HTMLTextAreaElement): string {
  return el.placeholder || el.getAttribute('aria-label') || el.closest('label')?.firstChild?.textContent || ''
}

function captureTyping(root: HTMLElement): TypingSnapshot | null {
  const el = document.activeElement
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) || !root.contains(el)) return null
  if (el.form?.dataset.submitted) return null
  const key = fieldKey(el)
  return key ? { key, value: el.value, start: el.selectionStart, end: el.selectionEnd } : null
}

function restoreTyping(root: HTMLElement, snap: TypingSnapshot | null): void {
  if (!snap) return
  const el = Array.from(root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')).find(
    (f) => fieldKey(f) === snap.key,
  )
  if (!el) return
  if (!el.value) el.value = snap.value
  el.focus()
  try { el.setSelectionRange(snap.start, snap.end) } catch { /* email inputs don't support selection */ }
}

async function refresh(root: HTMLElement): Promise<void> {
  try {
    const buttons = await toolService.listButtons()
    tabs = await toolService.listTabs()
    buttonUsage = await getButtonUsage()
    void pruneButtonUsage(buttons.map((b) => b.id))
    const prefs = await getTabPrefs()
    defaultTabId = prefs.defaultTabId
    if (!activeTabId || !tabs.some((t) => t.id === activeTabId)) {
      activeTabId = resolveActiveTabId(
        tabs.map((t) => t.id),
        prefs,
      )
    }
    let visibleButtons =
      activeTabId === null ? buttons : buttons.filter((b) => b.tabId === activeTabId)
    if (sortMode === 'most-used') {
      visibleButtons = sortButtonsByMostUsed(visibleButtons, buttonUsage)
    }
    const typing = captureTyping(root)
    renderApp(
      root,
      visibleButtons,
      { tabs, activeTabId, defaultTabId, editingTabId, sortMode, buttonUsage, allButtons: buttons },
      view,
      runState,
      settingsState,
      session,
      orgSession,
      teamPrompts,
      teamActiveTabId,
      {
        members: orgMembers,
        addError: manageOrgAddError,
        loading: manageOrgLoading,
        busy: manageOrgBusy,
        orgTabs: teamPrompts.tabs,
        prompts: orgPrompts,
        editingPromptId,
        promptFormError,
        usageSnapshots: orgUsageSnapshots,
        analytics: orgAnalytics,
      },
      {
      onRun: async (button: Button) => {
        const alreadyRunning = [...runState.values()].some((state) => state.isRunning)
        if (alreadyRunning) return
        clearRunErrors()
        runState.set(button.id, { isRunning: true, error: null })
        if (view.mode === 'list') await refresh(root)

        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
          if (!tab?.id || !tab.url) {
            console.warn('[Claude Tools] no active claude.ai tab to run against')
            runState.set(button.id, { isRunning: false, error: 'Open claude.ai to use this prompt.' })
            announce('Open claude.ai to use this prompt.')
            if (view.mode === 'list') await refresh(root)
            return
          }

          const runToken = crypto.randomUUID()
          const request: InsertPromptRequest = {
            type: 'INSERT_PROMPT',
            prompt: button.prompt,
            runToken,
          }
          const sent = await sendToClaudeTab(tab.id, request)
          if (!sent.ok) {
            runState.set(button.id, { isRunning: false, error: 'Reload the Claude tab and try again.' })
            announce('Reload the Claude tab and try again.')
            if (view.mode === 'list') await refresh(root)
            return
          }
          const response = sent.response

          if (response.ok) {
            runState.set(button.id, { isRunning: false, error: null })
            qaTrack('button_run', { type: button.type })
            registerPendingRun(runToken, () => {
              qaTrack('button_sent', { type: button.type })
              void recordButtonRun(button.id).then(() => {
                if (view.mode === 'list') void refresh(root)
              })
            })
          } else {
            // Shown to the person; the page's script already reports it as a
            // named QA defect, so warn rather than count it twice.
            console.warn('[Claude Tools] run failed', response.error, response.message)
            runState.set(button.id, { isRunning: false, error: response.message })
            announce(response.message)
          }
          if (view.mode === 'list') await refresh(root)
        } catch (error) {
          console.error('[Claude Tools] unexpected error running button', error)
          runState.set(button.id, {
            isRunning: false,
            error: 'Something went wrong running that prompt. Check the console for details.',
          })
          announce('Something went wrong running that prompt. Check the console for details.')
          if (view.mode === 'list') await refresh(root)
        }
      },
      onAddClick: () => {
        clearRunErrors()
        view = { mode: 'library' }
        void refresh(root)
      },
      onWriteOwnTool: () => {
        view = { mode: 'form', button: null }
        void refresh(root)
      },
      onLibraryDone: () => {
        view = { mode: 'list' }
        void refresh(root)
      },
      onLibraryAdd: async (item: LibraryItem) => {
        try {
          await toolService.createButton(item.name, item.prompt, item.type, activeTabId ?? undefined)
          const tabName = tabs.find((t) => t.id === activeTabId)?.name
          announce(tabName ? `Added ${item.name} to ${tabName}.` : `Added ${item.name}.`)
          await refresh(root)
        } catch (error) {
          console.error('[Claude Tools] failed to add library tool', error)
          root.textContent = 'Something went wrong adding that prompt. Check the console for details.'
        }
      },
      onEdit: (button: Button) => {
        clearRunErrors()
        view = { mode: 'form', button }
        void refresh(root)
      },
      onDelete: async (button: Button) => {
        const confirmed = window.confirm(`Delete "${button.name}"? This cannot be undone.`)
        if (!confirmed) return
        clearRunErrors()
        try {
          await toolService.deleteButton(button.id)
          qaTrack('button_deleted')
          await refresh(root)
        } catch (error) {
          console.error('[Claude Tools] failed to delete button', error)
          root.textContent = 'Something went wrong deleting that prompt. Check the console for details.'
        }
      },
      onDrop: async (draggedId: string, targetId: string, position: 'before' | 'after') => {
        if (sortMode !== 'manual') return
        clearRunErrors()
        const ids = withMovedId(
          visibleButtons.map((b) => b.id),
          draggedId,
          targetId,
          position,
        )
        try {
          await toolService.reorderButtons(ids)
          qaTrack('buttons_reordered', { method: 'drag' })
          await refresh(root)
        } catch (error) {
          console.error('[Claude Tools] failed to reorder buttons', error)
          root.textContent = 'Something went wrong reordering your prompts. Check the console for details.'
        }
      },
      onArrowMove: async (id: string, direction: 'up' | 'down') => {
        if (sortMode !== 'manual') return
        const ids = withSwappedAdjacent(
          visibleButtons.map((b) => b.id),
          id,
          direction,
        )
        if (!ids) return
        clearRunErrors()
        try {
          await toolService.reorderButtons(ids)
          qaTrack('buttons_reordered', { method: 'keyboard' })
          focusHandleId = id
          await refresh(root)
        } catch (error) {
          console.error('[Claude Tools] failed to reorder buttons', error)
          root.textContent = 'Something went wrong reordering your prompts. Check the console for details.'
        }
      },
      onSave: async (data) => {
        if (!data.name || !data.prompt) return
        clearRunErrors()
        try {
          if (data.id) {
            await toolService.updateButton(data.id, {
              name: data.name,
              prompt: data.prompt,
              type: data.type,
              tabId: data.tabId || undefined,
            })
          } else {
            await toolService.createButton(data.name, data.prompt, data.type, data.tabId || undefined)
          }
          qaTrack(data.id ? 'button_edited' : 'button_created', { type: data.type })
          view = { mode: 'list' }
          await refresh(root)
        } catch (error) {
          console.error('[Claude Tools] failed to save button', error)
          root.textContent = 'Something went wrong saving that prompt. Check the console for details.'
        }
      },
      onSelectTab: async (tabId: string) => {
        clearRunErrors()
        activeTabId = tabId
        await setActiveTab(tabId)
        await refresh(root)
      },
      onToggleSort: () => {
        sortMode = sortMode === 'most-used' ? 'manual' : 'most-used'
        qaTrack('sort_toggled', { mode: sortMode })
        void refresh(root)
      },
      onAddTab: async () => {
        clearRunErrors()
        try {
          const created = await toolService.createTab('New tab')
          tabBeforeFresh = activeTabId
          qaTrack('tab_created')
          activeTabId = created.id
          await setActiveTab(created.id)
          // Name it right there on the tab.
          editingTabId = created.id
          freshTabId = created.id
          await refresh(root)
        } catch (error) {
          console.error('[Claude Tools] failed to create tab', error)
          root.textContent = 'Something went wrong creating that tab. Check the console for details.'
        }
      },
      onStartRenameTab: (id: string) => {
        editingTabId = id
        if (activeTabId !== id) {
          activeTabId = id
          void setActiveTab(id)
        }
        void refresh(root)
      },
      onCancelRenameTab: async (id: string) => {
        editingTabId = null
        if (freshTabId === id) {
          // Escape on a tab that was only just made: undo making it. It is
          // empty, so there is nothing to confirm.
          freshTabId = null
          try {
            await toolService.deleteTab(id, null)
            activeTabId = tabBeforeFresh
            await setActiveTab(tabBeforeFresh)
          } catch (error) {
            console.error('[Claude Tools] failed to remove new tab', error)
          }
        }
        await refresh(root)
      },
      onReorderTabs: async (orderedIds: string[]) => {
        try {
          await toolService.reorderTabs(orderedIds)
          qaTrack('tabs_reordered', { method: 'drag' })
          await refresh(root)
        } catch (error) {
          console.error('[Claude Tools] failed to reorder tabs', error)
        }
      },
      onMoveTab: async (id: string, direction: 'up' | 'down') => {
        const ids = tabs.map((t) => t.id)
        const i = ids.indexOf(id)
        const j = direction === 'up' ? i - 1 : i + 1
        if (i === -1 || j < 0 || j >= ids.length) return
        ;[ids[i], ids[j]] = [ids[j], ids[i]]
        try {
          await toolService.reorderTabs(ids)
          qaTrack('tabs_reordered', { method: 'buttons' })
          await refresh(root)
        } catch (error) {
          console.error('[Claude Tools] failed to reorder tabs', error)
        }
      },
      onRenameTab: async (id: string, name: string, emoji: string | null) => {
        editingTabId = null
        if (freshTabId === id) freshTabId = null
        try {
          await toolService.updateTab(id, { name, emoji })
          qaTrack('tab_renamed', { emoji: emoji !== null })
          await refresh(root)
        } catch (error) {
          console.error('[Claude Tools] failed to rename tab', error)
        }
      },
      onDeleteTab: async (id: string) => {
        const tab = tabs.find((t) => t.id === id)
        if (!tab) return
        const count = (await toolService.listButtons(id)).length
        const message =
          count === 0
            ? `Delete the "${tab.name}" tab?`
            : `Delete the "${tab.name}" tab and its ${count} prompt${count === 1 ? '' : 's'}? This cannot be undone.`
        if (!window.confirm(message)) return
        try {
          await toolService.deleteTab(id, null)
          qaTrack('tab_deleted', { buttons: count })
          if (defaultTabId === id) await setDefaultTab(null)
          if (activeTabId === id) {
            activeTabId = null
            await setActiveTab(null)
          }
          await refresh(root)
        } catch (error) {
          console.error('[Claude Tools] failed to delete tab', error)
          root.textContent = 'Something went wrong deleting that tab. Check the console for details.'
        }
      },
      onSetDefaultTab: async (id: string) => {
        defaultTabId = id
        qaTrack('default_tab_set')
        await setDefaultTab(id)
        await refresh(root)
      },
      onCancel: () => {
        clearRunErrors()
        view = { mode: 'list' }
        void refresh(root)
      },
      onOpenSettings: () => {
        clearRunErrors()
        settingsState.error = null
        settingsState.successCount = null
        view = { mode: 'settings' }
        qaTrack('settings_opened')
        void refresh(root)
      },
      onExport: async () => {
        try {
          const json = serializeBackup(await toolService.listTabs(), buttons)
          const blob = new Blob([json], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = 'ai-ready-prompts.json'
          document.body.appendChild(link)
          link.click()
          link.remove()
          setTimeout(() => URL.revokeObjectURL(url), 0)
          qaTrack('tools_exported', { count: buttons.length })
        } catch (error) {
          console.error('[Claude Tools] failed to export tools', error)
          settingsState.error = 'Something went wrong exporting your prompts. Check the console for details.'
          announce('Something went wrong exporting your prompts. Check the console for details.')
          settingsState.successCount = null
          void refresh(root)
        }
      },
      onImport: async (file: File) => {
        try {
          const text = await file.text()
          const parsed = parseBackup(text)
          for (const tab of parsed.tabs) {
            await toolService.ensureTabByName(tab.name, tab.emoji)
          }
          for (const tool of parsed.tools) {
            const tab = await toolService.ensureTabByName(tool.tab, null)
            await toolService.createButton(tool.name, tool.prompt, tool.type, tab.id)
          }
          settingsState.error = null
          settingsState.successCount = parsed.tools.length
          qaTrack('tools_imported', { count: parsed.tools.length })
          announce(`Imported ${parsed.tools.length} prompt${parsed.tools.length === 1 ? '' : 's'}.`)
          await refresh(root)
        } catch (error) {
          console.error('[Claude Tools] failed to import tools', error)
          settingsState.error =
            error instanceof Error ? error.message : 'Something went wrong importing that file.'
          announce(settingsState.error)
          settingsState.successCount = null
          await refresh(root)
        }
      },
      onSettingsBack: () => {
        settingsState.error = null
        settingsState.successCount = null
        view = { mode: 'list' }
        void refresh(root)
      },
      onSignIn: async (providerId: ProviderId) => {
        settingsState.signingIn = true
        qaTrack('sign_in_started')
        await refresh(root)
        let result: { email: string } | null = null
        try {
          result = await authAdapter.signIn()
        } finally {
          settingsState.signingIn = false
        }
        if (result) {
          session = { email: result.email }
          qaTrack('sign_in_succeeded')
          void flushQa()
          announce(`Signed in as ${result.email}`)
          await refresh(root)
          void resolveOrgSession(root)
        } else {
          qaTrack('sign_in_failed')
          announce('Sign in was not completed.')
          await refresh(root)
        }
      },
      onSignOut: async () => {
        qaTrack('signed_out')
        // Send what's queued while the token is still valid.
        await flushQa()
        await authAdapter.signOut()
        await clearCachedOrgPrompts()
        session = null
        stopUsageReportTimer()
        orgSession = null
        teamPrompts = { orgName: null, tabs: [], prompts: [] }
        if (view.mode === 'org-onboarding') view = { mode: 'list' }
        await refresh(root)
      },
      onOpenCreateOrg: () => {
        settingsState.onboardingError = null
        view = { mode: 'org-onboarding' }
        void refresh(root)
      },
      onOnboardingSubmit: async (data: { orgName: string; initialMemberEmails: string[] }) => {
        if (settingsState.onboardingBusy) return
        const idToken = await authAdapter.getValidToken()
        if (!idToken) {
          settingsState.onboardingError = 'Please sign in again, then try again.'
          announce(settingsState.onboardingError)
          await refresh(root)
          return
        }
        settingsState.onboardingBusy = true
        settingsState.onboardingError = null
        await refresh(root)
        let result: Awaited<ReturnType<typeof submitOrgOnboarding>> = null
        try {
          result = await submitOrgOnboarding(idToken, data.orgName, data.initialMemberEmails)
        } finally {
          settingsState.onboardingBusy = false
        }
        if (!result) {
          settingsState.onboardingError = "Couldn't create the organisation. Check your connection and try again."
          announce(settingsState.onboardingError)
          await refresh(root)
          return
        }
        view = { mode: 'settings' }
        qaTrack('org_onboarding_submitted', { outcome: result.outcome })
        announce(
          result.outcome === 'created'
            ? `${result.org.name} created. You're its admin.`
            : `${result.org.name} already exists for your company, so a request to join it was sent to its admins.`,
        )
        await refresh(root)
        void resolveOrgSession(root)
      },
      onOnboardingCancel: () => {
        // Back to Settings -- still signed in, with a personal account.
        settingsState.onboardingError = null
        view = { mode: 'settings' }
        void refresh(root)
      },
      onOpenManageOrg: () => {
        clearRunErrors()
        qaTrack('manage_org_opened')
        manageOrgLoading = true
        view = { mode: 'manage-org' }
        void refresh(root)
        void Promise.allSettled([
          // One redraw when all four land (below), not one per fetch --
          // each redraw replaces every input, killing autofill mid-click.
          refreshOrgMembers(root, false),
          refreshOrgPrompts(root, false),
          refreshOrgUsage(root, false),
          refreshOrgAnalytics(root, false),
        ]).then(() => {
          manageOrgLoading = false
          if (view.mode === 'manage-org') void refresh(root)
        })
      },
      onManageOrgBack: () => {
        manageOrgAddError = null
        editingPromptId = null
        promptFormError = null
        view = { mode: 'settings' }
        void refresh(root)
      },
      onAcceptInvite: async () => {
        const idToken = await authAdapter.getValidToken()
        if (!idToken) {
          announce('Please sign in again.')
          return
        }
        const accepted = await acceptInvite(idToken)
        if (!accepted) {
          announce('Could not accept the invite. Check the console for details.')
          // Re-render so the card's "Joining..." button is clickable again.
          await resolveOrgSession(root)
          return
        }
        qaTrack('invite_accepted')
        // Re-resolve through the normal path so shared prompts, the cache
        // and usage reporting start exactly as for any active member.
        await resolveOrgSession(root)
        announce(accepted.state === 'active' ? `Joined ${accepted.org.name}.` : 'Invite accepted.')
      },
      onLeaveOrg: async () => {
        const leaving = orgSession
        const isPending = leaving?.state === 'pending'
        const isInvited = leaving?.state === 'invited'
        const name =
          leaving?.state === 'active' || leaving?.state === 'pending' || leaving?.state === 'invited'
            ? leaving.org.name
            : 'this organisation'
        const message = isInvited
          ? `Decline the invite to join ${name}?`
          : isPending
            ? `Cancel your request to join ${name}?`
            : `Leave ${name}? You'll lose access to its shared prompts until you're re-added.`
        if (!window.confirm(message)) return

        const idToken = await authAdapter.getValidToken()
        if (!idToken) {
          announce('Please sign in again.')
          return
        }
        const result = await leaveOrg(idToken)
        if (result === 'last_admin') {
          announce('You are the last admin -- promote someone else before leaving.')
          return
        }
        if (result === 'error') {
          announce('Could not leave the organisation. Check the console for details.')
          return
        }
        // 'left' or 'not_in_org' -- either way the caller has no membership.
        qaTrack('org_left', { from: isInvited ? 'invite' : isPending ? 'request' : 'member' })
        orgSession = null
        orgPrompts = []
        teamPrompts = { orgName: null, tabs: [], prompts: [] }
        await clearCachedOrgPrompts()
        stopUsageReportTimer()
        announce(isInvited ? 'Invite declined.' : isPending ? 'Request cancelled.' : `Left ${name}.`)
        await refresh(root)
        void resolveOrgSession(root)
      },
      onApproveMember: async (email: string) => {
        const idToken = await authAdapter.getValidToken()
        if (!idToken) return
        await approveOrgMember(idToken, email)
        qaTrack('member_approved')
        await refreshOrgMembers(root)
      },
      onRemoveMember: async (email: string) => {
        const idToken = await authAdapter.getValidToken()
        if (!idToken) return
        const result = await removeOrgMember(idToken, email)
        if (result.ok) qaTrack('member_removed')
        if (!result.ok) announce(result.error)
        await refreshOrgMembers(root)
      },
      onPromoteMember: async (email: string) => {
        const idToken = await authAdapter.getValidToken()
        if (!idToken) return
        const result = await setOrgMemberRole(idToken, email, 'director')
        if (result.ok) qaTrack('member_role_changed', { role: 'admin' })
        if (!result.ok) announce(result.error)
        await refreshOrgMembers(root)
      },
      onDemoteMember: async (email: string) => {
        const idToken = await authAdapter.getValidToken()
        if (!idToken) return
        const result = await setOrgMemberRole(idToken, email, 'member')
        if (result.ok) qaTrack('member_role_changed', { role: 'member' })
        if (!result.ok) announce(result.error)
        await refreshOrgMembers(root)
      },
      onAddMember: async (email: string) => {
        const idToken = await authAdapter.getValidToken()
        if (!idToken) return
        const added = await addOrgMember(idToken, email)
        if (added) qaTrack('member_invited')
        manageOrgAddError = added ? null : 'Something went wrong adding that member. Check the console for details.'
        await refreshOrgMembers(root)
      },
      onCreateOrgTab: (name: string) =>
        runOrgWrite(root, async (idToken) => {
          await createOrgTab(idToken, { name })
          qaTrack('org_tab_created')
        }),
      onRenameOrgTab: (id: string, name: string, emoji: string | null) =>
        runOrgWrite(root, async (idToken) => {
          await updateOrgTab(idToken, id, { name, emoji })
          qaTrack('org_tab_renamed')
        }),
      onDeleteOrgTab: async (id: string) => {
        const tab = teamPrompts.tabs.find((t) => t.id === id)
        if (!tab) return
        const count = teamPrompts.prompts.filter((p) => p.tabId === id).length
        const message =
          count === 0
            ? `Delete the shared "${tab.name}" tab?`
            : `Delete the shared "${tab.name}" tab? Its ${count} prompt${count === 1 ? '' : 's'} move to the first remaining tab.`
        if (!window.confirm(message)) return
        await runOrgWrite(root, async (idToken) => {
          const result = await deleteOrgTab(idToken, id)
          if (result.ok) qaTrack('org_tab_deleted')
          if (!result.ok && result.status === 400) {
            announce('An organisation must keep at least one shared tab.')
          }
        })
      },
      onReorderOrgTabs: (orderedIds: string[]) =>
        runOrgWrite(root, async (idToken) => {
          await reorderOrgTabs(idToken, orderedIds)
          qaTrack('org_tabs_reordered')
        }),
      onCreatePrompt: (data) =>
        runOrgWrite(root, async (idToken) => {
          const created = await createOrgPrompt(idToken, data)
          if (created) qaTrack('org_prompt_created', { type: data.type })
          promptFormError = created
            ? null
            : 'Something went wrong adding that prompt. Check the console for details.'
        }),
      onUpdatePrompt: (id, data) =>
        runOrgWrite(root, async (idToken) => {
          const updated = await updateOrgPrompt(idToken, id, data)
          if (updated) qaTrack('org_prompt_edited', { type: data.type })
          if (updated) editingPromptId = null
          promptFormError = updated
            ? null
            : 'Something went wrong saving that prompt. Check the console for details.'
        }),
      onDeletePrompt: async (id: string) => {
        const prompt = orgPrompts.find((p) => p.id === id)
        if (!window.confirm(`Delete the shared prompt "${prompt?.name ?? ''}"? Everyone in the organisation loses it.`)) return
        await runOrgWrite(root, async (idToken) => {
          await deleteOrgPrompt(idToken, id)
          qaTrack('org_prompt_deleted')
        })
        // Top prompts lists every shared prompt; reload so the deleted one drops out.
        await refreshOrgAnalytics(root)
      },
      onEditPromptClick: (prompt: OrgPrompt) => {
        editingPromptId = prompt.id
        promptFormError = null
        void refresh(root)
      },
      onCancelEditPrompt: () => {
        editingPromptId = null
        promptFormError = null
        void refresh(root)
      },
      onOpenFeedback: () => {
        if (!QA_ENABLED) return
        feedbackState.error = null
        feedbackState.sent = null
        view = { mode: 'feedback' }
        qaTrack('feedback_opened')
        void refresh(root)
      },
      onFeedbackSubmit: async (input: FeedbackInput) => {
        if (!QA_ENABLED || feedbackState.sending) return
        feedbackState.draft = input
        feedbackState.sending = true
        feedbackState.error = null
        await refresh(root)
        try {
          const token = await authAdapter.getValidToken()
          if (!token) {
            feedbackState.error = 'Please sign in again, then resend.'
            return
          }
          // So the attached diagnostics include what just happened.
          if (input.attachDiagnostics) await qaFlush(token)
          const result = await sendFeedback(token, input)
          if (result.ok) {
            qaTrack('feedback_sent', { category: input.category, diagnostics: input.attachDiagnostics })
            feedbackState.sent = { id: result.id, issueUrl: result.issueUrl }
            feedbackState.draft = emptyDraft()
            announce('Feedback sent. Thank you.')
          } else {
            feedbackState.error = result.error
            announce(result.error)
          }
        } finally {
          feedbackState.sending = false
          if (view.mode === 'feedback') await refresh(root)
        }
      },
      onFeedbackSendAnother: () => {
        feedbackState.sent = null
        feedbackState.error = null
        void refresh(root)
      },
      onFeedbackBack: () => {
        feedbackState.error = null
        view = { mode: 'settings' }
        void refresh(root)
      },
      onSelectTeamTab: (tabId: string) => {
        teamActiveTabId = tabId
        void refresh(root)
      },
      onRunTeamPrompt: async (prompt: OrgPrompt) => {
        const alreadyRunning = [...runState.values()].some((state) => state.isRunning)
        if (alreadyRunning) return
        clearRunErrors()
        runState.set(TEAM_RUN_KEY, { isRunning: true, error: null })
        // Shown under the Team list (not just to screen readers), like a
        // personal button's inline error.
        const fail = (message: string) => {
          announce(message)
          runState.set(TEAM_RUN_KEY, { isRunning: false, error: message })
        }
        try {
          try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
            if (!tab?.id || !tab.url) {
              fail('Open claude.ai to use this prompt.')
              return
            }
            const runToken = crypto.randomUUID()
            const request: InsertPromptRequest = {
              type: 'INSERT_PROMPT',
              prompt: prompt.promptText,
              runToken,
            }
            const sent = await sendToClaudeTab(tab.id, request)
            if (!sent.ok) {
              fail('Reload the Claude tab and try again.')
              return
            }
            const response = sent.response
            if (response.ok) {
              announce(`Inserted ${prompt.name}.`)
              qaTrack('team_prompt_run', { type: prompt.type })
              registerPendingRun(runToken, () => {
                qaTrack('team_prompt_sent', { type: prompt.type })
                void authAdapter.getValidToken().then((token) => {
                  if (token) void reportPromptRun(token, prompt.id)
                })
              })
            } else {
              console.warn('[Claude Tools] team prompt run failed', response.error, response.message)
              fail(response.message)
            }
          } catch (error) {
            console.error('[Claude Tools] unexpected error running team prompt', error)
            fail('Something went wrong running that prompt. Check the console for details.')
          }
        } finally {
          if (runState.get(TEAM_RUN_KEY)?.isRunning) runState.delete(TEAM_RUN_KEY)
          if (view.mode === 'list') await refresh(root)
        }
      },
      },
      QA_ENABLED ? { buildLabel: QA_BUILD_LABEL, feedback: feedbackState } : null,
    )
    if (focusHandleId) {
      const handles = Array.from(root.querySelectorAll<HTMLElement>('.drag-handle'))
      handles.find((el) => el.dataset.buttonId === focusHandleId)?.focus()
      focusHandleId = null
    }
    restoreTyping(root, typing)
    // A tab name being typed in place takes focus, with the text selected
    // the first time so typing replaces "New tab".
    if (editingTabId) {
      const input = root.querySelector<HTMLInputElement>('.folder-tab-input')
      if (input && document.activeElement !== input) {
        input.focus()
        input.select()
      }
    }
  } catch (error) {
    console.error('[Claude Tools] failed to load buttons', error)
    root.textContent = 'Something went wrong loading your prompts. Check the console for details.'
  }
}

async function start(): Promise<void> {
  // Lets captureTyping skip a form that was just submitted (see above).
  root.addEventListener('submit', (e) => { (e.target as HTMLFormElement).dataset.submitted = '1' }, true)
  session = await authAdapter.getCurrentSession()
  qaTrack('panel_opened', { signedIn: session !== null })
  await refresh(root)
  if (session) void resolveOrgSession(root)
  startQaFlushing()
  void flushQa()
}

void start()
