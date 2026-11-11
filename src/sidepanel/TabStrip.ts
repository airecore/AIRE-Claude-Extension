import type { ToolTab } from '../shared/types'
import { joinTabLabel, splitTabLabel } from '../shared/tab-label'

export interface TabStripContext {
  activeTabId: string | null
  /** The tab whose name is being typed in place, or null. */
  editingTabId: string | null
  /** Number of tools in each tab, shown as a small count on the tab. */
  countByTab: Record<string, number>
  onSelect: (tabId: string) => void
  onAdd: () => void
  onReorder: (orderedIds: string[]) => void
  onStartRename: (tabId: string) => void
  onRename: (tabId: string, name: string, emoji: string | null) => void
  onCancelRename: (tabId: string) => void
}

/** DOM id of a folder tab, so its panel can point back at it. */
export function folderTabDomId(tabId: string): string {
  return `folder-tab-${tabId}`
}

export const FOLDER_PANEL_ID = 'folder-panel'
export const TAB_NAME_INPUT_LABEL = 'Tab name (start with an emoji to set an icon)'

// What the person has typed so far, kept across re-renders. The panel
// redraws whenever background data (team prompts, org session) arrives,
// which would otherwise reset the input to the saved name mid-typing.
let draft: { tabId: string; value: string } | null = null

function withMoved(ids: string[], draggedId: string, targetId: string): string[] {
  const remaining = ids.filter((id) => id !== draggedId)
  const at = remaining.indexOf(targetId)
  if (at === -1) return ids
  remaining.splice(at, 0, draggedId)
  return remaining
}

function renderNameInput(tab: ToolTab, context: TabStripContext): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.className = 'folder-tab folder-tab-editing'
  wrapper.setAttribute('role', 'tab')
  wrapper.setAttribute('aria-selected', 'true')
  wrapper.id = folderTabDomId(tab.id)

  const input = document.createElement('input')
  input.type = 'text'
  input.className = 'folder-tab-input'
  input.setAttribute('aria-label', TAB_NAME_INPUT_LABEL)
  input.placeholder = 'Tab name'
  input.maxLength = 40
  input.value = draft?.tabId === tab.id ? draft.value : joinTabLabel(tab.emoji, tab.name)
  input.addEventListener('input', () => {
    draft = { tabId: tab.id, value: input.value }
  })

  let done = false
  const finish = (save: boolean): void => {
    if (done) return
    done = true
    draft = null
    const { emoji, name } = splitTabLabel(input.value)
    if (save && name.length > 0) context.onRename(tab.id, name, emoji)
    else context.onCancelRename(tab.id)
  }

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      finish(true)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      finish(false)
    }
  })
  // Clicking away saves. Deferred so a re-render (which detaches this
  // input) is not mistaken for the person clicking away.
  input.addEventListener('blur', () => {
    setTimeout(() => {
      if (input.isConnected) finish(true)
    }, 0)
  })

  wrapper.appendChild(input)
  return wrapper
}

/** Folder-style tabs that sit on top of the folder panel (render.ts). The
 * active tab joins the panel below it, so the tools read as "inside" it.
 * Double-click a tab (or use the tab menu) to rename it in place; drag to
 * reorder. */
export function renderTabStrip(tabs: ToolTab[], context: TabStripContext): HTMLElement {
  const list = document.createElement('div')
  list.className = 'folder-tabs-list'
  list.setAttribute('role', 'tablist')
  list.setAttribute('aria-label', 'Tool tabs')

  const ids = tabs.map((t) => t.id)

  tabs.forEach((tab) => {
    if (tab.id === context.editingTabId) {
      list.appendChild(renderNameInput(tab, context))
      return
    }

    const isActive = tab.id === context.activeTabId
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'folder-tab'
    button.id = folderTabDomId(tab.id)
    button.setAttribute('role', 'tab')
    button.setAttribute('aria-selected', String(isActive))
    button.setAttribute('aria-controls', FOLDER_PANEL_ID)
    button.tabIndex = isActive ? 0 : -1
    button.dataset.tabId = tab.id
    button.title = 'Double-click to rename. Drag to reorder.'

    const label = document.createElement('span')
    label.textContent = joinTabLabel(tab.emoji, tab.name)
    button.appendChild(label)

    const count = document.createElement('span')
    count.className = 'folder-tab-count'
    count.textContent = String(context.countByTab[tab.id] ?? 0)
    count.setAttribute('aria-hidden', 'true')
    button.appendChild(count)

    button.addEventListener('click', () => context.onSelect(tab.id))
    button.addEventListener('dblclick', () => context.onStartRename(tab.id))
    button.addEventListener('keydown', (event) => {
      const currentIndex = tabs.findIndex((t) => t.id === tab.id)
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault()
        const next = tabs[(currentIndex + 1) % tabs.length]
        context.onSelect(next.id)
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault()
        const prev = tabs[(currentIndex - 1 + tabs.length) % tabs.length]
        context.onSelect(prev.id)
      } else if (event.key === 'F2') {
        event.preventDefault()
        context.onStartRename(tab.id)
      }
    })

    button.draggable = true
    button.addEventListener('dragstart', (event) => {
      event.dataTransfer?.setData('text/plain', tab.id)
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
      button.classList.add('dragging')
    })
    button.addEventListener('dragend', () => button.classList.remove('dragging'))
    button.addEventListener('dragover', (event) => {
      event.preventDefault()
      button.classList.add('drag-over')
    })
    button.addEventListener('dragleave', () => button.classList.remove('drag-over'))
    button.addEventListener('drop', (event) => {
      event.preventDefault()
      button.classList.remove('drag-over')
      const draggedId = event.dataTransfer?.getData('text/plain')
      if (!draggedId || draggedId === tab.id) return
      context.onReorder(withMoved(ids, draggedId, tab.id))
    })

    list.appendChild(button)
  })

  const addButton = document.createElement('button')
  addButton.type = 'button'
  addButton.className = 'folder-tab folder-tab-add'
  addButton.innerHTML = '<span class="gi" aria-hidden="true">+</span> New'
  addButton.setAttribute('aria-label', 'Add tab')
  addButton.addEventListener('click', context.onAdd)

  // The add button sits beside the tablist, not inside it: a tablist may
  // only contain tabs.
  const row = document.createElement('div')
  row.className = 'folder-tabs-row'
  row.append(list, addButton)
  return row
}
