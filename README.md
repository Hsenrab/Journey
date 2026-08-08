# National Trust Tracker

A private, browser-only tracker for qualifying National Trust visitor destinations reachable within
a maximum 2.5-hour one-way drive from Brockworth, Gloucester (GL3). It records which places have
been visited, how completely they were explored, and keeps notes and photo references alongside each
visit. Distance and drive time from Brockworth support proximity filtering and sorting.

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

`npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`, and `npm run build` validate the app. See [AGENTS.md](AGENTS.md) for the full folder structure and development conventions.

## Backup and restore

Visit records (status, date, notes and photo references) are stored only in this browser's local storage, separately from the committed location catalogue. Use **Settings** to manage them:

- **Export JSON** downloads `national-trust-tracker.json`, a versioned backup:

  ```json
  {
    "version": 1,
    "exportedAt": "2026-08-01T00:00:00.000Z",
    "visits": [
      {
        "visitId": "8f0d0f6e-2b4a-4f43-9f0f-6a1f6a5a1c2b",
        "locationId": "dyrham-park",
        "date": "2026-08-01",
        "status": "silver",
        "notes": "Great day",
        "photos": [],
        "createdAt": "2026-08-01T10:00:00.000Z",
        "updatedAt": "2026-08-01T10:00:00.000Z"
      }
    ]
  }
  ```

- **Restore JSON** picks a backup file and replaces your visit history with its contents. The file is parsed as data only — nothing in it is ever executed. Its type, structure, `version`, location IDs, dates, and status values are validated before anything is saved, so a malformed or unsupported file is rejected with an error and your existing data is left untouched.
- **Clear data** removes every visit from this browser after a confirmation prompt.

The `version` field allows future formats to be migrated; backups with any other version are rejected.

## Codespaces

The included dev container uses Node 22, installs the locked dependencies, and installs
the Playwright Chromium browser when a codespace is created. Start the development
server with `npm run dev`; Codespaces forwards port 5173 to an in-browser preview.

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

The committed catalogue contains 138 places with an estimated one-way drive time of no more than
150 minutes from **Brockworth, Gloucester** (GL3). `travel.distanceMiles` is an approximate road
distance used for sorting and display, while `travel.driveTimeMinutes` determines inclusion in the
challenge. These indicative figures support rough trip planning and are not turn-by-turn directions.

The list was assembled from National Trust regional visitor-place listings and known official place
pages, then filtered by approximate road travel time. Listings, openings and route times change, so
boundary or limited-opening places should be checked before visiting.

### Qualifying rules

Locations must be publicly accessible National Trust visitor destinations with their own
visitor information page and an estimated one-way drive time of 150 minutes or less from
Brockworth GL3. The catalogue **excludes**: cafés only, shops only, offices, holiday cottages,
standalone car parks, non-public properties, and non-qualifying tenant attractions.

No precise home address or other personal details are committed to this repository.

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
| `npm run preview`       | Preview the production build        |

GitHub Actions validates pull requests with linting, typechecking, format checks,
unit/component coverage, a production build, and Playwright smoke tests. CI can also
be started manually with the `workflow_dispatch` action.

The Azure workflow (`.github/workflows/azure-static-web-apps.yml`) provisions and
publishes production only from `main`. Pull requests publish to Static Web Apps'
temporary preview environments. Ordinary branch pushes do not deploy to Azure, so
branches cannot overwrite the shared test deployment.

Production Azure login uses GitHub OIDC from the `main` branch. Define these
repository-level secrets:

- `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` — federated (OIDC)
  credentials for Azure login.
- `AZURE_RESOURCE_GROUP`, `AZURE_STATIC_WEB_APP_NAME` — production deployment target.

Optional variables `AZURE_LOCATION` and `AZURE_RESOURCE_OWNER` override the region and
resource owner tag.

Two GitHub Actions workflows drive delivery:

- `.github/workflows/ci.yml` validates every pull request (install, format
  check, lint, type check, tests with coverage, build, and end-to-end smoke
  tests) and can be run manually. The deploy workflow reuses it via `workflow_call`.
- `.github/workflows/azure-static-web-apps.yml` deploys production only from `main` after
  validation, and publishes pull request previews without updating shared infrastructure.

The preview job still runs against the `azure-test` GitHub environment and, like the
production deploy job, authenticates via OIDC and reads its deployment token from Azure
at run time (masking it in the logs), using the same `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`,
`AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP`, and `AZURE_STATIC_WEB_APP_NAME` secrets
defined for that environment.

## Data format

Visits are stored in this browser's local storage as an append-only history; a location's status is
the highest status awarded by any of its visits:

```json
{
  "visits": [
    {
      "visitId": "8f0d0f6e-2b4a-4f43-9f0f-6a1f6a5a1c2b",
      "locationId": "may-hill",
      "date": "2026-04-12",
      "status": "silver",
      "notes": "Walked to the summit and the topograph.",
      "photos": ["https://example.com/photo.jpg"],
      "createdAt": "2026-04-12T18:00:00.000Z",
      "updatedAt": "2026-04-12T18:00:00.000Z"
    }
  ]
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
- [Deployment and operations](docs/operations.md)

## Deploy

`.github/workflows/azure-static-web-apps.yml` runs on pushes to `main`. It calls the CI workflow,
provisions the Azure Static Web App from `infra/main.bicep`, publishes the Vite build, and verifies
the site responds. Repository secrets must define `AZURE_CLIENT_ID`,
`AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` (federated OIDC credentials), `AZURE_RESOURCE_GROUP`, and
`AZURE_STATIC_WEB_APP_NAME`. Optional variables `AZURE_LOCATION` and `AZURE_RESOURCE_OWNER` override
the region and the owner tag. The Static Web Apps deployment token is read from Azure at run time and
masked, so it is never stored as a repository secret.

See [docs/operations.md](docs/operations.md) for environments, preview environments, rollback,
backup and restore, troubleshooting, and routine operational checks.

## Known limitations

- **Browser-local storage only.** All visit data lives in the local storage of the browser and
  profile used. It is not synchronised between devices, and clearing site data or using private
  browsing loses it. Export a JSON backup regularly.
- **Photo references, not photos.** Photos are stored as URLs or filenames only; no image is
  uploaded or hosted by the app.
- **No accounts or sharing.** There is no authentication, no server-side storage and no multi-user
  support; anyone with access to the browser profile can see and edit the data.
- **Static location list.** Locations are committed reference data in `src/data/locations.json`, so
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
