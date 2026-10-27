# UI Contract: Complete the Challenge Activity Journey

**Authority**: [specification](../spec.md).
**State definitions**: [data model](../data-model.md).
**Scope**: Existing frontend routes and components; no new public HTTP contract.

## Navigation and provenance

| Surface/action                                         | Destination and behavior                                                                               |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Dashboard Challenge card                               | Existing `/challenges/:challengeId`.                                                                   |
| Challenge member or next-incomplete-member link        | Existing `/waypoints/:id`, carrying validated `challengeOrigin` Router state.                          |
| Originated Waypoint, including editor and confirmation | Named `Back to [original Challenge]` action to `/challenges/:challengeId`, while origin remains valid. |
| Challenge details                                      | Visible page-level `Back to Dashboard` action to `/challenges`.                                        |
| Direct/list/reloaded Waypoint without valid origin     | Ordinary Waypoints navigation; do not infer a Challenge.                                               |
| Activity details/editing and other creation entries    | Existing destinations and navigation unchanged; no propagated Challenge origin.                        |

Each return leg is one action on both viewport sizes without a menu or browser
Back. Existing normal Waypoints navigation remains available. Use existing
detail headers/MUI links and buttons, not a new navigation component.

The origin resolver checks document, route, both data modes, successful load,
current existence, and original membership. Current loaded names label links.
An optional invalid origin is omitted; actual load/missing-record failures remain
explicit. Opening a direct URL/new document does not invent origin state.

### Guard contract

All newly introduced returns use the provider's generalized navigation
confirmation. Its existing Settings and data-mode consumers use the same API.

| State                                                   | Result                                                            |
| ------------------------------------------------------- | ----------------------------------------------------------------- |
| No dirty draft or pending mutation                      | Follow destination normally.                                      |
| Registered dirty draft, user declines discard           | Stay on page with unchanged draft and feedback.                   |
| Registered dirty draft, user accepts discard            | Navigate once; no write and no success confirmation.              |
| Pending mutation, including before a disabling rerender | Block navigation without discarding or starting another mutation. |

Preserve keyboard activation and existing modified/new-tab link behavior.
Do not introduce duplicate prompts. Challenge route/award drafts and Waypoint
Activity drafts must use the existing registration, not page-specific guesses.

## Challenge progress and next step

- Put the completion summary and next-member action near the page heading,
  before long descriptive content and optional map/route administration.
- Show completed/total Waypoints and the shared rounded percentage. Explain
  that percentage counts completed Waypoints, not recorded Activities.
- Use the first incomplete member in existing member order. No new ranking,
  member reordering, or next-member action for complete/empty Challenges.
- Preserve each member's current once/count explanation, exact actual count,
  and route capabilities. Thresholds, award eligibility, and membership do not
  change.
- After a successful write, all views derive from committed provider data;
  do not request or save separate progress. Partial count increments and
  crossing a completion threshold must produce their distinct correct results.
- Loaded deletion/reassignment overrides any earlier save receipt when
  reporting current contribution.

| Data state                         | Required presentation                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Loaded with zero members           | Explicit empty state; 0/0 and 0% if a numeric summary is shown; no next action.                        |
| Loaded with members, zero progress | Accurate zero progress and first incomplete action.                                                    |
| Loaded, partially complete         | Accurate member counts/aggregate and first incomplete action.                                          |
| Loaded, complete                   | Accurate 100% summary; no misleading incomplete action.                                                |
| Loading                            | Explicit loading, not an empty or zero-progress assertion.                                             |
| Failed load                        | Explicit failure, not current-looking retained progress. Production never substitutes Demo/stale data. |
| Missing record in loaded data      | Existing missing-record state, distinct from load failure and empty membership.                        |
| Demo Cosmos load exception         | Preserve visible warning and loaded read-only Demo local identity; no stale Cosmos origin.             |

## Recording, correction, and confirmation

### Entry and Save reach

Opening Log activity on a Waypoint reveals and focuses the first required
editable field. This is an explicit entry opt-in, not a global focus change
for Activities, Idea-origin forms, or Activity editing.

Empty GPX/reference/photo sections stay collapsed; sections with existing
content retain their editing behavior. With a minimal valid draft and those
sections collapsed, Save must be fully visible/actionable after at most one
additional viewport-height of scrolling from the last applicable required
field. No Waypoint history intervenes. Do not add duplicate/sticky controls
unless measured evidence requires a directly justified layout change.

### Reported-field correction

Update visible errors and accessible invalid indications no later than blur or
completion of a requirement-changing selection. Keep errors on still-invalid
values. Revalidate reported dependent groups using current values:

- Title and existing UK-date constraints.
- Postcode/coordinate mode, paired coordinate requirements, numeric/range rules.
- Waypoint-driven award eligibility and existing award-removal acknowledgment.
- Indexed reference/photo title, HTTPS link, and applicable preview fields.

Do not show all untouched fields as newly invalid merely because another
reported field changed. Do not move focus, write records, discard attachments,
clear unrelated errors, or clear a save/conflict/GPX failure during correction.
Submission retains first-invalid focus and duplicate-submit protection.

### Successful save

Success is shown only after the existing mutation succeeds and adopts committed
data. Stay on the Waypoint, close the editor, and reveal/focus the confirmation
container once. The container is programmatically focusable; its return button
does not receive automatic focus. No automatic navigation occurs.

Keep the valid original Challenge return even if the saved Activity is unlinked
or now belongs elsewhere. State non-contribution explicitly rather than imply a
progress increase. If another member of that same Challenge received the
Activity, show the actual derived Challenge progress without incrementing the
original Waypoint. Failed, pending, cancelled, or merely corrected drafts never
trigger success focus or a success message.

## Awards, readers, and accessibility

Preserve feature 017: completion and awards remain separate; omit inapplicable
award indicators, use `No award recorded` in an explicit applicable award
context, and distinguish highest-versus-recorded awards. Recently visited
continues showing completion. Do not add award requirements to ordinary
Challenges or alter exact scoped statistics/history protections.

Viewers and read-only Demo users receive identical browsing/progress for
identical loaded data. Hide recording/route-write controls, show the existing
`ReadOnlyNotice` and Settings link, and perform zero writes.

At 360x800 and 1280x800, verify no horizontal page scrolling, clipped/overlapping
actions, or colour-only status. Long titles/messages wrap. Controls remain
keyboard-operable with visible focus; focus targets must be visible rather than
hidden under the application header. Follow the
[UI guideline self-review](../../../docs/UI_GUIDELINES.md).

## Requirement coverage

| Requirement | Design/acceptance boundary                                                                                |
| ----------- | --------------------------------------------------------------------------------------------------------- |
| FR-001      | Explicit origin resolver and named return in browsing/editor/confirmation; no Activity-details extension. |
| FR-002      | Success transition, container focus, original return and truthful contribution.                           |
| FR-003      | Page-level Dashboard return; ordinary direct/list Waypoint navigation.                                    |
| FR-004      | Shared guard; document/route/mode/existence/membership checks.                                            |
| FR-005      | Shared completed/total/percentage summary and explanation.                                                |
| FR-006      | Provider-committed derivation on Challenge/member/Dashboard views.                                        |
| FR-007      | Existing-order incomplete-member action before route controls.                                            |
| FR-008      | Distinct empty/loading/missing/failure states and empty 0%.                                               |
| FR-009      | Award applicability, explicit unrecorded label, completion distinction.                                   |
| FR-010      | Recently visited completion and separately correct awards.                                                |
| FR-011      | Shared reported-field/group revalidation before resubmission.                                             |
| FR-012      | No correction-induced writes/focus/data loss or erased failures.                                          |
| FR-013      | Waypoint-only entry focus and measured one-viewport Save reach.                                           |
| FR-014      | Exact viewport, keyboard, wrapping, overflow and accessible-error checks.                                 |
| FR-015      | Reader parity, notices and zero writes/controls.                                                          |
| FR-016      | Existing validator, destinations, guards, awards, evidence, and route regressions.                        |
| FR-017      | Update Dashboard, Waypoint and Activity user guidance.                                                    |

| Success criterion | Required evidence                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| SC-001            | Both named return legs succeed in one action at both viewports.                                     |
| SC-002            | Exact once/count/zero/partial/threshold/above-target/shared/empty assertions.                       |
| SC-003            | Summary and correct next member precede optional administration.                                    |
| SC-004            | Award/Recently visited regressions preserve feature 017 wording and distinctions.                   |
| SC-005            | Corrected and still-invalid fields have accurate accessible feedback without side effects.          |
| SC-006            | Actual focused elements and measured Save scroll at both sizes; keyboard actions.                   |
| SC-007            | Eight viewport x role x zero/partial combinations; admin recording, viewer zero writes.             |
| SC-008            | Explicit failure/cancel/pending/invalid-origin/read-only outcomes and success-only container focus. |
