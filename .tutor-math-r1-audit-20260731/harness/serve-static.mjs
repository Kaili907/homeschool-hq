import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const documentRoot = path.resolve(process.argv[2] ?? '.')
const port = Number(process.argv[3] ?? 4173)
const host = '127.0.0.1'

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.vtt', 'text/vtt; charset=utf-8'],
])

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url ?? '/', `http://${host}:${port}`)
  const relativePath = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, '') || 'index.html'
  const filePath = path.resolve(documentRoot, relativePath)

  if (filePath !== documentRoot && !filePath.startsWith(`${documentRoot}${path.sep}`)) {
    response.writeHead(403).end('Forbidden')
    return
  }

  fs.stat(filePath, (statError, stat) => {
    if (statError || !stat.isFile()) {
      response.writeHead(404).end('Not found')
      return
    }

    response.writeHead(200, {
      'cache-control': 'no-store',
      'content-type': contentTypes.get(path.extname(filePath).toLowerCase()) ?? 'application/octet-stream',
    })
    fs.createReadStream(filePath).pipe(response)
  })
})

server.listen(port, host, () => {
  console.log(`SERVING ${documentRoot} AT http://${host}:${port}/`)
})

const close = () => server.close(() => process.exit(0))
process.on('SIGINT', close)
process.on('SIGTERM', close)
