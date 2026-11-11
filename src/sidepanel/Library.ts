import type { Button, ToolTab } from '../shared/types'
import type { LibraryItem, LibrarySource } from '../shared/library'
import { joinTabLabel } from '../shared/tab-label'

export interface LibraryContext {
  onAdd: (item: LibraryItem) => void
  onWriteOwn: () => void
  onDone: () => void
}

/** "Add a tool" screen: pick from the library, or write your own. Adding
 * keeps the person on this screen so they can add several in a row. */
export function renderLibrary(
  source: LibrarySource,
  tab: ToolTab | null,
  buttons: Button[],
  context: LibraryContext,
): HTMLElement {
  const panel = document.createElement('div')
  panel.className = 'library'

  const back = document.createElement('button')
  back.type = 'button'
  back.className = 'settings-back-button'
  back.innerHTML = '<span class="gi">←</span> '
  back.append(tab ? `Back to ${tab.name}` : 'Back')
  back.addEventListener('click', context.onDone)
  panel.appendChild(back)

  const heading = document.createElement('h2')
  heading.className = 'settings-heading'
  heading.textContent = tab ? `Add prompts to ${joinTabLabel(tab.emoji, tab.name)}` : 'Add prompts'
  panel.appendChild(heading)

  const own = document.createElement('button')
  own.type = 'button'
  own.className = 'library-own'
  own.innerHTML =
    '<span class="library-own-icon gi" aria-hidden="true">✎</span>' +
    '<span class="library-own-text"><strong>Write your own prompt</strong>' +
    '<span>Type a prompt or a skill command from scratch.</span></span>'
  own.addEventListener('click', context.onWriteOwn)
  panel.appendChild(own)

  const sourceHeading = document.createElement('p')
  sourceHeading.className = 'eyebrow library-source'
  sourceHeading.textContent = `From the ${source.name}`
  panel.appendChild(sourceHeading)

  // An item counts as added when this tab already holds a tool with the
  // same text, so re-opening the library shows what is already there.
  const inTab = new Set(buttons.filter((b) => !tab || b.tabId === tab.id).map((b) => b.prompt.trim()))

  for (const section of source.sections) {
    const group = document.createElement('section')
    group.className = 'library-section'

    const title = document.createElement('h3')
    title.className = 'library-section-title'
    title.textContent = section.title
    group.appendChild(title)

    if (section.note) {
      const note = document.createElement('p')
      note.className = 'library-note'
      note.textContent = section.note
      group.appendChild(note)
    }

    const list = document.createElement('ul')
    list.className = 'library-list'
    for (const item of section.items) {
      list.appendChild(renderItem(item, inTab.has(item.prompt.trim()), context))
    }
    group.appendChild(list)
    panel.appendChild(group)
  }

  return panel
}

function renderItem(item: LibraryItem, added: boolean, context: LibraryContext): HTMLElement {
  const li = document.createElement('li')
  li.className = 'library-item'

  const text = document.createElement('div')
  text.className = 'library-item-text'
  const name = document.createElement('strong')
  name.textContent = item.name
  const desc = document.createElement('span')
  desc.className = 'library-item-desc'
  desc.textContent = item.description
  text.append(name, desc)

  const preview = document.createElement('details')
  preview.className = 'library-preview'
  const summary = document.createElement('summary')
  summary.textContent = 'Show prompt'
  const body = document.createElement('pre')
  body.textContent = item.prompt
  preview.append(summary, body)
  text.appendChild(preview)

  const add = document.createElement('button')
  add.type = 'button'
  add.className = added ? 'library-add is-added' : 'library-add'
  add.textContent = added ? 'Added ✓' : 'Add'
  add.disabled = added
  add.setAttribute('aria-label', added ? `${item.name} is added` : `Add ${item.name}`)
  add.addEventListener('click', () => {
    add.disabled = true
    context.onAdd(item)
  })

  li.append(text, add)
  return li
}
