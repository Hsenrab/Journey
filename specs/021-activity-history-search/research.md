# Research: Search Activity History

**Date**: 2026-10-31
**Feature**: [spec.md](./spec.md)
**Evidence**: Current repository source and accepted clarifications; no application
execution, hosted acceptance or real-data access during planning.

## 1. Keep filtering inside the existing scope

**Decision**: Add a pure typed domain filter over the page's selected Activity
group. Keep the existing date/updated-time comparator.

**Rationale**: [Activities](../../src/pages/Activities.tsx) already selects the
Challenge and exact recorded-award group through shared statistics rules.
Filtering that group cannot accidentally turn scoped history into global search.
Its current Waypoint lookup can be passed as a readonly map rather than rebuilt.

**Alternatives considered**: Filtering all data before scope selection introduces
unnecessary scope-regression risk. A server/index, generic search service or
duplicated award rules is outside the requirement.

## 2. Every word may match a different supported field

**Decision**: Trim/lowercase the query, split on whitespace, and require every
nonempty token to be a substring of at least one supported field within the same
Activity. Repeated words require no extra occurrence.

**Rationale**: The user chose "walk" in title and "garden" in notes, in either
query order. Reuse [title/location formatters](../../src/domain/visit.ts) so
location means visible text. Search full notes, not the 140-character excerpt.
Do not concatenate fields to allow partial words across artificial boundaries.

**Alternatives considered**: Exact-phrase matching was rejected. Any-word
matching would show records missing part of the query. Fuzzy matching, ranking,
quoted syntax, hidden metadata and evidence indexing are excluded. Current
Waypoint search is a single-substring rule, not a reusable all-word helper;
do not change its semantics here.

## 3. Local query with an effective-mode reset

**Decision**: Component-local state only; no query URL, history metadata,
registry or saved preference. Store the effective mode with query and clear on
mode mismatch before filtering.

**Rationale**: The user chose reset-on-leave, including browser Back/Forward.
[App](../../src/app/App.tsx) has separate history/detail routes, so genuine
departure unmounts Activities.
[JourneyContext](../../src/features/journey/JourneyContext.tsx) keys children by
selected `dataMode`, not `activeDataMode`: selected changes reset the page but
same-selection fallback/recovery needs a local reset. The guarded render-time
adjustment pattern in [Locations](../../src/pages/Locations.tsx) prevents the new
dataset appearing through old query text and permanently discards the old query.

**Alternatives considered**: Waypoint discovery context contradicts the accepted
lifetime. Keying by every Router entry loses query during award/Add/Cancel
changes. Changing provider keys risks discarding unrelated editor state.
An effect-only reset can briefly filter the new dataset with old query text.

## 4. Preserve editor and navigation boundaries

**Decision**: Add controls in the existing filter area without changing editor
handlers, mutation APIs, links or breadcrumbs.

**Rationale**: Ordinary saves stay on Activities; Idea-origin saves retain the
conditional return. Add/Cancel and recorded-award changes stay on history, so
retain query. A saved record may not match retained query: keep success feedback
and clear recovery rather than force navigation, broaden scope or invent a
result. Query text is not a record draft and does not register a dirty guard.

**Alternatives considered**: New return contracts, automatic card focus, clearing
query on every save or rebuilding the editor are unrequested.

## 5. Reuse compact controls and truthful empty states

**Decision**: Reuse [FilterBar](../../src/components/FilterBar.tsx) and
[EmptyState](../../src/components/EmptyState.tsx). Provide one Clear search
action per nonblank-query state and focus the actual input.

**Rationale**: These components meet [UI guidelines](../../docs/UI_GUIDELINES.md).
Empty dataset/scope and no-match need distinct messages, subordinate to loading
and errors. Use EmptyState's action for no matches and an input adornment in
other states, suppressing duplicate actions.

**Alternatives considered**: Duplicate clear buttons, bare text loading, a separate
search page, fixed-width fields, hidden overflow or a new presentation abstraction
add friction or break conventions.

## 6. Scoped, isolated evidence

**Decision**: Add domain/page/browser coverage and preserve relevant existing
Activity/evidence regressions. Measure from final input event to correct rendered
results/feedback with the browser clock, not a generous assertion timeout.

**Rationale**: A 30-Activity fictional fixture proves the specified workload
without adding a scale requirement. Existing
[browser isolation](../../e2e/waypoint-discovery-return.spec.ts) supports typed
intercepted records, roles, held reads/writes and explicit failures. Production
load-error precedence needs a routed production-mode test because browser test
mode intentionally uses local Production storage.

**Alternatives considered**: Real backups, live Cosmos writes, real external image
downloads, unrelated backend checks or a new performance framework are unnecessary.
Test-mode postcode saves do not prove that #174 is fixed.

## Resolved status

No technical unknowns remain. Existing libraries and service boundaries are
unchanged; no new integration, dependency research or research agent is needed.
Design is source-grounded, not executed acceptance evidence.
