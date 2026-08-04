import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { defaultAppState } from '../../migration'
import { ParentHub } from './ParentHub'

const VALIDATION_ERROR =
  'Stored Academy data is not safe to synchronize: Academy data contains an oversized or sparse array.'

describe('Parent Hub persistence failure banner', () => {
  it('renders the save failure reason in a dismissible adult-side alert', () => {
    const html = renderToStaticMarkup(
      <ParentHub
        state={defaultAppState()}
        onStateChange={() => {}}
        onClose={() => {}}
        onOpenClassic={() => {}}
        persistenceFailure={VALIDATION_ERROR}
        onDismissPersistenceFailure={() => {}}
      />,
    )

    expect(html).toContain('role="alert"')
    expect(html).toContain('Changes aren&#x27;t being saved')
    expect(html).toContain(VALIDATION_ERROR)
    expect(html).toContain('>Dismiss</button>')
  })
})
