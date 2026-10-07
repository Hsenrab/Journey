import { z } from 'zod'
import { createDemoData, DataSchema, type WaypointsData } from '../domain/visit'

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
const dataModeKey = 'journey-data-mode-v1'
const dataModes = new Set<JourneyDataMode>(['demo-local', 'demo-cosmos', 'production'])

function requireProductionDataMode() {
  const mode = getDataMode()
  if (mode !== 'production')
    throw new Error(`load()/save() are only available in Production data mode; the current mode is ${mode}.`)
}

export function createDefaultData(): WaypointsData {
  return { waypoints: [], challenges: [], ideas: [], activities: [], references: [], photoReferences: [] }
}

export function createDemoModeData(): WaypointsData {
  return createDemoData()
}

export function getDataMode(defaultMode: string = 'production'): JourneyDataMode {
  if (!dataModes.has(defaultMode as JourneyDataMode))
    throw new Error(`Unknown default Journey data mode: ${defaultMode}`)

  const stored = localStorage.getItem(dataModeKey)
  if (dataModes.has(stored as JourneyDataMode)) {
    const storedMode = stored as JourneyDataMode
    return storedMode === 'production' && defaultMode !== 'production' ? (defaultMode as JourneyDataMode) : storedMode
  }

  return defaultMode as JourneyDataMode
}

export function setDataMode(mode: JourneyDataMode) {
  localStorage.setItem(dataModeKey, mode)
}

export function load(): WaypointsData {
  requireProductionDataMode()
  const fallback = createDefaultData()
  const raw = localStorage.getItem(key)
  if (!raw) return fallback
  return DataSchema.parse(JSON.parse(raw))
}

export function save(data: WaypointsData) {
  requireProductionDataMode()
  localStorage.setItem(key, JSON.stringify(data))
}

export function createBackup(data: WaypointsData): Backup {
  return { version: backupVersion, exportedAt: new Date().toISOString(), data }
}

export function parseImport(value: string): WaypointsData {
  return ImportSchema.parse(JSON.parse(value)).data
}
