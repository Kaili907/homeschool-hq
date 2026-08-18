/**
 * Minimal JSON Schema (draft 2020-12 subset) validator.
 *
 * The repository has no JSON Schema runtime dependency, and the R3 framework
 * needs the schema files themselves to be the single validation authority
 * rather than a second hand-written checker that can drift away from them.
 * This supports exactly the keywords the two R3 schemas use; `unsupportedKeywords`
 * fails loudly if a schema ever reaches for one that is not implemented here.
 */

const ANNOTATION_KEYWORDS = ['$schema', '$id', '$comment', 'title', 'description', 'examples']
const SUPPORTED_KEYWORDS = new Set([
  ...ANNOTATION_KEYWORDS,
  '$defs',
  '$ref',
  'allOf',
  'not',
  'type',
  'const',
  'enum',
  'required',
  'properties',
  'additionalProperties',
  'propertyNames',
  'minProperties',
  'items',
  'minItems',
  'maxItems',
  'uniqueItems',
  'minLength',
  'maxLength',
  'pattern',
  'minimum',
  'maximum',
])

function typeOf(value) {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number'
  return typeof value
}

function matchesType(value, expected) {
  const actual = typeOf(value)
  const allowed = Array.isArray(expected) ? expected : [expected]
  return allowed.some((name) => (name === 'number' ? actual === 'number' || actual === 'integer' : actual === name))
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function resolveRef(root, ref) {
  if (!ref.startsWith('#/')) throw new Error(`Only local pointers are supported, received "${ref}".`)
  let node = root
  for (const rawSegment of ref.slice(2).split('/')) {
    const segment = rawSegment.replaceAll('~1', '/').replaceAll('~0', '~')
    node = node?.[segment]
    if (node === undefined) throw new Error(`Unresolved schema pointer "${ref}".`)
  }
  return node
}

/** Returns every keyword used by `schema` that this validator does not implement. */
export function unsupportedKeywords(schema, path = '#') {
  if (typeof schema === 'boolean' || schema === null || typeof schema !== 'object') return []
  const found = []
  for (const [keyword, nested] of Object.entries(schema)) {
    if (!SUPPORTED_KEYWORDS.has(keyword)) {
      found.push(`${path}/${keyword}`)
      continue
    }
    if (ANNOTATION_KEYWORDS.includes(keyword) || keyword === '$ref') continue
    if (keyword === 'enum' || keyword === 'const' || keyword === 'required' || keyword === 'type') continue
    if (keyword === 'properties' || keyword === '$defs') {
      for (const [key, child] of Object.entries(nested)) found.push(...unsupportedKeywords(child, `${path}/${keyword}/${key}`))
      continue
    }
    if (keyword === 'allOf') {
      nested.forEach((child, index) => found.push(...unsupportedKeywords(child, `${path}/allOf/${index}`)))
      continue
    }
    if (typeof nested === 'object' && nested !== null) found.push(...unsupportedKeywords(nested, `${path}/${keyword}`))
  }
  return found
}

function validateNode(schema, value, path, root, errors) {
  if (schema === true || schema === undefined) return
  if (schema === false) {
    errors.push({ path, message: 'value is not permitted here' })
    return
  }
  if (schema.$ref) {
    validateNode(resolveRef(root, schema.$ref), value, path, root, errors)
    return
  }
  if (schema.allOf) for (const child of schema.allOf) validateNode(child, value, path, root, errors)
  if (schema.not !== undefined) {
    const branch = []
    validateNode(schema.not, value, path, root, branch)
    if (branch.length === 0) errors.push({ path, message: 'value matches a forbidden schema' })
  }
  if (schema.type !== undefined && !matchesType(value, schema.type)) {
    errors.push({ path, message: `expected type ${JSON.stringify(schema.type)}, received ${typeOf(value)}` })
    return
  }
  if (schema.const !== undefined && !deepEqual(value, schema.const)) {
    errors.push({ path, message: `expected constant ${JSON.stringify(schema.const)}, received ${JSON.stringify(value)}` })
  }
  if (schema.enum !== undefined && !schema.enum.some((allowed) => deepEqual(allowed, value))) {
    errors.push({ path, message: `value ${JSON.stringify(value)} is outside the permitted set` })
  }

  if (typeOf(value) === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({ path, message: `expected at least ${schema.minLength} characters, received ${value.length}` })
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({ path, message: `expected at most ${schema.maxLength} characters, received ${value.length}` })
    }
    if (schema.pattern !== undefined && !new RegExp(schema.pattern, 'u').test(value)) {
      errors.push({ path, message: `value does not match ${schema.pattern}` })
    }
  }

  if (typeOf(value) === 'number' || typeOf(value) === 'integer') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push({ path, message: `expected at least ${schema.minimum}, received ${value}` })
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push({ path, message: `expected at most ${schema.maximum}, received ${value}` })
    }
  }

  if (typeOf(value) === 'array') {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push({ path, message: `expected at least ${schema.minItems} entries, received ${value.length}` })
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push({ path, message: `expected at most ${schema.maxItems} entries, received ${value.length}` })
    }
    if (schema.uniqueItems === true) {
      const seen = new Set(value.map((entry) => JSON.stringify(entry)))
      if (seen.size !== value.length) errors.push({ path, message: 'entries must be unique' })
    }
    if (schema.items !== undefined) {
      value.forEach((entry, index) => validateNode(schema.items, entry, `${path}/${index}`, root, errors))
    }
  }

  if (typeOf(value) === 'object') {
    const keys = Object.keys(value)
    if (schema.minProperties !== undefined && keys.length < schema.minProperties) {
      errors.push({ path, message: `expected at least ${schema.minProperties} properties, received ${keys.length}` })
    }
    for (const required of schema.required ?? []) {
      if (!Object.hasOwn(value, required)) errors.push({ path, message: `missing required property "${required}"` })
    }
    for (const key of keys) {
      if (schema.propertyNames !== undefined) validateNode(schema.propertyNames, key, `${path}/${key}<name>`, root, errors)
      const child = schema.properties?.[key]
      if (child !== undefined) {
        validateNode(child, value[key], `${path}/${key}`, root, errors)
      } else if (schema.additionalProperties !== undefined) {
        if (schema.additionalProperties === false) {
          errors.push({ path: `${path}/${key}`, message: 'property is not part of this contract' })
        } else {
          validateNode(schema.additionalProperties, value[key], `${path}/${key}`, root, errors)
        }
      }
    }
  }
}

/** Validates `value` against `schema`, returning one entry per violation. */
export function validate(schema, value) {
  const errors = []
  validateNode(schema, value, '#', schema, errors)
  return errors
}
