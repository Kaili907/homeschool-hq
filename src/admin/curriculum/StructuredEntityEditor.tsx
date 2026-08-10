import type { ChangeEvent } from 'react'
import type {
  CurriculumDraftEntityPayload,
  CurriculumDraftEntityType,
} from '../curriculum-authoring/contracts'
import type { ValidationIssue } from '../../curriculum-authoring/v2/schema'
import {
  authoringArrayItemDefault,
  authoringFieldLabel,
  authoringFieldOptions,
  isProtectedAuthoringPath,
  missingOptionalAuthoringFields,
  updateAuthoringValue,
} from './studioEditorModel'

export function StructuredEntityEditor({
  entityType,
  payload,
  disabled,
  issues,
  onChange,
}: {
  readonly entityType: CurriculumDraftEntityType
  readonly payload: CurriculumDraftEntityPayload
  readonly disabled: boolean
  readonly issues: readonly ValidationIssue[]
  readonly onChange: (payload: CurriculumDraftEntityPayload) => void
}) {
  const optional = missingOptionalAuthoringFields(entityType, payload)
  return (
    <div className="curriculum-structured-editor">
      {issues.length > 0 && (
        <section className="curriculum-editor-errors" role="alert" aria-label="Schema v2 validation rejection">
          <strong>Schema v2 validation rejected this save.</strong>
          <ul>{issues.map((issue) => <li key={`${issue.path}:${issue.code}`}>{issue.path}: {issue.message}</li>)}</ul>
        </section>
      )}
      {Object.entries(payload).map(([key, value]) => (
        <StructuredValue
          key={key}
          label={authoringFieldLabel(key)}
          path={[key]}
          value={value}
          disabled={disabled}
          root={payload}
          onChange={onChange}
        />
      ))}
      {optional.length > 0 && (
        <div className="curriculum-optional-fields" aria-label="Optional Schema v2 fields">
          <span>Optional fields</span>
          {optional.map((field) => (
            <button
              key={field.key}
              type="button"
              disabled={disabled}
              onClick={() => onChange(updateAuthoringValue(payload, [field.key], field.value))}
            >
              Add {authoringFieldLabel(field.key)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function StructuredValue({
  label,
  path,
  value,
  disabled,
  root,
  onChange,
}: {
  readonly label: string
  readonly path: readonly (string | number)[]
  readonly value: unknown
  readonly disabled: boolean
  readonly root: CurriculumDraftEntityPayload
  readonly onChange: (payload: CurriculumDraftEntityPayload) => void
}) {
  const protectedField = isProtectedAuthoringPath(path)
  const controlDisabled = disabled || protectedField
  const id = `curriculum-field-${path.join('-')}`
  if (Array.isArray(value)) {
    return (
      <fieldset className="curriculum-structured-group curriculum-structured-array" disabled={disabled}>
        <legend>{label}</legend>
        {value.length === 0 && <p>No entries.</p>}
        {value.map((item, index) => (
          <div className="curriculum-array-item" key={`${id}-${index}`}>
            <StructuredValue
              label={`${label} ${index + 1}`}
              path={[...path, index]}
              value={item}
              disabled={disabled}
              root={root}
              onChange={onChange}
            />
            <button
              type="button"
              className="curriculum-remove-field"
              disabled={disabled}
              aria-label={`Remove ${label} ${index + 1}`}
              onClick={() => onChange(updateAuthoringValue(root, path, value.filter((_, candidate) => candidate !== index)))}
            >Remove</button>
          </div>
        ))}
        <button
          type="button"
          className="curriculum-add-field"
          disabled={disabled}
          onClick={() => onChange(updateAuthoringValue(root, path, [...value, authoringArrayItemDefault(path, root, value.length)]))}
        >Add {label}</button>
      </fieldset>
    )
  }
  if (value !== null && typeof value === 'object') {
    return (
      <fieldset className="curriculum-structured-group" disabled={disabled}>
        <legend>{label}</legend>
        {Object.entries(value as Record<string, unknown>).map(([key, child]) => (
          <StructuredValue
            key={`${id}-${key}`}
            label={authoringFieldLabel(key)}
            path={[...path, key]}
            value={child}
            disabled={disabled}
            root={root}
            onChange={onChange}
          />
        ))}
      </fieldset>
    )
  }
  if (typeof value === 'boolean') {
    return (
      <label className="curriculum-boolean-field" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={value}
          disabled={controlDisabled}
          onChange={(event) => onChange(updateAuthoringValue(root, path, event.target.checked))}
        />
        <span>{label}{protectedField ? ' (system protected)' : ''}</span>
      </label>
    )
  }
  const options = authoringFieldOptions(path)
  if (options && typeof value === 'string') {
    return (
      <label className="curriculum-structured-field" htmlFor={id}>
        <span>{label}</span>
        <select
          id={id}
          value={value}
          disabled={controlDisabled}
          onChange={(event) => onChange(updateAuthoringValue(root, path, event.target.value))}
        >
          {options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
    )
  }
  if (typeof value === 'number') {
    return (
      <label className="curriculum-structured-field" htmlFor={id}>
        <span>{label}</span>
        <input
          id={id}
          type="number"
          value={value}
          disabled={controlDisabled}
          onChange={(event) => onChange(updateAuthoringValue(root, path, numberValue(event, value)))}
        />
      </label>
    )
  }
  const text = typeof value === 'string' ? value : ''
  const multiline = text.length > 90 || /description|guidance|question|activity|criteria|objective|fallback|locator|note|rights|prompt|action|mitigation/i.test(String(path.at(-1)))
  return (
    <label className="curriculum-structured-field" htmlFor={id}>
      <span>{label}{protectedField ? ' (system protected)' : ''}</span>
      {multiline ? (
        <textarea
          id={id}
          rows={Math.min(8, Math.max(3, Math.ceil(text.length / 70)))}
          value={text}
          disabled={controlDisabled}
          onChange={(event) => onChange(updateAuthoringValue(root, path, event.target.value))}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={text}
          disabled={controlDisabled}
          onChange={(event) => onChange(updateAuthoringValue(root, path, event.target.value))}
        />
      )}
    </label>
  )
}

function numberValue(event: ChangeEvent<HTMLInputElement>, fallback: number): number {
  return event.target.value === '' || !Number.isFinite(event.target.valueAsNumber)
    ? fallback
    : event.target.valueAsNumber
}
