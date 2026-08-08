# Dashboard

Route: `/` — implemented in `src/pages/Dashboard.tsx`.

## Purpose

Give an at-a-glance answer to "how far through the challenge am I?" by summarising progress across
every qualifying location.

## Supported actions

- View the number of locations completed (silver or gold) out of the total
- View a count card for each status: Not Started, Bronze, Silver, Gold
- View progress bars towards Bronze, Silver and Gold completion
- Review the most recently visited locations
- See how many locations are still not started
- Open suggested next locations from not-yet-started places

The Dashboard is read-only; all editing happens on a location's details page.

## Data read

- `locations` from `src/data/locations.ts` (the full reference list)
- The visit history from the journey context (`useJourney().data.visits`), loaded from local storage

## Data written

None.

## Rules and data flow

1. `JourneyProvider` loads and validates stored data on start-up.
2. A location's status is the highest status awarded by its visits; a location with no visits is
   `not-started`.
3. A location counts as complete when its status is `silver` or `gold`, matching the challenge
   rule that silver is the main completion level.
4. Status counts partition all locations, so the four counts always sum to the total.
5. Suggested next locations come from the first not-yet-started places in catalogue order.

## Future improvements

- Progress over time (visits per month)
- Breakdown by area or location category
