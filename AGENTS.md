# AGENTS.md — development conventions

This document gives AI coding agents (and humans) the conventions needed to work
productively in this repository.

## Stack

- React 19 + TypeScript (strict mode) + Vite
- Material UI (MUI) for components and theming
- React Router for client-side routing
- Zod for runtime validation of persisted/imported data
- Vitest + Testing Library for tests
- Oxlint for linting, Prettier for formatting
- Azure Static Web Apps with Microsoft Entra ID authentication, a minimal linked
  Azure Functions API (`api/`), and Azure Cosmos DB for NoSQL for the explicitly
  approved managed-identity persistence boundary described in "Conventions" below
- Azure Maps Web SDK for the explicitly approved waypoint and activity map

## Project philosophy

This is a lightweight personal project. Optimize for code that is direct, obvious,
and easy to change, not for enterprise resilience, extensibility, or compatibility.

- Prefer the smallest implementation that clearly satisfies the current requirement.
  Do not add speculative abstractions, configuration, or future-proofing.
- Fail fast. Unexpected errors must retain their specific message and bubble to the
  application root. Do not catch them merely to log, retry, return a default, discard
  data, or keep the app running.
- Catch an error only at a boundary that can fully handle an expected condition, such
  as reporting invalid user input next to the action that caused it. Do not turn an
  unexpected failure into an apparently successful or empty state.
- Do not add fallbacks, degraded modes, retries, polyfills, or workarounds. If the
  requested behavior is not supported by the chosen stack or project constraints,
  state that limitation clearly in the relevant documentation or error message.
- Do not preserve backward compatibility unless the task explicitly requires it.
  Replace obsolete schemas, APIs, and behavior directly; remove their old paths and
  update affected tests and documentation in the same change.
- Prefer an obvious breaking failure over silently interpreting incompatible persisted
  or imported data. Add a migration only when explicitly requested.

## Commands

| Command                | Purpose                                        |
| ---------------------- | ---------------------------------------------- |
| `npm install`          | Install dependencies                           |
| `npm run dev`          | Start the Vite dev server                      |
| `npm run build`        | Type-check (`tsc -b`) and build for production |
| `npm run typecheck`    | Type-check only, no emit                       |
| `npm run lint`         | Run Oxlint                                     |
| `npm run format`       | Format the repo with Prettier                  |
| `npm run format:check` | Check formatting without writing changes       |
| `npm test`             | Run the Vitest test suite                      |
| `npm run preview`      | Preview the production build locally           |

The `api/` Functions project has its own `package.json` with equivalent `lint`,
`typecheck`, `test`, `test:coverage`, and `build` scripts, run from within `api/`.

## Agent execution

Agents must execute validation as part of the work. Do not stop after editing and tell
the user to run commands.

- Prefer built-in editor and source-control tools for reading, searching, diagnostics,
  edits, and final diff inspection. Use terminal commands for project scripts and for
  operations with no built-in equivalent; do not reproduce editor operations with
  `sed`, `cat`, `find`, or chains of Git inspection commands.
- During implementation, use editor diagnostics and run a targeted test only when it
  provides useful feedback. Do not run Prettier, lint, typecheck, coverage, builds,
  end-to-end tests, or broad validation suites as changes are made.
- Immediately before committing, trace the changed files to their impacted imports,
  callers, configuration consumers, build steps, and deployment paths. Run formatting
  and validate those impacted surfaces once instead of blindly checking every package
  or only directly edited files:
  - Documentation-only changes: diagnostics and formatting for changed files.
  - Workflow or configuration changes: syntax plus the scripts, packages, or deployment
    paths whose behavior changed. Do not run application tests merely because an
    unchanged workflow step references them.
  - Frontend code: lint, typecheck, and directly relevant tests. Add a build for
    build/configuration changes and end-to-end tests for affected user flows.
  - API code: run equivalent checks from `api/` without unrelated frontend checks.
  - Cross-cutting, dependency, release, push, or pull-request work: run the complete
    `.github/workflows/ci.yml` local sequence once.
- Run the selected formatting, static, and test checks once after implementation is
  complete and immediately before final diff review and commit. Do not repeat a
  successful check unless covered files changed afterward. Committing an already
  validated, unchanged working tree needs no additional test or lint pass.
- Run `npm ci` only when dependencies need installing or the lockfile changed. Install
  Playwright Chromium only when an end-to-end run requires it.
- Before committing, inspect the final diff and status once and stage only intended
  files. Run additional Git checks only to investigate a specific concern.
- Treat a failed command as a failure. Do not suppress it, weaken the check, alter test
  data to avoid it, or claim completion. Fix failures caused by the change; otherwise
  report the exact failing command and error as the blocker.
- GitHub-hosted workflow behavior that depends on Actions contexts, environments, OIDC,
  repository secrets, or artifact services cannot be faithfully run locally. Do not
  simulate it or claim it ran. State which GitHub-only steps remain for Actions when
  remote validation is relevant.
- When the user explicitly requests a push or remote validation, use the GitHub CLI to
  dispatch or monitor CI for the current branch, inspect the completed checks, and
  verify the pull request preview URL when the Azure workflow provides one. Do not
  claim preview validation if deployment did not run or no URL is available.
- Do not trigger `.github/workflows/azure-static-web-apps.yml`, push a branch, or deploy
  Azure resources unless the user explicitly requests that side effect.

## Folder structure

```
src/
  app/        Application shell: root App component, routing, theme
  components/ Shared, reusable presentation components (e.g. Layout)
  pages/      Route-level components (Dashboard, Locations, LocationDetails, Settings)
  features/   Feature-specific logic and state (e.g. journey/ tracking context)
  services/   Cross-cutting infrastructure (e.g. the authenticated Journey API)
  domain/     Core types and business rules, framework-agnostic
  data/       Static/reference data (e.g. the list of locations)
  styles/     Global stylesheets
  domain/     Map filtering and nearby-ordering rules
api/
  src/functions/  HTTP-triggered Azure Functions, one purpose-specific endpoint per file (including Maps and Journey data)
  src/lib/        Principal validation, Cosmos document validation, and downstream-service credential logic
```

Tests live alongside the file they cover (`*.test.ts`/`*.test.tsx`).

## Conventions

- Keep business/domain logic (validation, data shape, rules) out of presentation
  components. Put it in `domain/` or `services/`, and have pages/components consume it.
- Prefer typed props and typed context values; avoid `any`.
- Use MUI components and the shared theme (`src/app/theme.ts`) rather than ad-hoc CSS
  where possible.
- New routes should be added under `src/pages/` and registered in `src/app/App.tsx`,
  with a corresponding entry in the navigation (`src/components/Layout.tsx`).
- Do not add Next.js, Redux, arbitrary map UI, or photo upload storage. Azure Cosmos DB for NoSQL is approved only for Journey persistence through the protected boundary below; no other database is approved. Azure Maps is approved only for the waypoint and activity map through the protected boundary below. Microsoft
  Entra authentication through Azure Static Web Apps and a minimal linked Azure
  Functions API are permitted for explicitly approved features. Browser access to
  `/api/*` must be restricted to the explicitly assigned work identity; Function
  access to Azure services must use managed identity and least-privilege,
  resource-scoped RBAC. Do not expose shared keys, Function keys, database
  credentials, or long-lived service tokens to browser code.
- Every newly approved Azure service integration requires its own purpose-specific
  endpoint(s), infrastructure-as-code in `infra/main.bicep`, focused tests, and
  `docs/operations.md` updates. This exception does not approve Cosmos DB,
  multi-user roles, personal-account access, generic backend/data-access
  infrastructure, or arbitrary map UI; each requires its own issue and convention update.
- The Azure Maps account must keep `disableLocalAuth: true` to satisfy policy. Shared
  keys and SAS tokens are local authentication and are prohibited. Browser rendering
  must use a Microsoft Entra access token acquired by the linked Function App's
  system-assigned managed identity and returned only through the authenticated,
  purpose-specific token endpoint. The browser must provide that token and the
  non-secret Maps account client ID to the Web SDK. Geocoding must use the
  purpose-specific protected Maps search API, which also authenticates downstream
  with the Function managed identity. Scope Maps RBAC to the account and the minimum
  render/search data actions. Do not add a second map provider, shared-key or SAS
  fallback, client secret, Function key, retry layer, or bulk-geocoding migration
  without an explicit requirement.
- Real Journey data is Cosmos-only. Browser code accesses it through authenticated,
  purpose-specific same-origin Function APIs using the Function managed identity and
  Cosmos data-plane RBAC; it never accesses Cosmos directly, uses account keys or
  connection strings, caches data locally, synchronizes offline edits, or falls back
  to stale data. The account uses Session consistency, periodic backup, and one typed
  document per entity with `id`, `datasetId`, `type`, and `schemaVersion`, partitioned
  by `/datasetId`.
- The `production`, `test`, and `demo` containers are separate. Production starts
  empty and is the only mutable real-data container. Test runs use a unique
  `datasetId`, clean it unconditionally, verify it is empty, and never access
  production. Demo records are deterministic and read-only. Production exports
  exclude test and demo records; import is allowed only into empty production.
- Do not commit secrets or personal data. Visit data lives only in the browser's
  local storage.
- Tests should assert explicit success or explicit failure. Do not encode silent
  recovery or compatibility behavior unless a requirement specifically calls for it.
- Follow the complete validation requirements in "Agent execution" before committing
  changes.
