# UI Contract: Idea-to-Waypoint Navigation

**Feature**: [spec.md](../spec.md)
**Data rules**: [data-model.md](../data-model.md)

The user-facing interface changes only on `/ideas/:ideaId`. No HTTP endpoint,
request schema, role, or route registration changes.

## Linked destinations

| Condition                                              | Required result                                                             |
| ------------------------------------------------------ | --------------------------------------------------------------------------- |
| One available destination, not editing                 | One named anchor to `/waypoints/{waypointId}`                               |
| Multiple available destinations, not editing           | One independently focusable anchor per record, in association order         |
| Duplicate destination titles                           | Separate anchors with distinct identity-based targets                       |
| No linked destinations                                 | Explicit none-linked text, with no empty or dead control                    |
| Editing, pending save, or failed save with editor open | The same saved destination names as non-interactive text                    |
| Cancel completes or save succeeds                      | Restore links using the current saved associations                          |
| Existing dirty-Cancel prompt is declined               | Retain editor/draft and plain-text destinations                             |
| Viewer or another read-only state                      | Navigation remains available; mutation/recording actions remain unavailable |

The section keeps the visible label "Linked waypoints". Each link's visible
title supplies its accessible name. Use native anchor behavior: ordinary
activation stays in the same tab, keyboard activation works, and modified
activation is not replaced with a custom click-only handler.

Long labels, including unbroken text, must wrap. No horizontal page overflow is
allowed at 360x800 or 1280x800. Keyboard focus must be visible. Use MUI and shared
theme spacing rather than fixed-width controls or a new styling system.

## Meaning and preserved behavior

- Planning state remains separately labelled.
- Brief copy explains that linked Waypoints are planning associations.
- Activity usage remains separately labelled, with brief copy explaining that
  it counts Activities that explicitly used the Idea.
- An Activity at an unassociated Waypoint, or without a Waypoint, contributes
  usage when it references this Idea. It does not alter the Idea's destinations
  or planning state.
- Destination navigation issues no mutation request and changes no record.
- Existing reference links, Activity-usage links, read-only notices, and the
  Idea editor's existing confirmation/error behavior are unchanged.

## Activity-entry regression contract

| Available linked destinations | Existing entry target                                      |
| ----------------------------- | ---------------------------------------------------------- |
| Zero                          | `/activities?mode=add&idea={ideaId}`                       |
| One                           | `/activities?mode=add&idea={ideaId}&waypoint={waypointId}` |
| More than one                 | `/activities?mode=add&idea={ideaId}`                       |

Only a successful save retaining the initiating Idea produces the existing
return to that Idea with "Activity saved" and its Activity detail link.
Cancellation, failure, and a saved Activity with that Idea removed must not
produce that return-with-success result.

## Unavailable records and failures

Do not create a link for an unavailable destination. A removed record or
dataset change continues to use the destination page's existing missing-record
handling. An unavailable Idea retains the existing "Idea not found" state.
Loading and explicit load failures must not become an empty-list success state.
Do not add retries, cached data, repair logic, or a new error boundary.

## Acceptance evidence

- Page tests prove targets, independent links, empty state, associations/usage,
  read-only presentation, and editing/save/cancel transitions.
- Browser tests prove actual destination routing, keyboard activation and focus,
  and measured overflow for admin/viewer at both required viewports.
- Include a Demo local read-only check and a valid dataset-change/missing-record
  scenario; do not manufacture invalid persisted data to bypass validation.
- Evidence names the role, data mode, viewport, outcome, and whether API traffic
  was intercepted. Mocked responses do not prove hosted identity, authorization,
  Cosmos writes, geocoding, or resolution of #174.
