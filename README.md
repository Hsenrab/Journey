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
- The `/challenges` page presents the National Trust Challenge dashboard: overall
  completion percentage and completed waypoint count are the primary summary, with
  Bronze/Silver/Gold activity-category counts shown underneath as secondary
  information. Bronze/Silver/Gold describe how well an activity fits the challenge;
  they are not challenge completion milestones. Each category count links to a
  filtered Waypoints view (e.g. `/waypoints?status=bronze`).

## Data and validation

Shared domain validation lives in `src/domain/visit.ts` and is reused by UI + storage.

- Stable IDs are used for waypoints, challenges, ideas, activities, references,
  and external photo references.
- Activities require a non-empty location record before save/import.
- Waypoint/challenge/idea location data remains optional.
- Export/import uses a versioned portable JSON format.
- The app header includes a **Demo data** switch on every route. It loads a clearly
  fabricated sample data set from `src/data/demo.json` into a separate local storage
  partition, clearly marks when demo data is active,
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

## Hosted access

The hosted application uses Azure Static Web Apps' built-in Microsoft Entra ID
provider. Application and API routes require the custom `owner` role, assigned
through a Static Web Apps invitation. The linked Functions API validates the
Static Web Apps principal before accessing Azure Maps. Azure Maps must retain
`disableLocalAuth: true`; its browser and API access must use Microsoft Entra tokens
acquired with the Function App's managed identity, never shared keys or SAS tokens.

See [docs/operations.md](docs/operations.md) for environment configuration,
invitations, deployment verification, and sign-in troubleshooting.

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
