// Post-build step: stamp the built service worker with a unique per-build id so
// every deploy gets a fresh cache name (the SW's activate step then deletes old
// caches → cache-bust). public/sw.js ships the literal `__BUILD_ID__`; Vite copies
// it to dist/sw.js, and this replaces it. Runs as part of `npm run build`.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sw = resolve(process.cwd(), 'dist/sw.js')
if (!existsSync(sw)) {
  console.error('stamp-sw: dist/sw.js not found — did the build run?')
  process.exit(1)
}
const id = `${Date.now()}`
writeFileSync(sw, readFileSync(sw, 'utf8').replaceAll('__BUILD_ID__', id))
console.log(`stamp-sw: cache id ${id}`)
