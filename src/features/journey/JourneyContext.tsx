import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  createDemoModeData,
  getDataMode,
  load,
  save,
  setDataMode as saveDataMode,
  type JourneyDataMode,
} from '../../services/storage'
import {
  clearJourney,
  deleteJourneyEntity,
  importJourney,
  loadJourney,
  replaceJourney,
  type JourneyContainer,
  type JourneyRole,
} from '../../services/journeyApi'
import {
  activitiesForWaypoint,
  createActivity,
  createIdea,
  statusForWaypoint,
  validateActivityCategory,
  validateAwardTransition,
  DataSchema,
  type Activity,
  type GpxGeometry,
  type ActivityLocation,
  type AwardedStatus,
  ChallengeSchema,
  type Challenge,
  type ExternalPhotoReference,
  type Idea,
  type PlannedRoute,
  type Reference,
  type Waypoint,
  WaypointSchema,
  type Status,
  type WaypointsData,
} from '../../domain/visit'

type AccessRole = JourneyRole | 'local'

type DraftReference = Pick<Reference, 'title' | 'url' | 'description' | 'previewImageUrl'> & { referenceId?: string }
type DraftPhotoReference = Pick<ExternalPhotoReference, 'title' | 'url' | 'altText'> & { photoReferenceId?: string }

type ReloadResult = { status: 'success' } | { status: 'failure'; message: string } | { status: 'superseded' }
export type JourneyLoadState =
  { status: 'loading' } | { status: 'loaded'; warning?: string } | { status: 'failed'; message: string }

export type ActivityDraft = {
  name: string
  waypointId?: string
  ideaIds: string[]
  date: string
  category?: AwardedStatus
  location: ActivityLocation
  recordedTrack?: GpxGeometry
  notes: string
  references: DraftReference[]
  photoReferences: DraftPhotoReference[]
}

export type IdeaDraft = {
  title: string
  description: string
  notes: string
  waypointIds: string[]
  planningState: Idea['planningState']
  rejectionReason?: string
  difficulty: Idea['difficulty']
  location?: Idea['location']
  references: DraftReference[]
}

export type WaypointDraft = {
  title: string
  description: string
  category: string
  tags: string[]
  challengeIds: string[]
  completion: Waypoint['completion']
  location?: Waypoint['location']
  references: DraftReference[]
  photoReferences: DraftPhotoReference[]
}

type Action =
  | { type: 'add-challenge'; input: Challenge }
  | {
      type: 'update-challenge-awards'
      challengeId: string
      input: Pick<Challenge, 'supportsActivityCategories' | 'awardDescriptions'>
    }
  | { type: 'delete-challenge'; challengeId: string }
  | { type: 'update-challenge-route'; challengeId: string; plannedRoute?: PlannedRoute }
  | { type: 'add-waypoint'; input: WaypointDraft }
  | { type: 'update-waypoint'; waypointId: string; input: WaypointDraft }
  | { type: 'delete-waypoint'; waypointId: string }
  | { type: 'add-activity'; activityId: string; input: ActivityDraft }
  | { type: 'update-activity'; activityId: string; input: ActivityDraft }
  | { type: 'delete-activity'; activityId: string }
  | { type: 'add-idea'; input: IdeaDraft }
  | { type: 'update-idea'; ideaId: string; input: IdeaDraft }
  | { type: 'delete-idea'; ideaId: string }
  | { type: 'restore'; data: WaypointsData }

type WaypointsValue = {
  data: WaypointsData
  dataMode: JourneyDataMode
  activeDataMode: JourneyDataMode
  readOnly: boolean
  loading: boolean
  role: AccessRole
  loadError?: string
  loadState: JourneyLoadState
  setDataMode: (mode: JourneyDataMode) => Promise<'switched' | 'cancelled'>
  mutationPending: boolean
  runMutation: <T>(operation: () => Promise<T>) => Promise<T>
  registerDraft: (id: symbol, dirty: boolean) => () => void
  confirmNavigation: (destination: string) => boolean
  addChallenge: (
    input: Pick<Challenge, 'title' | 'description' | 'supportsActivityCategories' | 'awardDescriptions'>,
  ) => Promise<void>
  updateChallengeAwards: (
    challengeId: string,
    input: Pick<Challenge, 'supportsActivityCategories' | 'awardDescriptions'>,
  ) => Promise<void>
  deleteChallenge: (challengeId: string) => Promise<void>
  updateChallengeRoute: (challengeId: string, plannedRoute?: PlannedRoute) => Promise<void>
  addWaypoint: (input: WaypointDraft) => Promise<void>
  updateWaypoint: (waypointId: string, input: WaypointDraft) => Promise<void>
  deleteWaypoint: (waypointId: string) => Promise<void>
  addActivity: (input: ActivityDraft) => Promise<string>
  updateActivity: (activityId: string, input: ActivityDraft) => Promise<void>
  deleteActivity: (activityId: string) => Promise<void>
  addIdea: (input: IdeaDraft) => Promise<void>
  updateIdea: (ideaId: string, input: IdeaDraft) => Promise<void>
  deleteIdea: (ideaId: string) => Promise<void>
  restore: (data: WaypointsData) => Promise<void>
  clear: () => Promise<void>
  /** Resolves with whether the refresh succeeded, failed, or was superseded by another load. */
  reload: () => Promise<ReloadResult>
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
    ...data.ideas.flatMap((idea) => idea.referenceIds),
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
  validateActivityCategory(data, activity)
  return activity
}

function reducer(data: WaypointsData, action: Action): WaypointsData {
  switch (action.type) {
    case 'restore':
      return action.data
    case 'add-challenge':
      return { ...data, challenges: [...data.challenges, ChallengeSchema.parse(action.input)] }
    case 'update-challenge-awards': {
      const existing = data.challenges.find((item) => item.challengeId === action.challengeId)
      if (!existing) throw new Error('Challenge not found')
      const { awardDescriptions: _removed, ...retained } = existing
      const updated = ChallengeSchema.parse({ ...retained, ...action.input })
      return {
        ...data,
        challenges: data.challenges.map((item) => (item.challengeId === action.challengeId ? updated : item)),
      }
    }
    case 'delete-challenge': {
      if (!data.challenges.some((item) => item.challengeId === action.challengeId))
        throw new Error('Challenge not found')
      return {
        ...data,
        challenges: data.challenges.filter((item) => item.challengeId !== action.challengeId),
        waypoints: data.waypoints.map((item) => ({
          ...item,
          challengeIds: item.challengeIds.filter((id) => id !== action.challengeId),
        })),
        activities: data.activities.map((item) => {
          if (item.challengeId !== action.challengeId) return item
          const { challengeId: _removed, ...retained } = item
          return retained
        }),
      }
    }
    case 'update-challenge-route': {
      const existing = data.challenges.find((challenge) => challenge.challengeId === action.challengeId)
      if (!existing) throw new Error('Challenge not found')
      const updated = ChallengeSchema.parse({ ...existing, plannedRoute: action.plannedRoute })
      return {
        ...data,
        challenges: data.challenges.map((challenge) =>
          challenge.challengeId === action.challengeId ? updated : challenge,
        ),
      }
    }
    case 'add-waypoint': {
      const refs = upsertReferences(data, action.input.references)
      const photos = upsertPhotoReferences(data, action.input.photoReferences)
      const missingChallenges = action.input.challengeIds.filter(
        (challengeId) => !data.challenges.some((challenge) => challenge.challengeId === challengeId),
      )
      if (missingChallenges.length > 0) {
        throw new Error(`Unknown challenge ID: ${missingChallenges[0]}`)
      }
      const waypointId = crypto.randomUUID()
      const waypoint = WaypointSchema.parse({
        waypointId,
        title: action.input.title,
        description: action.input.description,
        category: action.input.category,
        tags: action.input.tags,
        challengeIds: action.input.challengeIds,
        completion: action.input.completion,
        location: action.input.location,
        referenceIds: refs.referenceIds,
        photoReferenceIds: photos.photoReferenceIds,
      })
      return pruneUnreferenced({
        ...data,
        waypoints: [...data.waypoints, waypoint],
        references: refs.references,
        photoReferences: photos.photoReferences,
      })
    }
    case 'update-waypoint': {
      const existing = data.waypoints.find((waypoint) => waypoint.waypointId === action.waypointId)
      if (!existing) throw new Error('Waypoint not found')
      const refs = upsertReferences(data, action.input.references)
      const photos = upsertPhotoReferences(data, action.input.photoReferences)
      const missingChallenges = action.input.challengeIds.filter(
        (challengeId) => !data.challenges.some((challenge) => challenge.challengeId === challengeId),
      )
      if (missingChallenges.length > 0) {
        throw new Error(`Unknown challenge ID: ${missingChallenges[0]}`)
      }
      const waypoint = WaypointSchema.parse({
        waypointId: existing.waypointId,
        title: action.input.title,
        description: action.input.description,
        category: action.input.category,
        tags: action.input.tags,
        challengeIds: action.input.challengeIds,
        completion: action.input.completion,
        location: action.input.location,
        referenceIds: refs.referenceIds,
        photoReferenceIds: photos.photoReferenceIds,
      })
      const next = pruneUnreferenced({
        ...data,
        waypoints: data.waypoints.map((item) => (item.waypointId === action.waypointId ? waypoint : item)),
        references: refs.references,
        photoReferences: photos.photoReferences,
      })
      next.activities
        .filter((activity) => activity.waypointId === waypoint.waypointId)
        .forEach((activity) => validateActivityCategory(next, activity))
      return next
    }
    case 'delete-waypoint':
      return pruneUnreferenced({
        ...data,
        waypoints: data.waypoints.filter((waypoint) => waypoint.waypointId !== action.waypointId),
        ideas: data.ideas.map((idea) => ({
          ...idea,
          waypointIds: idea.waypointIds.filter((waypointId) => waypointId !== action.waypointId),
        })),
        activities: data.activities.map((activity) => {
          if (activity.waypointId !== action.waypointId) return activity
          const { waypointId: _removed, ...detached } = activity
          return detached
        }),
      })
    case 'add-activity': {
      const refs = upsertReferences(data, action.input.references)
      const photos = upsertPhotoReferences(data, action.input.photoReferences)
      const category = action.input.category
      const activity = ensureCategoryEligibility(
        data,
        createActivity({
          activityId: action.activityId,
          name: action.input.name,
          waypointId: action.input.waypointId,
          ideaIds: action.input.ideaIds,
          date: action.input.date,
          category,
          location: action.input.location,
          recordedTrack: action.input.recordedTrack,
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
          name: action.input.name,
          createdAt: existing.createdAt,
          updatedAt,
          waypointId: action.input.waypointId,
          ideaIds: action.input.ideaIds,
          date: action.input.date,
          category: action.input.category,
          location: action.input.location,
          recordedTrack: action.input.recordedTrack,
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
    case 'add-idea': {
      const refs = upsertReferences(data, action.input.references)
      const idea = createIdea({
        title: action.input.title,
        description: action.input.description,
        notes: action.input.notes,
        waypointIds: action.input.waypointIds,
        planningState: action.input.planningState,
        rejectionReason: action.input.rejectionReason,
        difficulty: action.input.difficulty,
        location: action.input.location,
        referenceIds: refs.referenceIds,
      })
      return pruneUnreferenced({ ...data, ideas: [...data.ideas, idea], references: refs.references })
    }
    case 'update-idea': {
      const existing = data.ideas.find((idea) => idea.ideaId === action.ideaId)
      if (!existing) throw new Error('Idea not found')
      const now = new Date()
      const updatedAt =
        now.toISOString() > existing.updatedAt ? now.toISOString() : new Date(now.getTime() + 1).toISOString()
      const refs = upsertReferences(data, action.input.references)
      const updated = createIdea({
        ideaId: existing.ideaId,
        createdAt: existing.createdAt,
        updatedAt,
        title: action.input.title,
        description: action.input.description,
        notes: action.input.notes,
        waypointIds: action.input.waypointIds,
        planningState: action.input.planningState,
        rejectionReason: action.input.rejectionReason,
        difficulty: action.input.difficulty,
        location: action.input.location,
        referenceIds: refs.referenceIds,
      })
      return pruneUnreferenced({
        ...data,
        ideas: data.ideas.map((idea) => (idea.ideaId === action.ideaId ? updated : idea)),
        references: refs.references,
      })
    }
    case 'delete-idea':
      return pruneUnreferenced({
        ...data,
        ideas: data.ideas.filter((idea) => idea.ideaId !== action.ideaId),
        activities: data.activities.map((activity) => ({
          ...activity,
          ideaIds: activity.ideaIds.filter((ideaId) => ideaId !== action.ideaId),
        })),
      })
    default:
      return data
  }
}

export function WaypointsProvider({ children }: { children: ReactNode }) {
  const localTestMode = import.meta.env.MODE === 'test'
  const initialDataMode = getDataMode(import.meta.env.VITE_DEFAULT_DATA_MODE)
  const emptyData = (): WaypointsData => ({
    waypoints: [],
    challenges: [],
    ideas: [],
    activities: [],
    references: [],
    photoReferences: [],
  })
  const initialData = () => {
    if (initialDataMode === 'demo-local') return createDemoModeData()
    if (localTestMode && initialDataMode === 'production') return load()
    return emptyData()
  }
  const [data, dispatch] = useReducer(reducer, undefined, initialData)
  const [dataMode, setDataModeState] = useState<JourneyDataMode>(initialDataMode)
  const [activeDataMode, setActiveDataMode] = useState<JourneyDataMode>(initialDataMode)
  const [loadState, setLoadState] = useState<JourneyLoadState>({ status: 'loading' })
  const loading = loadState.status === 'loading'
  const [etags, setEtags] = useState<Record<string, string>>({})
  const [role, setRole] = useState<AccessRole>('local')
  const loadGeneration = useRef(0)
  const pendingCount = useRef(0)
  const [mutationPending, setMutationPending] = useState(false)
  const drafts = useRef(new Set<symbol>())
  const registerDraft = useCallback((id: symbol, dirty: boolean) => {
    if (dirty) drafts.current.add(id)
    else drafts.current.delete(id)
    return () => {
      drafts.current.delete(id)
    }
  }, [])
  const confirmNavigation = useCallback((destination: string) => {
    if (pendingCount.current > 0) return false
    if (drafts.current.size === 0) return true
    if (!window.confirm(`You have unsaved changes. Discard them and continue to ${destination}?`)) return false
    drafts.current.clear()
    return true
  }, [])
  const runMutation = useCallback(async <T,>(operation: () => Promise<T>): Promise<T> => {
    pendingCount.current += 1
    setMutationPending(true)
    try {
      return await operation()
    } finally {
      pendingCount.current -= 1
      setMutationPending(pendingCount.current > 0)
    }
  }, [])
  const apply = useCallback((loaded: { data: WaypointsData; etags: Record<string, string>; role: AccessRole }) => {
    dispatch({ type: 'restore', data: loaded.data })
    setEtags(loaded.etags)
    setRole(loaded.role)
  }, [])
  const loadMode = useCallback(
    async (mode: JourneyDataMode): Promise<ReloadResult> => {
      const generation = loadGeneration.current + 1
      loadGeneration.current = generation
      setLoadState({ status: 'loading' })
      const settle = (
        loaded: { data: WaypointsData; etags: Record<string, string>; role: AccessRole },
        active: JourneyDataMode,
        error?: string,
      ): ReloadResult => {
        if (loadGeneration.current !== generation) return { status: 'superseded' }
        apply(loaded)
        setActiveDataMode(active)
        setLoadState(error ? { status: 'loaded', warning: error } : { status: 'loaded' })
        return error ? { status: 'failure', message: error } : { status: 'success' }
      }
      const fail = (active: JourneyDataMode, error: string): ReloadResult => {
        if (loadGeneration.current !== generation) return { status: 'superseded' }
        setActiveDataMode(active)
        setLoadState({ status: 'failed', message: error })
        return { status: 'failure', message: error }
      }

      if (mode === 'demo-local') {
        return settle({ data: createDemoModeData(), etags: {}, role: 'local' }, 'demo-local')
      }

      if (localTestMode && mode === 'production') {
        return settle({ data: load(), etags: {}, role: 'local' }, 'production')
      }

      try {
        return settle(await loadJourney(mode === 'demo-cosmos' ? 'demo' : 'production'), mode)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (mode === 'demo-cosmos') {
          return settle(
            { data: createDemoModeData(), etags: {}, role: 'local' },
            'demo-local',
            `Demo Cosmos could not be loaded, so read-only local demo data is shown: ${message}`,
          )
        }
        return fail(
          'production',
          `Production data could not be loaded. Check the Journey API and Cosmos configuration: ${message}`,
        )
      }
    },
    [apply, localTestMode],
  )
  const reload = useCallback(async () => loadMode(dataMode), [dataMode, loadMode])
  const changeDataMode = useCallback(
    async (mode: JourneyDataMode) => {
      if (pendingCount.current > 0) throw new Error('Cannot switch data modes while a Journey mutation is pending.')
      if (mode === dataMode) return 'switched' as const
      if (!confirmNavigation('another data mode')) return 'cancelled' as const
      saveDataMode(mode)
      setDataModeState(mode)
      return 'switched' as const
    },
    [confirmNavigation, dataMode],
  )
  useEffect(() => {
    if (localTestMode && dataMode === 'production' && activeDataMode === 'production') save(data)
  }, [activeDataMode, data, dataMode, localTestMode])
  useEffect(() => {
    void reload()
  }, [reload])
  const value = useMemo<WaypointsValue>(() => {
    const loadError =
      loadState.status === 'failed' ? loadState.message : loadState.status === 'loaded' ? loadState.warning : undefined
    const readOnly =
      loading ||
      role === 'viewer' ||
      activeDataMode === 'demo-local' ||
      (dataMode === 'production' && loadState.status === 'failed')
    const writableContainer = (): JourneyContainer => {
      if (loading)
        throw new Error('Journey data is still loading. Wait for the selected data mode before making changes.')
      if (activeDataMode === 'demo-local') throw new Error('Demo local data is read-only.')
      if (loadState.status === 'failed') throw new Error('Production data is not loaded. Reload before making changes.')
      if (role !== 'admin') {
        if (role === 'viewer') throw new Error('Viewer access is read-only.')
        if (!(localTestMode && dataMode === 'production'))
          throw new Error('Journey role is not authorized to modify data.')
      }
      if (activeDataMode === 'demo-cosmos') return 'demo'
      return 'production'
    }
    const persist = async (container: JourneyContainer, action: Action, next: WaypointsData) => {
      validateAwardTransition(data, next)
      DataSchema.parse(next)
      if (localTestMode && dataMode === 'production') dispatch(action)
      else apply({ ...(await replaceJourney(container, next, etags)), role })
    }

    const mutations = {
      addChallenge: async (
        input: Pick<Challenge, 'title' | 'description' | 'supportsActivityCategories' | 'awardDescriptions'>,
      ) => {
        const container = writableContainer()
        const action = {
          type: 'add-challenge' as const,
          input: ChallengeSchema.parse({
            challengeId: crypto.randomUUID(),
            title: input.title.trim(),
            description: input.description.trim(),
            supportsActivityCategories: input.supportsActivityCategories,
            ...(input.awardDescriptions ? { awardDescriptions: input.awardDescriptions } : {}),
          }),
        }
        await persist(container, action, reducer(data, action))
      },
      updateChallengeAwards: async (
        challengeId: string,
        input: Pick<Challenge, 'supportsActivityCategories' | 'awardDescriptions'>,
      ) => {
        const container = writableContainer()
        const action = { type: 'update-challenge-awards' as const, challengeId, input }
        await persist(container, action, reducer(data, action))
      },
      deleteChallenge: async (challengeId: string) => {
        const container = writableContainer()
        const action = { type: 'delete-challenge' as const, challengeId }
        const next = reducer(data, action)
        validateAwardTransition(data, next)
        DataSchema.parse(next)
        if (localTestMode && dataMode === 'production') {
          dispatch(action)
          return
        }
        const etag = etags[challengeId]
        if (!etag) throw new Error(`Challenge "${challengeId}" has no ETag for delete.`)
        await deleteJourneyEntity(container, 'challenge', challengeId, etag)
        apply({ ...(await loadJourney(container)), role })
      },
      updateChallengeRoute: async (challengeId: string, plannedRoute?: PlannedRoute) => {
        const container = writableContainer()
        const action = { type: 'update-challenge-route' as const, challengeId, plannedRoute }
        await persist(container, action, reducer(data, action))
      },
      addWaypoint: async (input: WaypointDraft) => {
        const container = writableContainer()
        const action = { type: 'add-waypoint' as const, input }
        const next = reducer(data, action)
        await persist(container, action, next)
      },
      updateWaypoint: async (waypointId: string, input: WaypointDraft) => {
        const container = writableContainer()
        const action = { type: 'update-waypoint' as const, waypointId, input }
        const next = reducer(data, action)
        await persist(container, action, next)
      },
      deleteWaypoint: async (waypointId: string) => {
        const container = writableContainer()
        const action = { type: 'delete-waypoint' as const, waypointId }
        if (!data.waypoints.some((waypoint) => waypoint.waypointId === waypointId))
          throw new Error('Waypoint not found')
        const next = reducer(data, action)
        validateAwardTransition(data, next)
        DataSchema.parse(next)
        if (localTestMode && dataMode === 'production') {
          dispatch(action)
          return
        }
        const etag = etags[waypointId]
        if (!etag) throw new Error(`Waypoint "${waypointId}" has no ETag for delete.`)
        await deleteJourneyEntity(container, 'waypoint', waypointId, etag)
        apply({ ...(await loadJourney(container)), role })
      },
      addActivity: async (input: ActivityDraft) => {
        const container = writableContainer()
        const activityId = crypto.randomUUID()
        const action = { type: 'add-activity' as const, activityId, input }
        const next = reducer(data, action)
        await persist(container, action, next)
        return activityId
      },
      updateActivity: async (activityId: string, input: ActivityDraft) => {
        const container = writableContainer()
        const action = { type: 'update-activity' as const, activityId, input }
        const next = reducer(data, action)
        await persist(container, action, next)
      },
      deleteActivity: async (activityId: string) => {
        const container = writableContainer()
        const action = { type: 'delete-activity' as const, activityId }
        const next = reducer(data, action)
        await persist(container, action, next)
      },
      addIdea: async (input: IdeaDraft) => {
        const container = writableContainer()
        const action = { type: 'add-idea' as const, input }
        const next = reducer(data, action)
        await persist(container, action, next)
      },
      updateIdea: async (ideaId: string, input: IdeaDraft) => {
        const container = writableContainer()
        const action = { type: 'update-idea' as const, ideaId, input }
        const next = reducer(data, action)
        await persist(container, action, next)
      },
      deleteIdea: async (ideaId: string) => {
        const container = writableContainer()
        const action = { type: 'delete-idea' as const, ideaId }
        const next = reducer(data, action)
        await persist(container, action, next)
      },
      restore: async (newData: WaypointsData) => {
        const container = writableContainer()
        if (localTestMode && dataMode === 'production') dispatch({ type: 'restore', data: newData })
        else apply({ ...(await importJourney(container, newData)), role })
      },
      clear: async () => {
        const container = writableContainer()
        if (localTestMode && dataMode === 'production') dispatch({ type: 'restore', data: emptyData() })
        else apply({ ...(await clearJourney(container)), role })
      },
    }
    const track =
      <Args extends unknown[], Result>(operation: (...args: Args) => Promise<Result>) =>
      (...args: Args) =>
        runMutation(() => operation(...args))
    return {
      data,
      dataMode,
      activeDataMode,
      readOnly,
      loading,
      role,
      loadError,
      loadState,
      setDataMode: changeDataMode,
      mutationPending,
      runMutation,
      registerDraft,
      confirmNavigation,
      addChallenge: track(mutations.addChallenge),
      updateChallengeAwards: track(mutations.updateChallengeAwards),
      deleteChallenge: track(mutations.deleteChallenge),
      updateChallengeRoute: track(mutations.updateChallengeRoute),
      addWaypoint: track(mutations.addWaypoint),
      updateWaypoint: track(mutations.updateWaypoint),
      deleteWaypoint: track(mutations.deleteWaypoint),
      addActivity: track(mutations.addActivity),
      updateActivity: track(mutations.updateActivity),
      deleteActivity: track(mutations.deleteActivity),
      addIdea: track(mutations.addIdea),
      updateIdea: track(mutations.updateIdea),
      deleteIdea: track(mutations.deleteIdea),
      restore: track(mutations.restore),
      clear: track(mutations.clear),
      reload,
      activitiesFor: (waypointId) => activitiesForWaypoint(data.activities, waypointId),
      statusFor: (waypointId) => statusForWaypoint(data.activities, waypointId),
    }
  }, [
    activeDataMode,
    apply,
    changeDataMode,
    data,
    dataMode,
    etags,
    loadState,
    loading,
    localTestMode,
    reload,
    role,
    mutationPending,
    runMutation,
    registerDraft,
    confirmNavigation,
  ])
  return (
    <Context.Provider value={value}>
      <Fragment key={dataMode}>{children}</Fragment>
    </Context.Provider>
  )
}

/** Presentational editors also work outside the application provider. */
export function useJourneyDraft(dirty: boolean) {
  const context = useContext(Context)
  const register = context?.registerDraft
  const id = useRef(Symbol('draft'))
  useLayoutEffect(() => register?.(id.current, dirty), [register, dirty])
}

export function useWaypoints() {
  const value = useContext(Context)
  if (!value) throw new Error('useWaypoints must be used inside WaypointsProvider')
  return value
}

export type { WaypointsData }
