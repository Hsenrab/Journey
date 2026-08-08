import { z } from 'zod'
import { locations } from '../data/locations'
import { visitsSchema, type Visit } from '../domain/visit'

export type JourneyData = { visits: Visit[] }
export type Backup = { version: number; exportedAt: string; visits: Visit[] }

export const backupVersion = 1

const VisitListSchema = visitsSchema(locations.map((location) => location.locationId))
const DataSchema = z.object({ visits: VisitListSchema })
const ImportSchema = z
  .object({
    version: z.literal(backupVersion),
    exportedAt: z.string(),
    visits: VisitListSchema,
  })
  .strict()

const key = 'national-trust-tracker-v2'

export function load(): JourneyData {
  try {
    return DataSchema.parse(JSON.parse(localStorage.getItem(key) ?? '{"visits":[]}'))
  } catch {
    return { visits: [] }
  }
}

export function save(data: JourneyData) {
  localStorage.setItem(key, JSON.stringify(data))
}

export function createBackup(data: JourneyData): Backup {
  return { version: backupVersion, exportedAt: new Date().toISOString(), visits: data.visits }
}

export function parseImport(value: string): JourneyData {
  return { visits: ImportSchema.parse(JSON.parse(value)).visits }
}
