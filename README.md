# React + TypeScript + Vite

# National Trust Tracker

A private, browser-only tracker for qualifying National Trust visitor destinations, with distance and drive time from Brockworth, Gloucester so you can filter or sort the catalogue by proximity.

## Run locally

```sh
npm install
npm run dev
```

`npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`, and `npm run build` validate the app. Visit records are stored only in browser local storage; use **Settings** to export or restore a JSON backup. See [AGENTS.md](AGENTS.md) for the full folder structure and development conventions.

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

## Deploy

The included GitHub Actions workflow (`.github/workflows/azure-static-web-apps.yml`) provisions the Azure Static Web App from `infra/main.bicep` and publishes the Vite build from `main`. It runs against the `azure-test` GitHub environment, which must define these secrets:

- `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` — federated (OIDC) credentials for the `infra` job's Azure login.
- `AZURE_RESOURCE_GROUP`, `AZURE_STATIC_WEB_APP_NAME` — target resource group and Static Web App name for the Bicep deployment.

The `infra` job reads the deployment token straight from the Bicep deployment output and passes it to the `deploy` job, so you do **not** need to set `AZURE_STATIC_WEB_APPS_API_TOKEN` manually. Optionally, set `GH_ACTIONS_ADMIN_TOKEN` to a fine-grained PAT with `Secrets: write` access on this repo if you want the workflow to also persist that token as the `AZURE_STATIC_WEB_APPS_API_TOKEN` repository secret for reference; without it, that step is skipped with a warning and deployment still succeeds using the Bicep output token directly.
This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
