import { parseLocations, type Location } from '../domain/location'
import rawLocations from './locations.json'

export const locations: Location[] = parseLocations(rawLocations)
export const MAX_DRIVE_TIME_MINUTES = 150
