import { z } from 'zod'
import { locations } from '../data/locations'
import { visitsSchema, type Visit } from '../domain/visit'

export type JourneyData = { visits: Visit[] }

const knownLocationIds = locations.map((location) => location.locationId)

const DataSchema = z.object({ visits: visitsSchema(knownLocationIds) })

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

export function parseImport(value: string): JourneyData {
  return DataSchema.parse(JSON.parse(value))
}
