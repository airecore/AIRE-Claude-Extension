import { API_BASE_URL } from './src/shared/api-base'
import { CLERK_DOMAIN } from './src/shared/auth/providers'

// `pnpm run build:store` sets this. The Chrome Web Store assigns its own
// extension ID and rejects a package carrying `key`, so the store build
// leaves it out; dev/unpacked builds keep it so the ID stays pinned.
const STORE_BUILD = process.env.AIRE_STORE_BUILD === '1'

interface ExtensionManifest {
  manifest_version: 3
  name: string
  version: string
  description: string
  /** Pins the extension's ID to the same value on every machine that loads
   * this unpacked build, instead of Chrome deriving a new one per install
   * path. This is a public key (safe to commit) -- it has no matching
   * private key kept anywhere, since this project never produces a signed
   * .crx. Without this, Google Sign-In's redirect URI (registered in Google
   * Cloud Console against a specific extension ID) would need re-adding
   * every time the extension is loaded fresh on a different computer. */
  key?: string
  icons: Record<string, string>
  permissions: string[]
  host_permissions: string[]
  background: {
    service_worker: string
    type: 'module'
  }
  content_scripts: Array<{
    matches: string[]
    js: string[]
  }>
  side_panel: {
    default_path: string
  }
  action: { default_icon: Record<string, string> }
}

const manifest: ExtensionManifest = {
  manifest_version: 3,
  name: 'AI Ready Tools Extension',
  version: '1.0.0',
  description: 'Saved prompts and skills for claude.ai in a sidebar, plus optional team prompt sharing. Nothing is sent automatically.',
  key: STORE_BUILD ? undefined : 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA5XVB/dXgxQE8jwyqw4Rpvz/OscKGE/KeOplSBusI8gn+2mqrdh9Pq0i+HIop95bsz/KbMml+uCvgJMLVgstHlO3TxGc1E5T5u13kL/g0CoZDd5khfx2SSJVAwSWoNs3ttZT72xJ3p6TgeJbj4++b1ECTEmU41DxEvChJcdsGk91La7wZg+9Flaqv0Eh2J/qCj/1eGcmLIBNv9BfuLRw1L3MGZSN/jJFEAnSFnIcKGtdz86/EexjTcctx4RTQf7b1LQeaaz93qjZ7mCzDBC7XfHnzkJI38qaScfSd6StGRiiaE1FoWxpVMrDRLSqte7V72Eio/TiaRNHp31kcnQ4l1wIDAQAB',
  icons: {
    '16': 'src/icons/icon-16.png',
    '32': 'src/icons/icon-32.png',
    '48': 'src/icons/icon-48.png',
    '128': 'src/icons/icon-128.png',
  },
  permissions: ['sidePanel', 'storage', 'identity'],
  host_permissions: [
    'https://claude.ai/*',
    // Backend and Clerk hosts come from the same constants the code uses,
    // so switching to production is an edit to those two files only.
    `${API_BASE_URL}/*`,
    `https://${CLERK_DOMAIN}/*`,
  ],
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['https://claude.ai/*'],
      js: ['src/content/content-script.ts'],
    },
  ],
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  action: {
    default_icon: {
      '16': 'src/icons/icon-16.png',
      '32': 'src/icons/icon-32.png',
    },
  },
}

export default manifest
