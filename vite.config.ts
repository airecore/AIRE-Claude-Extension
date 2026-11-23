import { defineConfig, type Plugin } from 'vite'
import { crx, type ManifestV3Export } from '@crxjs/vite-plugin'
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import manifest from './manifest.config'

// The Chrome Web Store build (`pnpm run build:store`) leaves tester QA
// logging out entirely; every other build is a tester build.
const STORE_BUILD = process.env.AIRE_STORE_BUILD === '1'

/** Short commit SHA, so a defect report says exactly which build it came
 * from. CI sets GITHUB_SHA; a local build asks git. */
function buildId(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7)
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'local'
  }
}

/**
 * CRXJS lists the content script as a web-accessible resource on every
 * chat site, for the loader it uses when a content script is split into
 * chunks. Ours is one self-contained file and needs no loader, and the
 * entry would let those websites detect that the extension is installed.
 * So it is removed from the built manifest. (e2e tests check the content
 * script still runs everywhere.)
 */
function dropWebAccessibleResources(): Plugin {
  let manifestPath = ''
  return {
    name: 'aire-drop-web-accessible-resources',
    enforce: 'post',
    configResolved(config) {
      manifestPath = resolve(config.root, config.build.outDir, 'manifest.json')
    },
    // After CRXJS has written the manifest.
    closeBundle() {
      if (!existsSync(manifestPath)) return
      const built = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>
      if (!('web_accessible_resources' in built)) return
      delete built.web_accessible_resources
      writeFileSync(manifestPath, JSON.stringify(built, null, 2))
    },
  }
}

export default defineConfig({
  define: {
    __AIRE_QA__: JSON.stringify(!STORE_BUILD),
    __AIRE_BUILD_ID__: JSON.stringify(buildId()),
  },
  plugins: [
    // Cast past CRXJS's bundled manifest type: side_panel is a valid MV3
    // key but the plugin's own type definitions can lag behind newer
    // manifest keys. Our own ExtensionManifest type is the real safety net.
    crx({ manifest: manifest as ManifestV3Export }),
    dropWebAccessibleResources(),
  ],
})
