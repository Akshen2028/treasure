import { describe, expect, it } from 'vitest'

import { SnapshotBuilder } from '@/domain/testing/factories'

import { newPaymentForm, parsePaymentForm, previewPaymentImpact, sortPayments } from './paymentForm'

describe('parsePaymentForm', () => {
  const base = newPaymentForm('2026-10-16')

  it('defaults the date to today', () => {
    expect(base.paidOn).toBe('2026-10-16')
  })

  it('requires a positive amount', () => {
    expect(parsePaymentForm(base)).toMatchObject({
      ok: false,
      errors: { amount: 'Enter the amount paid.' },
    })
    expect(parsePaymentForm({ ...base, amount: '0' })).toMatchObject({
      ok: false,
      errors: { amount: 'A payment must be more than $0.' },
    })
    expect(parsePaymentForm({ ...base, amount: '-50' })).toMatchObject({ ok: false })
  })

  it('requires a date', () => {
    expect(parsePaymentForm({ ...base, amount: '100', paidOn: '' })).toMatchObject({
      ok: false,
      errors: { paidOn: expect.any(String) },
    })
  })

  it('parses a valid payment and trims the note', () => {
    expect(
      parsePaymentForm({ amount: '$1,250.50', paidOn: '2026-09-01', note: ' Deposit ' }),
    ).toEqual({
      ok: true,
      value: { amountCents: 125_050, paidOn: '2026-09-01', note: 'Deposit' },
    })
  })
})

describe('previewPaymentImpact', () => {
  const summary = { budgetCents: 300_000, actualCostCents: 275_000, paidCents: 250_000 }

  it('reports nothing when the payment stays within budget and actual cost', () => {
    expect(previewPaymentImpact(summary, 20_000)).toEqual({
      paidAfterCents: 270_000,
      overBudgetByCents: 0,
      overpaidByCents: 0,
    })
  })

  it('warns about overpaying without being over budget', () => {
    expect(previewPaymentImpact(summary, 40_000)).toMatchObject({
      overBudgetByCents: 0,
      overpaidByCents: 15_000,
    })
  })

  it('warns about both when both apply', () => {
    expect(previewPaymentImpact(summary, 100_000)).toMatchObject({
      overBudgetByCents: 50_000,
      overpaidByCents: 75_000,
    })
  })

  it('never reports overpaid when the actual cost is unknown', () => {
    expect(previewPaymentImpact({ ...summary, actualCostCents: null }, 100_000)).toMatchObject({
      overBudgetByCents: 50_000,
      overpaidByCents: 0,
    })
  })

  it('replaces the existing amount when editing instead of adding to it', () => {
    // Editing a $50,000 payment down to $20,000: total goes from 250,000 to 220,000.
    expect(previewPaymentImpact(summary, 20_000, 50_000).paidAfterCents).toBe(220_000)
  })
})

describe('sortPayments', () => {
  it('lists newest payments first, ties broken by when they were recorded', () => {
    const payments = new SnapshotBuilder()
      .payment('old', 'a', 1, { paidOn: '2026-01-01' })
      .payment('new-early', 'a', 1, { paidOn: '2026-09-01', createdAt: '2026-09-01T10:00:00Z' })
      .payment('new-late', 'a', 1, { paidOn: '2026-09-01', createdAt: '2026-09-01T12:00:00Z' })
      .build().payments
    expect(sortPayments(payments).map((p) => p.id)).toEqual(['new-late', 'new-early', 'old'])
  })
})
