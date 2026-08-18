export interface SchemaViolation {
  readonly path: string
  readonly message: string
}

export function unsupportedKeywords(schema: unknown, path?: string): string[]
export function validate(schema: unknown, value: unknown): SchemaViolation[]
