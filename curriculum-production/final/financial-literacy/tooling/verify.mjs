import { verifyCorpus } from './reconcile.mjs'

process.stdout.write(`${JSON.stringify(verifyCorpus(), null, 2)}\n`)
