import { createDemoData, type WaypointsData } from '../domain/visit'

export function createDemoTestData(): WaypointsData {
  const data = createDemoData()
  return { ...data, ideas: [], activities: [] }
}
