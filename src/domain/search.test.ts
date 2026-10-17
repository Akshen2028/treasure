import { describe, expect, it } from 'vitest'

import { selectActive } from './hierarchy'
import { buildSearchIndex, excerpt, highlightParts, normalize, search } from './search'
import { deleted, SnapshotBuilder } from './testing/factories'

const snapshot = new SnapshotBuilder()
  .definition('food', 'Food')
  .definition('decor', 'Decor')
  .definition('mehndi-artist', 'Mehndi Artist')
  .event('mehndi', 0, { name: 'Mehndi', location: 'Family home, Brampton' })
  .event('reception', 0, {
    name: 'Reception',
    description: 'Dinner and dancing at the Grand Ballroom.',
  })
  .event('haldi', 0, { name: 'Haldi', ...deleted })
  .category('m-food', 'mehndi', 'food')
  .category('m-artist', 'mehndi', 'mehndi-artist')
  .category('r-decor', 'reception', 'decor')
  .category('r-food', 'reception', 'food')
  .category('h-food', 'haldi', 'food')
  .activity('caterer', 'm-food', 100, {
    name: 'Caterer',
    notes: 'Ask whether the crème brûlée can be made eggless for Nani.',
  })
  .activity('florals', 'r-decor', 100, { name: 'Centrepieces and florals' })
  .activity('dinner', 'r-food', 100, { name: 'Plated dinner', description: 'Three courses.' })
  .activity('old', 'r-food', 100, { name: 'Florals backup', ...deleted })
  .activity('breakfast', 'h-food', 100, { name: 'Haldi breakfast' })
  .build()

const index = buildSearchIndex(selectActive(snapshot))
const ids = (query: string) => search(index, query).map((r) => `${r.kind}:${r.id}`)

describe('normalize', () => {
  it('ignores case, accents and extra spaces', () => {
    expect(normalize('  Crème  BRÛLÉE ')).toBe('creme brulee')
  })
})

describe('search', () => {
  it('returns nothing for an empty query', () => {
    expect(search(index, '   ')).toEqual([])
  })

  it('finds events, categories and activities by name, with their context', () => {
    expect(ids('florals')).toEqual(['activity:florals'])
    const [decor] = search(index, 'decor')
    expect(decor).toMatchObject({ kind: 'category', title: 'Decor', context: ['Reception'] })
  })

  it('lists each event a shared category appears in separately', () => {
    expect(ids('food').filter((id) => id.startsWith('category'))).toEqual([
      'category:m-food',
      'category:r-food',
    ])
  })

  it('searches descriptions, notes and locations, with an excerpt', () => {
    const [byNotes] = search(index, 'eggless')
    expect(byNotes).toMatchObject({ id: 'caterer', field: 'notes' })
    expect(byNotes?.snippet).toContain('eggless')
    expect(search(index, 'brampton')[0]).toMatchObject({ id: 'mehndi', field: 'location' })
    expect(search(index, 'ballroom')[0]).toMatchObject({ id: 'reception', field: 'description' })
  })

  it('matches without accents and regardless of case', () => {
    expect(ids('CREME BRULEE')).toEqual(['activity:caterer'])
  })

  it('requires every word, using where an item lives too', () => {
    // The Food category in Mehndi ranks first; activities living in Mehndi › Food also match.
    expect(ids('food mehndi')).toEqual(['category:m-food', 'activity:caterer'])
    expect(ids('reception dinner')).toContain('activity:dinner')
    expect(ids('florals mehndi')).toEqual([])
  })

  it('ranks name matches above other fields, and prefixes above mid-word matches', () => {
    const results = search(index, 'dinner').map((r) => r.id)
    expect(results.indexOf('dinner')).toBeLessThan(results.indexOf('reception'))
    const mehndi = search(index, 'mehndi').map((r) => r.id)
    expect(mehndi[0]).toBe('mehndi')
  })

  it('never returns deleted items or anything under a deleted event', () => {
    expect(ids('backup')).toEqual([])
    expect(ids('haldi')).toEqual([])
    expect(ids('breakfast')).toEqual([])
  })
})

describe('excerpt', () => {
  it('trims long text around the match to whole words', () => {
    const text = 'One two three four five six seven eight nine ten eleven twelve thirteen'
    expect(excerpt(text, 'seven', 12)).toBe('…five six seven eight nine…')
  })
})

describe('highlightParts', () => {
  it('marks every query word in the original text, ignoring accents and case', () => {
    expect(highlightParts('Crème Brûlée bar', 'creme bar')).toEqual([
      { text: 'Crème', match: true },
      { text: ' Brûlée ', match: false },
      { text: 'bar', match: true },
    ])
  })

  it('returns the text unchanged when nothing is searched', () => {
    expect(highlightParts('Florals', '')).toEqual([{ text: 'Florals', match: false }])
  })
})
