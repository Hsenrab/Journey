import { z } from 'zod'
import { locations } from '../data/locations'
import { createDemoData, createSeedData, DataSchema, type WaypointsData } from '../domain/visit'

export type Backup = { version: number; exportedAt: string; data: WaypointsData }
export type JourneyDataMode = 'demo-local' | 'demo-cosmos' | 'production'

export const backupVersion = 1

const ImportSchema = z
  .object({
    version: z.literal(backupVersion),
    exportedAt: z.string(),
    data: DataSchema,
  })
  .strict()

const key = 'waypoints-v1'
const demoModeKey = 'waypoints-demo-mode-v1'
const dataModeKey = 'journey-data-mode-v1'
const dataModes = new Set<JourneyDataMode>(['demo-local', 'demo-cosmos', 'production'])

export function createDefaultData(): WaypointsData {
  return createSeedData(locations)
}

export function createDemoModeData(): WaypointsData {
  return createDemoData()
}

export function getDataMode(): JourneyDataMode {
  const stored = localStorage.getItem(dataModeKey)
  if (dataModes.has(stored as JourneyDataMode)) return stored as JourneyDataMode

  const legacyDemoMode = localStorage.getItem(demoModeKey)
  if (legacyDemoMode === 'true') {
    localStorage.setItem(dataModeKey, 'demo-local')
    return 'demo-local'
  }
  if (legacyDemoMode === 'false') {
    localStorage.setItem(dataModeKey, 'production')
    return 'production'
  }

  return 'production'
}

export function setDataMode(mode: JourneyDataMode) {
  localStorage.setItem(dataModeKey, mode)
}

export function isDemoModeEnabled(): boolean {
  return getDataMode() !== 'production'
}

export function setDemoMode(enabled: boolean) {
  setDataMode(enabled ? 'demo-local' : 'production')
  localStorage.setItem(demoModeKey, String(enabled))
}

export function load(): WaypointsData {
  if (getDataMode() !== 'production') return createDemoModeData()
  const fallback = createDefaultData()
  const raw = localStorage.getItem(key)
  if (!raw) return fallback
  return DataSchema.parse(JSON.parse(raw))
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
