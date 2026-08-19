import { z } from 'zod'
import { locations } from '../data/locations'
import { createDemoData, createSeedData, DataSchema, type WaypointsData } from '../domain/visit'

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
const demoKey = 'waypoints-demo-v1'
const demoModeKey = 'waypoints-demo-mode-v1'

export function createDefaultData(): WaypointsData {
  return createSeedData(locations)
}

export function createDemoModeData(): WaypointsData {
  return createDemoData()
}

export function isDemoModeEnabled(): boolean {
  return localStorage.getItem(demoModeKey) === 'true'
}

function activeKey(): string {
  return isDemoModeEnabled() ? demoKey : key
}

export function setDemoMode(enabled: boolean) {
  localStorage.setItem(demoModeKey, String(enabled))
  if (enabled && !localStorage.getItem(demoKey)) {
    localStorage.setItem(demoKey, JSON.stringify(createDemoModeData()))
  }
}

export function load(): WaypointsData {
  const fallback = isDemoModeEnabled() ? createDemoModeData() : createDefaultData()
  const raw = localStorage.getItem(activeKey())
  if (!raw) return fallback
  return DataSchema.parse(JSON.parse(raw))
}

export function save(data: WaypointsData) {
  localStorage.setItem(activeKey(), JSON.stringify(data))
}

export function createBackup(data: WaypointsData): Backup {
  return { version: backupVersion, exportedAt: new Date().toISOString(), data }
}

export function parseImport(value: string): WaypointsData {
  return ImportSchema.parse(JSON.parse(value)).data
}
