# Locations

Route: `/locations` — implemented in `src/pages/Locations.tsx`.

## Purpose

Browse every qualifying location, see its current status, and navigate to a location to log or
review a visit.

## Supported actions

- Search by name, area or category
- Filter by maximum driving distance from Brockworth
- Filter by status (all, Not Started, Bronze, Silver, Gold)
- Sort by name, progress, distance (nearest first), travel time or last visit date
- Open a location's details page

## Data read

- `locations` from `src/data/locations.ts`
- Visit records from `useJourney().data`

## Data written

None. The page holds search, filter and sort choices in component state only, so they reset on
reload.

## Rules and data flow

1. Locations with no visit record are shown as `not-started`.
2. Search is case-insensitive and matches the combined name, area and category text.
3. Filtering is applied before sorting; sorting by name uses locale comparison, sorting by progress
   orders by status value, sorting by distance orders by road miles from Brockworth, sorting by
   travel time orders by estimated drive minutes, and sorting by last visit date shows newest visits
   first.
4. Each card links to `/locations/:id`, where the id is the stable identifier used as the storage
   key.

## Future improvements

- Persist the last used filters
- Group by area or allow a different travel reference point
- Show visit dates and note previews on the cards
