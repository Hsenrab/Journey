import { describe, expect, it } from 'vitest'
import { parseActivityDraftJson, parseIdeaDraftJson } from './draftJsonImport'

describe('draftJsonImport', () => {
  it('parses a valid activity draft payload', () => {
    const result = parseActivityDraftJson(
      JSON.stringify({
        date: '2026-09-01',
        notes: 'Loaded from JSON',
        waypointId: '',
        ideaIds: [],
        location: { kind: 'postcode', postcode: 'GL1 1AA' },
        references: [{ title: 'Guide', url: 'https://example.com/guide', description: '', previewImageUrl: '' }],
        photoReferences: [{ title: 'Photo', url: 'https://example.com/photo.jpg', altText: '' }],
      }),
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.waypointId).toBeUndefined()
      expect(result.value.references[0]).toEqual({
        title: 'Guide',
        url: 'https://example.com/guide',
        description: undefined,
        previewImageUrl: undefined,
      })
      expect(result.value.photoReferences[0]).toEqual({
        title: 'Photo',
        url: 'https://example.com/photo.jpg',
        altText: undefined,
      })
    }
  })

  it('rejects arrays and forbidden id fields for activity drafts', () => {
    expect(parseActivityDraftJson('[]')).toEqual({
      ok: false,
      error: 'Paste a single object, not an array.',
      issues: [],
    })

    const withId = parseActivityDraftJson(
      JSON.stringify({
        activityId: 'activity-1',
        date: '2026-09-01',
        notes: '',
        ideaIds: [],
        location: { kind: 'postcode', postcode: 'GL1 1AA' },
        references: [],
        photoReferences: [],
      }),
    )
    expect(withId.ok).toBe(false)
    if (!withId.ok) {
      expect(withId.error).toContain("Remove 'activityId' — IDs are assigned automatically.")
    }
  })

  it('rejects unknown activity location fields', () => {
    const result = parseActivityDraftJson(
      JSON.stringify({
        date: '2026-09-01',
        notes: '',
        ideaIds: [],
        location: { kind: 'postcode', postcode: 'GL1 1AA', placename: 'Typo field' },
        references: [],
        photoReferences: [],
      }),
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('JSON does not match the activity draft shape.')
      expect(result.issues).toContain('location: Unexpected field: placename.')
    }
  })

  it('parses a valid idea payload', () => {
    const result = parseIdeaDraftJson(
      JSON.stringify({
        title: 'Sunrise walk',
        description: 'Try a short route',
        notes: 'Bring snacks',
        waypointIds: [],
        planningState: 'active',
        difficulty: 1,
        location: { placeName: 'Brockworth', source: '' },
        references: [{ title: 'Route ideas', url: 'https://example.com/route', description: '', previewImageUrl: '' }],
      }),
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.location).toEqual({ placeName: 'Brockworth', source: undefined })
      expect(result.value.references[0]).toEqual({
        title: 'Route ideas',
        url: 'https://example.com/route',
        description: undefined,
        previewImageUrl: undefined,
      })
    }
  })

  it('rejects unknown idea location fields', () => {
    const result = parseIdeaDraftJson(
      JSON.stringify({
        title: 'Sunrise walk',
        description: 'Try a short route',
        notes: 'Bring snacks',
        waypointIds: [],
        planningState: 'active',
        difficulty: 1,
        location: { placename: 'Typo field' },
        references: [],
      }),
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('JSON does not match the idea draft shape.')
      expect(result.issues).toContain('location: Unexpected field: placename.')
    }
  })
})
