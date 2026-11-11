import type { Button } from '../shared/types'
import { badgeFor } from '../shared/badge'
import { renderPopoverMenu } from './PopoverMenu'

export interface ButtonRowContext {
  isRunning: boolean
  runError: string | null
  /** When false, the drag handle is hidden and arrow-key reorder is off
   * (the list is in most-used order, so manual order is meaningless). */
  reorderable?: boolean
  onRun: () => void
  onEdit: () => void
  onDelete: () => void
  onDrop: (draggedId: string, position: 'before' | 'after') => void
  onArrowMove: (direction: 'up' | 'down') => void
}

function dropPosition(event: DragEvent, item: HTMLElement): 'before' | 'after' {
  const rect = item.getBoundingClientRect()
  return event.clientY - rect.top > rect.height / 2 ? 'after' : 'before'
}

/** Edit and Delete sit behind ⋯, so the red Delete is hard to hit by
 * mistake. */
function renderRowMenu(button: Button, context: ButtonRowContext): HTMLElement {
  return renderPopoverMenu(`tool-${button.id}`, `More actions for ${button.name}`, [
    { label: 'Edit', ariaLabel: `Edit ${button.name}`, onSelect: context.onEdit },
    { label: 'Delete', ariaLabel: `Delete ${button.name}`, danger: true, onSelect: context.onDelete },
  ])
}

export function renderButtonRow(button: Button, context: ButtonRowContext): HTMLElement {
  const item = document.createElement('li')
  item.className = 'button-row-wrapper'

  const row = document.createElement('div')
  row.className = 'button-row'

  const reorderable = context.reorderable ?? true
  if (reorderable) {
    const dragHandle = document.createElement('button')
    dragHandle.type = 'button'
    dragHandle.className = 'drag-handle'
    dragHandle.textContent = '☰'
    dragHandle.dataset.buttonId = button.id
    dragHandle.setAttribute('aria-label', `Reorder ${button.name}. Press arrow keys to move, or drag.`)
    dragHandle.title = 'Drag to reorder'
    dragHandle.draggable = true
    dragHandle.addEventListener('dragstart', (event) => {
      event.dataTransfer?.setData('text/plain', button.id)
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
      item.classList.add('dragging')
    })
    dragHandle.addEventListener('dragend', () => {
      item.classList.remove('dragging')
    })
    dragHandle.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        context.onArrowMove('up')
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        context.onArrowMove('down')
      }
    })
    row.appendChild(dragHandle)
  }

  const badgeChar = badgeFor(button.type, button.prompt)
  if (badgeChar) {
    const badge = document.createElement('span')
    badge.className = 'skill-badge'
    badge.textContent = badgeChar
    badge.setAttribute('aria-hidden', 'true')
    row.appendChild(badge)
  }

  // The name and its "Run" pill are one button, so the whole row is a big
  // click target. The pill is CSS (::after) so innerText stays the name.
  const name = document.createElement('button')
  name.type = 'button'
  name.className = 'button-row-name'
  const label = document.createElement('span')
  label.className = 'button-row-label'
  label.textContent = button.name
  name.appendChild(label)
  name.setAttribute('aria-label', `Run ${button.name}`)
  name.disabled = context.isRunning
  name.addEventListener('click', context.onRun)
  row.appendChild(name)

  row.appendChild(renderRowMenu(button, context))
  item.appendChild(row)

  if (reorderable) {
    item.addEventListener('dragover', (event) => {
      event.preventDefault()
      const isAfter = dropPosition(event, item) === 'after'
      item.classList.toggle('drag-over-top', !isAfter)
      item.classList.toggle('drag-over-bottom', isAfter)
    })
    item.addEventListener('dragleave', () => {
      item.classList.remove('drag-over-top', 'drag-over-bottom')
    })
    item.addEventListener('drop', (event) => {
      event.preventDefault()
      item.classList.remove('drag-over-top', 'drag-over-bottom')
      const draggedId = event.dataTransfer?.getData('text/plain')
      if (!draggedId || draggedId === button.id) return
      context.onDrop(draggedId, dropPosition(event, item))
    })
  }

  if (context.isRunning) {
    const status = document.createElement('p')
    status.className = 'button-row-status'
    status.textContent = 'Running...'
    item.appendChild(status)
  } else if (context.runError) {
    const status = document.createElement('p')
    status.className = 'button-row-status button-row-status-error'
    status.textContent = context.runError
    item.appendChild(status)
  }

  return item
}
