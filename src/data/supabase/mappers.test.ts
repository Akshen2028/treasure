import { describe, expect, it } from 'vitest'

import {
  activityPatchToRow,
  eventPatchToRow,
  fromGuestView,
  newActivityToRow,
  newCategoryDefinitionToRow,
  newEventToRow,
  newPaymentToRow,
  type Row,
  toActivity,
  toEvent,
  toPayment,
  toWedding,
  weddingPatchToRow,
} from './mappers'
import { toRepositoryError } from './SupabaseRepository'

const ts = { created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-02T00:00:00Z' }

describe('rows to domain', () => {
  it('maps a wedding', () => {
    const row: Row<'weddings'> = {
      id: 'w1',
      slug: 'main',
      name: 'Akshen & Anjana',
      wedding_date: '2028-07-01',
      budget_mode: 'manual',
      manual_budget_cents: 5_000_000,
      visibility: 'private',
      share_key: '0123456789abcdef0123456789abcdef',
      guest_amounts: 'percentages',
      plan: 'free',
      ...ts,
    }
    expect(toWedding(row)).toEqual({
      id: 'w1',
      name: 'Akshen & Anjana',
      weddingDate: '2028-07-01',
      budgetMode: 'manual',
      manualBudgetCents: 5_000_000,
      visibility: 'private',
      guestAmounts: 'percentages',
      createdAt: ts.created_at,
      updatedAt: ts.updated_at,
    })
  })

  it('maps an event including nullable fields', () => {
    const event = toEvent({
      id: 'e1',
      wedding_id: 'w1',
      name: 'Mehndi',
      event_date: null,
      location: '',
      description: 'Henna night',
      cover_image_path: null,
      manual_budget_cents: 0,
      sort_order: 2,
      deleted_at: '2026-10-05T00:00:00Z',
      ...ts,
    })
    expect(event).toMatchObject({
      id: 'e1',
      weddingId: 'w1',
      eventDate: null,
      coverImagePath: null,
      sortOrder: 2,
      deletedAt: '2026-10-05T00:00:00Z',
    })
  })

  it('keeps a null actual cost distinct from zero', () => {
    const base = {
      id: 'a1',
      wedding_id: 'w1',
      event_category_id: 'c1',
      name: 'Florals',
      description: '',
      notes: '',
      status: 'booked' as const,
      budget_cents: 150_000,
      sort_order: 0,
      deleted_at: null,
      ...ts,
    }
    expect(toActivity({ ...base, actual_cost_cents: null }).actualCostCents).toBeNull()
    expect(toActivity({ ...base, actual_cost_cents: 0 }).actualCostCents).toBe(0)
  })

  it('maps a payment', () => {
    expect(
      toPayment({
        id: 'p1',
        wedding_id: 'w1',
        activity_id: 'a1',
        amount_cents: 25_050,
        paid_on: '2026-09-01',
        note: 'Deposit',
        deleted_at: null,
        ...ts,
      }),
    ).toMatchObject({
      activityId: 'a1',
      amountCents: 25_050,
      paidOn: '2026-09-01',
      note: 'Deposit',
    })
  })
})

describe('domain to rows', () => {
  it('only includes fields present in a patch', () => {
    expect(eventPatchToRow({ name: 'Sangeet' })).toEqual({ name: 'Sangeet' })
    expect(weddingPatchToRow({ budgetMode: 'manual' })).toEqual({ budget_mode: 'manual' })
    expect(weddingPatchToRow({ visibility: 'public', guestAmounts: 'percentages' })).toEqual({
      visibility: 'public',
      guest_amounts: 'percentages',
    })
  })

  it('keeps explicit nulls, which clear a value', () => {
    expect(eventPatchToRow({ eventDate: null, coverImagePath: null })).toEqual({
      event_date: null,
      cover_image_path: null,
    })
    expect(activityPatchToRow({ actualCostCents: null })).toEqual({ actual_cost_cents: null })
  })

  it('builds inserts with parent and wedding ids', () => {
    expect(newEventToRow({ weddingId: 'w1', name: 'Haldi', location: 'Home' })).toEqual({
      wedding_id: 'w1',
      name: 'Haldi',
      location: 'Home',
    })
    expect(
      newActivityToRow({ weddingId: 'w1', eventCategoryId: 'c1', name: 'DJ', budgetCents: 100 }),
    ).toEqual({ wedding_id: 'w1', event_category_id: 'c1', name: 'DJ', budget_cents: 100 })
    expect(
      newPaymentToRow({
        weddingId: 'w1',
        activityId: 'a1',
        amountCents: 500,
        paidOn: '2026-10-01',
      }),
    ).toEqual({ wedding_id: 'w1', activity_id: 'a1', amount_cents: 500, paid_on: '2026-10-01' })
  })

  it('trims custom category names', () => {
    expect(newCategoryDefinitionToRow({ weddingId: 'w1', name: '  Mehndi Artist ' })).toEqual({
      wedding_id: 'w1',
      name: 'Mehndi Artist',
    })
  })
})

describe('toRepositoryError', () => {
  it('keeps plain-English messages raised by our database rules', () => {
    const error = toRepositoryError({
      code: '23514',
      message: 'This category is still used by an event',
    })
    expect(error).toMatchObject({
      reason: 'invalid',
      message: 'This category is still used by an event.',
    })
    const constraint = toRepositoryError({
      code: '23514',
      message:
        'new row for relation "payments" violates check constraint "payments_amount_cents_check"',
    })
    expect(constraint.message).toBe('Some of the values aren’t valid.')
  })

  it.each([
    ['42501', 'forbidden'],
    ['23505', 'conflict'],
    ['23514', 'invalid'],
    ['23503', 'invalid'],
    ['PGRST116', 'not-found'],
    ['XX000', 'unknown'],
  ])('maps %s to %s', (code, reason) => {
    expect(toRepositoryError({ code, message: 'x' }).reason).toBe(reason)
  })

  it('recognises network failures', () => {
    expect(toRepositoryError({ code: '', message: 'TypeError: Failed to fetch' }).reason).toBe(
      'network',
    )
  })
})

describe('guest view', () => {
  const wedding = {
    id: 'w1',
    slug: 'main',
    name: 'Akshen & Anjana',
    wedding_date: null,
    budget_mode: 'auto' as const,
    manual_budget_cents: 0,
    visibility: 'public' as const,
    guest_amounts: 'percentages' as const,
    ...ts,
  }
  const empty = {
    category_definitions: [],
    events: [],
    event_categories: [],
    activities: [],
    activity_images: [],
    activity_links: [],
    payments: [],
  }

  it('maps the document to a snapshot, keeping the figures', () => {
    const figures = {
      wedding: { budget: 1_000_000, paid: 0, child: 1_000_000, over: false },
      events: {},
      categories: {},
      activities: {},
    }
    const snapshot = fromGuestView({ wedding, ...empty, figures })
    expect(snapshot.wedding).toMatchObject({ id: 'w1', guestAmounts: 'percentages' })
    expect(snapshot.events).toEqual([])
    expect(snapshot.guestFigures).toEqual(figures)
  })

  it('has no figures in amounts mode', () => {
    const snapshot = fromGuestView({
      wedding: { ...wedding, guest_amounts: 'amounts' },
      ...empty,
      figures: null,
    })
    expect(snapshot.guestFigures).toBeNull()
  })
})
