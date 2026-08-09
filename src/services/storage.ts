import { z } from 'zod'
import { locations } from '../data/locations'
import { createSeedData, DataSchema, type WaypointsData } from '../domain/visit'

export type Backup = { version: number; exportedAt: string; data: WaypointsData }

export const backupVersion = 1

const ImportSchema = z
  .object({
    version: z.literal(backupVersion),
    exportedAt: z.string(),
    data: DataSchema,
  })
  .strict()

const key = 'waypoints-v1'

export function createDefaultData(): WaypointsData {
  return createSeedData(locations)
}

export function load(): WaypointsData {
  const fallback = createDefaultData()
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return DataSchema.parse(JSON.parse(raw))
  } catch {
    return fallback
  }
}

export function save(data: WaypointsData) {
  localStorage.setItem(key, JSON.stringify(data))
}

export function createBackup(data: WaypointsData): Backup {
  return { version: backupVersion, exportedAt: new Date().toISOString(), data }
}

export function parseImport(value: string): WaypointsData {
  return ImportSchema.parse(JSON.parse(value)).data
}
