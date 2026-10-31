# Validation Guide: Waypoint Discovery Return

**Implementation status**: Complete and locally validated on 2026-10-30.
The commands below define the acceptance selection; actual execution results
and limitations are recorded at the end. No hosted checks or deployment ran.

## Prerequisites and boundaries

- Use branch `020-waypoint-discovery-return` and the existing installed
  dependencies. Install only after a missing-dependency failure or manifest change.
- Use fictional coordinate-based fixtures; do not access Production records.
- Reuse existing intercepted Journey API test patterns for admin/viewer and
  Demo Cosmos. Demo local uses its bundled fixture. Test-only local Production
  storage is not evidence of real Production behavior.
- Fixture updates must pass existing `DataSchema` and reference validation.
  Duplicate titles, long text and enough matching cards to open one below the
  first screen are required.
- Do not start a new server on an occupied port or reuse an unrelated shared
  preview. The selected browser command requires a fresh Playwright-managed
  test-mode build/server and does not deploy anything.

## Targeted unit/component checks after implementation

Cover session capture/isolation, invalidated versus absent entries, scope
transitions, A -> B -> A, refresh/provider replacement and malformed own metadata.
Provider tests must prove cancelled mode changes, pending writes, superseded
loads and same-dataset edits/reloads do not invalidate valid context.

Use a routed list/detail harness for Back, explicit return, editor guards and
focus. Existing `src/test/DataMemoryRouter.tsx` provides the data router needed
when mounting Activity editors. Keep other component callers' default props
working and assert state forwarding, preventDefault and anchor refs.

In the current Windows/WSL environment, run from PowerShell:

```powershell
$repo = 'C:\Users\hllew\OneDrive\Documents\CodeProjects\Journey'
wsl.exe --distribution Ubuntu --cd $repo --exec npm test -- waypointDiscovery.test.ts JourneyContext.test.tsx Locations.test.tsx LocationDetails.test.tsx ClickableCard.test.tsx DetailPageHeader.test.tsx --pool=vmThreads --maxWorkers=1
```

`vmThreads` is the established working pool for this OneDrive/WSL environment;
the earlier ordinary thread pool failed before running assertions. Do not
increase timeouts or claim a startup failure was an assertion-level red test.

## Browser checks after implementation

Put all new cases under `test.describe('Waypoint discovery return')` in
`e2e/waypoint-discovery-return.spec.ts`, so the selection below includes the
whole new suite and only the named existing consumer regressions.

```powershell
wsl.exe --distribution Ubuntu --cd $repo --exec env CI=1 npm run test:e2e -- waypoint-discovery-return.spec.ts challenge-activity-journey.spec.ts idea-waypoint-navigation.spec.ts waypoint-draft-protection.spec.ts e2e.journey.spec.ts --grep 'Waypoint discovery return|shared origin, direct entry, reload|dirty, pending and conflict|changing the dataset invalidates|browses destinations and usage without writing|Demo local destination browsing|Challenge member progress|unchanged, declined and confirmed Waypoint Cancel' --workers=1 --retries=0 --reporter=line
```

`CI=1` disables preview-server reuse in the existing Playwright configuration;
it does not simulate GitHub Actions. Retries are disabled for this acceptance run.
`e2e.journey.spec.ts` is a runner filename regex selecting the root Journey suite,
not every feature suite ending in `journey.spec.ts`.

The existing selections cover the changed provider, contextual detail navigation,
opt-in shared links, read-only modes and preserved draft behavior. Do not add
unrelated API/Cosmos, Maps SDK, import/export or full local CI suites.

### Required new scenarios

| Scenario                                                                       | Expected evidence                                                                            |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Both widths, admin/viewer, each return mechanism                               | All controls/scope/order preserved; zero writes; selected anchor visible and focused         |
| All current criteria, normal and award-enabled scope                           | Exact search/Area/Category/sort/award/Challenge restoration and correct active count         |
| Clear after return                                                             | Filtering clears; Challenge scope and applicable chosen sort stay                            |
| Duplicate titles and reordered result                                          | Focus follows the exact ID/href, not title/index/old pixel offset                            |
| Current Activity/Waypoint changes                                              | Current completion, awards, ordering and membership; no cached records                       |
| Missing/nonmatching result                                                     | Focused appropriate explanation; no stale card; removed criterion remains selectable         |
| Invalid scope, failed load, loading, empty data, no matches                    | Distinct explicit states; errors/loading never become a missing-result claim                 |
| Selected/effective change and A -> B -> A                                      | Fresh bare list through breadcrumb and old history entries; no selection resurrected         |
| Demo Cosmos fallback/recovery                                                  | Scope invalidated, warning preserved and Demo local read-only                                |
| Refresh on list and detail                                                     | Captured criteria/selection expire; existing explicit URL scope retains normal semantics     |
| Direct/Idea/Challenge entry, modified click and new tab                        | No borrowed list origin; existing navigation behavior retained                               |
| Dirty Waypoint/Activity return                                                 | One existing named confirmation; decline retains all input/errors; accept returns            |
| Pending return and cancelled mode change                                       | Navigation blocked as before; no premature context invalidation                              |
| Further typing/Clear/own-query navigation/background update after return       | Other active controls remain; no repeated automatic focus or stale return-only explanation   |
| Return, award-filter REPLACE or Add/Cancel PUSH, Settings dataset change, Back | Fresh bare list, no filters or selected focus, Name sort; reversal never revives old context |
| Demo local and viewer                                                          | Navigation available; notices/Settings link retained; no new write actions                   |

Capture and inspect focused-return screenshots at both sizes. Verify actual
Tab/Enter activation and computed visible focus, not only `.focus()` calls.
Measure `document.documentElement.scrollWidth <= clientWidth`; do not hide
overflow or shorten fixtures to pass. Check primary initial desktop list content
is visible before deliberate scroll restoration. Run the existing
`docs/UI_GUIDELINES.md` self-review against changed UI.

If native confirmation behavior itself changes, add real-browser keyboard
acceptance evidence; programmatic dialog responses alone do not prove the
browser's keyboard interaction. This plan reuses, rather than redesigns, those
dialogs.

## Final implementation validation

Once implementation is complete, format only changed files and run frontend
lint, typecheck and the selected unit/browser checks once. During implementation,
use diagnostics and narrowly targeted tests only when they provide feedback.

```powershell
wsl.exe --distribution Ubuntu --cd $repo --exec npm run lint
wsl.exe --distribution Ubuntu --cd $repo --exec npm run typecheck
```

The browser runner already builds isolated Vite test-mode output. Add a separate
production build only if build/configuration changes become necessary. Revisit
the impact trace if actual implementation expands beyond the planned surfaces;
do not blindly run every package or only directly edited files.

Record exact results and any existing warnings. Fix failures caused by this
feature; report unrelated failures with their specific command/error rather
than hiding them. Intercepted fixtures do not establish hosted authorization,
Cosmos persistence or a fix for independent postcode-only Activity saves (#174).
Remote checks, deployment and preview validation require a separate request.

## Execution results: 2026-10-30

### Impact trace and checks

The changed surfaces are the provider-owned discovery helper and lifecycle,
the opt-in card/breadcrumb props, and the Waypoint list/detail pages. Existing
Challenge and Idea consumers keep their default links; the selected consumer
and draft browser regressions cover this shared boundary. There are no API,
schema, dependency, build-configuration or deployment changes.

| Check                                                                                                                | Result                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Changed-file Prettier                                                                                                | Passed; only implementation and directly related documentation files formatted                                             |
| `npm run lint`                                                                                                       | Passed, zero errors and the four existing warnings                                                                         |
| `npm run typecheck`                                                                                                  | Passed                                                                                                                     |
| Six unit suites selected above                                                                                       | 142 passed, including 32 new cases                                                                                         |
| Final card-only correction: `npm test -- Locations.test.tsx --pool=vmThreads --maxWorkers=1`                         | 41 passed; other passing suites were unchanged                                                                             |
| Full affected browser selection above                                                                                | 20 existing consumer regressions passed; initial feature assertion/readiness failures were corrected and revalidated below |
| Popup-specific selection with `--grep 'a modified new-tab visit' --workers=1 --retries=0 --reporter=line --trace=on` | 1 passed after awaiting the new document's DOMContentLoaded                                                                |
| Final `env CI=1 npm run test:e2e -- waypoint-discovery-return.spec.ts --workers=1 --retries=0 --reporter=line`       | All 19 feature cases passed, including the corrected popup and final card wrapping                                         |
| Editor diagnostics                                                                                                   | No errors reported for changed implementation files                                                                        |

This is 39 distinct passing browser cases across the affected selection and
targeted reruns, not a claim that the earlier failing invocation passed.
The final stylesheet correction changed only list-card wrapping; its page
suite, all feature browser cases, lint and typecheck were rerun. No unrelated
backend or complete CI sequence was run.

The editor test adapter could not discover these files, so the existing WSL
Vitest runner was used. During feedback, an invalid test Challenge description,
a duplicate context property, hook dependencies and Testing Library options
were corrected. Browser assertions were corrected to respect existing
title/area/category matching and the existing fallback notice wording. Popup
readiness was awaited explicitly; no timeout was increased and no automatic
retry was used.

### Actual UI evidence

Reviewed all four focused-return screenshots: admin/viewer at 360 by 800 and
1280 by 800. Each shows the correct second duplicate-title card with a visible
focus outline and its current completion/award indicators. The initial result
was below the first screen; return brought the exact anchor into view.

The four matrix cases verified:

- Actual Tab/Enter activation and both breadcrumb/browser Back returns.
- Exact search, Area, Category, sort, award/Challenge scope, ordering and counts.
- `document.documentElement.scrollWidth <= clientWidth`.
- Initial desktop first-card position below 800px, before deliberate scrolling.
- Selected-card metadata `scrollWidth <= clientWidth`, not merely page overflow.
- A computed non-`none` focus outline and the returned anchor in the viewport.
- Zero navigation writes and retained read-only treatment for viewers.

Screenshot review initially found clipped long Area text inside cards even
though the page-overflow assertion passed. A browser computed-style inspection
confirmed a 615px text extent inside a 466px paragraph. Applying wrapping to
the actual card content fixed it; the final screenshots visibly wrap the full
labels and the new internal-width assertion passes without shortening fixtures
or hiding overflow.

The UI self-review passes: shared MUI/theme spacing, aligned labelled controls,
existing empty/loading/error patterns, initially collapsed secondary filters,
visible initial desktop results, wrapping at both widths and no duplicated
presentation component. The temporary inspection server was stopped.

### Boundaries and warnings

- The four existing lint warnings remain: Waypoint editor dependency stability
  and Fast Refresh exports in the award fields and Journey context.
- Vite reported its existing large-chunk warning and a plugin-timing advisory.
- JSDOM reports its unimplemented native document-navigation path during the
  modified-click test; the real-browser new-tab case passes.
- Production load-failure precedence is exercised by the routed component
  test in production mode. The browser test build deliberately uses local
  Production storage, so its API-intercepted failure/recovery evidence uses
  Demo Cosmos and preserves the explicit read-only fallback warning.
- All API records are fictional intercepted fixtures. These results do not
  prove hosted authentication, Cosmos persistence, Azure deployment or a fix
  for #174. Native dialogs are reused; programmatic accept/decline is not
  represented as evidence of native-dialog keyboard interaction.
- No dependencies were installed and no commit, push or deployment was made.
