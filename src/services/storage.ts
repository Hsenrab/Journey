import { z } from 'zod'
import { locations } from '../data/locations'
import type { Status } from '../domain/location'

export type Visit = { status: Status; date: string; notes: string; photos: string[] }
export type JourneyData = Record<string, Visit>
export type Backup = { version: number; exportedAt: string; visits: JourneyData }

export const backupVersion = 1

const StatusSchema = z.enum(['not-started', 'bronze', 'silver', 'gold'])
const DateSchema = z
  .string()
  .refine((value) => value === '' || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))), {
    message: 'Dates must be empty or in YYYY-MM-DD format',
  })
const VisitSchema = z
  .object({
    status: StatusSchema,
    date: DateSchema,
    notes: z.string(),
    photos: z.array(z.string()),
  })
  .strict()
const DataSchema = z.record(z.string(), VisitSchema)
const knownIds = new Set(locations.map((location) => location.id))
const ImportSchema = z
  .object({
    version: z.literal(backupVersion),
    exportedAt: z.string(),
    visits: DataSchema.refine((visits) => Object.keys(visits).every((id) => knownIds.has(id)), {
      message: 'Backup references unknown locations',
    }),
  })
  .strict()

const key = 'national-trust-tracker-v1'

export function load(): JourneyData {
  try {
    return DataSchema.parse(JSON.parse(localStorage.getItem(key) ?? '{}'))
  } catch {
    return {}
  }
}

export function save(data: JourneyData) {
  localStorage.setItem(key, JSON.stringify(data))
}

export function createBackup(data: JourneyData): Backup {
  return { version: backupVersion, exportedAt: new Date().toISOString(), visits: data }
}

export function parseImport(value: string): JourneyData {
  return ImportSchema.parse(JSON.parse(value)).visits
}
