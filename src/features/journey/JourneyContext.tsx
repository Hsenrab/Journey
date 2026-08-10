import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import { load, save } from '../../services/storage'
import {
  activitiesForWaypoint,
  createActivity,
  statusForWaypoint,
  validateActivityCategory,
  type Activity,
  type ActivityLocation,
  type AwardedStatus,
  type ExternalPhotoReference,
  type Reference,
  type Status,
  type WaypointsData,
} from '../../domain/visit'

type DraftReference = Pick<Reference, 'title' | 'url' | 'description' | 'previewImageUrl'> & { referenceId?: string }
type DraftPhotoReference = Pick<ExternalPhotoReference, 'title' | 'url' | 'altText'> & { photoReferenceId?: string }

export type ActivityDraft = {
  waypointId?: string
  date: string
  category?: AwardedStatus
  location: ActivityLocation
  notes: string
  references: DraftReference[]
  photoReferences: DraftPhotoReference[]
}

type Action =
  | { type: 'add-activity'; input: ActivityDraft }
  | { type: 'update-activity'; activityId: string; input: ActivityDraft }
  | { type: 'delete-activity'; activityId: string }
  | { type: 'restore'; data: WaypointsData }

type WaypointsValue = {
  data: WaypointsData
  addActivity: (input: ActivityDraft) => void
  updateActivity: (activityId: string, input: ActivityDraft) => void
  deleteActivity: (activityId: string) => void
  restore: (data: WaypointsData) => void
  activitiesFor: (waypointId: string) => Activity[]
  statusFor: (waypointId: string) => Status
}

const Context = createContext<WaypointsValue | null>(null)

function upsertReferences(
  data: WaypointsData,
  items: DraftReference[],
): { references: Reference[]; referenceIds: string[] } {
  const references = [...data.references]
  const referenceIds: string[] = []

  for (const item of items) {
    const referenceId = item.referenceId ?? crypto.randomUUID()
    referenceIds.push(referenceId)
    const next: Reference = {
      referenceId,
      title: item.title,
      description: item.description,
      url: item.url,
      previewImageUrl: item.previewImageUrl,
    }
    const index = references.findIndex((reference) => reference.referenceId === referenceId)
    if (index === -1) references.push(next)
    else references[index] = next
  }

  return { references, referenceIds }
}

function upsertPhotoReferences(
  data: WaypointsData,
  items: DraftPhotoReference[],
): { photoReferences: ExternalPhotoReference[]; photoReferenceIds: string[] } {
  const photoReferences = [...data.photoReferences]
  const photoReferenceIds: string[] = []

  for (const item of items) {
    const photoReferenceId = item.photoReferenceId ?? crypto.randomUUID()
    photoReferenceIds.push(photoReferenceId)
    const next: ExternalPhotoReference = {
      photoReferenceId,
      title: item.title,
      altText: item.altText,
      url: item.url,
    }
    const index = photoReferences.findIndex((photoReference) => photoReference.photoReferenceId === photoReferenceId)
    if (index === -1) photoReferences.push(next)
    else photoReferences[index] = next
  }

  return { photoReferences, photoReferenceIds }
}

function pruneUnreferenced(data: WaypointsData): WaypointsData {
  const activeReferenceIds = new Set<string>([
    ...data.waypoints.flatMap((waypoint) => waypoint.referenceIds),
    ...data.activities.flatMap((activity) => activity.referenceIds),
  ])
  const activePhotoReferenceIds = new Set<string>([
    ...data.waypoints.flatMap((waypoint) => waypoint.photoReferenceIds),
    ...data.activities.flatMap((activity) => activity.photoReferenceIds),
  ])

  return {
    ...data,
    references: data.references.filter((reference) => activeReferenceIds.has(reference.referenceId)),
    photoReferences: data.photoReferences.filter((photoReference) =>
      activePhotoReferenceIds.has(photoReference.photoReferenceId),
    ),
  }
}

function ensureCategoryEligibility(data: WaypointsData, activity: Activity): Activity {
  const cleaned = !activity.waypointId ? { ...activity, category: undefined } : activity
  validateActivityCategory(data, cleaned)
  return cleaned
}

function reducer(data: WaypointsData, action: Action): WaypointsData {
  switch (action.type) {
    case 'restore':
      return action.data
    case 'add-activity': {
      const refs = upsertReferences(data, action.input.references)
      const photos = upsertPhotoReferences(data, action.input.photoReferences)
      const category = action.input.waypointId ? action.input.category : undefined
      const activity = ensureCategoryEligibility(
        data,
        createActivity({
          waypointId: action.input.waypointId,
          date: action.input.date,
          category,
          location: action.input.location,
          notes: action.input.notes,
          referenceIds: refs.referenceIds,
          photoReferenceIds: photos.photoReferenceIds,
        }),
      )

      return pruneUnreferenced({
        ...data,
        activities: [...data.activities, activity],
        references: refs.references,
        photoReferences: photos.photoReferences,
      })
    }
    case 'update-activity': {
      const existing = data.activities.find((activity) => activity.activityId === action.activityId)
      if (!existing) throw new Error('Activity not found')
      const now = new Date()
      const updatedAt =
        now.toISOString() > existing.updatedAt ? now.toISOString() : new Date(now.getTime() + 1).toISOString()

      const refs = upsertReferences(data, action.input.references)
      const photos = upsertPhotoReferences(data, action.input.photoReferences)
      const updated = ensureCategoryEligibility(
        data,
        createActivity({
          activityId: existing.activityId,
          createdAt: existing.createdAt,
          updatedAt,
          waypointId: action.input.waypointId,
          date: action.input.date,
          category: action.input.waypointId ? action.input.category : undefined,
          location: action.input.location,
          notes: action.input.notes,
          referenceIds: refs.referenceIds,
          photoReferenceIds: photos.photoReferenceIds,
        }),
      )

      return pruneUnreferenced({
        ...data,
        activities: data.activities.map((activity) => (activity.activityId === action.activityId ? updated : activity)),
        references: refs.references,
        photoReferences: photos.photoReferences,
      })
    }
    case 'delete-activity':
      return pruneUnreferenced({
        ...data,
        activities: data.activities.filter((activity) => activity.activityId !== action.activityId),
      })
    default:
      return data
  }
}

export function WaypointsProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(reducer, undefined, load)
  useEffect(() => save(data), [data])
  const value = useMemo<WaypointsValue>(
    () => ({
      data,
      addActivity: (input) => dispatch({ type: 'add-activity', input }),
      updateActivity: (activityId, input) => dispatch({ type: 'update-activity', activityId, input }),
      deleteActivity: (activityId) => dispatch({ type: 'delete-activity', activityId }),
      restore: (newData) => dispatch({ type: 'restore', data: newData }),
      activitiesFor: (waypointId) => activitiesForWaypoint(data.activities, waypointId),
      statusFor: (waypointId) => statusForWaypoint(data.activities, waypointId),
    }),
    [data],
  )
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useWaypoints() {
  const value = useContext(Context)
  if (!value) throw new Error('useWaypoints must be used inside WaypointsProvider')
  return value
}

export type { WaypointsData }
