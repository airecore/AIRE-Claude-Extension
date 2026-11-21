import { pollFor } from './claude-adapter'
import { formatResetLabel, type UsageMeter } from '../shared/usage'
import { contentSiteForHost } from './site-inputs'
import { SITE_USAGE, captureGeminiUsage, type SiteUsage } from './site-usage'

/** This page's usage source, or null when the site shows no usage
 * (Copilot). An unknown host (a test page) is treated as Claude. */
export function siteUsage(hostname: string = location.hostname): SiteUsage | null {
  return SITE_USAGE[contentSiteForHost(hostname)?.id ?? 'claude'] ?? null
}
const WIDGET_ID = 'claude-tools-usage-widget'
const STYLE_ID = 'claude-tools-usage-widget-style'

const RING_RADIUS = 19
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS
const SVG_NS = 'http://www.w3.org/2000/svg'

// Every colour is derived from the text colour the site gives its sidebar
// (currentColor) and the font is the site's own (inherit), so the box
// blends into Claude, ChatGPT and Gemini in whatever theme the person uses
// -- light, dark or any other -- instead of always being a dark box. Only the
// meter fills keep fixed green / amber / red, which read on both.
export const WIDGET_CSS = `
#${WIDGET_ID} {
  margin: 10px 8px 8px;
  padding: 10px 10px 14px;
  border-radius: 10px;
  color: inherit;
  background: color-mix(in srgb, currentColor 4%, transparent);
  border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
  font-family: inherit;
}
#${WIDGET_ID} .ctu-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
#${WIDGET_ID} .ctu-title {
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: color-mix(in srgb, currentColor 60%, transparent);
}
#${WIDGET_ID} .ctu-updated {
  margin-left: 6px;
  text-transform: none;
  letter-spacing: 0;
  color: color-mix(in srgb, currentColor 45%, transparent);
}
#${WIDGET_ID} .ctu-refresh {
  width: 18px;
  height: 18px;
  border-radius: 5px;
  border: none;
  background: transparent;
  color: color-mix(in srgb, currentColor 60%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  cursor: pointer;
  padding: 0;
}
#${WIDGET_ID} .ctu-refresh:hover {
  background: color-mix(in srgb, currentColor 8%, transparent);
  color: inherit;
}
#${WIDGET_ID} .ctu-rings {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  justify-items: center;
  gap: 6px;
}
#${WIDGET_ID} .ctu-ring {
  position: relative;
  width: 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
#${WIDGET_ID} .ctu-ring svg {
  width: 46px;
  height: 46px;
  transform: rotate(-90deg);
}
#${WIDGET_ID} .ctu-ring circle {
  fill: none;
  stroke-width: 4;
}
#${WIDGET_ID} .ctu-track {
  stroke: color-mix(in srgb, currentColor 14%, transparent);
}
#${WIDGET_ID} .ctu-fill {
  stroke-linecap: round;
}
#${WIDGET_ID} .ctu-fill.normal {
  stroke: #4caf50;
}
#${WIDGET_ID} .ctu-fill.warning {
  stroke: #e09a2d;
}
#${WIDGET_ID} .ctu-fill.critical {
  stroke: #e5484d;
}
#${WIDGET_ID} .ctu-pct {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10.5px;
  font-weight: 700;
  color: inherit;
  font-variant-numeric: tabular-nums;
}
#${WIDGET_ID} .ctu-label {
  display: block;
  margin-top: 3px;
  font-size: 9px;
  color: color-mix(in srgb, currentColor 65%, transparent);
}
#${WIDGET_ID} .ctu-reset {
  display: block;
  margin-top: 2px;
  font-size: 8px;
  color: color-mix(in srgb, currentColor 50%, transparent);
  white-space: nowrap;
}
`

function severityClass(severity: string): 'normal' | 'warning' | 'critical' {
  if (severity === 'normal') return 'normal'
  if (severity === 'warning') return 'warning'
  return 'critical'
}

function ensureStyleInjected(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = WIDGET_CSS
  document.head.appendChild(style)
}

function renderRing(meter: UsageMeter, resetLabel: string | null): HTMLElement {
  const { label, percent, severity, disabledReason, remaining } = meter
  const isCount = typeof remaining === 'number'
  const wrap = document.createElement('div')
  wrap.className = 'ctu-ring'
  wrap.setAttribute('role', 'img')

  // A disabled meter (e.g. out of credits) has nothing meaningful to show a
  // percentage for -- the ring renders empty (no fill) and the center shows
  // a dash instead of "0%", which would misleadingly read as "used none".
  // A count (ChatGPT: "4 left") has no known total, so its ring stays empty.
  const clamped = disabledReason || isCount ? 0 : Math.min(100, Math.max(0, percent))
  const roundedPct = Math.round(clamped)
  wrap.setAttribute(
    'aria-label',
    disabledReason
      ? `${label}: ${disabledReason}`
      : isCount
        ? `${label}: ${remaining} left${resetLabel ? `, ${resetLabel}` : ''}`
        : resetLabel
        ? `${label}: ${roundedPct}%, ${resetLabel}`
        : `${label}: ${roundedPct}%`,
  )

  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', '0 0 46 46')

  const track = document.createElementNS(SVG_NS, 'circle')
  track.setAttribute('class', 'ctu-track')
  track.setAttribute('cx', '23')
  track.setAttribute('cy', '23')
  track.setAttribute('r', String(RING_RADIUS))
  svg.appendChild(track)

  const offset = RING_CIRCUMFERENCE - (clamped / 100) * RING_CIRCUMFERENCE
  const fill = document.createElementNS(SVG_NS, 'circle')
  fill.setAttribute('class', `ctu-fill ${severityClass(severity)}`)
  fill.setAttribute('cx', '23')
  fill.setAttribute('cy', '23')
  fill.setAttribute('r', String(RING_RADIUS))
  fill.setAttribute('stroke-dasharray', String(RING_CIRCUMFERENCE))
  fill.setAttribute('stroke-dashoffset', String(offset))
  svg.appendChild(fill)

  wrap.appendChild(svg)

  const pct = document.createElement('span')
  pct.className = 'ctu-pct'
  pct.textContent = disabledReason ? '—' : isCount ? String(remaining) : `${roundedPct}%`
  wrap.appendChild(pct)

  const labelEl = document.createElement('span')
  labelEl.className = 'ctu-label'
  labelEl.textContent = label
  wrap.appendChild(labelEl)

  if (disabledReason) {
    const reasonEl = document.createElement('span')
    reasonEl.className = 'ctu-reset'
    reasonEl.textContent = disabledReason
    wrap.appendChild(reasonEl)
  } else if (resetLabel || isCount) {
    const resetEl = document.createElement('span')
    resetEl.className = 'ctu-reset'
    resetEl.textContent = isCount ? ['left', resetLabel].filter(Boolean).join(' · ') : resetLabel
    wrap.appendChild(resetEl)
  }

  return wrap
}

/** "updated 5m ago", for numbers kept from an earlier read (Gemini). */
export function updatedLabel(savedAt: number, now: number): string {
  const minutes = Math.floor((now - savedAt) / 60_000)
  if (minutes < 1) return 'updated just now'
  if (minutes < 60) return `updated ${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return hours < 24 ? `updated ${hours}h ago` : `updated ${Math.floor(hours / 24)}d ago`
}

export function buildWidget(
  meters: UsageMeter[],
  options: { savedAt?: number; refreshHint?: string } = {},
): HTMLElement {
  const widget = document.createElement('div')
  widget.id = WIDGET_ID

  const head = document.createElement('div')
  head.className = 'ctu-head'

  const title = document.createElement('span')
  title.className = 'ctu-title'
  title.textContent = 'Usage'
  const now = Date.now()
  if (options.savedAt !== undefined) {
    const updated = document.createElement('span')
    updated.className = 'ctu-updated'
    updated.textContent = updatedLabel(options.savedAt, now)
    title.appendChild(updated)
  }
  head.appendChild(title)

  const refreshButton = document.createElement('button')
  refreshButton.type = 'button'
  refreshButton.className = 'ctu-refresh'
  refreshButton.textContent = '↻'
  const hint = options.refreshHint
  refreshButton.setAttribute('aria-label', hint ?? 'Refresh usage')
  refreshButton.title = hint ?? 'Refresh usage'
  refreshButton.addEventListener('click', () => {
    // Gemini only shows its numbers on its Usage page: go there to update.
    if (hint && location.pathname !== '/usage') location.assign('/usage')
    else void refreshWidget()
  })
  head.appendChild(refreshButton)

  widget.appendChild(head)

  const rings = document.createElement('div')
  rings.className = 'ctu-rings'
  meters.forEach((meter) => {
    const resetLabel = meter.resetText ?? formatResetLabel(meter.resetsAt, now)
    rings.appendChild(renderRing(meter, resetLabel))
  })
  widget.appendChild(rings)

  return widget
}

let resilienceObserverStarted = false
let resilienceCheckScheduled = false
let lastPath = location.pathname

function scheduleResilienceCheck(): void {
  if (resilienceCheckScheduled) return
  resilienceCheckScheduled = true
  setTimeout(() => {
    resilienceCheckScheduled = false
    const usage = siteUsage()
    if (!usage) return
    // Gemini: opening its Usage page updates the kept numbers.
    const pathChanged = location.pathname !== lastPath
    lastPath = location.pathname
    if (location.pathname === '/usage' && usage.refreshHint) {
      void captureGeminiUsage().then((saved) => {
        if (saved || pathChanged) void refreshWidget()
      })
      return
    }
    if (document.getElementById(WIDGET_ID)) return
    if (usage.anchor()) void refreshWidget()
  }, 1000)
}

function startResilienceObserver(): void {
  if (resilienceObserverStarted) return
  resilienceObserverStarted = true
  const observer = new MutationObserver(scheduleResilienceCheck)
  observer.observe(document.body, { childList: true, subtree: true })
}

export async function refreshWidget(): Promise<void> {
  const usage = siteUsage()
  if (!usage) return
  const anchor = usage.anchor()
  if (!anchor) return

  const response = await usage.fetch()
  if (!response.ok || response.usage.meters.length === 0) return

  ensureStyleInjected()

  const widget = buildWidget(response.usage.meters, { savedAt: response.savedAt, refreshHint: usage.refreshHint })
  const existing = document.getElementById(WIDGET_ID)
  if (existing) {
    existing.replaceWith(widget)
  } else {
    // Above the sidebar's chat list rather than below it, so the meters
    // sit near the top of the sidebar instead of the bottom.
    anchor.insertAdjacentElement('beforebegin', widget)
  }
}

export async function initUsageWidget(): Promise<void> {
  const usage = siteUsage()
  if (!usage) return
  // The observer starts first: Gemini's Usage page and sidebars that load
  // late are both caught by it.
  startResilienceObserver()
  const anchor = await pollFor(usage.anchor, 300, 8000)
  if (!anchor) {
    console.warn('[Claude Tools] sidebar anchor not found; usage widget not injected yet')
    return
  }
  await refreshWidget()
}
