import { installQaCapture, qaReportFromContent } from '../shared/qa/logger'
import type { QaReportMessage } from '../shared/messages'
import { siteForUrl } from '../shared/sites'

// Tester build: errors here, and those the content script forwards, are
// queued and then sent by the side panel.
installQaCapture('background')

chrome.runtime.onMessage.addListener((message: unknown, sender) => {
  const m = message as Partial<QaReportMessage> | null
  // Only our own content script on a chat site, never another page.
  if (m?.type !== 'QA_REPORT' || sender.id !== chrome.runtime.id || !sender.tab) return undefined
  if (typeof m.name !== 'string' || typeof m.message !== 'string') return undefined
  qaReportFromContent(m.name, m.message, typeof m.stack === 'string' ? m.stack : undefined, m.props)
  return undefined
})

const SIDE_PANEL_PATH = 'src/sidepanel/index.html'

function updateSidePanelForTab(tab: chrome.tabs.Tab): void {
  if (tab.id === undefined) return
  // The panel is offered on every supported AI chat site (src/shared/sites.ts).
  const isChatTab = siteForUrl(tab.url) !== null
  chrome.sidePanel
    .setOptions({
      tabId: tab.id,
      path: SIDE_PANEL_PATH,
      enabled: isChatTab,
    })
    .catch((error) => {
      console.error('[Claude Tools] failed to update side panel options for tab', tab.id, error)
    })
}

function syncAllTabs(): void {
  chrome.tabs
    .query({})
    .then((tabs) => {
      tabs.forEach(updateSidePanelForTab)
    })
    .catch((error) => {
      console.error('[Claude Tools] failed to enumerate tabs for side panel sync', error)
    })
}

function disableGlobalPanel(): void {
  // Suppresses the manifest's default_path from acting as an always-on
  // fallback for tabs that haven't been explicitly synced yet, so the
  // per-tab enable/disable below (not the manifest default) is the only
  // thing that determines whether the panel shows for a given tab.
  chrome.sidePanel.setOptions({ enabled: false }).catch((error) => {
    console.error('[Claude Tools] failed to disable global side panel state', error)
  })
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => {
    console.error('[Claude Tools] failed to set side panel behavior', error)
  })
  disableGlobalPanel()
  syncAllTabs()
})

chrome.runtime.onStartup.addListener(() => {
  disableGlobalPanel()
  syncAllTabs()
})

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'loading') return
  updateSidePanelForTab(tab)
})
