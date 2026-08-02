import type { ParentTeacherPrivateRecord } from '../contracts/index.ts'
import {
  createRootJsonSchema,
  isoDateTimeSchema,
  opaqueIdSchema,
} from './json-schema.ts'
import {
  compareDateTimes,
  defineRuntimeSchema,
  expectArray,
  expectId,
  expectISODateTime,
  expectRecord,
  expectString,
  indexPath,
  propertyPath,
  validateHeader,
  type ValidationContext,
} from './validation.ts'

export const parentTeacherPrivateJsonSchema = createRootJsonSchema({
  id: 'urn:manuel-academy:study-engine:parent-teacher-private:1',
  title: 'Parent and Teacher Private Record',
  kind: 'parent-teacher-private',
  description:
    'Adult-authorized private note bodies. This record must be stored and projected separately from student-safe contracts.',
  required: ['studentId', 'notes'],
  properties: {
    studentId: opaqueIdSchema,
    notes: {
      type: 'array',
      maxItems: 2_000,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'author', 'createdAt', 'updatedAt', 'visibility', 'category', 'body'],
        properties: {
          id: opaqueIdSchema,
          author: {
            type: 'object',
            additionalProperties: false,
            required: ['role', 'actorId'],
            properties: {
              role: { enum: ['parent', 'teacher'] },
              actorId: opaqueIdSchema,
            },
          },
          createdAt: isoDateTimeSchema,
          updatedAt: isoDateTimeSchema,
          visibility: { const: 'authorized-adults-only' },
          category: { enum: ['instructional', 'accommodation', 'schedule', 'review', 'other'] },
          body: { type: 'string', minLength: 1, maxLength: 4_000 },
        },
      },
    },
  },
  runtimeRefinements: [
    'note identifiers are unique',
    'updatedAt is not earlier than createdAt',
    'only parent and teacher actors may author notes',
  ],
})

const PRIVATE_KEYS = [
  'kind',
  'schemaVersion',
  'id',
  'revision',
  'createdAt',
  'updatedAt',
  'metadata',
  'studentId',
  'notes',
] as const

function validatePrivateRecord(
  value: unknown,
  context: ValidationContext,
): value is ParentTeacherPrivateRecord {
  const record = expectRecord(context, value, '$', PRIVATE_KEYS)
  if (!record) return false
  validateHeader(context, record, '$', 'parent-teacher-private')
  expectId(context, record.studentId, '$.studentId')
  const notes = expectArray(context, record.notes, '$.notes', { maximumLength: 2_000 })
  const noteIds = new Set<string>()
  notes?.forEach((entry, index) => {
    const path = indexPath('$.notes', index)
    const note = expectRecord(context, entry, path, [
      'id',
      'author',
      'createdAt',
      'updatedAt',
      'visibility',
      'category',
      'body',
    ])
    if (!note) return
    if (expectId(context, note.id, propertyPath(path, 'id'))) {
      const id = note.id as string
      if (noteIds.has(id)) {
        context.add({
          code: 'duplicate',
          path: propertyPath(path, 'id'),
          message: `Duplicate private note id "${id}".`,
        })
      }
      noteIds.add(id)
    }
    const author = expectRecord(context, note.author, propertyPath(path, 'author'), [
      'role',
      'actorId',
    ])
    if (author) {
      expectString(context, author.role, propertyPath(propertyPath(path, 'author'), 'role'), {
        allowed: ['parent', 'teacher'],
      })
      expectId(context, author.actorId, propertyPath(propertyPath(path, 'author'), 'actorId'))
    }
    expectISODateTime(context, note.createdAt, propertyPath(path, 'createdAt'))
    expectISODateTime(context, note.updatedAt, propertyPath(path, 'updatedAt'))
    compareDateTimes(
      context,
      note.createdAt,
      note.updatedAt,
      propertyPath(path, 'updatedAt'),
      'Private note updatedAt cannot be earlier than createdAt.',
    )
    expectString(context, note.visibility, propertyPath(path, 'visibility'), {
      allowed: ['authorized-adults-only'],
    })
    expectString(context, note.category, propertyPath(path, 'category'), {
      allowed: ['instructional', 'accommodation', 'schedule', 'review', 'other'],
    })
    expectString(context, note.body, propertyPath(path, 'body'), {
      minimumLength: 1,
      maximumLength: 4_000,
    })
  })
  return context.issues.length === 0
}

export const parentTeacherPrivateSchema = defineRuntimeSchema<ParentTeacherPrivateRecord>({
  schemaId: 'parent-teacher-private',
  kind: 'parent-teacher-private',
  jsonSchema: parentTeacherPrivateJsonSchema,
  validateValue: validatePrivateRecord,
})

export const validateParentTeacherPrivateRecord = parentTeacherPrivateSchema.validate
export const parseParentTeacherPrivateRecord = parentTeacherPrivateSchema.parse
export const isParentTeacherPrivateRecord = parentTeacherPrivateSchema.is

