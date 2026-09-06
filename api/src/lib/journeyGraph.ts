import type { EntityType, JourneyData } from './journeySchema.js'

type Entity = Record<string, unknown>

const entityKeys = {
  waypoint: 'waypoints',
  challenge: 'challenges',
  idea: 'ideas',
  activity: 'activities',
  reference: 'references',
  photoReference: 'photoReferences',
} as const satisfies Record<EntityType, keyof JourneyData>

export function entityKey(type: EntityType): keyof JourneyData {
  return entityKeys[type]
}

export function entityTypeFor(key: keyof JourneyData): EntityType {
  const type = (Object.keys(entityKeys) as EntityType[]).find((candidate) => entityKeys[candidate] === key)
  if (!type) throw new Error(`Unknown Journey data key "${key}".`)
  return type
}

export function entityId(type: EntityType, entity: Entity): string {
  const idKey = type === 'photoReference' ? 'photoReferenceId' : `${type}Id`
  const id = entity[idKey]
  if (typeof id !== 'string' || !id) throw new Error(`Entity "${type}" is missing its identifier.`)
  return id
}

export function upsertEntity(data: JourneyData, type: EntityType, entity: Entity): JourneyData {
  const key = entityKey(type)
  const id = entityId(type, entity)
  const entities = (data[key] as Entity[]).filter((item) => entityId(type, item) !== id)
  return { ...data, [key]: [...entities, entity] }
}

function linkError(owner: string, ownerId: string, label: string, ids: readonly string[], known: Set<string>) {
  if (new Set(ids).size !== ids.length) return `${owner} "${ownerId}" repeats a ${label} link.`
  const missing = ids.find((id) => !known.has(id))
  return missing ? `${owner} "${ownerId}" references unknown ${label} "${missing}".` : undefined
}

export function referenceIntegrityError(data: JourneyData): string | undefined {
  const waypointIds = new Set(data.waypoints.map((waypoint) => waypoint.waypointId))
  const challengeIds = new Set(data.challenges.map((challenge) => challenge.challengeId))
  const ideaIds = new Set(data.ideas.map((idea) => idea.ideaId))
  const referenceIds = new Set(data.references.map((reference) => reference.referenceId))
  const photoIds = new Set(data.photoReferences.map((photo) => photo.photoReferenceId))

  const errors = [
    ...data.waypoints.flatMap((waypoint) => [
      linkError('Waypoint', waypoint.waypointId, 'challenge', waypoint.challengeIds, challengeIds),
      linkError('Waypoint', waypoint.waypointId, 'reference', waypoint.referenceIds, referenceIds),
      linkError('Waypoint', waypoint.waypointId, 'photo reference', waypoint.photoReferenceIds, photoIds),
    ]),
    ...data.challenges.map((challenge) =>
      linkError('Challenge', challenge.challengeId, 'waypoint', challenge.waypointIds, waypointIds),
    ),
    ...data.ideas.flatMap((idea) => [
      linkError('Idea', idea.ideaId, 'waypoint', idea.waypointIds, waypointIds),
      linkError('Idea', idea.ideaId, 'reference', idea.referenceIds, referenceIds),
    ]),
    ...data.activities.flatMap((activity) => [
      linkError('Activity', activity.activityId, 'idea', activity.ideaIds, ideaIds),
      linkError(
        'Activity',
        activity.activityId,
        'waypoint',
        activity.waypointId ? [activity.waypointId] : [],
        waypointIds,
      ),
      linkError(
        'Activity',
        activity.activityId,
        'challenge',
        activity.challengeId ? [activity.challengeId] : [],
        challengeIds,
      ),
      linkError('Activity', activity.activityId, 'reference', activity.referenceIds, referenceIds),
      linkError('Activity', activity.activityId, 'photo reference', activity.photoReferenceIds, photoIds),
    ]),
  ]
  return errors.find((error) => error !== undefined)
}

function unreferencedIds(data: JourneyData): string[] {
  const usedReferences = new Set([
    ...data.waypoints.flatMap((waypoint) => waypoint.referenceIds),
    ...data.ideas.flatMap((idea) => idea.referenceIds),
    ...data.activities.flatMap((activity) => activity.referenceIds),
  ])
  const usedPhotos = new Set([
    ...data.waypoints.flatMap((waypoint) => waypoint.photoReferenceIds),
    ...data.activities.flatMap((activity) => activity.photoReferenceIds),
  ])
  return [
    ...data.references.map((reference) => reference.referenceId).filter((id) => !usedReferences.has(id)),
    ...data.photoReferences.map((photo) => photo.photoReferenceId).filter((id) => !usedPhotos.has(id)),
  ]
}

function newlyUnreferencedIds(before: JourneyData, after: JourneyData): string[] {
  const alreadyUnreferenced = new Set(unreferencedIds(before))
  return unreferencedIds(after).filter((id) => !alreadyUnreferenced.has(id))
}

export type DeletionPlan = { deletes: string[]; updates: { type: EntityType; entity: Entity }[] }

export function deletionPlan(data: JourneyData, type: EntityType, id: string): DeletionPlan {
  if (type === 'waypoint') {
    const ideas = data.ideas
      .filter((idea) => idea.waypointIds.includes(id))
      .map((idea) => ({
        type: 'idea' as const,
        entity: { ...idea, waypointIds: idea.waypointIds.filter((waypointId) => waypointId !== id) },
      }))
    const activities = data.activities
      .filter((activity) => activity.waypointId === id)
      .map(({ waypointId: _removed, ...activity }) => ({ type: 'activity' as const, entity: { ...activity } }))
    return { deletes: [id], updates: [...ideas, ...activities] }
  }

  if (type === 'idea') {
    const activities = data.activities
      .filter((activity) => activity.ideaIds.includes(id))
      .map((activity) => ({ ...activity, ideaIds: activity.ideaIds.filter((ideaId) => ideaId !== id) }))
    const remaining: JourneyData = {
      ...data,
      ideas: data.ideas.filter((idea) => idea.ideaId !== id),
      activities: data.activities.map(
        (activity) => activities.find((updated) => updated.activityId === activity.activityId) ?? activity,
      ),
    }
    return {
      deletes: [id, ...newlyUnreferencedIds(data, remaining)],
      updates: activities.map((activity) => ({ type: 'activity' as const, entity: { ...activity } })),
    }
  }

  if (type === 'activity') {
    const remaining: JourneyData = {
      ...data,
      activities: data.activities.filter((activity) => activity.activityId !== id),
    }
    return { deletes: [id, ...newlyUnreferencedIds(data, remaining)], updates: [] }
  }

  return { deletes: [id], updates: [] }
}
