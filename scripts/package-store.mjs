// Builds the Chrome Web Store package: `pnpm run build:store`.
// Same build as `pnpm run build`, minus the pinned `key` (see
// manifest.config.ts), zipped from dist/ into aire-extension-<version>.zip.
import { execSync } from 'node:child_process'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { deflateRawSync } from 'node:zlib'

const run = (cmd, env = {}) => execSync(cmd, { stdio: 'inherit', env: { ...process.env, ...env } })

run('npx tsc --noEmit')
run('npx vite build', { AIRE_STORE_BUILD: '1' })

const manifest = JSON.parse(readFileSync('dist/manifest.json', 'utf8'))
if (manifest.key) throw new Error('store build still has a `key` -- the Web Store would reject it')

// Minimal zip writer (deflate, no dependency): the OS zip tools differ per
// platform (`tar -a` is a tar under Git Bash), so we write the format directly.
const CRC = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1
  return n >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const files = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]))

const local = []
const central = []
let offset = 0
for (const path of files('dist')) {
  const name = Buffer.from(relative('dist', path).split(sep).join('/'))
  const data = readFileSync(path)
  const packed = deflateRawSync(data)
  const crc = crc32(data)
  const head = Buffer.alloc(30)
  head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(8, 8)
  head.writeUInt32LE(crc, 14); head.writeUInt32LE(packed.length, 18); head.writeUInt32LE(data.length, 22)
  head.writeUInt16LE(name.length, 26)
  local.push(head, name, packed)
  const dirEntry = Buffer.alloc(46)
  dirEntry.writeUInt32LE(0x02014b50, 0); dirEntry.writeUInt16LE(20, 4); dirEntry.writeUInt16LE(20, 6)
  dirEntry.writeUInt16LE(8, 10); dirEntry.writeUInt32LE(crc, 16); dirEntry.writeUInt32LE(packed.length, 20)
  dirEntry.writeUInt32LE(data.length, 24); dirEntry.writeUInt16LE(name.length, 28); dirEntry.writeUInt32LE(offset, 42)
  central.push(dirEntry, name)
  offset += head.length + name.length + packed.length
}
const centralBuf = Buffer.concat(central)
const end = Buffer.alloc(22)
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(central.length / 2, 8); end.writeUInt16LE(central.length / 2, 10)
end.writeUInt32LE(centralBuf.length, 12); end.writeUInt32LE(offset, 16)

const zip = `aire-extension-${manifest.version}.zip`
writeFileSync(zip, Buffer.concat([...local, centralBuf, end]))
console.log(`\nStore package ready: ${zip} (upload this in the Chrome Web Store dashboard)`)
