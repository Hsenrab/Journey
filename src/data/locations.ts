import { parseLocations, type Location } from '../domain/location'
import rawLocations from './locations.json'

/**
 * The qualifying National Trust location catalogue, parsed and validated from
 * the committed `locations.json` reference data. Parsing always produces a
 * new array/objects, so the source JSON module is never mutated.
 */
export const locations: Location[] = parseLocations(rawLocations)
