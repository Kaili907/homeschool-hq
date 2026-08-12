// Node-only: source.node.ts reads the filesystem and must be imported
// directly (see its own header), never through this barrel, so importing
// this module stays safe from any environment.
export * from './types'
export * from './catalog'
export * from './evidence'
export * from './studyAdapter'
