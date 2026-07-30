/**
 * Minimal Node declarations for the owned generator/tests. The application
 * package intentionally does not install @types/node.
 */
declare module 'node:fs' {
  export function existsSync(path: string): boolean
  export function mkdirSync(path: string, options?: { recursive?: boolean }): string | undefined
  export function readFileSync(path: string, encoding: 'utf8'): string
  export function readdirSync(path: string, options?: { withFileTypes?: boolean }): unknown[]
  export function writeFileSync(path: string, data: string, encoding: 'utf8'): void
}

declare module 'node:path' {
  export function dirname(path: string): string
  export function join(...paths: string[]): string
  export function resolve(...paths: string[]): string
}

declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string
}

declare const process: {
  readonly argv: readonly string[]
  readonly cwd: () => string
  readonly stdout: { write(value: string): void }
}

