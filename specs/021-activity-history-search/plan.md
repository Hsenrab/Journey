# Implementation Plan: Search Activity History

**Branch**: `021-activity-history-search` | **Date**: 2026-10-31 | **Spec**: [spec.md](./spec.md)

**Input**: Clarified #189 specification: reset search on leaving history and
require every query word across the supported fields.

**Status**: Design, implementation and scoped local validation complete; executed
evidence is recorded in [quickstart.md](./quickstart.md).

## Summary

Add one compact text search to the existing Activity log. A pure typed domain
helper filters the already selected Challenge/recorded-award group across Activity
title, full saved notes, displayed location and current linked Waypoint title.
Every whitespace-separated query word must match, ignoring case and order.

Keep scope rules, chronology, native links, evidence and mutation flows intact.
Component-local query state resets on departure, refresh and selected/effective
dataset changes. Reuse existing UI components for distinct empty, no-match,
loading and failure feedback.

## Technical Context

**Language/Version**: TypeScript ~6.0.2, strict mode; existing Node.js 24 tooling.

**Primary Dependencies**: Existing React 19, React Router 7, MUI 9, Vite 8 and
domain formatters. No dependency additions or upgrades.

**Storage**: No new storage. Read the loaded dataset; query is component-local,
not URL/history state, browser storage, a provider registry or a saved entity.
Existing Cosmos persistence is untouched.

**Testing**: Existing Vitest 4, Testing Library, Playwright 1.62, Oxlint,
TypeScript and Prettier. Routed tests use the existing data-router harness.

**Target Platform**: Authenticated browser application at 360 by 800 and
1280 by 800; admin/viewer and existing data modes.

**Project Type**: Frontend enhancement to the existing single-page application.

**Performance Goals**: Correct results/feedback within one second of the last
query change for 30 loaded fictional Activities at both sizes (SC-006).
Synchronous filtering; no submit, debounce, request or index.

**Constraints**: Preserve scopes, chronology, saved-data truth, notices, Demo
warnings, detail navigation and draft/save behavior. No backend, schema,
authentication, routing, infrastructure or recording-form redesign. #174 remains
a separate postcode-only save defect.

**Scale/Scope**: One existing page, one pure domain helper, related tests, one
browser suite and the existing Activity guide. The 30-Activity fixture is a
verification workload, not a new product limit.

## Constitution Check

The [constitution](../../.specify/memory/constitution.md) gates pass before
research and after design:

| Principle                           | Pre-design | Post-design evidence                                                                          |
| ----------------------------------- | ---------- | --------------------------------------------------------------------------------------------- |
| I. Small, direct changes            | PASS       | Local state and one pure helper; no generic infrastructure or unrelated fixes.                |
| II. Explicit failures               | PASS       | Loading/errors precede search feedback; no catches, retries, defaults or new fallbacks.       |
| III. Typed rules and consistent UI  | PASS       | Typed filtering; reuse formatters, FilterBar, EmptyState and MUI labels/focus.                |
| IV. Protected data integrity        | PASS       | No new calls, writes, record copies, caches, roles or persistence. Fictional validation only. |
| V. Evidence and controlled delivery | PASS       | Scoped guide; #174/environment limitations explicit. No push/deployment authorized.           |

No violations, exceptions or unresolved design questions.

## Project Structure

### Documentation (this feature)

```text
specs\021-activity-history-search\
  spec.md
  plan.md
  research.md
  data-model.md
  contracts\ui-contract.md
  quickstart.md
  checklists\requirements.md
  tasks.md                         # Completed implementation task list
```

### Source Code (repository root)

Planned implementation surfaces:

```text
src\domain\activityHistory.ts            # New pure filter
src\domain\activityHistory.test.ts       # New matching tests
src\pages\Activities.tsx                 # Query, controls and result states
src\pages\Activities.test.tsx            # Page and routed regressions
e2e\activity-history-search.spec.ts      # New focused browser suite
docs\pages\visits.md                     # Extend existing Activity guide
```

**Structure Decision**: Retain the frontend layout and reuse
[FilterBar](../../src/components/FilterBar.tsx),
[EmptyState](../../src/components/EmptyState.tsx),
[ClickableCard](../../src/components/ClickableCard.tsx) and
[domain formatters](../../src/domain/visit.ts) without changing their contracts.
Existing [ActivityDetails tests](../../src/pages/ActivityDetails.test.tsx) and
[Activity browser regressions](../../e2e/activity-recording.spec.ts) are validation
consumers, not automatically planned edits.

## Phase 0: Research Outcome

All decisions are resolved in [research.md](./research.md) from current source
and the accepted clarifications. Existing dependencies are retained; no new
technology, external research or separate research agent is necessary.

## Phase 1: Design

### Domain matching

- Add `filterActivityHistory(records, waypointById, query)` in the domain layer.
  Read typed readonly Activities and a readonly current Waypoint lookup; return
  a filtered array preserving supplied order and entity identity.
- Trim, lowercase and split query on whitespace; ignore empty tokens. Every
  token must match a substring in at least one supported field of the same
  Activity. Repeated tokens require no repeated occurrence.
- Reuse `activityTitle` and `locationSummary`. Search full saved notes, not the
  140-character excerpt. Missing Waypoint association contributes no text.
- Do not search Idea text, dates, awards, evidence contents or hidden geographic
  metadata, and do not mutate or clone entities.

### Scope, query and rendering

- Keep existing `awardStatistics` / `awardFilterError` selection. Filter that
  selected group, then retain the date/updated-time comparator. Use the
  unsearched group's count for empty-versus-no-match decisions.
- Store query with `activeDataMode` in local state. The provider already keys
  children by selected `dataMode`, so accepted selected changes reset the page.
  Effective fallback/recovery also needs a local reset: clear on mode mismatch
  using the existing guarded render-time adjustment pattern, and use an empty
  effective query in that render before filtering.
- This reset permanently replaces the old mode/query pair but must reset only
  search, not remount an editor or modify provider keys. Same-mode reloads,
  declined switches and blocked switches retain query.
- Do not key by Router `location.key`: award selection and Add/Cancel update
  search parameters without leaving history and retain query. Real departure
  unmounts Activities; Back/Forward and refresh mount empty without origin state.
- Put the search field and existing applicable recorded-award selector in the
  shared FilterBar in the current filter area. Keep alerts, editor and log
  hierarchy intact; search is not a registered record draft.
- For nonblank query provide one labelled Clear search action: EmptyState's
  action slot for no matches, input end-adornment otherwise. Use one query-only
  clear handler and the real input ref; clearing focuses input.
- Wrap actual result and feedback content as needed. Do not hide overflow,
  shorten fixtures, change native links or auto-focus cards during updates.

### Empty and failure precedence

See the [UI contract](./contracts/ui-contract.md) for messages. Failed load,
loading and invalid scope take precedence. For valid loaded data distinguish
zero dataset Activities, zero records in the unsearched scope, and a nonempty
scope reduced to zero by a nonblank query. Never substitute old results.

### Validation and impact

- Domain tests cover all-word semantics, full notes, formatted location, absent
  links, excluded fields, stable order and input immutability.
- Routed page tests prove scopes, clear/focus, own URL-query continuations,
  true unmount/reset, selected/effective dataset transitions and same-mode reload.
  Preserve add/save/cancel, Idea-origin saves and saved-versus-draft record truth.
- Browser tests cover admin/viewer at both sizes, exact duplicate-title IDs,
  current changes, read-only modes, visible focus and wrapping. Measure actual
  event-to-correct-results time against 1,000 ms with 30 fictional Activities.
- Preserve evidence order, galleries, failed-photo feedback and tracks. Use
  coordinate/resolved fixtures for maintenance saves; do not claim to fix #174.
- The affected import path is domain filter to Activities to existing App routing.
  Providers, services, API, build configuration and deployment remain unchanged.
  After implementation run frontend lint/typecheck, directly relevant units/
  browser regressions and changed-file formatting. No unrelated API checks or
  standalone production build are required for this frontend-only feature.

Runnable checks and evidence boundaries are in [quickstart.md](./quickstart.md).
Planning originally validated only new documents. Completed local application
acceptance checks and their limitations are now recorded in the quickstart guide.
