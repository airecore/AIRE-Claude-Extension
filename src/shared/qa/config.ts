// Whether this build reports to the QA dashboard, and how it labels
// itself. The constants come from vite.config.ts; the `typeof` guards make
// unit tests (no Vite define step) see a disabled, "local" build.

export const QA_ENABLED: boolean = typeof __AIRE_QA__ !== 'undefined' && __AIRE_QA__ === true

const BUILD_ID: string = typeof __AIRE_BUILD_ID__ !== 'undefined' ? __AIRE_BUILD_ID__ : 'local'

/** e.g. "1.0.0+3f2a1b4" -- the manifest version plus the commit it was built from. */
export function buildLabel(manifestVersion: string = safeManifestVersion()): string {
  return `${manifestVersion}+${BUILD_ID}`
}

function safeManifestVersion(): string {
  try {
    return chrome.runtime.getManifest().version
  } catch {
    return '0.0.0'
  }
}

/** "Chrome 131", "Edge 131" -- just the browser and major version, not
 * the full user-agent string. */
export function browserLabel(userAgent: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''): string {
  const edge = /Edg\/(\d+)/.exec(userAgent)
  if (edge) return `Edge ${edge[1]}`
  const chrome = /Chrome\/(\d+)/.exec(userAgent)
  if (chrome) return `Chrome ${chrome[1]}`
  return 'unknown'
}
