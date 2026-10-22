import type { Waypoint } from './visit'

type Location = Waypoint['location']

export function effectiveWaypointLocation(initial: Location, current: Location): Location {
  if (!current) return undefined
  const placeName = current.placeName?.trim() || undefined
  const addressOrRegion = current.addressOrRegion?.trim() || undefined
  const normalized = { ...current, placeName, addressOrRegion }
  const sameCoordinates = current.latitude === initial?.latitude && current.longitude === initial?.longitude
  const changedText =
    placeName !== (initial?.placeName?.trim() || undefined) ||
    addressOrRegion !== (initial?.addressOrRegion?.trim() || undefined)
  if (sameCoordinates && changedText) {
    if (!placeName && !addressOrRegion) return undefined
    return { ...normalized, latitude: undefined, longitude: undefined }
  }
  return normalized
}
