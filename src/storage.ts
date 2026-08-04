import { z } from 'zod'
import type { Status } from './data'

export type Visit = { status: Status; date: string; notes: string; photos: string[] }
export type JourneyData = Record<string, Visit>

const StatusSchema = z.enum(['not-started', 'bronze', 'silver', 'gold'])
const DataSchema = z.record(z.string(), z.object({
  status: StatusSchema,
  date: z.string(),
  notes: z.string(),
  photos: z.array(z.string()),
}))
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

export function parseImport(value: string): JourneyData {
  return DataSchema.parse(JSON.parse(value))
}
