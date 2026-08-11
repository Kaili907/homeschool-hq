import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, isAbsolute, relative, resolve } from 'node:path'

const port = Number(process.env.ADMIN_BROWSER_TEST_PORT ?? 4179)
const distRoot = resolve(process.cwd(), 'dist')
const indexPath = resolve(distRoot, 'index.html')
const readCapabilities = [
  'overview:read', 'learners:read', 'engines:read', 'costs:read', 'safety:read',
  'health:read', 'curriculum:read', 'configuration:read', 'audit:read', 'releases:read',
]
const operationalCapabilities = [
  'engines:operate', 'safety:triage', 'incidents:acknowledge', 'curriculum:drafts:write',
]
const ownerCapabilities = [
  'admin_roles:manage', 'configuration:manage', 'curriculum:approve',
  'curriculum:publish', 'releases:manage',
]
const capabilities = {
  viewer: readCapabilities,
  owner: [...readCapabilities, ...operationalCapabilities, ...ownerCapabilities],
}
const state = { authMode: 'owner', swVersion: 'old' }

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

async function bodyOf(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
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
    let body = await readFile(filePath)
    if (pathname === '/sw.js') {
      body = Buffer.from(body.toString('utf8').replace(
        /(\$\{APP_CACHE_PREFIX\})[A-Za-z0-9_-]+/,
        `$1${state.swVersion}`,
      ))
    }
    const immutable = pathname.startsWith('/assets/') || pathname.startsWith('/curriculum/')
    send(response, 200, body, {
      'content-type': contentType(pathname),
      'cache-control': pathname === '/sw.js'
        ? 'no-cache, no-store, must-revalidate'
        : immutable ? 'public, max-age=31536000, immutable' : 'no-cache, must-revalidate',
      ...(pathname === '/sw.js' ? { 'service-worker-allowed': '/' } : {}),
    })
    return true
  } catch {
    return false
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`)
  if (url.pathname === '/__admin_test__/health') {
    json(response, 200, { ok: true })
    return
  }
  if (url.pathname === '/__admin_test__/state' && request.method === 'POST') {
    try {
      const next = JSON.parse(await bodyOf(request))
      if (['owner', 'viewer', 'revoked'].includes(next.authMode)) state.authMode = next.authMode
      if (/^[a-z0-9-]{1,40}$/.test(next.swVersion)) state.swVersion = next.swVersion
      json(response, 200, state)
    } catch {
      json(response, 400, { error: { code: 'invalid_request' } })
    }
    return
  }
  if (url.pathname === '/api/admin/v1/authorization') {
    if (state.authMode === 'revoked') {
      json(response, 401, { error: { code: 'unauthenticated' } })
      return
    }
    json(response, 200, {
      contractVersion: 2,
      status: 'authorized',
      role: state.authMode,
      capabilities: capabilities[state.authMode],
    })
    return
  }
  if (url.pathname.startsWith('/api/admin/')) {
    json(response, 503, { error: { code: 'browser_test_source_unavailable' } })
    return
  }
  if (url.pathname.startsWith('/.netlify/functions/admin-')) {
    json(response, 403, { error: { code: 'admin_access_denied' } })
    return
  }
  if (await staticResponse(response, url.pathname)) return

  const index = await readFile(indexPath)
  send(response, 200, index, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': url.pathname === '/academy/admin' || url.pathname.startsWith('/academy/admin/')
      ? 'private, no-store, max-age=0'
      : 'no-cache, must-revalidate',
  })
})

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`admin-browser-test-server: http://127.0.0.1:${port}\n`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)))
}
