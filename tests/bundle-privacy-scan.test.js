import { readFile, readdir, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

/**
 * SEC-8 client-privacy + bundle-security regression scan. Reads the last
 * production build under dist/assets/ and asserts none of the emitted browser
 * assets contain the specific value shapes that a leak would take. Skips the
 * suite if no build is present so unrelated test runs are not blocked.
 *
 * Patterns focus on VALUE shapes (concrete secrets, tokens, absolute paths)
 * rather than field NAMES a legitimate schema might reference (the
 * AdminConsoleRoute bundle carries a privacy DENY-list of names, for example,
 * and that is intentional). Library-internal defaults like the supabase-js
 * `http://localhost:9999` GoTrue fallback are unreachable when
 * VITE_SUPABASE_URL is unset and are allow-listed explicitly.
 */

const distAssets = fileURLToPath(new URL('../dist/assets', import.meta.url))

async function bundleFiles() {
  try {
    const entries = await readdir(distAssets)
    const files = []
    for (const name of entries) {
      if (!name.endsWith('.js')) continue
      const full = path.join(distAssets, name)
      const info = await stat(full)
      if (info.isFile()) files.push({ name, full })
    }
    return files
  } catch (cause) {
    if (cause && cause.code === 'ENOENT') return null
    throw cause
  }
}

let bundles = null

beforeAll(async () => {
  bundles = await bundleFiles()
})

describe('SEC-8 bundle privacy scan — emitted browser assets', () => {
  it('at least one asset exists after a production build (dist/ present)', () => {
    if (!bundles) {
      // No build output on this checkout; nothing to scan but nothing to fail.
      return
    }
    expect(bundles.length).toBeGreaterThan(0)
  })

  it('no asset embeds a service-role or admin credential value', async () => {
    if (!bundles) return
    const patterns = [
      /SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*['"][A-Za-z0-9_.-]{16,}/,
      /service[_-]?role[_-]?key\s*[:=]\s*['"][A-Za-z0-9_.-]{16,}/i,
      /sk_live_[A-Za-z0-9]{16,}/,
      /sk_test_[A-Za-z0-9]{16,}/,
    ]
    for (const bundle of bundles) {
      const source = await readFile(bundle.full, 'utf8')
      for (const pattern of patterns) {
        expect(pattern.test(source), `${bundle.name} contains ${pattern}`).toBe(
          false,
        )
      }
    }
  })

  it('no asset embeds a fully-formed JWT bearer token', async () => {
    if (!bundles) return
    const jwt = /eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/
    for (const bundle of bundles) {
      const source = await readFile(bundle.full, 'utf8')
      expect(jwt.test(source), `${bundle.name} contains a JWT`).toBe(false)
    }
  })

  it('no asset embeds absolute developer file-system paths', async () => {
    if (!bundles) return
    const patterns = [
      /[A-Z]:\\Users\\[^"\\]+/,
      /[A-Z]:\\ma-sec\\/,
      /\/Users\/[a-z0-9._-]+\//i,
      /\/home\/[a-z0-9._-]+\//i,
    ]
    for (const bundle of bundles) {
      const source = await readFile(bundle.full, 'utf8')
      for (const pattern of patterns) {
        expect(
          pattern.test(source),
          `${bundle.name} contains developer path ${pattern}`,
        ).toBe(false)
      }
    }
  })

  it('no asset embeds an active dev endpoint outside supabase-js library defaults', async () => {
    if (!bundles) return
    // Only flag fully-formed URLs, not bare hostname string literals. supabase-js
    // ships `http://localhost:9999` as its GoTrue default (unreachable when
    // VITE_SUPABASE_URL is unset) and its browser-code hostname allowlist
    // includes bare `"localhost"` and `"127.0.0.1"` string literals — those are
    // library constants, not endpoint leaks.
    const ALLOWED = new Set(['http://localhost:9999'])
    const scan = /https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/[A-Za-z0-9._/-]*)?/g
    for (const bundle of bundles) {
      const source = await readFile(bundle.full, 'utf8')
      const hits = new Set()
      let match
      while ((match = scan.exec(source)) !== null) {
        hits.add(match[0])
      }
      for (const hit of hits) {
        if (ALLOWED.has(hit)) continue
        expect(
          false,
          `${bundle.name} contains unexpected dev endpoint "${hit}"`,
        ).toBe(true)
      }
    }
  })
})
