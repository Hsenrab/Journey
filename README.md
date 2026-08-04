# National Trust Tracker

A private, browser-only tracker for qualifying National Trust visitor destinations across the UK.
It records which places have been visited, how completely they were explored, and keeps notes and
photo references alongside each visit. Distance and drive time from Brockworth, Gloucester support
proximity filtering and sorting.

## Challenge rules

Locations qualify when they are publicly accessible National Trust visitor destinations with their
own visitor information page. Cafés, shops, offices, holiday cottages, standalone car parks,
non-public properties and non-qualifying tenant attractions are excluded.

## Status definitions

| Status        | Meaning                                                                  |
| ------------- | ------------------------------------------------------------------------ |
| `not-started` | No visit recorded.                                                       |
| `bronze`      | Physically visited.                                                      |
| `silver`      | Main visitor experience completed — the main challenge completion level. |
| `gold`        | Everything reasonably available to a normal visitor completed.           |

Dashboard progress counts a location as complete at `silver` or `gold`.

## Features

- Dashboard summary of progress across all qualifying locations
- Searchable, filterable and sortable location list
- Per-location visit logging (status, date, notes, photo references)
- JSON export and restore of all visit data from **Settings**
- Responsive MUI layout that works on phone and desktop

## Technical stack and version 1 non-goals

The agreed stack is React 19 + TypeScript (strict) + Vite, Material UI, React Router, Zod for
runtime validation, Vitest + Testing Library for tests, and Oxlint + Prettier for code quality.
Version 1 deliberately does **not** include Next.js, Redux, a server-side database,
authentication, maps, or photo upload storage. See [AGENTS.md](AGENTS.md) for the full
AI-friendly development conventions that keep the codebase predictable for agents and humans.

## Project structure

```
src/
  app/        Application shell: root App component, routing, theme
  components/ Shared presentation components (Layout)
  pages/      Route-level components (Dashboard, Locations, LocationDetails, Settings)
  features/   Feature state (journey/ tracking context)
  services/   Infrastructure (storage persistence and validation)
  domain/     Core types and business rules
  data/       Reference data (the list of locations)
  styles/     Global stylesheets
docs/         Documentation for pages, data, and deployment
infra/        Bicep template for the Azure Static Web App
```

## Run locally

Requires Node.js 20 or later.

```sh
npm install
npm run dev
```

The dev server prints a local URL (by default <http://localhost:5173>).

## Location catalogue

The qualifying National Trust location catalogue is committed reference data at
[`src/data/locations.json`](src/data/locations.json). It is loaded and validated at
startup by [`src/data/locations.ts`](src/data/locations.ts), which parses the raw JSON
against the Zod schema defined in [`src/domain/location.ts`](src/domain/location.ts) and
returns a new, validated array without mutating the source JSON module. Invalid or
malformed records throw a descriptive Zod error rather than being silently accepted.

Each location record has:

| Field        | Description                                                                 |
| ------------ | --------------------------------------------------------------------------- |
| `locationId` | Stable, immutable identifier. Never derived from, or replaced by, `name`.   |
| `name`       | Display name of the property.                                               |
| `area`       | County or area, e.g. "Gloucestershire".                                     |
| `category`   | One of a fixed set of qualifying categories (see "Qualifying rules" below). |
| `travel`     | `{ distanceMiles, driveTimeMinutes }` — see "Travel reference point" below. |
| `url`        | Official National Trust visitor information page for the property.          |
| `notes`      | Free-text description of the property.                                      |
| `createdAt`  | ISO date the record was added to the catalogue.                             |
| `updatedAt`  | ISO date the record was last updated.                                       |

### Travel reference point

The catalogue aims to include all qualifying National Trust properties nationally — it is
not restricted to a travel boundary. Each record stores its distance and drive time from
**Brockworth, Gloucester** (GL3), the reference starting point for this app, so the
**Locations** page can filter and sort by proximity. `travel.distanceMiles` is the
straight-line distance from Brockworth to the location, and `travel.driveTimeMinutes` is
the typical road drive time. These figures are indicative, sourced from public mapping
services, and are only used for filtering/sorting and rough trip planning — they are not
turn-by-turn directions.

### Qualifying rules

Locations must be publicly accessible National Trust visitor destinations with their own
visitor information page. The catalogue **excludes**: cafés only, shops only, offices,
holiday cottages, standalone car parks, non-public properties, and non-qualifying tenant
attractions.

No precise home address or other personal details are committed to this repository.

## Checks and tests

| Command                | Purpose                             |
| ---------------------- | ----------------------------------- |
| `npm test`             | Run the Vitest suite                |
| `npm run lint`         | Run Oxlint                          |
| `npm run typecheck`    | Type-check without emitting         |
| `npm run format:check` | Verify Prettier formatting          |
| `npm run build`        | Type-check and build for production |
| `npm run preview`      | Preview the production build        |

## Data format

Visit data is a JSON object keyed by location id:

```json
{
  "dunham-massey": {
    "status": "silver",
    "date": "2026-04-12",
    "notes": "House and garden done, deer park next time.",
    "photos": ["https://example.com/photo.jpg"]
  }
}
```

Full details, including validation rules and backup/restore steps, are in
[docs/data.md](docs/data.md).

## Documentation

- [Dashboard](docs/pages/dashboard.md)
- [Locations](docs/pages/locations.md)
- [Visits (location details)](docs/pages/visits.md)
- [Settings](docs/pages/settings.md)
- [Data import, export, backup and restore](docs/data.md)
- [Deployment and operations](docs/deployment.md)

## Deploy

The GitHub Actions workflow (`.github/workflows/azure-static-web-apps.yml`) provisions the Azure
Static Web App from `infra/main.bicep` and publishes the Vite build. Pushes to `main` use the
`azure-prod` GitHub environment; all other branches use `azure-test`. Each environment must define:

- `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` — federated (OIDC) credentials for the `infra` job's Azure login.
- `AZURE_RESOURCE_GROUP`, `AZURE_STATIC_WEB_APP_NAME` — target resource group and Static Web App name for the Bicep deployment.

The `infra` job reads the deployment token straight from the Bicep deployment output and passes it
to the `deploy` job, so you do **not** need to set `AZURE_STATIC_WEB_APPS_API_TOKEN` manually.
Optionally, set `GH_ACTIONS_ADMIN_TOKEN` to a fine-grained PAT with `Secrets: write` access on this
repo if you want the workflow to also persist that token as the `AZURE_STATIC_WEB_APPS_API_TOKEN`
repository secret for reference; without it, that step is skipped with a warning and deployment
still succeeds using the Bicep output token directly. See [docs/deployment.md](docs/deployment.md)
for environments, rollback, backup and troubleshooting.

## Known limitations

- **Browser-local storage only.** All visit data lives in the local storage of the browser and
  profile used. It is not synchronised between devices, and clearing site data or using private
  browsing loses it. Export a JSON backup regularly.
- **Photo references, not photos.** Photos are stored as URLs or filenames only; no image is
  uploaded or hosted by the app.
- **No accounts or sharing.** There is no authentication, no server-side storage and no multi-user
  support; anyone with access to the browser profile can see and edit the data.
- **Static location list.** Locations are compiled into the app from `src/data/locations.ts`, so
  adding or amending a location requires a code change and redeploy.
- **No offline install.** There is no service worker or installable app support yet.
- Do not record secrets, precise home location information, or other personal data in notes.

## Roadmap

- Per-location checklists for the activities that make up silver and gold
- Photo thumbnails from linked references
- Optional cross-device sync or file-system backed storage
- Offline support and installable (PWA) experience
- Location data sourced from a maintained dataset rather than hard-coded values
- Richer progress statistics and visit history over time
