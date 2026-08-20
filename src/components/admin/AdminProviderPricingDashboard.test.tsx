import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type {
  ProviderPricingDraft,
  ProviderPricingEndRequest,
  ProviderPricingReadState,
  ProviderPricingTerm,
  ProviderPricingTermRequest,
} from '../../admin/providerPricingModel'
import {
  AdminProviderPricingDashboard,
  ProviderPricingEditor,
  ProviderPricingEndConfirmation,
  ProviderPricingPreviewConfirmation,
  type PendingPreview,
} from './AdminProviderPricingDashboard'

const TERM_ID = '00000000-0000-4000-8000-000000000301'

function term(overrides: Partial<ProviderPricingTerm> = {}): ProviderPricingTerm {
  return {
    termId: TERM_ID,
    provider: 'anthropic',
    providerProductId: 'provider-product',
    providerModelId: 'provider-model',
    logicalModelTier: 'sonnet',
    usageUnit: 'input_token',
    priceMicrosPerUnitSize: '2500',
    unitSize: '1000000',
    currency: 'USD',
    effectiveFrom: '2026-08-01T00:00:00.000Z',
    effectiveUntil: null,
    revision: '1',
    status: 'published',
    supersedesTermId: null,
    verificationRef: 'verified-reference',
    createdAt: '2026-07-31T00:00:00.000Z',
    createdAuthority: { role: 'owner' },
    ...overrides,
  }
}

function ready(terms: readonly ProviderPricingTerm[]): ProviderPricingReadState {
  return {
    status: 'ready',
    model: {
      schemaVersion: 1,
      pricingStatus: terms.length ? 'configured' : 'pricing_unconfigured',
      currency: 'USD',
      terms,
    },
  }
}

function render(state: ProviderPricingReadState, manageAuthorized = false) {
  return renderToStaticMarkup(
    <AdminProviderPricingDashboard
      readAuthorized
      manageAuthorized={manageAuthorized}
      state={state}
      onRetry={() => {}}
      onUpdated={() => {}}
      onBack={() => {}}
      now="2026-08-10T00:00:00.000Z"
    />,
  )
}

function request(): ProviderPricingTermRequest {
  return {
    provider: 'anthropic',
    providerProductId: 'provider-product',
    providerModelId: 'provider-model',
    logicalModelTier: 'sonnet',
    usageUnit: 'input_token',
    priceMicrosPerUnitSize: '3000',
    unitSize: '1000000',
    effectiveFrom: '2026-09-01T00:00:00.000Z',
    effectiveUntil: null,
    replacesTermId: TERM_ID,
    verificationRef: 'verified-reference',
    reasonCode: 'scheduled.change',
  }
}

describe('Admin Provider Pricing dashboard', () => {
  it('renders loading, retry, and server-authoritative permission-denied states', () => {
    expect(render({ status: 'loading' })).toContain('Loading provider pricing terms')
    const error = render({ status: 'error', code: 'source_timeout' })
    expect(error).toContain('request timed out')
    expect(error).toContain('Try again')
    const denied = render({ status: 'unauthorized' })
    expect(denied).toContain('server did not confirm costs:read')
    expect(denied).not.toContain('Add pricing term')
  })

  it('shows the zero-config state as unconfigured and never claims a zero price', () => {
    const markup = render(ready([]), true)
    expect(markup).toContain('Pricing not configured')
    expect(markup).toContain('cannot calculate provider cost for affected usage')
    expect(markup).toContain('No price is assumed or seeded')
    expect(markup).not.toContain('$0')
  })

  it('renders exact current, future, historical, and disabled terms with all dimensions', () => {
    const markup = render(ready([
      term(),
      term({ termId: '00000000-0000-4000-8000-000000000302', effectiveFrom: '2026-09-01T00:00:00.000Z', revision: '2' }),
      term({ termId: '00000000-0000-4000-8000-000000000303', effectiveFrom: '2026-01-01T00:00:00.000Z', effectiveUntil: '2026-02-01T00:00:00.000Z', status: 'ended' }),
      term({ termId: '00000000-0000-4000-8000-000000000304', effectiveFrom: '2026-10-01T00:00:00.000Z', status: 'disabled' }),
    ]), true)
    expect(markup).toContain('Current effective terms')
    expect(markup).toContain('<h2>Provider Pricing</h2>')
    expect(markup).not.toContain('<h1>')
    expect(markup).toContain('Future effective terms')
    expect(markup).toContain('Historical terms')
    expect(markup).toContain('Disabled future terms')
    expect(markup).toContain('Anthropic · provider-product')
    expect(markup).toContain('Model provider-model')
    expect(markup).toContain('Tier sonnet · Input token')
    expect(markup).toContain('$0.002500')
    expect(markup).toContain('USD per 1,000,000 input tokens')
    expect(markup).toContain('Revision 2')
    expect(markup).toContain('Verification verified-reference')
    expect(markup).toContain('Replace')
    expect(markup).toContain('End / disable')
  })

  it('keeps costs:read viewers read-only even when configured', () => {
    const markup = render(ready([term()]))
    expect(markup).toContain('Read-only pricing access')
    expect(markup).toContain('requires configuration:manage')
    expect(markup).toContain('$0.002500')
    expect(markup).not.toContain('Add pricing term')
    expect(markup).not.toContain('>Replace<')
    expect(markup).not.toContain('End / disable')
  })

  it('offers only supported dimensions and keeps live price state blank in the editor', () => {
    const draft: ProviderPricingDraft = {
      provider: 'anthropic',
      providerProductId: 'provider-product',
      providerModelId: 'provider-model',
      logicalModelTier: 'sonnet',
      usageUnit: '',
      exactUsd: '',
      unitSize: '1000000',
      effectiveFrom: '',
      effectiveUntil: '',
      replacesTermId: TERM_ID,
      verificationRef: '',
      reasonCode: '',
    }
    const markup = renderToStaticMarkup(
      <ProviderPricingEditor
        draft={draft}
        errors={{ exactUsd: 'Enter the exact USD price.' }}
        busy={false}
        onChange={() => {}}
        onSubmit={() => {}}
        onCancel={() => {}}
      />,
    )
    expect(markup).toContain('Exact price (USD)')
    expect(markup).toContain('Enter the exact USD price')
    expect(markup).toContain('type="datetime-local"')
    expect(markup).toContain('<label')
    expect(markup).not.toContain('value="cached_input_write_token"')
    expect(markup).not.toMatch(/Exact price \(USD\)[\s\S]{0,220}value="[0-9]/)
  })

  it('renders a deliberate server preview before commit with the affected term and consequence', () => {
    const pricingRequest = request()
    const pending: PendingPreview = {
      request: pricingRequest,
      requestId: '00000000-0000-4000-8000-000000000201',
      preview: {
        schemaVersion: 1,
        operation: 'replace',
        expectedRevision: '1',
        newRevision: '2',
        term: {
          provider: pricingRequest.provider,
          providerProductId: pricingRequest.providerProductId,
          providerModelId: pricingRequest.providerModelId,
          logicalModelTier: pricingRequest.logicalModelTier,
          usageUnit: pricingRequest.usageUnit,
          priceMicrosPerUnitSize: pricingRequest.priceMicrosPerUnitSize,
          unitSize: pricingRequest.unitSize,
          effectiveFrom: pricingRequest.effectiveFrom,
          effectiveUntil: pricingRequest.effectiveUntil,
          replacesTermId: pricingRequest.replacesTermId,
          currency: 'USD',
        },
        confirmationId: '00000000-0000-4000-8000-000000000401',
        confirmationExpiresAt: '2026-08-10T00:05:00.000Z',
        confirmationToken: 'A'.repeat(43),
      },
    }
    const markup = renderToStaticMarkup(
      <ProviderPricingPreviewConfirmation
        pending={pending}
        affectedTerm={term()}
        busy={false}
        error={null}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    )
    expect(markup).toContain('role="dialog"')
    expect(markup).toContain('aria-modal="true"')
    expect(markup).toContain('Preview → confirm → commit')
    expect(markup).toContain('Current term affected')
    expect(markup).toContain('$0.002500 · revision 1 · published')
    expect(markup).toContain('Proposed exact price')
    expect(markup).toContain('$0.003000')
    expect(markup).toContain('1 → 2')
    expect(markup).toContain('affected published term will end')
    expect(markup).toContain('Confirm and commit')
    expect(markup).toContain('Back to edit')
  })

  it('shows explicit end and disable consequences without fabricating a replacement price', () => {
    const endRequest: ProviderPricingEndRequest = {
      termId: TERM_ID,
      expectedRevision: '1',
      mode: 'end',
      effectiveUntil: '2026-09-15T00:00:00.000Z',
      reasonCode: 'scheduled.change',
      requestId: '00000000-0000-4000-8000-000000000201',
    }
    const ended = renderToStaticMarkup(
      <ProviderPricingEndConfirmation request={endRequest} term={term()} busy={false} error={null} onConfirm={() => {}} onCancel={() => {}} />,
    )
    expect(ended).toContain('Confirm term end')
    expect(ended).toContain('usage after the boundary will have unavailable cost')
    expect(ended).toContain('Confirm end')

    const disabled = renderToStaticMarkup(
      <ProviderPricingEndConfirmation request={{ ...endRequest, mode: 'disable', effectiveUntil: null }} term={term({ effectiveFrom: '2026-10-01T00:00:00.000Z' })} busy={false} error={null} onConfirm={() => {}} onCancel={() => {}} />,
    )
    expect(disabled).toContain('unused future term will be marked disabled')
    expect(disabled).toContain('no replacement price is created')
  })

  it('documents unsupported cache-write behavior and includes responsive, reduced-motion styles', () => {
    const markup = render(ready([term()]), true)
    expect(markup).toContain('Anthropic cache-write pricing is unsupported')
    expect(markup).toContain('no cache-write control is offered')
    expect(markup).not.toContain('value="cached_input_write_token"')
    const css = readFileSync(fileURLToPath(new URL('./admin-provider-pricing.css', import.meta.url)), 'utf8')
    expect(css).toContain('@media (max-width: 640px)')
    expect(css).toContain('grid-template-columns: 1fr')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(css).toContain('overflow-x: auto')
    expect(css).toContain('min-height: 2.75rem')
    expect(css).toContain('overflow-wrap: anywhere')
    expect(markup).toContain('tabindex="0"')
    const shellCss = readFileSync(fileURLToPath(new URL('./admin-console.css', import.meta.url)), 'utf8')
    expect(shellCss).toContain('max-width: 100vw')
    expect(shellCss).toContain('.admin-sidebar nav { min-width: 0; overflow: hidden; }')
  })
})
