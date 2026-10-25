# Validation Guide: Activity Recording Experience

## Status and prerequisites

Implementation and local acceptance validation are recorded below. No commit,
push, hosted-data correction or deployment has been performed.

For implementation: Node.js 24, existing root/API dependencies, Chromium for
browser tests, and Functions Core Tools for the existing API-host smoke test.
Install dependencies only if missing or manifests/lockfiles changed.

Use fictional records and isolated test data only. Do not access Production to
test invalid data, clear a live dataset, run a migration, or trigger deployment.
Browser smoke tests use the existing test-mode local storage path, not proof of
hosted authorization or managed identity.
The delayed Activity-save cases instead select Demo Cosmos and intercept the
existing API with fictional records; they do not depend on synchronous local saves.

See [contract](contracts/activity-recording.md) for field, lifecycle and date
cases, and [data model](data-model.md) for deliberate breaking changes.

## Focused implementation feedback

Choose only the relevant tests while implementing; illustrative selectors once
the planned date test files exist:

```powershell
npm test -- src/domain/activityDate.test.ts src/domain/visit.test.ts src/domain/draftJsonImport.test.ts src/components/ActivityEditor.test.tsx
```

From `api/`:

```powershell
npm test -- src/lib/activityDate.test.ts src/lib/journeySchema.test.ts src/functions/journey.test.ts
```

Extend existing context, page, storage/API, app routing, graph/Cosmos and fixture
tests as affected. Do not treat the selectors above as the full impacted surface.

## Required acceptance matrix

1. **Title and date boundaries**: Missing/blank/whitespace title, blank/malformed/
   impossible/leap/future date; today/past acceptance; trimmed title; duplicate
   deliberate title/date records. Cover editor, create/edit, JSON application,
   complete import/replacement, API writes and stored loads. Assert zero writes
   on each invalid case, not only an error message.
2. **UK date semantics**: Freeze clocks using the contract examples; test both
   sides of UK midnight, winter/BST and clock transitions. Use a non-UK device
   timezone. Verify prefill, validation and unchanged serialized date agree.
   Restore clocks after each case; keep ordinary fixtures explicitly in the past.
3. **Breaking contract**: Version-5 valid document accepted; versions 3/4 and
   invalid version-5 payloads rejected explicitly. Production load failure must
   not become demo/stale success. Preserve the existing warned Demo fallback.
4. **Pending save per journey**: Use deferred mutation promises for Activities,
   Waypoint, Idea-origin and edit. Repeated clicks and form submit events in the
   same tick and after render must yield one callback/mutation. Verify Saving
   status, disabled actions, retained draft and no duplicate records.
   For Playwright, select Demo Cosmos and intercept `/api/journey/demo`, returning
   fictional initial data, valid ETags and admin role. Hold the mutation response
   behind a test-controlled promise, then fulfill with updated data/ETags or an
   expected HTTP 400/conflict response in the existing API format. Count requests
   and preserve mock dataset state across deliberate retry. Reuse existing route
   interception; do not add production delay hooks or target the synchronous
   Production test-mode storage path for delayed network tests.
5. **Navigation**: While pending, exercise desktop/mobile links, title/breadcrumb
   links, browser Back/Forward, programmatic navigation and data-mode/Settings
   actions. They cannot discard the editor. After settling, navigation works;
   blocked destinations are not replayed. Preserve warning on hard unload,
   without claiming the browser must honor it.
6. **Failure and retry**: Reject with a specific error and with an ETag conflict.
   No false success/navigation; retain all links/attachments and draft values.
   Correct/retry deliberately and verify a single accepted new submission.
   Assert typed expected input rejection/conflict becomes handled false with the
   exact message. Inject unexpected network/server/response/programming failures
   in router integration tests: after lock cleanup the editor rethrows the same
   exception during rendering and the actual root error element displays its
   original message. Assert no success callback or unhandled promise rejection;
   unexpected failures are not editable save errors or generic fallbacks.
7. **Accessible correction**: Blank title/date, postcode, individual coordinates,
   conditional award and invalid reference/photo fields. Assert associated error
   text and first focus in reading order, including previously collapsed fields.
8. **Optional details**: Save minimal draft without opening attachments. Expand,
   edit, reorder, collapse/reopen and round-trip each section; preserve values.
   Apply JSON and edit populated records; content is revealed. Preserve GPX
   replacement-error and asynchronous parsing protections.
9. **Destinations**: All four save journeys show correct confirmation. Idea
   retained/unlinked cases go to their correct destinations. Verify updated
   usage/progress, actual saved Activity link, one-shot notification consumption,
   legitimate duplicate titles/dates, and no feedback-only extra read.
10. **Permissions and modes**: Admin Production/Demo Cosmos behavior with mocked
    API, viewer read-only, Demo local and warned fallback. No new writes or controls
    for read-only users; no behavior changes to other entity editors.
11. **Responsive/keyboard browser flows**: 360x800 and 1280x800, long titles/errors,
    keyboard-only optional sections and Save. Assert document scroll width does
    not exceed viewport width, controls are visible/unclipped, focus is visible,
    and no keyboard traps occur. Run the UI-guidelines self-review.

## Final local CI before a future cross-cutting commit

After implementation is complete, format changed files and run the complete local
CI sequence from `.github/workflows/ci.yml` once. Root:

```powershell
npm run lint
npm run typecheck
npm run format:check
npm run test:coverage
npm run build
npm run test:e2e
```

From `api/`:

```powershell
npm run lint
npm run typecheck
npm run test:coverage
npm run build
npm run test:smoke
```

Install Playwright Chromium only if required for this run. Azure Functions Core
Tools must be available for host smoke tests; report missing tools as blockers
rather than skipping or claiming success. Existing API build uses Unix shell
commands: use the supported WSL environment on this Windows machine.

Previous full validation encountered OneDrive-mounted worker/host issues; if that
recurs, use a task-owned WSL-native source copy and verify source parity. Do not
claim results for files differing from the workspace or delete unrelated paths.

Inspect final diff/status once and stage only intended files if asked to commit.
Actions contexts, secrets, artifact uploads, hosted identity and live Cosmos
integration are not locally reproduced. No push or Azure deployment is authorized
by this guide.

## Implementation evidence

### Impacted surfaces

- Required titles and UK dates: domain constructors/schema, structured Activity
  drafts and AI instructions, provider actions, storage/import/export, API
  validation and versioned Cosmos document loads.
- Presentation: Activity editor and all three hosts, Activity list/detail and map
  labels, Idea-origin confirmation and saved identity.
- Routing: the existing browser routes now use a data router; editor/page test
  wrappers use a memory data router so navigation blocking is exercised rather
  than bypassed.
- Existing API seed/integration consumers use the versioned schema helpers.
  No infrastructure, credentials, deployment workflow or dependency changed.
- Additional focused tests live in
  `src/components/ActivityEditor.lifecycle.test.tsx` and
  `e2e/activity-recording.spec.ts`; the latter supplements, rather than replaces,
  `e2e/journey.spec.ts`.

### Environment and results

Validation uses Node.js 24 in task-owned WSL-native copies because the Windows
checkout is on OneDrive and has no native Windows Node installation. Missing
native dependencies were installed only after an explicit missing-package error.
The dependency installation reported eight existing audit findings (three moderate,
five high); dependencies were not changed to address unrelated findings.

| Surface                      | Command                                                                                                                                                                                                                                                                                            | Result                                                                                                        |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Frontend static checks       | `npm run lint`; `npm run typecheck`                                                                                                                                                                                                                                                                | Passed; lint retains three existing warnings                                                                  |
| Production frontend          | `npm run build`                                                                                                                                                                                                                                                                                    | Passed; existing large-chunk warning remains                                                                  |
| Frontend regression feedback | `npm test -- src/app/App.test.tsx src/components/ActivityEditor.lifecycle.test.tsx src/components/ActivityEditor.test.tsx src/pages/IdeaDetails.test.tsx src/pages/Dashboard.test.tsx src/pages/ChallengeDetails.test.tsx src/pages/MapPage.test.tsx src/features/journey/JourneyContext.test.tsx` | 213 tests across eight files passed                                                                           |
| Frontend coverage            | `npm run test:coverage`                                                                                                                                                                                                                                                                            | 531 tests across 38 files passed; statements 91.14%, branches 86.43%, functions 89.16%, lines 92.13%          |
| Chromium acceptance          | `npm run test:e2e`; `npx playwright test e2e/activity-recording.spec.ts`                                                                                                                                                                                                                           | All 19 cases passed across the full run and targeted rerun: ten existing flows, nine Activity recording cases |
| API static checks            | `npm run lint`; `npm run typecheck` from `api/`                                                                                                                                                                                                                                                    | Passed without lint warnings                                                                                  |
| API coverage                 | `npm run test:coverage` from `api/`                                                                                                                                                                                                                                                                | 304 tests across 11 files passed; statements 90.57%, branches 82.44%, functions 92.85%, lines 93.25%          |
| Production API               | `npm run build` from `api/`                                                                                                                                                                                                                                                                        | Passed                                                                                                        |
| Built Functions host         | `TMPDIR="$PWD" npm run test:smoke` from `api/`                                                                                                                                                                                                                                                     | Two tests passed                                                                                              |

The first complete frontend coverage attempt exposed obsolete expectations for
required map titles, the newly returned Activity ID, and the deliberately changed
pending-navigation/error contract. Those expectations were corrected. It also
encountered existing 10-second test deadlines under coverage; the eight affected
suites subsequently passed without coverage and without increasing deadlines.
The final complete coverage run passed all 531 tests and the unchanged 80%
thresholds without concurrent browser workloads. Browser-test refinements opened
the mobile navigation drawer, used stable error-summary selectors, scoped the
saved-Activity link to its confirmation, and awaited completed client navigation
and history-marker consumption before testing Back. No production timing hooks
or weakened assertions were introduced.

API checks used checksum-identical source and consumed root fixtures; its
task-owned native copy was removed after validation. SHA-256 parity was confirmed
for 100 frontend source, browser, manifest and configuration files between the
workspace and native copy. Workspace editor diagnostics are clean. Final root
formatting covers the actual Windows checkout, including the API and feature docs.

### UI-guidelines review

- Existing MUI fields, theme sizes/variants, Stack layout and spacing are retained;
  evidence sections use MUI Accordion, with no additional styling system.
- Essential fields, notes and Save remain outside the optional accordions. New
  empty evidence starts collapsed, while existing/applied content opens.
- Required fields and location/award guidance are explicit. Invalid controls have
  associated messages and reading-order focus; hidden evidence opens before focus.
- Pending feedback is a live status outside the busy form. The form's fieldset
  disables conflicting controls; synchronous guards cover duplicate submissions.
- Browser checks cover 360x800 and 1280x800, long titles and rejection messages,
  minimal saves, pristine edits, keyboard Save/accordion actions, mobile navigation,
  history protection, retained evidence and no horizontal page overflow.
- Expected failures retain their specific Alert text; unexpected save failures
  render the original error at the root route error element.
- No shared presentation component was duplicated. The full editor can require
  vertical scrolling; primary fields remain above the fold and optional evidence
  does not push them out of view.

Actions artifact upload, hosted Entra authorization, managed identity, live Cosmos
integration and Azure deployment were not run locally. No migration or old-record
repair was attempted; incompatible Activity documents fail explicitly as documented.
