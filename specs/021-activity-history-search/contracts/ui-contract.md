# UI Contract: Search Activity History

**Feature**: [spec.md](../spec.md)
**Route**: Existing `/activities`; no new route, query parameter, origin metadata
or external service interface.

## Domain interface

Planned pure helper:

```ts
filterActivityHistory(
  records: readonly Activity[],
  waypointById: ReadonlyMap<string, Waypoint>,
  query: string,
): Activity[]
```

- Every whitespace-separated word must match a case-insensitive substring in
  title, full saved notes, displayed location or current linked Waypoint title.
- Words can match different fields in any order within one Activity.
  Excluded fields and unrelated Activities never contribute matches.
- Preserve input order, object identities and collections. Scope selection and
  chronology retain their existing page behavior.
- This is not a server endpoint, schema, persisted filter or cache.

## Controls

- One small labelled **Search activities** TextField in the current filter area,
  using FilterBar with the existing applicable **Recorded award** selector.
- Controls are available for valid loaded history, including empty/read-only
  data. Loading and errors take precedence; a same-mode reload does not clear query.
- Input changes update results without submission, navigation, load, save,
  dirty-draft registration or evidence downloads.
- Nonblank query has one accessible **Clear search** action: EmptyState action
  slot for no matches, input end-adornment otherwise. No duplicate actions.
- Clear only query and focus the real input. Scope controls/parameters and
  ordering remain unchanged.
- Recorded award changes, Add/Cancel and an ordinary same-route save retain query.
  Editor handlers are unchanged.

## Result-state precedence

| Condition, in order                                        | Required result                                                                            |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Load failed                                                | Existing LoadFailureAlert with specific error; no cards or empty-search fallback.          |
| Loading                                                    | Existing LoadingNotice and loading label; no empty/no-match state.                         |
| Loaded, invalid Challenge/award scope                      | Existing specific error Alert; no unfiltered recovery.                                     |
| Valid scope; dataset has zero Activities                   | Existing **No activities logged yet.** empty state.                                        |
| Dataset nonempty; unsearched valid scope has zero          | **No activities in this scope.** empty state; retain applicable controls.                  |
| Nonempty unsearched scope; nonblank query has zero matches | **No activities match "{trimmed query}".** and Clear search recovery.                      |
| Otherwise                                                  | Exact matching Activities in existing date-descending, then updated-time-descending order. |

Preserve the current loading label and ellipsis rather than changing its
wording/localization. Long echoed query text must wrap without hidden overflow.

## Result and detail compatibility

- Keep real `/activities/:activityId` links and separate Waypoint actions.
  Duplicate titles never select by display text or position.
- Preserve card dates, Waypoint subtitles, location summaries, 140-character
  note excerpts, applicable recorded-award chips and evidence counts.
  Search still uses the full saved notes.
- Existing breadcrumbs, linked-detail destinations, Idea-origin saves, evidence
  order, galleries, failed-photo feedback, tracks and mutation guards stay intact.
- A successfully saved record may be excluded by retained query/scope. Keep the
  success message and clear recovery; do not insert false matches, broaden scope
  or force unrelated navigation.
- Recompute saved changes/reloads; never match failed or unsaved draft text.

## Lifetime and access

- Fresh mount, Back/Forward after departure and refresh start empty. Existing
  explicit URL scope still behaves normally.
- Selected/effective dataset changes clear query irreversibly. Effective changes
  reset only local mode/query; same-mode reloads, declined/blocked switches and
  superseded responses do not.
- Viewer, Demo local and warned fallback browsing remain read-only with existing
  notices/warnings. No new write actions or permissions.
- No query URL/history state, browser storage, registry or persistence.

## Accessibility, layout and measurable feedback

- Reuse small outlined labels, theme spacing and responsive FilterBar. Initial
  desktop browsing results stay above the fold.
- Support keyboard typing, clear, award selection and exact link activation.
  Clear focuses input; typing/reload must not steal focus.
- Validate admin/viewer at 360 by 800 and 1280 by 800. Wrap actual long
  title/subtitle/notes/feedback; do not hide overflow or shorten fixtures.
- With 30 loaded fictional Activities, measure from final input event to correct
  observed result IDs/feedback in the same browser clock. Assert at most 1,000 ms
  for matching, no-match and clear, not eventual default-timeout success.
