import { describe, expect, it } from 'vitest'
import { detectCredentialRequests } from './credentialRequests'

describe('detectCredentialRequests', () => {
  it('detects a direct request and marks it unquoted', () => {
    const matches = detectCredentialRequests('Enter your password to open the family budget file.')
    expect(matches).toHaveLength(1)
    expect(matches[0].insideQuotedSpan).toBe(false)
  })

  it.each([
    ["single quotes", "The scam message reads: 'Enter your password now'."],
    ['double quotes', 'The scam message reads: "Enter your password now".'],
    ['curly single quotes', 'The scam message reads: ‘Enter your password now’.'],
    ['curly double quotes', 'The scam message reads: “Enter your password now”.'],
  ])('still sees a credential request inside %s', (_label, text) => {
    const matches = detectCredentialRequests(text)
    expect(matches).toHaveLength(1)
    expect(matches[0].insideQuotedSpan).toBe(true)
  })

  it('does not let a possessive apostrophe open a quoted span and hide a request', () => {
    const matches = detectCredentialRequests(
      "The student's next step is to enter your password on the sign-in screen.",
    )
    expect(matches).toHaveLength(1)
    expect(matches[0].insideQuotedSpan).toBe(false)
  })

  it('marks a request outside the quotes as unquoted even when the text also quotes an example', () => {
    const matches = detectCredentialRequests(
      "Read the fake message 'you have won a prize', then enter your password to claim it.",
    )
    expect(matches).toHaveLength(1)
    expect(matches[0].insideQuotedSpan).toBe(false)
  })

  it('finds nothing in ordinary lesson text', () => {
    expect(
      detectCredentialRequests(
        'Sam has a fictional allowance of $8.00 and records each deposit in the practice ledger.',
      ),
    ).toEqual([])
  })

  it('returns nothing for absent or blank text', () => {
    expect(detectCredentialRequests(undefined)).toEqual([])
    expect(detectCredentialRequests('   ')).toEqual([])
  })
})

describe('detectCredentialRequests — teaching refusal is not requesting', () => {
  it.each([
    'Remember the rule: never enter your password or account number into a link that arrives by text.',
    'Do not share your password with anyone, even someone claiming to work at the bank.',
    'Never give your PIN to someone who calls you out of the blue.',
    'A real bank will never ask you to send your account number by text message.',
    "Don't type your password into a page you reached from an email.",
  ])('does not flag the safety instruction %j', (text) => {
    expect(detectCredentialRequests(text)).toEqual([])
  })

  it('still flags a request whose own clause carries no prohibition', () => {
    const matches = detectCredentialRequests(
      'Do not skip this step: enter your real bank account number to continue.',
    )
    expect(matches).toHaveLength(1)
    expect(matches[0].insideQuotedSpan).toBe(false)
  })

  it('keeps a quoted scam example quoted when it contains a possessive', () => {
    const matches = detectCredentialRequests(
      "Analyze this fake text: 'we need your parent's help, so enter your password on the link'.",
    )
    expect(matches).toHaveLength(1)
    expect(matches[0].insideQuotedSpan).toBe(true)
  })
})
