import { createDemoData } from '../domain/visit'

export function createDemoTestData() {
  const data = createDemoData()
  return { ...data, ideas: [], activities: [] }
}
