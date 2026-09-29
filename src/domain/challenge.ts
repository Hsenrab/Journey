import type { Activity, Challenge, Waypoint } from './visit'

export function challengeWaypoints(challenge: Challenge, waypoints: readonly Waypoint[]): Waypoint[] {
  return waypoints.filter(
    (waypoint) =>
      challenge.waypointIds.includes(waypoint.waypointId) || waypoint.challengeIds.includes(challenge.challengeId),
  )
}

export function challengeRecordedActivities(
  challenge: Challenge,
  waypoints: readonly Waypoint[],
  activities: readonly Activity[],
): Activity[] {
  const waypointIds = new Set(challengeWaypoints(challenge, waypoints).map((waypoint) => waypoint.waypointId))
  return activities.filter(
    (activity) => activity.recordedTrack && activity.waypointId && waypointIds.has(activity.waypointId),
  )
}
