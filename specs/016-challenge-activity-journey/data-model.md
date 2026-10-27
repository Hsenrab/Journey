# Data Model: Complete the Challenge Activity Journey

## Persisted entities: unchanged

Existing types and runtime schemas remain in
[visit.ts](../../src/domain/visit.ts). This feature changes no persisted fields,
schema versions, import/export formats, Cosmos documents, or API contracts.

| Entity                 | Relevant existing relationship                           | Rule preserved                                                                           |
| ---------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Challenge              | Member Waypoint IDs                                      | A Waypoint can belong to several Challenges; preserve member order.                      |
| Waypoint               | Existing once/count completion rule                      | Completion derives from Activities linked through `Activity.waypointId`.                 |
| Activity               | Optional `waypointId`, Idea links, existing award fields | Direct Challenge links, Ideas, and award levels do not independently complete Waypoints. |
| Loaded Journey dataset | Current Challenges, Waypoints, Activities                | Provider-committed data is authoritative, not a saved progress projection.               |

Backend validation, transactional mutations, role enforcement, and persisted
award history protections are unchanged.

## Transient originating-Challenge context

New typed UI state, implemented by the planned
`src/features/journey/challengeJourney.ts` helper:

| Field            | Type              | Meaning                                                        |
| ---------------- | ----------------- | -------------------------------------------------------------- |
| `challengeId`    | `string`          | Challenge from which the user explicitly opened this Waypoint. |
| `waypointId`     | `string`          | Original Waypoint route opened from that Challenge.            |
| `dataMode`       | `JourneyDataMode` | Provider-selected mode when the link was created.              |
| `activeDataMode` | `JourneyDataMode` | Actual loaded dataset mode when the link was created.          |
| `documentId`     | `string`          | Marker created in memory once per browser document.            |

`JourneyDataMode` is the existing type from
[storage.ts](../../src/services/storage.ts), with values `demo-local`,
`demo-cosmos`, and `production`. The marker is not a credential or entity ID.

Use an explicit `challengeOrigin` property in Router state. Parse incoming state
as unknown and accept it only when all of the following hold:

1. Required fields have the expected types and mode values.
2. The document marker matches this document.
3. Selected and active modes match current provider scope.
4. Data has successfully loaded; retained data during loading/failure is not valid.
5. The current route ID equals the origin Waypoint ID.
6. The current Challenge and Waypoint both exist, and membership still holds.

A missing or invalid optional origin means ordinary Waypoint navigation, not
an inferred Challenge or a suppressed load error. Read-only status does not
invalidate a loaded browsing origin.

### Lifecycle

- Create context only from an actual Challenge member/next-member link.
- Retain it through local recording, cancellation, failed saves, and successful
  confirmation while validation still passes.
- Changing the draft's destination does not change the original route context.
- Resolve labels from current loaded titles; do not snapshot names.
- A reload, changed scope, deleted Challenge/Waypoint, or removed original
  membership invalidates the return.
- Do not propagate this context to Activity details/editing.
- Do not store it in Journey data, local/session storage, or a new global store.

## Derived Challenge completion

The shared summary contains `completed`, `total`, and `percentage`.

- `members = challengeWaypoints(challenge, waypoints)`, retaining existing order.
- `completed = completedWaypointCount(members, activities)`.
- `total = members.length`.
- `percentage = total === 0 ? 0 : Math.round((completed / total) * 100)`.

The Challenge page chooses the first member whose existing
`waypointCompletionProgress` is incomplete. Complete and empty Challenges have
no next-incomplete member. Activity counts are not capped at a count target.
For example, a 3-visit target at 2 visits is incomplete; at 3 or 4 it is complete.

These are render-time projections of loaded data. No stored completion,
optimistic increment, cache, additional fetch, or alternate award arithmetic is
introduced.

## Draft validation and save feedback

The existing Activity draft shape is unchanged. A pure extracted validator has
a domain-owned typed input containing raw form values (including UK-date and
coordinate strings) and existing eligibility context. It returns the current
field-error map plus a normalized location when the location is valid. It retains
current error keys/messages and all title, date, location, award, acknowledgment,
reference, and photo rules. The helper does not import React, editor-local types,
or the provider's already-normalized `ActivityDraft` submission type.

Local editor feedback separately tracks reported field/group keys. A corrected
field may lose its visible error without losing the fact that it was reported.
Dependent location/award groups and indexed collection sections are revalidated
with current values; collection removal/reordering must not retain errors on the
wrong row. Feedback state itself is not persisted or counted as a draft edit.

Waypoint success state identifies the committed Activity ID. Resolve the
Activity's current linked Waypoint from loaded data when explaining contribution;
do not use an old draft or receipt as current progress. A removed/reassigned
Activity must not retain a false contribution message or a broken record link.

| Transition                           | Required state/result                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Open Log activity                    | Existing initial Waypoint; first required field visible and focused.                              |
| Invalid submit                       | Report errors, focus first invalid field, no mutation.                                            |
| Correct reported field/group         | Update only applicable feedback, retain values/unrelated failures, no focus move or mutation.     |
| Valid submit                         | Existing pending mutation lock; no success state yet.                                             |
| Expected save failure/conflict       | Retain draft and explicit failure; no confirmation or return-triggered write.                     |
| Successful save                      | Provider adopts committed data; close editor; reveal/focus confirmation once; remain on Waypoint. |
| Cancel/discard                       | Existing dirty decision; no success confirmation.                                                 |
| New return during dirty/pending work | Existing shared registry confirms discard; synchronous pending lock blocks navigation.            |

These transitions describe existing page/editor state plus the new feedback;
they do not require a new state-machine library or provider.
