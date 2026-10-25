# UI Contract: Challenge Member Progress

## Surface and inputs

Existing `/challenges/:challengeId` page and its Waypoint cards, using only the
active loaded Journey dataset. This contract adds no endpoint or mutation.

Membership remains Waypoint-side Challenge assignments. Each listed member uses
the existing domain completion helper and formatter with current Activities.

## Member entry

Preserve title, description, ordering, and View waypoint destination. Insert a
compact textual progress block between the description and navigation action.

- Once mode: `Completion: Done` or `Completion: Not done`.
- Count mode: `Completion: {actual count} of {target} activity/activities`
  plus explicit `Done` or `Not done` derived from the same completion result.
- Singular wording follows target one, not current count.
- Never cap the actual count at target or calculate state from an award tier.

Count text and completion text must be visibly within the same member card and
available to assistive technology. Do not add interactive semantics or a live
region solely for this display. Any colour is supplementary.

## Permissions and lifecycle

All roles and data modes that can read the Challenge can read this information.
Rendering causes no mutation, extra data request, local-storage record write,
or change in permitted actions. Existing labelled read-only notices remain.
Already-loaded changes recalculate naturally; no new refresh mechanism is added.

## Preserved behaviours

- Empty member list keeps its existing message and no fabricated progress rows.
- Loading, failed load, and missing Challenge remain distinct.
- Existing route attachment/removal, draft handling, conflict handling, map
  visibility, planned routes, and recorded tracks are unchanged.
- No changes to overview totals, member filtering/sorting, or award summaries.

## Responsive acceptance

At 360x800 and 1280x800 CSS pixels, test long titles and count labels:

1. Labels are readable and not clipped or overlapping title/description/actions.
2. The page has no horizontal overflow.
3. View waypoint stays visible within each card and remains keyboard operable.
4. Completion remains understandable without colour.

Use existing MUI layout/theme and `docs/UI_GUIDELINES.md`; do not introduce a
second card or styling convention.

## Acceptance trace

| Contract area                    | Spec requirements     | Proof                                                             |
| -------------------------------- | --------------------- | ----------------------------------------------------------------- |
| Once/count labels and states     | FR-001 through FR-004 | Card-scoped cases from data-model table                           |
| Membership and loaded changes    | FR-005, FR-006        | Overlap, unrelated/direct links, add/delete/reassign cases        |
| Preserved page behaviour         | FR-007, FR-010        | Existing Challenge details tests and scoped regression assertions |
| Roles/read-only and no writes    | FR-006, FR-008        | Mocked viewer/admin/Demo cases with mutation spy                  |
| Association/accessibility/layout | FR-009                | Card-scoped text and 360/1280 browser checks                      |
