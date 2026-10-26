import { describe, expect, it } from 'vitest'
import {
  applyPlan,
  awardTransitionError,
  deletionPlan,
  referenceIntegrityError,
  updatePlan,
  upsertEntity,
} from './journeyGraph.js'
import type { JourneyData } from './journeySchema.js'

function data(): JourneyData {
  return {
    waypoints: [
      {
        waypointId: 'waypoint-1',
        title: 'Manor',
        description: 'Manor',
        category: 'Historic building',
        tags: [],
        challengeIds: ['challenge-1'],
        completion: { mode: 'once' },
        referenceIds: ['reference-3'],
        photoReferenceIds: [],
      },
    ],
    challenges: [
      {
        challengeId: 'challenge-1',
        title: 'Heritage weekend',
        description: 'Heritage weekend',
        supportsActivityCategories: false,
      },
    ],
    ideas: [
      {
        ideaId: 'idea-1',
        title: 'Orangery tour',
        description: '',
        notes: '',
        waypointIds: ['waypoint-1'],
        planningState: 'active',
        difficulty: 2,
        referenceIds: ['reference-1'],
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
    ],
    activities: [
      {
        activityId: 'activity-1',
        name: 'Orangery tour',
        waypointId: 'waypoint-1',
        ideaIds: ['idea-1'],
        date: '2026-08-02',
        location: { kind: 'postcode', postcode: 'GL3 4AQ', latitude: 51.844, longitude: -2.153 },
        notes: '',
        referenceIds: ['reference-2'],
        photoReferenceIds: ['photo-1'],
        createdAt: '2026-08-02T00:00:00.000Z',
        updatedAt: '2026-08-02T00:00:00.000Z',
      },
    ],
    references: [
      { referenceId: 'reference-1', title: 'Idea link', url: 'https://example.com/idea' },
      { referenceId: 'reference-2', title: 'Activity link', url: 'https://example.com/activity' },
      { referenceId: 'reference-3', title: 'Waypoint link', url: 'https://example.com/waypoint' },
    ],
    photoReferences: [{ photoReferenceId: 'photo-1', title: 'Photo', url: 'https://example.com/photo.jpg' }],
  }
}

describe('referenceIntegrityError', () => {
  it('requires awards only through Waypoint memberships, never a direct Challenge link', () => {
    const graph = data()
    graph.challenges[0]!.supportsActivityCategories = true
    expect(referenceIntegrityError(graph)).toContain('Activity "activity-1" at Waypoint "waypoint-1" requires')
    graph.activities[0]!.category = 'gold'
    expect(referenceIntegrityError(graph)).toBeUndefined()
    graph.activities[0]!.challengeId = 'challenge-1'
    graph.waypoints[0]!.challengeIds = []
    expect(referenceIntegrityError(graph)).toContain('waypoint "waypoint-1" does not support')
    delete graph.activities[0]!.category
    expect(referenceIntegrityError(graph)).toBeUndefined()
    graph.activities[0]!.waypointId = 'missing'
    expect(referenceIntegrityError(graph)).toBe('Activity "activity-1" references unknown waypoint "missing".')
    delete graph.activities[0]!.waypointId
    graph.activities[0]!.challengeId = 'missing'
    expect(referenceIntegrityError(graph)).toBe('Activity "activity-1" references unknown challenge "missing".')
  })

  it('accepts a complete dataset', () => {
    expect(referenceIntegrityError(data())).toBeUndefined()
  })

  describe('awardTransitionError', () => {
    function awarded() {
      const graph = data()
      graph.challenges[0]!.supportsActivityCategories = true
      graph.activities[0]!.category = 'gold'
      return graph
    }

    it.each(['waypoint', 'membership', 'disable', 'challenge'] as const)(
      'blocks disguised %s award loss even when retained Activity categories are stripped',
      (operation) => {
        const before = awarded()
        const after = structuredClone(before)
        delete after.activities[0]!.category
        if (operation === 'waypoint') {
          after.waypoints = []
          delete after.activities[0]!.waypointId
          after.ideas[0]!.waypointIds = []
        }
        if (operation === 'membership') after.waypoints[0]!.challengeIds = []
        if (operation === 'disable') after.challenges[0]!.supportsActivityCategories = false
        if (operation === 'challenge') {
          after.challenges = []
          after.waypoints[0]!.challengeIds = []
        }
        expect(referenceIntegrityError(after)).toBeUndefined()
        expect(awardTransitionError(before, after)).toContain('Activity "activity-1" at Waypoint "waypoint-1"')
      },
    )

    it('permits separate deliberate Activity edits, deletion and shared eligibility', () => {
      const before = awarded()
      const edited = structuredClone(before)
      delete edited.activities[0]!.waypointId
      delete edited.activities[0]!.category
      expect(awardTransitionError(before, edited)).toBeUndefined()
      expect(referenceIntegrityError(edited)).toBeUndefined()
      expect(
        awardTransitionError(edited, applyPlan(edited, deletionPlan(edited, 'waypoint', 'waypoint-1'))),
      ).toBeUndefined()
      const deleted = { ...before, activities: [] }
      expect(awardTransitionError(before, deleted)).toBeUndefined()
      const shared = structuredClone(before)
      shared.challenges.push({ ...shared.challenges[0]!, challengeId: 'challenge-2' })
      shared.waypoints[0]!.challengeIds.push('challenge-2')
      shared.activities[0]!.challengeId = 'challenge-1'
      const after = applyPlan(shared, deletionPlan(shared, 'challenge', 'challenge-1'))
      expect(awardTransitionError(shared, after)).toBeUndefined()
      expect(referenceIntegrityError(after)).toBeUndefined()
      expect(after.waypoints[0]!.challengeIds).toEqual(['challenge-2'])
      expect(after.activities[0]).toMatchObject({ category: 'gold' })
      expect(after.activities[0]).not.toHaveProperty('challengeId')
    })
  })

  it('rejects unknown and duplicate referenced IDs', () => {
    const unknownIdea = data()
    unknownIdea.activities[0]!.ideaIds = ['idea-missing']
    expect(referenceIntegrityError(unknownIdea)).toBe('Activity "activity-1" references unknown idea "idea-missing".')

    const unknownWaypoint = data()
    unknownWaypoint.ideas[0]!.waypointIds = ['waypoint-missing']
    expect(referenceIntegrityError(unknownWaypoint)).toBe(
      'Idea "idea-1" references unknown waypoint "waypoint-missing".',
    )

    const duplicate = data()
    duplicate.activities[0]!.referenceIds = ['reference-2', 'reference-2']
    expect(referenceIntegrityError(duplicate)).toBe('Activity "activity-1" repeats a reference link.')
  })

  it('validates an upserted entity against the stored dataset', () => {
    const next = upsertEntity(data(), 'activity', { ...data().activities[0]!, ideaIds: ['idea-1', 'idea-2'] })
    expect(next.activities).toHaveLength(1)
    expect(referenceIntegrityError(next)).toBe('Activity "activity-1" references unknown idea "idea-2".')
  })

  it('rejects categorized activities without a category-supporting waypoint challenge', () => {
    const invalid = data()
    invalid.activities[0]!.category = 'silver'

    expect(referenceIntegrityError(invalid)).toBe(
      'Activity "activity-1" has a category but its waypoint "waypoint-1" does not support Bronze, Silver or Gold categories.',
    )
  })

  it('distinguishes categorized activities without a waypoint', () => {
    const invalid = data()
    delete invalid.activities[0]!.waypointId
    invalid.activities[0]!.category = 'silver'

    expect(referenceIntegrityError(invalid)).toBe(
      'Activity "activity-1" has a category but is not linked to a waypoint.',
    )
  })
})

describe('deletionPlan', () => {
  it('detaches ideas and activities when a waypoint is deleted', () => {
    const original = data()
    const plan = deletionPlan(original, 'waypoint', 'waypoint-1')

    expect(plan.deletes).toEqual(['waypoint-1', 'reference-3'])
    expect(plan.updates).toEqual([
      { type: 'idea', entity: expect.objectContaining({ ideaId: 'idea-1', waypointIds: [] }) },
      { type: 'activity', entity: expect.objectContaining({ activityId: 'activity-1', ideaIds: ['idea-1'] }) },
    ])
    expect(plan.updates[1]!.entity).not.toHaveProperty('waypointId')
    expect(plan.updates[1]!.entity).not.toHaveProperty('category')
    expect(referenceIntegrityError(applyPlan(original, plan))).toBeUndefined()
  })

  it('updates only the waypoint when its challenge assignments change', () => {
    const plan = updatePlan(data(), 'waypoint', {
      ...data().waypoints[0]!,
      challengeIds: [],
      referenceIds: [],
    })

    expect(plan.updates).toEqual([
      { type: 'waypoint', entity: expect.objectContaining({ waypointId: 'waypoint-1', challengeIds: [] }) },
    ])
    expect(referenceIntegrityError(applyPlan(data(), plan))).toBeUndefined()
  })

  it('rejects duplicate and dangling waypoint challenge assignments', () => {
    const duplicate = data()
    duplicate.waypoints[0]!.challengeIds = ['challenge-1', 'challenge-1']
    expect(referenceIntegrityError(duplicate)).toBe('Waypoint "waypoint-1" repeats a challenge link.')

    const dangling = data()
    dangling.waypoints[0]!.challengeIds = ['challenge-missing']
    expect(referenceIntegrityError(dangling)).toBe(
      'Waypoint "waypoint-1" references unknown challenge "challenge-missing".',
    )
  })

  it('rejects waypoint challenge updates that invalidate an activity category', () => {
    const withCategory = data()
    withCategory.challenges[0]!.supportsActivityCategories = true
    withCategory.waypoints[0]!.challengeIds = ['challenge-1']
    withCategory.activities[0]!.category = 'silver'
    const plan = updatePlan(withCategory, 'waypoint', {
      ...withCategory.waypoints[0]!,
      challengeIds: [],
    })

    expect(referenceIntegrityError(applyPlan(withCategory, plan))).toBe(
      'Activity "activity-1" has a category but its waypoint "waypoint-1" does not support Bronze, Silver or Gold categories.',
    )
  })

  it('removes idea links from activities and prunes orphaned references', () => {
    const plan = deletionPlan(data(), 'idea', 'idea-1')

    expect(plan.deletes).toEqual(['idea-1', 'reference-1'])
    expect(plan.updates).toEqual([
      { type: 'activity', entity: expect.objectContaining({ activityId: 'activity-1', ideaIds: [] }) },
    ])
  })

  it('preserves ideas and prunes only newly orphaned documents when an activity is deleted', () => {
    const withOrphan = data()
    withOrphan.references.push({ referenceId: 'reference-3', title: 'Orphan', url: 'https://example.com/orphan' })

    const plan = deletionPlan(withOrphan, 'activity', 'activity-1')

    expect(plan.deletes).toEqual(['activity-1', 'reference-2', 'photo-1'])
    expect(plan.updates).toEqual([])
  })

  it('deletes other entity types on their own', () => {
    expect(deletionPlan(data(), 'reference', 'reference-1')).toEqual({ deletes: ['reference-1'], updates: [] })
  })
})
