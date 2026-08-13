import { setRng } from '../../../../src/genUtils.ts'
import { createRng } from '../src/rng.ts'
import { HS_UNIT_BANKS } from '../src/hs/registry.ts'
let total = 0
let failures = 0
for (const [key, bank] of Object.entries(HS_UNIT_BANKS)) {
  const standards = new Set<string>()
  for (const itemType of bank.itemTypes) {
    for (const difficulty of [1, 2, 3] as const) {
      for (let trial = 0; trial < 400; trial += 1) {
        setRng(createRng(`hs|${key}|${itemType}|${difficulty}|${trial}`))
        try {
          const item = bank.generate(itemType, difficulty)
          standards.add(item.standard)
          if (new Set(item.choices).size !== item.choices.length) throw new Error('duplicate choice')
          if (!item.solutionSteps?.length) throw new Error('no solution steps')
          total += 1
        } catch (error) {
          failures += 1
          if (failures < 40) console.log(`FAIL ${key} ${itemType} d${difficulty}: ${(error as Error).message}`)
        }
      }
    }
  }
  console.log(`${key.padEnd(6)} types=${String(bank.itemTypes.length).padStart(2)} standards=${[...standards].sort().join(',')}`)
}
setRng(null)
console.log(`\nhs generated=${total} failures=${failures}`)
