import type { AuthoredLesson } from '../types.ts'
import { G3A } from './g3a.ts'
import { G3B } from './g3b.ts'
import { G4A } from './g4a.ts'
import { G4B } from './g4b.ts'
import { G5A } from './g5a.ts'
import { G5B } from './g5b.ts'
import { G7A } from './g7a.ts'
import { G7B } from './g7b.ts'
import { G8A } from './g8a.ts'
import { G8B } from './g8b.ts'
import { G8C } from './g8c.ts'
import { G8D } from './g8d.ts'

/**
 * Every authored Financial Literacy lesson for grades 3, 4, 5, 7, and 8.
 * `build.ts` refuses to emit unless this list covers the source inventory
 * exactly — one authored record per source lesson, no orphans.
 */
export const AUTHORED_LESSONS: readonly AuthoredLesson[] = [...G3A, ...G3B, ...G4A, ...G4B, ...G5A, ...G5B, ...G7A, ...G7B, ...G8A, ...G8B, ...G8C, ...G8D]
