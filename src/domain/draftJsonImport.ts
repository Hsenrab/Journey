import { ZodError } from 'zod'
import {
  DifficultySchema,
  ExternalPhotoReferenceSchema,
  PlanningStateSchema,
  ReferenceSchema,
  WaypointSchema,
  createActivity,
  createIdea,
  type ActivityLocation,
  type AwardedStatus,
  type ExternalPhotoReference,
  type Idea,
  type Reference,
  type Waypoint,
} from './visit'

export type ActivityJsonImportDraft = {
  name?: string
  date: string
  notes: string
  category?: AwardedStatus
  location: ActivityLocation
  references: Array<Pick<Reference, 'title' | 'url' | 'description' | 'previewImageUrl'>>
  photoReferences: Array<Pick<ExternalPhotoReference, 'title' | 'url' | 'altText'>>
}

export type IdeaJsonImportDraft = {
  title: string
  description: string
  notes: string
  planningState: Idea['planningState']
  rejectionReason?: string
  difficulty: Idea['difficulty']
  location?: Idea['location']
  references: Array<Pick<Reference, 'title' | 'url' | 'description' | 'previewImageUrl'>>
}

export type WaypointJsonImportDraft = {
  title: string
  description: string
  category: string
  tags: string[]
  completion: Waypoint['completion']
  location?: Waypoint['location']
  references: Array<Pick<Reference, 'title' | 'url' | 'description' | 'previewImageUrl'>>
  photoReferences: Array<Pick<ExternalPhotoReference, 'title' | 'url' | 'altText'>>
}

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string; issues: string[] }

const activityForbiddenIdFields = new Set(['activityId', 'referenceId', 'photoReferenceId'])
const activityRequiredImportFields = ['date', 'notes', 'location', 'references', 'photoReferences'] as const
const activityAllowedImportFields = new Set([
  'name',
  'date',
  'notes',
  'category',
  'location',
  'references',
  'photoReferences',
])

const ideaForbiddenIdFields = new Set(['ideaId', 'referenceId'])
const ideaRequiredImportFields = ['title', 'description', 'notes', 'planningState', 'difficulty', 'references'] as const
const ideaAllowedImportFields = new Set([
  'title',
  'description',
  'notes',
  'planningState',
  'rejectionReason',
  'difficulty',
  'location',
  'references',
])
const ideaLocationAllowedFields = new Set([
  'placeName',
  'latitude',
  'longitude',
  'addressOrRegion',
  'source',
  'approximate',
])
const waypointLocationAllowedFields = new Set([
  'placeName',
  'latitude',
  'longitude',
  'addressOrRegion',
  'source',
  'approximate',
])
const activityPostcodeLocationAllowedFields = new Set(['kind', 'postcode', 'latitude', 'longitude'])
const activityCoordinateLocationAllowedFields = new Set(['kind', 'latitude', 'longitude'])
const waypointForbiddenIdFields = new Set(['waypointId', 'referenceId', 'photoReferenceId'])
const waypointRequiredImportFields = [
  'title',
  'description',
  'category',
  'tags',
  'completion',
  'references',
  'photoReferences',
] as const
const waypointAllowedImportFields = new Set([
  'title',
  'description',
  'category',
  'tags',
  'completion',
  'location',
  'references',
  'photoReferences',
])

export const activityImportExample: ActivityJsonImportDraft = {
  name: 'Sunrise balloon flight',
  date: '2026-08-16',
  notes:
    'Took an early-morning balloon flight over the Cotswolds. The pilot explained how the balloon was controlled, and the flight ended with a clear view of the sunrise above the fields.',
  location: { kind: 'postcode', postcode: 'GL54 2EN' },
  references: [
    {
      title: 'Flight details',
      url: 'https://example.com/flight',
      description: 'Operator details for the completed flight.',
    },
  ],
  photoReferences: [
    {
      title: 'Sunrise balloon flight',
      url: 'https://example.com/balloon.jpg',
      altText: 'A hot-air balloon above the Cotswolds at sunrise',
    },
  ],
}

export const ideaImportExample: IdeaJsonImportDraft = {
  title: 'Compare Cotswolds balloon flights',
  description: 'Research local sunrise flights and choose a suitable operator.',
  notes: 'Compare launch locations, weather rebooking terms, accessibility and total cost before booking.',
  planningState: 'active',
  difficulty: 2,
  location: {
    addressOrRegion: 'Cotswolds',
    source: 'Operator website',
    approximate: true,
  },
  references: [
    {
      title: 'Flight options',
      url: 'https://example.com/balloon-flights',
      description: 'Available launch areas, prices and booking terms.',
    },
  ],
}

export const waypointImportExample: WaypointJsonImportDraft = {
  title: 'Take a hot-air balloon ride',
  description: 'Experience a sunrise flight in a hot-air balloon and see the landscape from above.',
  category: 'Adventure',
  tags: ['ballooning', 'flight', 'bucket list'],
  completion: { mode: 'once' },
  location: {
    addressOrRegion: 'Cotswolds',
    source: 'Manual research',
    approximate: true,
  },
  references: [
    {
      title: 'Balloon ride details',
      url: 'https://example.com/balloon-ride',
      description: 'Flight format, launch area and practical requirements.',
    },
  ],
  photoReferences: [
    {
      title: 'Balloon flight',
      url: 'https://example.com/balloon.jpg',
      altText: 'A hot-air balloon floating over fields at sunrise',
    },
  ],
}

function parseObject(value: string): ParseResult<Record<string, unknown>> {
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    return { ok: false, error: 'Invalid JSON. Paste a valid JSON object.', issues: [] }
  }
  if (Array.isArray(parsed)) return { ok: false, error: 'Paste a single object, not an array.', issues: [] }
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'Paste a single object, not a primitive value.', issues: [] }
  }
  return { ok: true, value: parsed as Record<string, unknown> }
}

function collectForbiddenIdFields(
  value: unknown,
  forbiddenIdFields: ReadonlySet<string>,
  ids = new Set<string>(),
): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((entry) => {
      collectForbiddenIdFields(entry, forbiddenIdFields, ids)
    })
    return ids
  }
  if (!value || typeof value !== 'object') return ids

  Object.entries(value).forEach(([key, entry]) => {
    if (forbiddenIdFields.has(key)) ids.add(key)
    collectForbiddenIdFields(entry, forbiddenIdFields, ids)
  })
  return ids
}

function validateObjectKeys(
  payload: Record<string, unknown>,
  requiredFields: readonly string[],
  allowedFields: ReadonlySet<string>,
): ParseResult<Record<string, unknown>> {
  const missing = requiredFields.filter((key) => !(key in payload))
  if (missing.length > 0) {
    return {
      ok: false,
      error: `Missing required field${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}.`,
      issues: [],
    }
  }
  const unknownFields = Object.keys(payload).filter((key) => !allowedFields.has(key))
  if (unknownFields.length > 0) {
    return {
      ok: false,
      error: `Unexpected field${unknownFields.length === 1 ? '' : 's'}: ${unknownFields.join(', ')}.`,
      issues: [],
    }
  }
  return { ok: true, value: payload }
}

function normalizeReferences(value: unknown): unknown {
  if (!Array.isArray(value)) return value
  return value.map((entry) => {
    if (!entry || typeof entry !== 'object') return entry
    const reference = entry as Record<string, unknown>
    return {
      ...reference,
      description:
        typeof reference.description === 'string' && !reference.description.trim() ? undefined : reference.description,
      previewImageUrl:
        typeof reference.previewImageUrl === 'string' && !reference.previewImageUrl.trim()
          ? undefined
          : reference.previewImageUrl,
    }
  })
}

function zodIssues(error: ZodError): string[] {
  return error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
}

function unknownFieldsError(path: string, fields: string[]): string {
  return `${path}: Unexpected field${fields.length === 1 ? '' : 's'}: ${fields.join(', ')}.`
}

export function parseActivityDraftJson(value: string): ParseResult<ActivityJsonImportDraft> {
  const parsedObject = parseObject(value)
  if (!parsedObject.ok) return parsedObject

  const foundIds = Array.from(collectForbiddenIdFields(parsedObject.value, activityForbiddenIdFields))
  if (foundIds.length > 0) {
    return {
      ok: false,
      error: foundIds.map((id) => `Remove '${id}' — IDs are assigned automatically.`).join(' '),
      issues: [],
    }
  }

  const keys = validateObjectKeys(parsedObject.value, activityRequiredImportFields, activityAllowedImportFields)
  if (!keys.ok) return keys

  const payload = keys.value
  if (Array.isArray(payload.location)) {
    return {
      ok: false,
      error: 'JSON does not match the activity draft shape.',
      issues: ['location: Invalid input: expected object, received array'],
    }
  }
  if (payload.location && typeof payload.location === 'object' && !Array.isArray(payload.location)) {
    const location = payload.location as Record<string, unknown>
    if (location.kind !== 'postcode' && location.kind !== 'coordinates') {
      return {
        ok: false,
        error: 'JSON does not match the activity draft shape.',
        issues: [
          location.kind === undefined
            ? 'location.kind: Required.'
            : "location.kind: Expected 'postcode' or 'coordinates'.",
        ],
      }
    }
    const allowedLocationFields =
      location.kind === 'postcode' ? activityPostcodeLocationAllowedFields : activityCoordinateLocationAllowedFields
    const unknownLocationFields = Object.keys(location).filter((key) => !allowedLocationFields.has(key))
    if (unknownLocationFields.length > 0) {
      return {
        ok: false,
        error: 'JSON does not match the activity draft shape.',
        issues: [unknownFieldsError('location', unknownLocationFields)],
      }
    }
  }

  const normalizedReferences = normalizeReferences(payload.references)
  const normalizedPhotoReferences = Array.isArray(payload.photoReferences)
    ? payload.photoReferences.map((entry) => {
        if (!entry || typeof entry !== 'object') return entry
        const photoReference = entry as Record<string, unknown>
        return {
          ...photoReference,
          altText:
            typeof photoReference.altText === 'string' && !photoReference.altText.trim()
              ? undefined
              : photoReference.altText,
        }
      })
    : payload.photoReferences

  const references = ReferenceSchema.omit({ referenceId: true }).array().safeParse(normalizedReferences)
  const photoReferences = ExternalPhotoReferenceSchema.omit({ photoReferenceId: true })
    .array()
    .safeParse(normalizedPhotoReferences)
  const issues: string[] = []
  if (!references.success) issues.push(...zodIssues(references.error))
  if (!photoReferences.success) issues.push(...zodIssues(photoReferences.error))

  const category =
    typeof payload.category === 'string' && !payload.category.trim()
      ? undefined
      : (payload.category as AwardedStatus | undefined)

  try {
    createActivity({
      name: payload.name as string | undefined,
      date: payload.date as string,
      notes: payload.notes as string,
      ideaIds: [],
      category,
      location: payload.location as ActivityLocation,
      // Placeholder IDs are only used to validate the draft against persisted-entity schemas.
      referenceIds: references.success ? references.data.map((_, index) => `reference-${index}`) : [],
      photoReferenceIds: photoReferences.success
        ? photoReferences.data.map((_, index) => `photo-reference-${index}`)
        : [],
    })
  } catch (error) {
    if (error instanceof ZodError) issues.push(...zodIssues(error))
    else throw error
  }

  if (issues.length > 0 || !references.success || !photoReferences.success) {
    return { ok: false, error: 'JSON does not match the activity draft shape.', issues }
  }

  return {
    ok: true,
    value: {
      name: payload.name as string | undefined,
      date: payload.date as string,
      notes: payload.notes as string,
      category,
      location: payload.location as ActivityLocation,
      references: references.data,
      photoReferences: photoReferences.data,
    },
  }
}

export function parseIdeaDraftJson(value: string): ParseResult<IdeaJsonImportDraft> {
  const parsedObject = parseObject(value)
  if (!parsedObject.ok) return parsedObject

  const foundIds = Array.from(collectForbiddenIdFields(parsedObject.value, ideaForbiddenIdFields))
  if (foundIds.length > 0) {
    return {
      ok: false,
      error: foundIds.map((id) => `Remove '${id}' — IDs are assigned automatically.`).join(' '),
      issues: [],
    }
  }

  const keys = validateObjectKeys(parsedObject.value, ideaRequiredImportFields, ideaAllowedImportFields)
  if (!keys.ok) return keys

  const payload = keys.value
  if (Array.isArray(payload.location)) {
    return {
      ok: false,
      error: 'JSON does not match the idea draft shape.',
      issues: ['location: Invalid input: expected object, received array'],
    }
  }
  if (payload.location && typeof payload.location === 'object' && !Array.isArray(payload.location)) {
    const location = payload.location as Record<string, unknown>
    const unknownLocationFields = Object.keys(location).filter((key) => !ideaLocationAllowedFields.has(key))
    if (unknownLocationFields.length > 0) {
      return {
        ok: false,
        error: 'JSON does not match the idea draft shape.',
        issues: [unknownFieldsError('location', unknownLocationFields)],
      }
    }
  }

  const normalizedReferences = normalizeReferences(payload.references)
  const references = ReferenceSchema.omit({ referenceId: true }).array().safeParse(normalizedReferences)
  const planningState = PlanningStateSchema.safeParse(payload.planningState)
  const difficulty = DifficultySchema.safeParse(payload.difficulty)
  const issues: string[] = []
  if (!references.success) issues.push(...zodIssues(references.error))
  if (!planningState.success) issues.push(...zodIssues(planningState.error))
  if (!difficulty.success) issues.push(...zodIssues(difficulty.error))

  const rejectionReason =
    typeof payload.rejectionReason === 'string' && !payload.rejectionReason.trim()
      ? undefined
      : (payload.rejectionReason as string | undefined)
  const location = (() => {
    if (!payload.location || typeof payload.location !== 'object')
      return payload.location as Idea['location'] | undefined
    const rawLocation = payload.location as Record<string, unknown>
    return {
      placeName:
        typeof rawLocation.placeName === 'string' && !rawLocation.placeName.trim()
          ? undefined
          : (rawLocation.placeName as string | undefined),
      addressOrRegion:
        typeof rawLocation.addressOrRegion === 'string' && !rawLocation.addressOrRegion.trim()
          ? undefined
          : (rawLocation.addressOrRegion as string | undefined),
      source:
        typeof rawLocation.source === 'string' && !rawLocation.source.trim()
          ? undefined
          : (rawLocation.source as string | undefined),
      latitude: rawLocation.latitude as number | undefined,
      longitude: rawLocation.longitude as number | undefined,
      approximate: rawLocation.approximate as boolean | undefined,
    } satisfies Idea['location']
  })()

  try {
    createIdea({
      title: payload.title as string,
      description: payload.description as string,
      notes: payload.notes as string,
      waypointIds: [],
      planningState: payload.planningState as Idea['planningState'],
      rejectionReason,
      difficulty: payload.difficulty as Idea['difficulty'],
      location,
      // Placeholder IDs are only used to validate the draft against persisted-entity schemas.
      referenceIds: references.success ? references.data.map((_, index) => `reference-${index}`) : [],
    })
  } catch (error) {
    if (error instanceof ZodError) issues.push(...zodIssues(error))
    else throw error
  }

  if (issues.length > 0 || !references.success || !planningState.success || !difficulty.success) {
    return { ok: false, error: 'JSON does not match the idea draft shape.', issues }
  }

  return {
    ok: true,
    value: {
      title: payload.title as string,
      description: payload.description as string,
      notes: payload.notes as string,
      planningState: payload.planningState as Idea['planningState'],
      rejectionReason,
      difficulty: payload.difficulty as Idea['difficulty'],
      location,
      references: references.data,
    },
  }
}

export function parseWaypointDraftJson(value: string): ParseResult<WaypointJsonImportDraft> {
  const parsedObject = parseObject(value)
  if (!parsedObject.ok) return parsedObject

  const foundIds = Array.from(collectForbiddenIdFields(parsedObject.value, waypointForbiddenIdFields))
  if (foundIds.length > 0) {
    return {
      ok: false,
      error: foundIds.map((id) => `Remove '${id}' — IDs are assigned automatically.`).join(' '),
      issues: [],
    }
  }

  const keys = validateObjectKeys(parsedObject.value, waypointRequiredImportFields, waypointAllowedImportFields)
  if (!keys.ok) return keys

  const payload = keys.value
  if (Array.isArray(payload.location)) {
    return {
      ok: false,
      error: 'JSON does not match the waypoint draft shape.',
      issues: ['location: Invalid input: expected object, received array'],
    }
  }
  if (payload.location && typeof payload.location === 'object' && !Array.isArray(payload.location)) {
    const location = payload.location as Record<string, unknown>
    const unknownLocationFields = Object.keys(location).filter((key) => !waypointLocationAllowedFields.has(key))
    if (unknownLocationFields.length > 0) {
      return {
        ok: false,
        error: 'JSON does not match the waypoint draft shape.',
        issues: [unknownFieldsError('location', unknownLocationFields)],
      }
    }
  }

  const normalizedReferences = normalizeReferences(payload.references)
  const normalizedPhotoReferences = Array.isArray(payload.photoReferences)
    ? payload.photoReferences.map((entry) => {
        if (!entry || typeof entry !== 'object') return entry
        const photoReference = entry as Record<string, unknown>
        return {
          ...photoReference,
          altText:
            typeof photoReference.altText === 'string' && !photoReference.altText.trim()
              ? undefined
              : photoReference.altText,
        }
      })
    : payload.photoReferences

  const references = ReferenceSchema.omit({ referenceId: true }).array().safeParse(normalizedReferences)
  const photoReferences = ExternalPhotoReferenceSchema.omit({ photoReferenceId: true })
    .array()
    .safeParse(normalizedPhotoReferences)
  const issues: string[] = []
  if (!references.success) issues.push(...zodIssues(references.error))
  if (!photoReferences.success) issues.push(...zodIssues(photoReferences.error))

  const location = (() => {
    if (!payload.location || typeof payload.location !== 'object')
      return payload.location as Waypoint['location'] | undefined
    const rawLocation = payload.location as Record<string, unknown>
    return {
      placeName:
        typeof rawLocation.placeName === 'string' && !rawLocation.placeName.trim()
          ? undefined
          : (rawLocation.placeName as string | undefined),
      addressOrRegion:
        typeof rawLocation.addressOrRegion === 'string' && !rawLocation.addressOrRegion.trim()
          ? undefined
          : (rawLocation.addressOrRegion as string | undefined),
      source:
        typeof rawLocation.source === 'string' && !rawLocation.source.trim()
          ? undefined
          : (rawLocation.source as string | undefined),
      latitude: rawLocation.latitude as number | undefined,
      longitude: rawLocation.longitude as number | undefined,
      approximate: rawLocation.approximate as boolean | undefined,
    } satisfies Waypoint['location']
  })()

  const waypoint = WaypointSchema.safeParse({
    waypointId: 'waypoint-import',
    title: payload.title as string,
    description: payload.description as string,
    category: payload.category as string,
    tags: payload.tags as string[],
    challengeIds: [],
    completion: payload.completion as Waypoint['completion'],
    location,
    // Placeholder IDs are only used to validate the draft against persisted-entity schemas.
    referenceIds: references.success ? references.data.map((_, index) => `reference-${index}`) : [],
    photoReferenceIds: photoReferences.success
      ? photoReferences.data.map((_, index) => `photo-reference-${index}`)
      : [],
  })
  if (!waypoint.success) issues.push(...zodIssues(waypoint.error))

  if (issues.length > 0 || !references.success || !photoReferences.success || !waypoint.success) {
    return { ok: false, error: 'JSON does not match the waypoint draft shape.', issues }
  }

  return {
    ok: true,
    value: {
      title: payload.title as string,
      description: payload.description as string,
      category: payload.category as string,
      tags: payload.tags as string[],
      completion: waypoint.data.completion,
      location,
      references: references.data,
      photoReferences: photoReferences.data,
    },
  }
}
