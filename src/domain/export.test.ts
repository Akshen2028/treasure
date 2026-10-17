import { describe, expect, it } from 'vitest'

import { buildWeddingExport, exportFileName, exportToJson, exportToMarkdown } from './export'
import { deleted, SnapshotBuilder } from './testing/factories'
import type { WeddingSnapshot } from './types'

const TS = '2026-10-01T12:00:00.000Z'

function sample(): WeddingSnapshot {
  const s = new SnapshotBuilder()
    .definition('food', 'Food', { isDefault: true })
    .definition('decor', 'Decor', { isDefault: true })
    .event('mehndi', 0, {
      name: 'Mehndi',
      eventDate: '2028-06-29',
      location: 'Family home | Brampton',
      description: 'Henna night\n# not a heading',
      coverImagePath: 'w1/events/mehndi/cover.webp',
    })
    .event('reception', 0, { name: 'Reception', eventDate: '2028-07-01' })
    .event('haldi', 0, { name: 'Haldi', ...deleted })
    .category('m-food', 'mehndi', 'food')
    .category('r-food', 'reception', 'food')
    .category('r-decor', 'reception', 'decor')
    .activity('caterer', 'm-food', 600_000, {
      name: 'Caterer',
      status: 'booked',
      actualCostCents: 580_000,
      notes: 'Ask about chai | sweets',
    })
    .activity('dinner', 'r-food', 1_000_000, { name: 'Dinner' })
    .activity('old', 'r-food', 50_000, { name: 'Cancelled tasting', ...deleted })
    .payment('p1', 'caterer', 200_000, { paidOn: '2026-08-14', note: 'Deposit' })
    .payment('p2', 'caterer', 150_000, { paidOn: '2026-10-02' })
    .payment('p3', 'caterer', 99_999, { paidOn: '2026-10-05', ...deleted })
    .build()
  s.activityLinks.push({
    id: 'l1',
    activityId: 'caterer',
    url: 'https://example.com/menu',
    label: 'Menu',
    sortOrder: 0,
    deletedAt: null,
    createdAt: TS,
    updatedAt: TS,
  })
  s.activityImages.push({
    id: 'i1',
    activityId: 'caterer',
    storagePath: 'w1/activities/caterer/a.webp',
    thumbnailPath: null,
    mimeType: 'image/webp',
    sizeBytes: 1,
    width: 1,
    height: 1,
    sortOrder: 0,
    deletedAt: null,
    createdAt: TS,
    updatedAt: TS,
  })
  return s
}

const options = {
  mediaUrl: (p: string) => `https://cdn.test/${p}`,
  generatedAt: '2026-10-16T09:30:00.000Z',
}

describe('buildWeddingExport', () => {
  const data = buildWeddingExport(sample(), options)

  it('summarises the wedding in dollars with totals from the budget logic', () => {
    expect(data).toMatchObject({ format: 'wedonomics-export', version: 1, currency: 'CAD' })
    expect(data.wedding).toMatchObject({
      budget: 16_000,
      paid: 3_500,
      remaining: 12_500,
      budgetMode: 'auto',
    })
  })

  it('leaves out deleted events, activities and payments', () => {
    expect(data.events.map((e) => e.name)).toEqual(['Mehndi', 'Reception'])
    const reception = data.events[1]!
    expect(reception.categories.flatMap((c) => c.activities.map((a) => a.name))).toEqual(['Dinner'])
    expect(data.events[0]!.categories[0]!.activities[0]!.payments).toHaveLength(2)
  })

  it('includes every activity detail, payments in date order, links and photo URLs', () => {
    const caterer = data.events[0]!.categories[0]!.activities[0]!
    expect(caterer).toMatchObject({
      name: 'Caterer',
      status: 'booked',
      budget: 6_000,
      actualCost: 5_800,
      paid: 3_500,
      stillToPay: 2_300,
      overBudget: false,
      overpaid: false,
      notes: 'Ask about chai | sweets',
      links: [{ label: 'Menu', url: 'https://example.com/menu' }],
      photos: ['https://cdn.test/w1/activities/caterer/a.webp'],
    })
    expect(caterer.payments).toEqual([
      { date: '2026-08-14', amount: 2_000, note: 'Deposit' },
      { date: '2026-10-02', amount: 1_500, note: '' },
    ])
    expect(data.events[0]!.coverPhoto).toBe('https://cdn.test/w1/events/mehndi/cover.webp')
  })

  it('totals shared categories across events, largest first', () => {
    expect(data.categoryTotals).toEqual([
      { name: 'Food', budget: 16_000, paid: 3_500, events: 2 },
      // Reception's Decor has no activities yet, so it shows at $0 rather than disappearing.
      { name: 'Decor', budget: 0, paid: 0, events: 1 },
    ])
  })

  it('round-trips as JSON', () => {
    expect(JSON.parse(exportToJson(data))).toEqual(data)
  })
})

describe('exportToMarkdown', () => {
  const md = exportToMarkdown(buildWeddingExport(sample(), options))

  it('explains itself for an AI reader and summarises the totals', () => {
    expect(md).toContain('# Test Wedding: wedding budget')
    expect(md).toContain('All amounts are in Canadian dollars (CAD)')
    expect(md).toContain('**Total budget:** $16,000.00')
    expect(md).toContain('**Paid so far:** $3,500.00')
  })

  it('lists events, categories, activities, payments, links and photos', () => {
    for (const text of [
      '## Mehndi',
      '### Food · budget $6,000.00 · paid $3,500.00',
      '#### Caterer (Booked)',
      '- Still to pay: $2,300.00',
      '| 2026-08-14 | $2,000.00 | Deposit |',
      '- Menu: https://example.com/menu',
      '- https://cdn.test/w1/activities/caterer/a.webp',
    ]) {
      expect(md).toContain(text)
    }
  })

  it('keeps user text from breaking tables or turning into headings', () => {
    expect(md).toContain('**Location:** Family home \\| Brampton')
    expect(md).toContain('> # not a heading')
    expect(md).not.toMatch(/^# not a heading/m)
  })

  it('never mentions deleted items', () => {
    expect(md).not.toContain('Haldi')
    expect(md).not.toContain('Cancelled tasting')
    expect(md).not.toContain('$999.99')
  })
})

describe('exportFileName', () => {
  it('builds a safe, dated file name', () => {
    expect(exportFileName('Akshen & Anjana', '2026-10-16T09:30:00Z', 'md')).toBe(
      'wedonomics-akshen-anjana-2026-10-16.md',
    )
    expect(exportFileName('Zoë ✨', '2026-10-16T09:30:00Z', 'json')).toBe(
      'wedonomics-zoe-2026-10-16.json',
    )
  })
})
