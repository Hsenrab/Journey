import { describe, expect, it } from 'vitest'
import { deletionPlan, referenceIntegrityError, upsertEntity } from './journeyGraph.js'
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
        challengeIds: [],
        completion: { mode: 'once' },
        referenceIds: [],
        photoReferenceIds: [],
      },
    ],
    challenges: [
      {
        challengeId: 'challenge-1',
        title: 'Heritage weekend',
        description: 'Heritage weekend',
        waypointIds: ['waypoint-1'],
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
        waypointId: 'waypoint-1',
        ideaIds: ['idea-1'],
        date: '2026-08-02',
        location: { kind: 'postcode', postcode: 'GL3 4AQ' },
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
    ],
    photoReferences: [{ photoReferenceId: 'photo-1', title: 'Photo', url: 'https://example.com/photo.jpg' }],
  }
}

describe('referenceIntegrityError', () => {
  it('accepts a complete dataset', () => {
    expect(referenceIntegrityError(data())).toBeUndefined()
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
})

describe('deletionPlan', () => {
  it('detaches ideas and activities when a waypoint is deleted', () => {
    const plan = deletionPlan(data(), 'waypoint', 'waypoint-1')

    expect(plan.deletes).toEqual(['waypoint-1'])
    expect(plan.updates).toEqual([
      { type: 'challenge', entity: expect.objectContaining({ challengeId: 'challenge-1', waypointIds: [] }) },
      { type: 'idea', entity: expect.objectContaining({ ideaId: 'idea-1', waypointIds: [] }) },
      { type: 'activity', entity: expect.objectContaining({ activityId: 'activity-1', ideaIds: ['idea-1'] }) },
    ])
    expect(plan.updates[1]!.entity).not.toHaveProperty('waypointId')
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
