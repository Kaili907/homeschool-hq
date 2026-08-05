import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { saveAppState } from '../../appState'
import { defaultAppState } from '../../migration'
import { APP_STATE_STORAGE_KEY } from '../../sync/provenance'
import { ParentHub } from './ParentHub'

const VALIDATION_ERROR =
  'Stored Academy data is not safe to synchronize: Academy data contains an oversized or sparse array.'

const VERIFICATION_ERROR =
  'Saved Academy data did not pass provenance verification.'

class FingerprintMismatchStorage implements Storage {
  private values = new Map<string, string>()

  get length() {
    return this.values.size
  }

  clear() {
    this.values.clear()
  }

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  setItem(key: string, value: string) {
    if (key !== APP_STATE_STORAGE_KEY) {
      this.values.set(key, value)
      return
    }
    const written = JSON.parse(value) as Record<string, unknown>
    this.values.set(key, JSON.stringify({ ...written, parentPin: '9999' }))
  }
}

describe('Parent Hub persistence failure banner', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('renders the save failure reason in a dismissible adult-side alert', () => {
    const html = renderToStaticMarkup(
      <ParentHub
        state={defaultAppState()}
        onStateChange={() => {}}
        onClose={() => {}}
        onOpenClassic={() => {}}
        persistenceFailure={{
          ok: false,
          error: VALIDATION_ERROR,
          wrote: false,
        }}
        onDismissPersistenceFailure={() => {}}
      />,
    )

    expect(html).toContain('role="alert"')
    expect(html).toContain('Changes aren&#x27;t being saved')
    expect(html).toContain('The last saved Academy data is still intact.')
    expect(html).toContain(VALIDATION_ERROR)
    expect(html).toContain('>Dismiss</button>')
  })

  it('does not claim last-good data is intact after a written change fails verification', async () => {
    vi.stubGlobal('localStorage', new FingerprintMismatchStorage())
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await saveAppState(defaultAppState())

    expect(result).toMatchObject({ ok: false, error: VERIFICATION_ERROR })
    if (result.ok) throw new Error('Expected persistence verification to fail')
    const html = renderToStaticMarkup(
      <ParentHub
        state={defaultAppState()}
        onStateChange={() => {}}
        onClose={() => {}}
        onOpenClassic={() => {}}
        persistenceFailure={result}
      />,
    )

    expect(html).not.toContain('The last saved Academy data is still intact.')
    expect(html).not.toContain('Changes aren&#x27;t being saved')
    expect(html).toContain('Changes were saved but couldn&#x27;t be verified')
    expect(html).toContain(
      'The stored Academy data may not match what was expected. Cloud sync is paused pending review.',
    )
    expect(html).toContain(VERIFICATION_ERROR)
  })
})
