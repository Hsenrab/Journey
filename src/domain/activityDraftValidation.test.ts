import { describe, expect, it } from 'vitest'
import { validateActivityDraft, type ActivityDraftValidationInput } from './activityDraftValidation'

const valid: ActivityDraftValidationInput = {
  name: 'A visit',
  date: '2026-01-01',
  locationKind: 'postcode',
  postcode: ' GL1 1AA ',
  latitude: '',
  longitude: '',
  category: '',
  supportsCategories: false,
  removesRecordedAward: false,
  awardRemovalConfirmed: false,
  references: [],
  photoReferences: [],
}

describe('Activity raw-form validation', () => {
  it('normalizes location without altering the raw draft', () => {
    expect(validateActivityDraft(valid)).toEqual({ errors: {}, location: { kind: 'postcode', postcode: 'GL1 1AA' } })
    expect(valid.postcode).toBe(' GL1 1AA ')
  })

  it.each([
    [{ name: ' ' }, 'name', 'Activity title is required.'],
    [{ postcode: '' }, 'postcode', 'Postcode is required.'],
    [{ locationKind: 'coordinates' }, 'coordinates', 'Enter both latitude and longitude.'],
    [
      { locationKind: 'coordinates', latitude: 'bad', longitude: '0' },
      'coordinates',
      'Latitude and longitude must be numeric.',
    ],
    [
      { locationKind: 'coordinates', latitude: '91', longitude: '0' },
      'coordinates',
      'Latitude must be between -90 and 90.',
    ],
    [
      { locationKind: 'coordinates', latitude: '0', longitude: '-181' },
      'coordinates',
      'Longitude must be between -180 and 180.',
    ],
    [{ supportsCategories: true }, 'category', 'Select Bronze, Silver or Gold.'],
    [{ removesRecordedAward: true }, 'awardRemoval', 'Confirm removal of the recorded award before saving.'],
  ] satisfies [Partial<ActivityDraftValidationInput>, string, string][])(
    'retains the existing error for %j',
    (patch, key, message) => {
      expect(validateActivityDraft({ ...valid, ...patch }).errors[key]).toBe(message)
    },
  )

  it('retains date and indexed evidence errors without discarding a valid location', () => {
    const result = validateActivityDraft({
      ...valid,
      date: '9999-01-01',
      references: [{ title: '', url: 'http://example.com', previewImageUrl: 'http://example.com/image' }],
      photoReferences: [{ title: '', url: '' }],
    })
    expect(Object.keys(result.errors)).toEqual([
      'date',
      'reference-0-title',
      'reference-0-url',
      'reference-0-preview',
      'photo-0-title',
      'photo-0-url',
    ])
    expect(result.location).toEqual({ kind: 'postcode', postcode: 'GL1 1AA' })
    expect(
      validateActivityDraft({
        ...valid,
        locationKind: 'coordinates',
        latitude: '51',
        longitude: '-2',
        supportsCategories: true,
        category: 'bronze',
      }),
    ).toEqual({ errors: {}, location: { kind: 'coordinates', latitude: 51, longitude: -2 } })
  })
})
