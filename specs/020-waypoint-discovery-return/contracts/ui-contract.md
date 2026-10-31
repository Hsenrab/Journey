# UI Contract: Waypoint Discovery Return

This is a user-interface/navigation contract, not a new HTTP API.
See the [specification](../spec.md) and [navigation model](../data-model.md).

## Entry and capture

- Existing `/waypoints` search, Area, Category, sort and applicable highest-award
  filtering retain their meanings and labels.
- Challenge and award scope continue to use their existing URL parameters.
- An unmodified same-tab result activation records that list entry's criteria
  and Waypoint ID. Use stable IDs, including when titles are duplicates.
- Retain actual link URLs, Enter activation and modified-click/new-tab behavior.
  A new tab has no inherited discovery session.
- Do not capture editor state or create another history entry before opening
  detail. No navigation-only operation writes records.

## Waypoint detail breadcrumb

| Origin                                           | Label / destination                               | Context                                        |
| ------------------------------------------------ | ------------------------------------------------- | ---------------------------------------------- |
| Current captured list                            | Back to Waypoint results; originating scoped list | Restores captured criteria and selected ID     |
| Dataset-invalidated list                         | Waypoints; bare fresh list                        | No old criteria, scope or selection            |
| Direct, refreshed, Idea, Map or uncaptured entry | Existing Waypoints return                         | No invented list origin                        |
| Existing Challenge journey                       | Existing breadcrumb and named Challenge return    | Existing `challengeOrigin` remains independent |

The contextual return remains available when the opened Waypoint has been
deleted or is unavailable; load/scope failures remain failures.
Reuse the breadcrumb rather than adding a second competing list-return button.

For the newly originated return, use `confirmNavigation('Waypoint results')`
once on a plain activation. Declining preserves the editor, errors, route and
draft contents. Pending work blocks the action. A permitted return performs
the ordinary navigation. Do not change editor Cancel dialogs or introduce a
global navigation blocker. Existing non-dirty browser Back remains a supported
round trip; this feature does not expand unrelated dirty browser-Back behavior.

## List return

Both the breadcrumb and browser Back must:

1. Restore all captured criteria before producing the list; preserve active
   secondary-filter counts and intentional Challenge scope.
2. Use current loaded records and existing ordering/domain rules.
3. Once successfully loaded with valid scope, bring the opened Waypoint's link
   into view and give it visible keyboard focus.
4. If the record exists but no longer matches, instead focus:
   **The Waypoint you opened no longer matches these filters.**
5. If the record was deleted, instead focus:
   **The Waypoint you opened is no longer available.**
6. Never focus a different duplicate-title result or a former array position.
7. Do not refocus on later typing, Clear filters, option changes, expanded
   secondary filters, rerenders or background record changes.

If a selected Area/Category disappears from current options, retain that
criterion with a **(no current waypoints)** option label. The unchanged predicate
may produce no matches; no stale entity is added.

Clear filters removes search, Area, Category and highest-award filtering.
It does not remove Challenge scope or deliberately change sort. Preserve
existing award applicability rules after loading; never reset restored sort
merely because loading temporarily has no award metadata.

## Dataset and refresh boundaries

- A selected or effective dataset change invalidates all previous captured
  contexts, including entries later reached by browser Back.
- Returning then uses empty search, no filters or Challenge scope, Name sort
  and no previous selection. Switching back does not revive an old context.
- Reset recognized captured entries only. Explicit invalid scope on an
  unrelated direct entry still produces its normal error.
- Refresh destroys the captured return context. Existing explicit URL
  Challenge/status values retain their normal independent behavior.
- Preserve the existing visibly warned, read-only Demo local fallback. This
  feature introduces no new fallback for load or navigation failures.

## State precedence and access

1. Loading: existing loading treatment; no stale results or missing-result claim.
2. Load failure: specific existing failure message; no empty-success treatment.
3. Invalid Challenge/award scope: explicit scope error; no unfiltered substitution.
4. Valid loaded return: current matches or focused absence explanation.
5. Empty dataset: explicit no-Waypoints empty state.
6. Nonempty dataset without matches: existing no-match state and filter controls.

The absence explanation may accompany a truthful empty/no-match state.
It must not replace a load/scope error. Invalidated origins have no selected
result and therefore do not produce a missing-result explanation.

Admins and viewers can browse/return without writes. Demo local stays read-only.
Keep `ReadOnlyNotice`, its Settings link, existing write-action gates and save
confirmation focus. Use MUI and shared theme spacing; no overflow hiding.

At 360 by 800 and 1280 by 800, verify visible focus and no horizontal page
overflow with long labels and a selected result below the initial screen.
On initial desktop list entry, primary list content remains visible without
scrolling. Intentionally scrolling to a returned result is not a layout failure.
