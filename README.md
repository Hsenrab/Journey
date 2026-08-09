# Waypoints

Waypoints is a private, browser-only planner for destinations, experiences, and activities.
The first built-in challenge is **National Trust**, represented directly as a challenge made
up of waypoints.

## Core concepts

- **Waypoint**: something worth doing (place, destination, skill, or activity).
- **Challenge**: a structured collection of waypoints with shared progress.
- **Idea**: inspiration or research that can link to waypoints/challenges or stand alone.
- **Activity**: something that actually happened. Activities can link to a waypoint,
  challenge, idea, or be independent.

See [docs/waypoints-model.md](docs/waypoints-model.md) for full definitions and examples.

## Product areas

Navigation includes:

- Waypoints
- Challenges
- Ideas
- Activities
- Map
- Settings

## National Trust implementation

- National Trust is modelled as a challenge (`national-trust`).
- National Trust catalogue entries are seeded as waypoints using
  `src/data/locations.json`.
- National Trust visits are saved as activities linked to waypoint/challenge IDs.
- Bronze/Silver/Gold progress remains available as challenge milestone language.

## Data and validation

Shared domain validation lives in `src/domain/visit.ts` and is reused by UI + storage.

- Stable IDs are used for waypoints, challenges, ideas, activities, references,
  and external photo references.
- Activities require a non-empty location record before save/import.
- Waypoint/challenge/idea location data remains optional.
- Export/import uses a versioned portable JSON format.
- The app header includes a **Demo data** switch on every route. It loads a linked sample
  data set in a separate local storage partition, clearly marks when demo data is active,
  and restores the personal partition when switched off.
- Export, restore, and clear actions operate on whichever partition is active; switching
  demo mode on or off does not overwrite the inactive partition.

### Backup format

```json
{
  "version": 1,
  "exportedAt": "2026-08-01T00:00:00.000Z",
  "data": {
    "waypoints": [],
    "challenges": [],
    "ideas": [],
    "activities": [],
    "references": [],
    "photoReferences": []
  }
}
```

## Run locally

Requires Node.js 24 or later.

```sh
npm ci
npm run dev
```

## Checks and tests

| Command                 | Purpose                             |
| ----------------------- | ----------------------------------- |
| `npm test`              | Run the Vitest suite                |
| `npm run test:coverage` | Run the Vitest suite with coverage  |
| `npm run test:e2e`      | Run the Playwright smoke tests      |
| `npm run lint`          | Run Oxlint                          |
| `npm run typecheck`     | Type-check without emitting         |
| `npm run format:check`  | Verify Prettier formatting          |
| `npm run build`         | Type-check and build for production |

## Documentation

- [Waypoints model and relationships](docs/waypoints-model.md)
- [Deployment and operations](docs/operations.md)
