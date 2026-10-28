# Validation Guide: Idea-to-Waypoint Navigation

**Feature**: [spec.md](./spec.md)
**Acceptance contract**: [contracts/ui-contract.md](./contracts/ui-contract.md)

## Status and prerequisites

Implementation and scoped local validation are complete. No commit, push, pull
request, or deployment was performed. The commands below describe the focused
checks; actual results and limitations are recorded at the end of this guide.

- Use branch `019-idea-waypoint-navigation`.
- Reuse installed dependencies. Install only after a missing-dependency failure
  or a deliberate dependency-manifest change.
- Use isolated fictional records, never real Journey data. Test navigable
  destinations with zero/one/many associations, duplicate/long titles, and
  Activity usage at another destination or without a destination.
- Keep API-intercepted browser cases explicitly in Demo Cosmos and return the
  intended `admin` or `viewer` role. Demo local is a separate read-only case.
- Use coordinate-based locations for save scenarios.
- Check [#174](https://github.com/Hsenrab/Journey/issues/174) before any
  postcode-only save acceptance. It was still OPEN on 2026-10-27; do not change
  unrelated API code or claim a mocked save proves that defect is resolved.

## Execution environment

Run the commands below from the repository root using its existing Node
environment. In this Windows workspace the established environment is WSL
Ubuntu. For example:

```powershell
wsl.exe --distribution Ubuntu --cd 'C:\Users\hllew\OneDrive\Documents\CodeProjects\Journey' --exec npm test -- IdeaDetails.test.tsx --pool=vmThreads --maxWorkers=1
```

Use filename selectors without path separators for the focused runners. The
bounded VM-thread options reflect the observed local thread-worker startup limitation;
they do not weaken assertions. Report failures with their specific messages.

## Focused implementation checks

1. Format only files actually changed by implementation. For the planned file
   set, these PowerShell commands use the established WSL environment:

   ```powershell
   wsl.exe --distribution Ubuntu --cd 'C:\Users\hllew\OneDrive\Documents\CodeProjects\Journey\src\pages' --exec npx --no-install prettier --write IdeaDetails.tsx IdeaDetails.test.tsx
   wsl.exe --distribution Ubuntu --cd 'C:\Users\hllew\OneDrive\Documents\CodeProjects\Journey\src\components' --exec npx --no-install prettier --write Layout.tsx Layout.test.tsx
   wsl.exe --distribution Ubuntu --cd 'C:\Users\hllew\OneDrive\Documents\CodeProjects\Journey\e2e' --exec npx --no-install prettier --write idea-waypoint-navigation.spec.ts
   wsl.exe --distribution Ubuntu --cd 'C:\Users\hllew\OneDrive\Documents\CodeProjects\Journey\docs\pages' --exec npx --no-install prettier --write ideas.md
   ```

2. After implementation is complete, run frontend static checks:

   ```text
   npm run lint
   npm run typecheck
   ```

3. Run the affected page tests:

   ```text
   npm test -- IdeaDetails.test.tsx Layout.test.tsx --pool=vmThreads --maxWorkers=1
   ```

   Expect coverage for identity-based targets, no destinations, duplicate titles,
   usage independent of associations, current planning states, read-only access,
   and text/link transitions through edit, pending/failed save, successful save,
   and Cancel. Retain existing recording, missing-Idea, and load-failure cases.
   When testing a changed draft's Cancel, handle the editor's existing native
   confirmation explicitly; declining must not end editing.

4. Run the new browser suite, the existing Idea-entry Activity cases, and the
   four existing shell role/viewport smoke cases in
   one selection. Give the new suite an Idea-named describe block so this filter
   includes all its cases:

   ```text
   npm run test:e2e -- idea-waypoint-navigation.spec.ts activity-recording.spec.ts e2e.journey.spec.ts --grep "[Ii]dea|Challenge.member.progress" --workers=1 --reporter=line
   ```

   The existing browser configuration builds in test mode and serves port 4173.
   This is the build needed for browser testing, not proof of a separate
   production build or hosted deployment. Do not reuse a stale/unrelated server
   merely because it occupies that port. Install Chromium only if required.
   The `e2e.journey.spec.ts` argument is a path-matching regular expression that
   selects the root journey file, not similarly suffixed feature suites.

5. Apply the [UI self-review](../../docs/UI_GUIDELINES.md#self-review-checklist)
   to the changed section. Check editor diagnostics for the changed files.

Do not run unrelated API checks, full coverage, all browser tests, or an extra
production build for this rendering-only change. Reassess the impacted surfaces
if implementation expands beyond this plan. Do not repeat successful checks
unless their covered files change.

The Layout checks are required by the mobile editor overflow found during
implementation; see the [plan finding](./plan.md#implementation-finding-shared-main-sizing).
Run only checks affected by subsequent fixes rather than repeating successful,
unchanged page tests.

## Browser acceptance scenarios

Use 360x800 and 1280x800 for admin and viewer destination browsing. Cover the
remaining behaviors with focused cases rather than a full cross-product of
every state and dataset.

| Scenario                       | Expected evidence                                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| One/many destinations          | Each link opens the correct existing Waypoint route in one activation                                    |
| Duplicate titles               | Independently operable links retain different identity-based targets                                     |
| Empty association list         | Explicit none-linked text; no destination control                                                        |
| Long and unbroken titles       | Labels wrap; `document.documentElement.scrollWidth <= document.documentElement.clientWidth`              |
| Keyboard                       | Reach each destination using Tab, verify visible focus, and activate with Enter                          |
| Admin edit lifecycle           | Names remain text while editing/pending/failed; restore only after successful save or completed Cancel   |
| Viewer                         | Destination and Activity links work; no edit/delete/recording controls or browse-triggered writes        |
| Demo local                     | Read-only notice and destination navigation remain available                                             |
| Different/no Activity Waypoint | Usage is correct without adding associations or changing planning state                                  |
| Dataset change/removal         | A valid replacement fixture and reload retain explicit missing-record behavior, not stale usable content |
| Existing Idea Activity entry   | Current pending/failure/success return and Activity link remain correct                                  |

For unavailable-record coverage, replace the isolated fixture with a valid
dataset that removes the destination and detaches its associations, then reload
its detail route. Do not introduce dangling references as a fake normal dataset.

Record each executed case's role, data mode, viewport, result, and whether its
API was intercepted. Pair keyboard focus assertions with a visible-focus review;
programmatic focus alone is not evidence of a visible indicator.

## Evidence and delivery boundary

Record actual command outcomes and explicit blockers during implementation.
Mocked frontend save tests do not establish actual API, Cosmos, geocoding, or
backend access enforcement. No push, pull request, deployment, or hosted preview
validation is part of this planning command.

## Implementation evidence: 2026-10-28 UTC

### Completed checks

| Check                                                              | Actual result                                                                                                     |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Changed-source formatting                                          | Passed for IdeaDetails, its page tests, the new browser suite, Layout and its tests, and the Ideas guide          |
| `npm run lint`                                                     | Exit 0; four existing warnings in unchanged files, zero errors                                                    |
| `npm run typecheck`                                                | Passed after the final Layout fix                                                                                 |
| `npm test -- IdeaDetails.test.tsx --pool=vmThreads --maxWorkers=1` | 30 passed                                                                                                         |
| `npm test -- Layout.test.tsx --pool=vmThreads --maxWorkers=1`      | 15 passed after the Layout fix                                                                                    |
| Expanded browser selection above                                   | 16 passed: ten new Idea-navigation cases, two existing Idea-entry Activity cases, four existing shell smoke cases |
| Editor diagnostics                                                 | No errors in the changed source, test, or Ideas guide files                                                       |

The 30 page tests ran successfully before the final shell-only fix. Their
MemoryRouter harness does not mount Layout, so its successful, unchanged checks
were not repeated. The Layout tests, browser cases, lint, and typecheck cover
the subsequent shared-container change.

### Runtime and visual coverage

| Role / data mode                           | Viewport(s)       | Result and boundary                                                                                                                                                  |
| ------------------------------------------ | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin / Demo Cosmos                        | 360x800, 1280x800 | Duplicate-title identity targets, browser-history return, usage links, unchanged records, and zero browsing writes passed                                            |
| Viewer / Demo Cosmos                       | 360x800, 1280x800 | Destination/usage navigation and read-only notice passed; edit/delete/recording actions absent                                                                       |
| Admin / Demo Cosmos                        | 360x800, 1280x800 | Plain names throughout editing/pending/failure, retained draft/error, declined and accepted existing Cancel, successful retry, and current saved associations passed |
| Admin / Demo Cosmos                        | 360x800, 1280x800 | Standalone/single-destination and valid dataset removal/reload scenarios passed with explicit missing-record states                                                  |
| Demo local / bundled fixture               | 360x800, 1280x800 | Read-only destination navigation passed; no API writes                                                                                                               |
| Admin and viewer / Demo Cosmos shell smoke | 360x800, 1280x800 | Existing Challenge member progress layout/navigation checks passed                                                                                                   |

Demo Cosmos responses and writes were intercepted using fictional,
coordinate-based fixtures and explicit roles. Demo local used the bundled
fixture, not an injected viewer identity; it is read-only because of its mode.
The existing Activity-entry cases also use intercepted responses. None of these
results establishes hosted identity, backend authorization, actual Cosmos
persistence, geocoding, or resolution of #174.

Tab/Enter activation and computed visible-focus assertions passed. The four
focused-destination screenshots (admin/viewer at each viewport) and two
failed-save editor screenshots were visually reviewed: focus outlines are
visible, long/unbroken names wrap, plain names remain readable in edit mode,
and controls/fields remain contained. Scroll-width assertions passed against
actual client width, including while editing, pending, and after failure.
The changed section uses theme spacing and semantic links; no form controls,
tabs, shared component copies, or arbitrary-width controls were added. Its
primary destination content remains visible at desktop size.

### Failures, fixes, and known warnings

- The editor test runner found no tests for the supplied file/test name, so
  validation used the existing WSL project runner.
- The initial red probe
  `npm test -- IdeaDetails.test.tsx --testNamePattern identity --pool=threads --maxWorkers=1`
  failed before executing tests with
  `[vitest-pool-runner]: Timeout waiting for worker to respond`.
  This was not a demonstrated assertion-level red result. Supported
  `vmThreads` workers subsequently executed the actual assertions successfully;
  no timeout or assertion was weakened.
- The first VM-thread page run exposed three malformed parameter rows and an
  overly exact error-text query in the new tests. The rows now pass ID arrays
  as object properties and the error assertion checks the actual API context
  plus the specific failure message. The final run passed all 30 cases.
- The first browser run passed 11 of 12 cases and failed the mobile edit
  overflow assertion: 1659px content at a 360px viewport. Inspection traced
  the automatic minimum width to Layout's main flex item. The one-property
  correction and expanded validation are documented in the plan/research.
  Final browser validation passed all 16 cases without changing the overflow
  threshold or shortening labels.
- Lint retains four warnings in unchanged WaypointEditor, JourneyContext, and
  ChallengeAwardFields code. The duplicate-title edit fixture also exposes
  existing React duplicate-option-key warnings in IdeaEditor's Autocomplete.
  These warnings were not suppressed; the new destination list uses record IDs,
  and its identity and edit/save assertions pass. The editor itself is unchanged.
- Vite reports its existing large-chunk and plugin-timing build warnings.
- #174 was still OPEN at implementation initialization. Postcode-only hosted
  save acceptance remains unexecuted and is not claimed by mocked saves.
- No API, broad coverage, unrelated browser suites, separate production build,
  or hosted acceptance was run. No failures remain in the selected completed
  checks. The temporary inspection preview was stopped.
