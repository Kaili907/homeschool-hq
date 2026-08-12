// Minimal static server for the family-pilot browser smoke harness.
// Modeled on tests/browser/admin-browser-test-server.mjs (the repo's existing
// Playwright-backed static server pattern) but pared down to what the pilot
// harness needs today: serve the built app shell and answer a health check.
//
// This server intentionally does NOT fake student-login or student-dashboard
// API responses. Those surfaces are owned by the Mac Student track; faking
// their behavior here would let a smoke test pass against invented selectors
// instead of the real UI. See WAITING_ON_MAC_STUDENT_OUTPUT.md.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, isAbsolute, relative, resolve } from 'node:path'

const port = Number(process.env.PILOT_BROWSER_TEST_PORT ?? 4180)
const distRoot = resolve(process.cwd(), 'dist')
const indexPath = resolve(distRoot, 'index.html')

function send(response, statusCode, body, headers = {}) {
  response.writeHead(statusCode, {
    'content-length': Buffer.byteLength(body),
    'x-content-type-options': 'nosniff',
    ...headers,
  })
  response.end(body)
}

function json(response, statusCode, payload) {
  send(response, statusCode, JSON.stringify(payload), {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'private, no-store, max-age=0',
  })
}

function contentType(pathname) {
  return ({
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.webmanifest': 'application/manifest+json',
  })[extname(pathname)] ?? 'application/octet-stream'
}

async function staticResponse(response, pathname) {
  const filePath = resolve(distRoot, `.${pathname}`)
  const relativePath = relative(distRoot, filePath)
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) return false
  try {
    if (!(await stat(filePath)).isFile()) return false
    const body = await readFile(filePath)
    const immutable = pathname.startsWith('/assets/')
    send(response, 200, body, {
      'content-type': contentType(pathname),
      'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache, must-revalidate',
    })
    return true
  } catch {
    return false
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`)
  if (url.pathname === '/__pilot_test__/health') {
    json(response, 200, { ok: true })
    return
  }
  if (await staticResponse(response, url.pathname)) return

  const index = await readFile(indexPath)
  send(response, 200, index, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-cache, must-revalidate',
  })
})

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`pilot-browser-test-server: http://127.0.0.1:${port}\n`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)))
}
