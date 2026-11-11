// Copies the tester build (dist/) into extension/, the ready-to-load folder
// testers get from GitHub's Code > Download ZIP. Run before committing a
// change to the extension:  pnpm run build:extension
import { cpSync, copyFileSync, existsSync, rmSync } from 'node:fs'

if (!existsSync('dist/manifest.json')) throw new Error('dist/ is missing -- run pnpm run build first')
rmSync('extension', { recursive: true, force: true })
cpSync('dist', 'extension', { recursive: true })
copyFileSync('.github/extension-folder-README.md', 'extension/README.md')
console.log('extension/ updated -- commit it with your change.')
