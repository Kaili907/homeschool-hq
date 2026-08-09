// Post-build step: stamp the built client document and service worker with one
// non-secret per-build id. The client uses it only for stale-refresh loop
// diagnostics, while the worker uses it for cache busting.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const id = `${Date.now()}`
const outputs = [
  resolve(process.cwd(), 'dist/index.html'),
  resolve(process.cwd(), 'dist/sw.js'),
]

for (const output of outputs) {
  if (!existsSync(output)) {
    console.error(`stamp-sw: ${output} not found — did the build run?`)
    process.exit(1)
  }
  const source = readFileSync(output, 'utf8')
  if (!source.includes('__BUILD_ID__')) {
    console.error(`stamp-sw: ${output} has no build identity placeholder`)
    process.exit(1)
  }
  writeFileSync(output, source.replaceAll('__BUILD_ID__', id))
}

console.log(`stamp-sw: client/worker build id ${id}`)
