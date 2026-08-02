import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await walk(path))
    else if (entry.isFile()) files.push(path)
  }
  return files
}

const files = (await walk(root))
  .filter((path) => relative(root, path) !== 'SHA256SUMS.txt')
  .sort((left, right) => relative(root, left).localeCompare(relative(root, right), 'en'))
const lines = []
for (const path of files) {
  const hash = createHash('sha256').update(await readFile(path)).digest('hex')
  const name = relative(root, path).split(sep).join('/')
  lines.push(`${hash}  ./${name}`)
}
await writeFile(join(root, 'SHA256SUMS.txt'), `${lines.join('\n')}\n`, 'utf8')
console.log(`Wrote ${lines.length} SHA-256 entries.`)
