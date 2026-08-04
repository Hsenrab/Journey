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

## Commands

| Command                | Purpose                                   |
| ----------------------- | ------------------------------------------ |
| `npm install`           | Install dependencies                       |
| `npm run dev`           | Start the Vite dev server                  |
| `npm run build`         | Type-check (`tsc -b`) and build for production |
| `npm run typecheck`     | Type-check only, no emit                   |
| `npm run lint`          | Run Oxlint                                 |
| `npm run format`        | Format the repo with Prettier              |
| `npm run format:check`  | Check formatting without writing changes   |
| `npm test`              | Run the Vitest test suite                  |
| `npm run preview`       | Preview the production build locally       |

## Folder structure

```
src/
  app/        Application shell: root App component, routing, theme
  components/ Shared, reusable presentation components (e.g. Layout)
  pages/      Route-level components (Dashboard, Locations, LocationDetails, Settings)
  features/   Feature-specific logic and state (e.g. journey/ tracking context)
  services/   Cross-cutting infrastructure (e.g. storage persistence)
  domain/     Core types and business rules, framework-agnostic
  data/       Static/reference data (e.g. the list of locations)
  styles/     Global stylesheets
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
- Do not add Next.js, Redux, a database, authentication, maps, or photo upload storage.
- Do not commit secrets or personal data. Visit data lives only in the browser's
  local storage.
- Run `npm run format`, `npm run lint`, `npm run typecheck`, and `npm test` before
  committing changes.
