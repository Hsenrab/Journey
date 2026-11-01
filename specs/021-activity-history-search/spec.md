# Feature Specification: Search Activity History

**Feature Branch**: `021-activity-history-search`

**Created**: 2026-10-31

**Status**: Implemented; local acceptance complete, hosted acceptance not run

**Input**: User description: "Implement #189: Search Activity history within its current Challenge and award scope."

## Clarifications

### Session 2026-10-31

- Q: When you open an Activity from search results and return with browser Back,
  should your search still be there? → A: No. Reset the query when leaving Activity
  history, including on browser Back/Forward returns; refresh and dataset changes
  also reset it.
- Q: If you search for "garden walk", should it match that phrase or both words
  anywhere in the Activity's searchable text? → A: Match every whitespace-separated
  word, ignoring case and order. Each word may match a substring in any supported
  field, including different fields within the same Activity.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Find a remembered experience (Priority: P1)

As an admin or viewer, I can search Activity history using a remembered name,
note, location or Waypoint rather than scanning records by date. When I came
from a Challenge or recorded-award view, search stays within that scope.

**Why this priority**: Finding the correct saved experience is the central
benefit. Search must not suggest that unrelated records belong to my Challenge
or recorded-award selection.

**Independent Test**: Load fictional saved Activities, open ordinary and scoped
history, search each supported field, and open a result. Verify exact matching
record identities and the existing chronological order.

**Acceptance Scenarios**:

1. **Given** loaded history, **When** I enter part of an Activity title,
   **Then** only matching Activities appear in their existing chronological order.
2. **Given** a term appears only in saved notes, displayed location or linked
   Waypoint title, **When** I search it, **Then** that Activity is found without
   opening or downloading its evidence.
3. **Given** matching Activities inside and outside my Challenge or recorded-award
   scope, **When** I search, **Then** only matching records inside that scope appear.
4. **Given** two matching Activities share a title, **When** I open either,
   **Then** its own detail opens and each card retains its date, location and
   evidence summaries.
5. **Given** an independent Activity has matching notes or location, **When**
   I search, **Then** it appears without an invented Waypoint association.
6. **Given** an Activity titled "Morning walk" with notes containing "Botanical
   garden", **When** I search "garden walk" or "walk garden", **Then** it matches;
   a record containing only one of those words does not.

---

### User Story 2 - Recover without losing the scope (Priority: P2)

As a person searching history, I understand whether no Activities are saved,
my scope contains no records, or my query simply matches none. I can clear
search without discarding the Challenge or recorded-award selection.

**Why this priority**: Search needs an obvious recovery action. Empty results
must not conceal a loading problem or imply that saved records disappeared.

**Independent Test**: Search for an absent term in nonempty scoped history,
clear it using the keyboard, and compare restored identities with the original
scope. Separately inspect empty, loading, invalid-scope and failed-load states.

**Acceptance Scenarios**:

1. **Given** the unsearched scope contains Activities, **When** a nonblank
   query matches none, **Then** search-specific feedback and a labelled
   clear-search action appear instead of an empty-dataset message.
2. **Given** a query, **When** I clear it, **Then** the current scope's records
   return in existing order, no outside record appears, and focus returns to
   the search input.
3. **Given** I enter only spaces, **When** results update, **Then** they are
   identical to an empty search.
4. **Given** no Activities exist before searching, **When** history renders,
   **Then** empty-dataset or empty-scope feedback remains distinct from a query
   excluding otherwise available records.
5. **Given** loading, invalid scope or load failure, **When** history renders
   with a query, **Then** that loading/error state takes precedence over
   no-match feedback.
6. **Given** a query in award-enabled scoped history, **When** I select another
   recorded-award filter, **Then** the retained query is reapplied within the
   newly selected scope.

---

### User Story 3 - Inspect current evidence without changing records (Priority: P2)

As an admin or viewer, I can search using a compact, keyboard-accessible layout
on mobile or desktop, open the correct Activity, and inspect existing evidence.
Searching never saves a record; later searches reflect current saved content,
not unsaved edits or copied old results.

**Why this priority**: Search must preserve the working Activity-detail flow,
read-only access and saved-record integrity.

**Independent Test**: Search and inspect fictional records as admin and viewer
at both target sizes. As admin, edit or delete an Activity through the existing
flow, revisit history and compare search results with newly saved records.
Repeat with a failed save and verify that unsaved edits are not searched as
persisted data.

**Acceptance Scenarios**:

1. **Given** a viewer, Demo local data or the warned read-only Demo fallback,
   **When** I search and inspect details, **Then** search works without new
   recording, editing or deletion actions.
2. **Given** a successful edit or deletion, **When** I revisit loaded history
   and apply a query, **Then** results reflect current saved records and do not
   reinsert a deleted Activity.
3. **Given** an Activity save fails, **When** I later search saved history,
   **Then** unsaved draft text is not treated as a persisted change, and existing
   save-failure/draft handling remains intact.
4. **Given** several linked Ideas, ordered references/photos or a recorded track,
   **When** I open an Activity from search, **Then** its associations, evidence
   order, gallery controls, failed-photo feedback and track links remain intact.
5. **Given** 360 by 800 or 1280 by 800, **When** I enter a query, clear it and
   open a result using only the keyboard, **Then** labels and focus are visible
   and the page does not overflow horizontally.
6. **Given** a query, **When** I leave history, refresh or change the selected
   or effective dataset, **Then** the query resets and switching back to the
   previous dataset does not revive it. Returning from another page with browser
   Back/Forward also starts with an empty query.

### Edge Cases

- Empty or whitespace-only query, mixed case, partial words, repeated words,
  and several words matching different fields in any order. Every word must
  match somewhere within the same Activity's supported fields.
- Duplicate Activity titles, equal dates and existing updated-time tie-breaking.
- Blank notes, independent Activities, removed Waypoint links and several Ideas;
  absent optional content contributes no match and is not an error.
- A matching record outside the selected Challenge/award scope but none inside.
- Ordinary and award-enabled Challenges; a valid scope with zero Activities.
- Zero loaded Activities versus a nonempty scope reduced to zero by a query.
- Loading, invalid scope, Production load failure and the explicitly warned
  read-only Demo local fallback.
- Saved edits/deletions, changed linked Waypoint titles and failed saves.
- Leaving history, refreshing or changing the selected/effective dataset;
  search must not carry records between datasets.
- No evidence, several references/photos, broken external images and recorded
  tracks; searching itself does not fetch evidence.
- Long query text, titles and locations on mobile and with keyboard-only use.
- #174 remains a separate blocker for affected postcode-only maintenance saves,
  not failed-save behavior to preserve as a feature requirement.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Loaded Activity history MUST expose one compact, visibly labelled
  **Search activities** control for admin and viewer browsing.
- **FR-002**: Search MUST match saved Activity title, saved notes, human-readable
  location shown in history, and the linked Waypoint's current title when
  present. After trimming the query and splitting it on whitespace, a record
  MUST match only when every word matches a case-insensitive substring in at
  least one supported field. Words may match different fields within the same
  Activity and in any order. Repeated words MUST NOT require repeated occurrences.
- **FR-003**: An empty or whitespace-only query MUST leave the current scoped
  history unchanged. Search MUST NOT require submission.
- **FR-004**: Search MUST intersect the existing Challenge/recorded-award scopes
  without broadening them, changing award applicability, altering chronological
  date/updated-time ordering, or inventing associations for independent Activities.
- **FR-005**: Cards MUST retain their existing title, date, location,
  linked-Waypoint action, award information where applicable and reference/photo
  summaries. Opening a result MUST select its Activity by identity, including
  duplicate titles.
- **FR-006**: A nonblank query excluding all records from a nonempty unsearched
  scope MUST show a query-specific no-match explanation and an accessible
  **Clear search** action. Clearing MUST remove only the query, restore the
  current scope's records and return focus to the search input.
- **FR-007**: Empty dataset, empty valid scope, loading, invalid scope and load
  failure MUST remain distinguishable. Existing loading/scope/load-failure
  feedback MUST take precedence over search feedback and MUST NOT become
  apparently successful empty results.
- **FR-008**: Changing the recorded-award filter within the same history visit
  MUST retain and reevaluate the query in the new scope. Clearing search MUST
  retain the existing Challenge and award selections.
- **FR-009**: Matching MUST evaluate currently loaded saved records, including
  current linked Waypoint titles. Newly loaded saved changes MUST be reflected;
  deleted records, failed saves and unsaved edits MUST NOT be treated as
  persisted search results.
- **FR-010**: Entering, changing or clearing a query MUST NOT write records,
  cause an additional dataset load, download evidence or grant editing rights.
  Existing read-only notices and Demo fallback warnings MUST remain visible
  where applicable.
- **FR-011**: Search MUST NOT change Activity-detail destinations, breadcrumbs,
  return contracts, evidence order, galleries, track links or existing
  edit/delete/save-failure behavior.
- **FR-012**: Search and recovery MUST be keyboard accessible with visible labels
  and focus at 360 by 800 and 1280 by 800. Long query text, labels and results
  MUST NOT introduce horizontal page overflow.
- **FR-013**: The query MUST be limited to the current history visit and reset
  on leaving history or refreshing. Returning from another page with browser
  Back/Forward MUST start with an empty query. Changing the selected or effective
  dataset MUST clear it; switching back MUST NOT revive the previous dataset's
  query. This feature MUST NOT persist search preferences.
- **FR-014**: Matching MUST NOT index evidence content, linked Idea text or
  unrelated Challenge/Waypoint descriptions, add other filters or relevance
  ranking, or change saved record shapes.

### Key Entities _(include if feature involves data)_

- **Activity**: A saved experience with an identity, title, date, notes, location,
  optional Waypoint association, Idea associations and evidence. Search reads
  existing saved content; it never turns a draft into a record.
- **Linked Waypoint**: An Activity's optional destination. Its current title
  contributes to matching; a missing association contributes no title.
- **History scope**: Existing Challenge and optional recorded-award selections
  determining which saved Activities may be shown.
- **Search query**: Temporary text narrowing the current scope, not a saved
  entity, separate dataset or copied set of results.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Fictional-record cases covering all four searchable fields,
  case differences, whitespace, multiword matches across fields and in reversed
  order, repeated words, duplicate titles and independent Activities produce
  100% of expected identities in existing chronological order.
- **SC-002**: Scoped cases show zero outside Activities. One clear-search action
  restores exactly the unsearched scope without changing its selections.
- **SC-003**: Every tested empty, no-match, loading, invalid-scope and failed-load
  state shows the appropriate explanation. No failure becomes a successful
  empty search, and clear-search recovery returns focus to the input.
- **SC-004**: Admin and viewer users can enter a query, clear it and open the
  correct result using only the keyboard at both target sizes, with visible
  focus and zero horizontal page overflow.
- **SC-005**: Fictional save, delete, linked-title-change and failed-save cases
  agree with currently loaded saved records and preserve evidence-order,
  gallery and track-link outcomes. Searching/clearing produce zero record
  writes or additional evidence requests.
- **SC-006**: For a loaded fictional history of 30 Activities at both target
  sizes, results and corresponding empty/no-match feedback settle within one
  second of the final query change, without submission.

## Assumptions

- The approved source is [#189](https://github.com/Hsenrab/Journey/issues/189).
  Current history already has chronological ordering, Challenge/recorded-award
  scopes and working detail/evidence flows; this feature adds text lookup.
- Matching requires every whitespace-separated query word to match a substring
  in the same Activity's supported fields, ignoring case and order. Whitespace
  between words does not require an exact phrase. No fuzzy matching, wildcard
  or quoted-phrase syntax, accent folding or ranking is introduced.
- Displayed location means the card's existing location text, including postcode
  or displayed coordinates, not a newly resolved place name or hidden metadata.
- During a history visit, changing recorded-award selection retains the query.
  Leaving history, including a subsequent browser Back/Forward return from
  another page, refreshing or changing datasets starts a fresh search.
  These confirmed search rules do not permit redesigning detail navigation.
- Existing roles and data modes remain supported. Acceptance uses isolated
  fictional records and identifies the tested roles/modes; local results do not
  prove hosted authentication or real-data persistence.
- [#174](https://github.com/Hsenrab/Journey/issues/174) owns the separate
  postcode-only Activity save failure. Search can be verified using saved records
  and supported saves without making specification completion depend on that
  fix. Affected maintenance checks must remain explicitly blocked, not passed.
- No recording-form changes, date/category/difficulty filters, pagination,
  new search services, saved preferences or data migrations are included.
- Source inspection supports the opportunity, not observed user difficulty,
  measured lookup frequency. Executed local implementation/acceptance evidence is
  recorded in [quickstart.md](./quickstart.md); hosted acceptance has not run.
