# Locations

Route: `/waypoints` — implemented in `src/pages/Locations.tsx`.

## Purpose

Browse every qualifying location, see its current status, and navigate to a location to log or
review a visit.

## Supported actions

- Search by name, area or category
- Filter by maximum driving distance from Brockworth
- Filter by status (all, Not Started, Bronze, Silver, Gold), area and category
- Sort by name, progress, distance (nearest first), travel time or last visit date
- Add a waypoint with the shared waypoint add form
- Open a location's details page

## Data read

- `locations` from `src/data/locations.ts`
- Waypoints and activities from `useWaypoints().data`, and derived statuses from `useWaypoints().statusFor`

## Data written

- Waypoint creation through `useWaypoints().addWaypoint`.

## Rules and data flow

1. Locations with no visits are shown as `not-started`; otherwise the highest status awarded by
   their visits is shown.
2. Search is case-insensitive and matches the combined name, area and category text.
3. Filtering is applied before sorting; sorting by name uses locale comparison, sorting by progress
   orders by status value, sorting by distance orders by road miles from Brockworth, sorting by
   travel time orders by estimated drive minutes, and sorting by last visit date shows newest visits
   first.
4. Add mode includes **Form** and **Paste JSON** tabs. Paste JSON accepts one waypoint draft object,
   rejects arrays, and rejects ID fields (`waypointId`, `referenceId`, `photoReferenceId`).
5. **Copy example JSON** copies a representative draft shape. **Load into form** validates the pasted
   JSON, keeps the pasted text on errors, and on success populates the existing form state before save.
6. An info icon next to the Waypoint JSON field opens a dialog with a ready-to-copy AI prompt describing
   the exact draft shape. Copy the prompt into an external AI tool (for example GitHub Copilot Chat or
   ChatGPT) alongside source material about the waypoint, then paste the AI's JSON response into Paste
   JSON.
7. Each card links to `/waypoints/:id`, where the id is the stable identifier used as the storage
   key.

### Waypoint Paste JSON draft example

```json
{
  "title": "Sunrise viewpoint",
  "description": "A local spot for early walks.",
  "category": "Scenic",
  "tags": ["sunrise"],
  "challengeIds": ["national-trust"],
  "completion": { "mode": "once" },
  "location": {
    "placeName": "Brockworth",
    "addressOrRegion": "Gloucestershire",
    "source": "Manual research",
    "approximate": true
  },
  "references": [{ "title": "Waypoint guide", "url": "https://example.com/guide" }],
  "photoReferences": [{ "title": "Waypoint photo", "url": "https://example.com/photo.jpg" }]
}
```

## Future improvements

- Persist the last used filters
- Group by area or allow a different travel reference point
- Show visit dates and note previews on the cards
