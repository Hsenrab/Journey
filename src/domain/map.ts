import type { Activity, Status, Waypoint } from './visit'

export type Coordinates = { latitude: number; longitude: number }

export function waypointCoordinates(waypoint: Waypoint): Coordinates | undefined {
  const { latitude, longitude } = waypoint.location ?? {}
  return typeof latitude === 'number' && typeof longitude === 'number' ? { latitude, longitude } : undefined
}

export function activityCoordinates(activity: Activity): Coordinates | undefined {
  return activity.location.kind === 'coordinates'
    ? { latitude: activity.location.latitude, longitude: activity.location.longitude }
    : undefined
}

export function filterWaypointsByStatus(
  waypoints: Waypoint[],
  statuses: readonly Status[],
  statusFor: (waypointId: string) => Status,
): Waypoint[] {
  return waypoints.filter((waypoint) => statuses.includes(statusFor(waypoint.waypointId)))
}

export function distanceMiles(from: Coordinates, to: Coordinates): number {
  const radians = (value: number) => (value * Math.PI) / 180
  const earthRadiusMiles = 3958.8
  const latitudeDistance = radians(to.latitude - from.latitude)
  const longitudeDistance = radians(to.longitude - from.longitude)
  const a =
    Math.sin(latitudeDistance / 2) ** 2 +
    Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(longitudeDistance / 2) ** 2
  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function orderNearbyWaypoints(
  waypoints: Waypoint[],
  origin: Coordinates,
): Array<{ waypoint: Waypoint; distanceMiles: number }> {
  return waypoints
    .flatMap((waypoint) => {
      const coordinates = waypointCoordinates(waypoint)
      return coordinates ? [{ waypoint, distanceMiles: distanceMiles(origin, coordinates) }] : []
    })
    .sort((a, b) => a.distanceMiles - b.distanceMiles || a.waypoint.title.localeCompare(b.waypoint.title))
}
