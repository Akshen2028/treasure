import { describe, expect, it } from 'vitest'

import {
  emptyCreateWeddingForm,
  parseCreateWeddingForm,
  previewWeddingPath,
  WEDDING_NAME_MAX,
} from './createWeddingForm'

const form = (values: Partial<typeof emptyCreateWeddingForm>) => ({
  ...emptyCreateWeddingForm,
  ...values,
})

describe('parseCreateWeddingForm', () => {
  it('requires a name and trims it', () => {
    expect(parseCreateWeddingForm(form({ name: '  ' }))).toEqual({
      ok: false,
      errors: { name: 'Give your wedding a name, like “Alex & Sam”.' },
    })
    expect(
      parseCreateWeddingForm(form({ name: ' Alex & Sam ', weddingDate: '2027-06-12' })),
    ).toEqual({ ok: true, value: { name: 'Alex & Sam', weddingDate: '2027-06-12' } })
  })

  it('treats an empty date as no date', () => {
    const result = parseCreateWeddingForm(form({ name: 'Alex & Sam' }))
    expect(result.ok && result.value.weddingDate).toBeNull()
  })

  it('limits the name to the database length', () => {
    expect(parseCreateWeddingForm(form({ name: 'a'.repeat(WEDDING_NAME_MAX) })).ok).toBe(true)
    expect(parseCreateWeddingForm(form({ name: 'a'.repeat(WEDDING_NAME_MAX + 1) }))).toEqual({
      ok: false,
      errors: { name: 'Keep the name to 100 characters or fewer.' },
    })
  })

  it('rejects a malformed date', () => {
    expect(parseCreateWeddingForm(form({ name: 'Alex & Sam', weddingDate: '12/06/2027' }))).toEqual(
      { ok: false, errors: { weddingDate: 'Choose a valid date.' } },
    )
  })
})

describe('previewWeddingPath', () => {
  it('previews the address from the names', () => {
    expect(previewWeddingPath('Zoë & José')).toBe('/w/zoe-jose')
    expect(previewWeddingPath('   ')).toBeNull()
  })
})
