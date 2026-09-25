import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
  importJourney,
  loadJourney,
  replaceJourney,
  type JourneyContainer,
} from '../../services/journeyApi'
import {
  activitiesForWaypoint,
  createActivity,
  createIdea,
  statusForWaypoint,
  validateActivityCategory,
  type Activity,
  type ActivityLocation,
  type AwardedStatus,
  type ExternalPhotoReference,
  type Idea,
  type Reference,
  type Waypoint,
  WaypointSchema,
  type Status,
  type WaypointsData,
} from '../../domain/visit'

type DraftReference = Pick<Reference, 'title' | 'url' | 'description' | 'previewImageUrl'> & { referenceId?: string }
type DraftPhotoReference = Pick<ExternalPhotoReference, 'title' | 'url' | 'altText'> & { photoReferenceId?: string }

type ReloadResult = { status: 'success' } | { status: 'failure'; message: string } | { status: 'superseded' }

export type ActivityDraft = {
  name?: string
  waypointId?: string
  ideaIds: string[]
  date: string
  category?: AwardedStatus
  location: ActivityLocation
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
  | { type: 'add-waypoint'; input: WaypointDraft }
  | { type: 'add-activity'; input: ActivityDraft }
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
  loadError?: string
  setDataMode: (mode: JourneyDataMode) => Promise<void>
  addWaypoint: (input: WaypointDraft) => Promise<void>
  addActivity: (input: ActivityDraft) => Promise<void>
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
  const cleaned = !activity.waypointId ? { ...activity, category: undefined } : activity
  validateActivityCategory(data, cleaned)
  return cleaned
}

function reducer(data: WaypointsData, action: Action): WaypointsData {
  switch (action.type) {
    case 'restore':
      return action.data
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
      const challenges = data.challenges.map((challenge) =>
        waypoint.challengeIds.includes(challenge.challengeId)
          ? {
              ...challenge,
              waypointIds: challenge.waypointIds.includes(waypoint.waypointId)
                ? challenge.waypointIds
                : [...challenge.waypointIds, waypoint.waypointId],
            }
          : challenge,
      )
      return pruneUnreferenced({
        ...data,
        waypoints: [...data.waypoints, waypoint],
        challenges,
        references: refs.references,
        photoReferences: photos.photoReferences,
      })
    }
    case 'add-activity': {
      const refs = upsertReferences(data, action.input.references)
      const photos = upsertPhotoReferences(data, action.input.photoReferences)
      const category = action.input.waypointId ? action.input.category : undefined
      const activity = ensureCategoryEligibility(
        data,
        createActivity({
          name: action.input.name,
          waypointId: action.input.waypointId,
          ideaIds: action.input.ideaIds,
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
          name: action.input.name,
          createdAt: existing.createdAt,
          updatedAt,
          waypointId: action.input.waypointId,
          ideaIds: action.input.ideaIds,
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
  const initialDataMode = getDataMode()
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
  const [loadError, setLoadError] = useState<string>()
  const [loading, setLoading] = useState(true)
  const [etags, setEtags] = useState<Record<string, string>>({})
  const loadGeneration = useRef(0)
  const apply = useCallback((loaded: { data: WaypointsData; etags: Record<string, string> }) => {
    dispatch({ type: 'restore', data: loaded.data })
    setEtags(loaded.etags)
  }, [])
  const loadMode = useCallback(
    async (mode: JourneyDataMode): Promise<ReloadResult> => {
      const generation = loadGeneration.current + 1
      loadGeneration.current = generation
      setLoading(true)
      const settle = (
        loaded: { data: WaypointsData; etags: Record<string, string> },
        active: JourneyDataMode,
        error?: string,
      ): ReloadResult => {
        if (loadGeneration.current !== generation) return { status: 'superseded' }
        apply(loaded)
        setActiveDataMode(active)
        setLoadError(error)
        setLoading(false)
        return error ? { status: 'failure', message: error } : { status: 'success' }
      }

      if (mode === 'demo-local') {
        return settle({ data: createDemoModeData(), etags: {} }, 'demo-local')
      }

      if (localTestMode && mode === 'production') {
        return settle({ data: load(), etags: {} }, 'production')
      }

      try {
        return settle(await loadJourney(mode === 'demo-cosmos' ? 'demo' : 'production'), mode)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (mode === 'demo-cosmos') {
          return settle(
            { data: createDemoModeData(), etags: {} },
            'demo-local',
            `Demo Cosmos could not be loaded, so read-only local demo data is shown: ${message}`,
          )
        }
        return settle(
          { data: emptyData(), etags: {} },
          'production',
          `Production data could not be loaded. Check the Journey API and Cosmos configuration: ${message}`,
        )
      }
    },
    [apply, localTestMode],
  )
  const reload = useCallback(async () => loadMode(dataMode), [dataMode, loadMode])
  const changeDataMode = useCallback(async (mode: JourneyDataMode) => {
    saveDataMode(mode)
    setDataModeState(mode)
  }, [])
  useEffect(() => {
    if (localTestMode && dataMode === 'production' && activeDataMode === 'production') save(data)
  }, [activeDataMode, data, dataMode, localTestMode])
  useEffect(() => {
    void reload()
  }, [reload])
  const value = useMemo<WaypointsValue>(() => {
    const readOnly = loading || activeDataMode === 'demo-local' || (dataMode === 'production' && Boolean(loadError))
    const writableContainer = (): JourneyContainer => {
      if (loading)
        throw new Error('Journey data is still loading. Wait for the selected data mode before making changes.')
      if (activeDataMode === 'demo-local') throw new Error('Demo local data is read-only.')
      if (activeDataMode === 'demo-cosmos') return 'demo'
      if (loadError) throw new Error('Production data is not loaded. Reload before making changes.')
      return 'production'
    }
    const persist = async (container: JourneyContainer, action: Action, next: WaypointsData) => {
      if (localTestMode && dataMode === 'production') dispatch(action)
      else apply(await replaceJourney(container, next, etags))
    }

    return {
      data,
      dataMode,
      activeDataMode,
      readOnly,
      loadError,
      setDataMode: changeDataMode,
      addWaypoint: async (input) => {
        const container = writableContainer()
        const action = { type: 'add-waypoint' as const, input }
        const next = reducer(data, action)
        await persist(container, action, next)
      },
      addActivity: async (input) => {
        const container = writableContainer()
        const action = { type: 'add-activity' as const, input }
        const next = reducer(data, action)
        await persist(container, action, next)
      },
      updateActivity: async (activityId, input) => {
        const container = writableContainer()
        const action = { type: 'update-activity' as const, activityId, input }
        const next = reducer(data, action)
        await persist(container, action, next)
      },
      deleteActivity: async (activityId) => {
        const container = writableContainer()
        const action = { type: 'delete-activity' as const, activityId }
        const next = reducer(data, action)
        await persist(container, action, next)
      },
      addIdea: async (input) => {
        const container = writableContainer()
        const action = { type: 'add-idea' as const, input }
        const next = reducer(data, action)
        await persist(container, action, next)
      },
      updateIdea: async (ideaId, input) => {
        const container = writableContainer()
        const action = { type: 'update-idea' as const, ideaId, input }
        const next = reducer(data, action)
        await persist(container, action, next)
      },
      deleteIdea: async (ideaId) => {
        const container = writableContainer()
        const action = { type: 'delete-idea' as const, ideaId }
        const next = reducer(data, action)
        await persist(container, action, next)
      },
      restore: async (newData) => {
        if (localTestMode && dataMode === 'production') dispatch({ type: 'restore', data: newData })
        else apply(await importJourney(writableContainer(), newData))
      },
      clear: async () => {
        if (localTestMode && dataMode === 'production') dispatch({ type: 'restore', data: emptyData() })
        else apply(await clearJourney(writableContainer()))
      },
      reload,
      activitiesFor: (waypointId) => activitiesForWaypoint(data.activities, waypointId),
      statusFor: (waypointId) => statusForWaypoint(data.activities, waypointId),
    }
  }, [activeDataMode, apply, changeDataMode, data, dataMode, etags, loadError, loading, localTestMode, reload])
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useWaypoints() {
  const value = useContext(Context)
  if (!value) throw new Error('useWaypoints must be used inside WaypointsProvider')
  return value
}

export type { WaypointsData }
