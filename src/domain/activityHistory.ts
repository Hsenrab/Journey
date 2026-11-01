import { activityTitle, locationSummary, type Activity, type Waypoint } from './visit'

export function filterActivityHistory(
  records: readonly Activity[],
  waypointById: ReadonlyMap<string, Waypoint>,
  query: string,
): Activity[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return records.filter((activity) => {
    const waypoint = activity.waypointId ? waypointById.get(activity.waypointId) : undefined
    const fields = [
      activityTitle(activity),
      activity.notes,
      locationSummary(activity.location),
      waypoint?.title ?? '',
    ].map((field) => field.toLowerCase())
    return words.every((word) => fields.some((field) => field.includes(word)))
  })
}
