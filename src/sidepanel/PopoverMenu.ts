export interface PopoverMenuItem {
  label: string
  /** Accessible name when the visible label needs context (e.g. the tool name). */
  ariaLabel?: string
  danger?: boolean
  disabled?: boolean
  onSelect: () => void
}

/** "⋯" button plus a popover menu. The popover gives light-dismiss and
 * Escape for free; CSS anchor positioning puts it under the ⋯ button.
 * `key` must be unique on the page (it names the popover and the anchor). */
export function renderPopoverMenu(key: string, triggerLabel: string, items: PopoverMenuItem[]): HTMLElement {
  const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '')
  const anchorName = `--menu-${safeKey}`
  const menuId = `menu-${safeKey}`

  const wrapper = document.createElement('div')
  wrapper.className = 'row-menu-wrapper'

  const trigger = document.createElement('button')
  trigger.type = 'button'
  trigger.className = 'row-menu-trigger gi'
  trigger.textContent = '⋯'
  trigger.setAttribute('aria-label', triggerLabel)
  trigger.setAttribute('popovertarget', menuId)
  trigger.style.setProperty('anchor-name', anchorName)

  const menu = document.createElement('div')
  menu.className = 'row-menu'
  menu.id = menuId
  menu.setAttribute('popover', '')
  menu.setAttribute('role', 'menu')
  menu.style.setProperty('position-anchor', anchorName)

  for (const entry of items) {
    const item = document.createElement('button')
    item.type = 'button'
    item.className = entry.danger ? 'row-menu-item row-menu-item-danger' : 'row-menu-item'
    item.setAttribute('role', 'menuitem')
    item.textContent = entry.label
    if (entry.ariaLabel) item.setAttribute('aria-label', entry.ariaLabel)
    item.disabled = entry.disabled ?? false
    item.addEventListener('click', () => {
      menu.hidePopover()
      entry.onSelect()
    })
    menu.appendChild(item)
  }

  wrapper.append(trigger, menu)
  return wrapper
}
