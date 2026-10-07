# Waypoints

Waypoints is a private planner for destinations, experiences, and activities. Real
data is persisted in Azure Cosmos DB through the authenticated Functions API.
Create challenges to organize your own waypoints around shared goals. Production starts
with an empty dataset; the bundled sample content is available only in the explicitly
labelled demo modes.

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
- Progress
- Ideas
- Activities
- Map
- Settings

## Progress

- The root route redirects to `/challenges`, so the app opens on the progress
  dashboard; the **Progress** navigation item and the app bar title lead to the same
  route.
- The `/challenges` page summarizes each challenge's completion and activity-category
  progress. Bronze/Silver/Gold describe how well an activity fits its challenge; they
  are not challenge completion milestones.

## Data and validation

Shared domain validation lives in `src/domain/visit.ts` and is reused by UI + storage.

- Stable IDs are used for waypoints, challenges, ideas, activities, references,
  and external photo references.
- Activities require a non-empty location record before save/import.
- Waypoint/challenge/idea location data remains optional.
- Export/import uses a versioned portable JSON format.
- The app header includes a **Data mode** selector on every route:
  **Demo local** loads the bundled `src/data/demo.json` fixture read-only, **Demo Cosmos**
  loads a temporary demo partition that is writable for admins and reseeded on
  redeploy, and **Production data** loads the persistent shared production partition.
  Viewers can read every shared dataset but cannot make changes.
- If Demo Cosmos cannot load, the app uses visible read-only Demo local fallback data for
  that session. Production load failures never fall back to demo data.
- Production has no bundled waypoint or challenge seed. Legacy browser-local records
  remain untouched; no local or Cosmos production data is migrated or deleted.
- Every page that hides write actions renders the shared `ReadOnlyNotice`, which names the
  read-only reason (local fallback, load error, viewer role or demo local) and links to
  Settings.
- Export is generated from the active dataset. Import is allowed only into an empty
  writable active dataset and is fully validated before writing.

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
provider. Application and API routes require exactly one custom Journey role,
assigned through a Static Web Apps invitation: `admin` has full access and
`viewer` is read-only. The linked Functions API validates the Static Web Apps
principal before accessing Azure Maps. Azure Maps must retain
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
- [UI guidelines](docs/UI_GUIDELINES.md)
- [Deployment and operations](docs/operations.md)
