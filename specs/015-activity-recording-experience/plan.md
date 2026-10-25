# Implementation Plan: Clear and Reliable Activity Recording

**Branch**: `015-activity-recording-experience` | **Date**: 2026-10-25
**Spec**: [spec.md](spec.md)

**Input**: Clarified Activity-recording specification, including mandatory title,
non-future dates, and UK calendar-date semantics.

## Summary

Strengthen Activity validation at the frontend and API boundaries, retain the
existing `name` property as the mandatory user-facing Activity title, and use
`Europe/London` calendar dates for prefilling and future-date rejection.

Give the shared Activity editor one asynchronous save lifecycle with a synchronous
duplicate-submit lock, accessible pending feedback, protected navigation,
field-associated validation, and collapsible optional evidence. Keep page-specific
save errors and success destinations explicit, including Idea-origin confirmation.

No new dependency, service, persistence path, migration, or infrastructure is needed.
This command produces design documents only; implementation and validation remain
future work.

## Technical Context

**Language/Version**: TypeScript 6 strict; Node.js 24 for tooling and Functions.

**Primary Dependencies**: React 19, React Router 7.18, MUI 9, Zod 4, Vite 8;
existing Azure Functions and Cosmos SDKs.

**Storage**: Existing authenticated Journey API and Cosmos containers. Browser-local
record storage remains test-mode-only; no new persistence.

**Testing**: Vitest 4, Testing Library, Playwright Chromium, existing Functions-host
smoke tests; explicit API/storage mocks for rejection-before-write assertions.

**Target Platform**: Current browser app and linked Node Functions API; keyboard
interaction and 360x800 / 1280x800 layouts.

**Project Type**: React web application with separately compiled Functions project.

**Performance Goals**: Pending feedback appears on submission without waiting for
the network; repeated events start no additional save. No polling or extra data
reads are introduced for confirmation.

**Constraints**: Specific errors, no automatic retries or silent defaults; no
migration or live-data correction. Preserve roles, modes, ETags, transactional
integrity, and the explicitly warned Demo fallback.

**Scale/Scope**: One shared editor, three hosting pages and four user save journeys
(Activities, Waypoint, Idea-origin, existing Activity); frontend/API ingestion,
fixtures, related documentation, and routing required for pending navigation guards.

## Constitution Check

| Principle                              | Pre-research gate                                 | Post-design gate                                                                  |
| -------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------- |
| Small, direct changes                  | Pass: extend existing editor and validators       | Pass: no dependency or service; routing change is necessary for FR-006            |
| Explicit failures and breaking changes | Pass: reject invalid records, no backfill         | Pass: versioned Activity contract replaced explicitly; errors and drafts retained |
| Typed domain rules and consistent UI   | Pass: domain validation and existing MUI patterns | Pass: required `name`, UK-date helpers, accessible field errors and accordions    |
| Protected access and integrity         | Pass: current backend authorization retained      | Pass: validate loads/writes/imports; no credential or container changes           |
| Evidence and controlled delivery       | Pass: planning only                               | Pass: validation matrix defined; no runtime, push, or deployment claims           |

All gates pass. No unresolved product clarification or constitution exception.

## Project Structure

### Documentation (this feature)

```text
specs/015-activity-recording-experience/
  spec.md
  plan.md
  research.md
  data-model.md
  quickstart.md
  checklists/requirements.md
  contracts/activity-recording.md
```

`tasks.md` is created by the next workflow, not by this plan.

### Source Code (repository root)

```text
src/
  app/App.tsx
  components/ActivityEditor.tsx
  domain/activityDate.ts                 # new focused date rules
  domain/visit.ts
  domain/draftJsonImport.ts
  domain/aiPrompts.ts
  features/journey/JourneyContext.tsx
  pages/{Activities,ActivityDetails,IdeaDetails,LocationDetails}.tsx
  services/{journeyApi,storage}.ts
  data/demo.json
api/
  src/lib/activityDate.ts                # equivalent API-local date rules
  src/lib/{journeySchema,cosmos,journeyGraph}.ts
  src/functions/journey.ts
  scripts/                              # existing fixture/integration consumers
e2e/journey.spec.ts
docs/{waypoints-model,operations,UI_GUIDELINES}.md
```

**Structure Decision**: Reuse the existing packages and adjacent test files.
Keep small equivalent date helpers inside each separately compiled package, with
the same boundary cases. Do not import frontend code into the Functions build or
create a shared package/build-copy mechanism for this rule.

## Phase 0: Research Decisions

See [research.md](research.md) for source evidence, decisions, and rejected
alternatives. Important findings:

1. Frontend dates check actual calendar validity, while the API currently checks
   only the date's shape. Both need the same stricter rule.
2. Activity title is currently optional across schemas, construction, and drafts;
   display helpers provide a date fallback. Replace that contract end-to-end.
3. Async parent callbacks are currently accepted through a `void` editor prop,
   and context pending counts do not serialize submission.
4. Pending navigation cannot be covered by disabling the Save button or the
   existing Settings-only link guard. Use the supported router blocker.
5. Demo Activities already have names in the inspected fixture; preserve their
   content and prove the full fixture validates rather than rewriting it blindly.

## Phase 1: Design

### Domain and ingestion

- Use a small `activityDate` helper in each package: derive UK `YYYY-MM-DD` with
  `Intl.DateTimeFormat` using `Europe/London` and explicit year/month/day parts;
  do not assume locale-formatted output order or use device-local dates.
- Validate shape, actual Gregorian date, and `date <= current UK date`.
  Evaluate the current date at validation time, not module initialization.
  Optional `now: Date` parameters permit deterministic date tests.
- Keep stored dates as unshifted strings. Leave other date/timestamp concepts alone.
- Require trimmed `name` in `Activity`, `ActivityDraft`, JSON draft types and
  `createActivity`; reject absent/empty values at runtime. Label it "Activity title".
- Remove the date-as-title and optional-name subtitle branches. Audit all callers,
  factories, fixtures, examples, prompts, import/export and API validation surfaces.
- Replace the Cosmos Activity document contract with version 5; remove Activity
  version-3 acceptance and reject versions 3/4 explicitly. Other entity versions
  are unchanged. Do not add loaders that reinterpret obsolete records.
- Keep complete validation before persistence and existing relationship checks.
  Document the incompatibility in operations/model docs and link the Feature 006
  and 009 historical contracts to their Feature 015 replacement.

### Save lifecycle and navigation

- The editor owns a synchronous in-flight ref plus render state. Lock before
  invoking the async callback, ignore repeated events, and unlock in `finally`.
- Make save completion explicit: `onSubmit(draft): Promise<boolean>` returns true
  only after the page's mutation succeeds; false means the page displayed a
  handled failure. A separate optional `onSaved(draft)` performs success UI and
  navigation after the editor releases its pending lock.
- All hosting pages adopt this contract together. Keep specific existing error
  and conflict handling; do not catch unexpected exceptions merely to return false.
  A rejected unexpected exception propagates after lock cleanup.
- Define a typed expected request error in `src/services/journeyApi.ts` for
  handled input rejection (HTTP 400), preserving the complete existing specific
  message and existing conflict/import-not-empty types. Activity save hosts
  return false only for applicable expected errors they fully display. Network
  failures, server failures, malformed responses and programming errors remain
  unexpected; do not classify every HTTP error or `Error` as handled.
- An async event-handler rejection alone does not reach a React error boundary.
  After cleanup, retain an unexpected exception and throw the same exception
  during editor rendering. Provide an explicit root route error element in
  `src/app/App.tsx` that displays the original error message as an application
  failure, not an editable save error or generic fallback. Test the full path
  through the data router, with no success callback or unhandled promise rejection.
- While saving, expose `aria-busy` and a live "Saving..." status, disable draft
  changes and conflicting actions (including links, mode switching, GPX changes,
  Cancel and Delete), and keep the draft registered even if otherwise pristine.
- Convert the existing route tree to `createBrowserRouter` / `RouterProvider`,
  retaining paths, redirects, theme, Layout and provider lifetime. Use an Outlet
  shell around the same pages. No loaders or new routes are needed.
- Use `useBlocker` on the mounted Activity editor's synchronous pending predicate.
  Reset blocked attempts instead of replaying them after save. This covers
  navigation links, programmatic navigation, and browser Back/Forward.
  New-tab browsing is not a discard of the editor.
- Keep the existing before-unload warning, including pending pristine edits.
  Hard reload/closing cannot be prevented reliably by a web app; do not claim
  browser unload cancellation guarantees or add offline recovery.
- Editor/page tests that mount the blocker must use a memory data router; do not
  silently disable the guard outside a supported router.

### Form layout and validation

- Keep essentials and notes directly available; use existing MUI Accordion
  patterns for GPX, References, and Photos. Empty sections start closed; sections
  containing initial or applied content open. Preserve values on collapse.
- Do not unmount fields in a way that clears drafts or abandons GPX state.
  Show errors in section summaries; open invalid sections before focusing.
- Give controls stable labels, IDs, and associated helper text. Use per-coordinate
  error association instead of a detached coordinate message.
- Establish the first invalid control by actual reading order, not the order
  errors happened to be added. Open its section, then focus once it is rendered;
  scrolling follows focus when necessary. Include reference/photo fields and
  conditional award selection.
- Keep native date controls useful (including a UK-based maximum), but use the
  same custom validation path for consistent focus and accessible error messages;
  native constraints must not intercept submission and skip that path.
- Say "Award tier" and explain when required; never imply it determines
  completion. Preserve location choices, prefill, relationship semantics and
  attachment order. Do not redesign other entity forms.

### Success destinations

- Activities and inline Waypoint saves keep existing success placement; editing
  returns to Activity detail. All show success only after mutation success.
- Pass a typed, one-shot Activity-saved navigation state to the originating Idea
  when it remains linked. Show the confirmation with updated derived usage and
  a link to the saved Activity, then consume the marker via history replacement
  so later visits do not replay success.
- Return the actual saved ID from `addActivity` as `Promise<string>` and retain
  that ID for the page's success callback. Allocate it before constructing the
  add action and carry it through the reducer so the computed next dataset and
  test-mode dispatch use the same identity. Make the existing tracking wrapper
  preserve its operation's return type; other mutations retain their current
  returns. Never match by title, date or list position. Do not add a feedback-only
  read; linked usage comes from the already updated provider.
- If the originating Idea was unlinked, remain on Activities with confirmation.

### Verification and delivery

See [quickstart.md](quickstart.md). Map FR-001/013 to date/schema/ingestion tests,
FR-002/003/004/009/010 to editor and browser accessibility/layout tests,
FR-005/006/007/008 to delayed-save lifecycle and routing tests, and FR-011/012
to regression, fixture, role/mode and documentation checks.

Implementation is cross-cutting: before a future commit run the complete local CI
sequence once, after changes are complete. This planning run validates only its
Markdown artifacts. No deployment, migration, push, or remote data writes are
authorized.

For delayed-save browser acceptance, select Demo Cosmos and intercept
`/api/journey/demo` using Playwright's existing API-route pattern. Supply fictional
data, valid ETags and the admin role; hold the mutation response behind a
test-controlled promise. Model replacement success with updated data/ETags and
expected input/conflict failures with the real API response format. Assert one
mutation while pending, then release and verify success or retained-draft retry.
Do not delay a nonexistent Production test-mode request or add application delay
hooks. Unexpected-error propagation is additionally exercised through a router
integration test with the actual root error element.

## Complexity Tracking

No constitution violations. The router conversion is a direct requirement of the
existing stack's navigation-blocking API; custom history interception would be an
unsupported workaround. The two tiny package-local date helpers avoid expanding
build/deployment boundaries and are held to the same test matrix.
