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

## Agent execution

Agents must execute validation as part of the work. Do not stop after editing and tell
the user to run commands.

- After the first substantive code change, immediately run the narrowest relevant test
  or check. Fix failures caused by the change before continuing.
- Before completing any repository change, run the local equivalent of
  `.github/workflows/ci.yml` in workflow order:
  `npm run lint`, `npm run typecheck`, `npm run format:check`,
  `npm run test:coverage`, `npm run build`, and `npm run test:e2e`.
- Run `npm ci` first when dependencies are not installed or the lockfile changed. Install
  the Playwright Chromium browser when it is not already available.
- Treat a failed command as a failure. Do not suppress it, weaken the check, alter test
  data to avoid it, or claim completion. Fix failures caused by the change; otherwise
  report the exact failing command and error as the blocker.
- GitHub-hosted workflow behavior that depends on Actions contexts, environments, OIDC,
  repository secrets, or artifact services cannot be faithfully run locally. Do not
  simulate it or claim it ran. Run all local commands from the workflow and state which
  GitHub-only steps remain for Actions.
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
- Tests should assert explicit success or explicit failure. Do not encode silent
  recovery or compatibility behavior unless a requirement specifically calls for it.
- Follow the complete validation requirements in "Agent execution" before committing
  changes.
