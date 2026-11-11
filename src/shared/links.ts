// Outbound links from the side panel. Every link to the AI Ready site has
// UTM tags, so site analytics can count visits that come from the extension
// and see which link people used.

const AI_READY_ORIGIN = 'https://getaiready.now'

function aiReadyUrl(path: string, content: string): string {
  const url = new URL(path, AI_READY_ORIGIN)
  url.searchParams.set('utm_source', 'chrome-extension')
  url.searchParams.set('utm_medium', 'sidepanel')
  url.searchParams.set('utm_campaign', 'ai-ready-tools')
  url.searchParams.set('utm_content', content)
  return url.toString()
}

export const LINKS = {
  homeFromLogo: aiReadyUrl('/au', 'header-logo'),
  homeFromAbout: aiReadyUrl('/au', 'settings-about'),
  contact: aiReadyUrl('/au/contact', 'settings-contact'),
  training: aiReadyUrl('/au/ai-training', 'settings-training'),
  privacy: 'https://claude-extension-xi.vercel.app/privacy.html',
} as const

/** The version from the built manifest, or '' outside an extension page. */
export function extensionVersion(): string {
  try {
    return chrome.runtime?.getManifest?.().version ?? ''
  } catch {
    return ''
  }
}
