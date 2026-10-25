# Contract: Activity Recording

## Scope

Applies to Activities creation, inline Waypoint recording, Idea-origin recording,
Activity editing, structured draft entry, backup import/export, and the existing
authenticated `/api/journey/{container}` API. No endpoint or route is added.

## Required data

- Serialized Activity title remains `name`: required trimmed nonempty string.
- `date`: required real `YYYY-MM-DD`, not later than today in `Europe/London`.
- UK date rules apply to new drafts, edits, loaded records, imports, replacements,
  and direct protected writes. Browser timezone cannot change the cutoff.
- Activity titles are shown as "Activity title" in the editor. Notes remain optional.
- Existing location, linked-ID, conditional award, evidence and ETag rules remain.
- Malformed/invalid write input produces a specific validation failure before any
  Cosmos write. Invalid import/replacement cannot partially change the dataset.
- Existing API success/error formats and authorization remain. Invalid stored data
  fails through the existing error boundary; do not convert it to an empty dataset.
- Cosmos Activity documents use version 5 only. Older Activity contracts fail
  explicitly and are not automatically corrected.

## Frontend save callback contract

The shared editor's callback is asynchronous and reports success explicitly:

- `onSubmit(draft): Promise<boolean>`: true only after mutation success; false
  only when the page has fully handled and displayed a failure.
- `onSaved(draft)`: optional post-save action, called only on true, after pending
  protection is released. Pages perform navigation and success UI here.
- Unexpected exceptions reject and propagate with their specific messages; the
  editor still releases its lock in `finally`. Do not blanket-catch to return false.
- Expected Activity-save errors are typed input-rejection request errors (HTTP 400) and the existing conflict error, fully displayed by the host. Retain the
  existing import-not-empty distinction for import consumers. Preserve messages;
  do not treat arbitrary HTTP failures, network failures, malformed responses or
  programming errors as expected save failures.
- For unexpected errors, release pending protection, retain the same exception,
  and throw it during editor rendering into the explicit root data-router error
  element. That element shows the original message as an application failure.
  Merely rejecting an async event handler is insufficient. Never invoke onSaved,
  substitute a generic message, or leave an unhandled promise rejection.
- `addActivity(draft): Promise<string>` returns the actual created ID after
  successful persistence. Allocate it once before the reducer action and preserve
  it through test-mode dispatch. The page retains the returned ID for its
  success callback and Idea navigation marker. Do not infer identity from fields.

This contract replaces the current `void` callback on all hosts together.

## Pending interaction

- Acquire the in-flight lock synchronously before invoking the callback.
- Repeated pointer/keyboard submits do not invoke it again while locked.
- Expose visible "Saving..." and accessible status/busy state.
- Disable modifications, Cancel, Delete, draft-mode and GPX changes while pending.
- Block link, programmatic, and history navigation that discards the editor using
  the router's supported blocker. Clear blocked attempts; do not replay them.
- Preserve data-mode protection and before-unload warning, including pristine
  edits being saved. No web application guarantee of preventing hard unload.
- After failure, allow deliberate retry/cancel; after success, navigate normally.

## Validation and optional detail

- Required title/date, required location explanation, optional-field guidance,
  and conditional "Award tier" requirement are visible with their controls.
- Submit collects errors, opens invalid sections, and focuses the first invalid
  control in reading order. Each error has a stable association with its input.
- Coordinate errors must be available with the affected latitude/longitude fields.
- Empty new GPX, References and Photos sections start closed. Existing/applied
  content opens its section; collapse never discards it.
- Collapsed sections indicate errors. A failed attempt cannot hide the control
  needed for correction.
- All controls remain usable by keyboard, with visible focus; 360x800 and
  1280x800 flows have no horizontal page overflow or clipped actions.

## Success and failure destinations

| Journey                    | Success                                                                      | Failure                                         |
| -------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------- |
| Activities                 | Close editor; "Activity saved."                                              | Same draft and specific error                   |
| Waypoint inline            | Close editor; updated history/progress and confirmation                      | Same draft and specific error                   |
| Idea origin, Idea retained | Return to originating Idea; confirmation, updated usage, saved Activity link | Stay in editor; specific error                  |
| Idea origin, Idea unlinked | Activities confirmation; no forced Idea return                               | Stay in editor; specific error                  |
| Edit Activity              | Leave edit mode; saved details and confirmation                              | Keep edits and specific error/conflict decision |

Success state on Idea is one-shot and must not replay on later navigation.
No feedback-only load, silent recovery, automatic retry, or write from section toggles.

## Date boundary acceptance examples

| Current instant        | UK today     | Accept       | Reject as future |
| ---------------------- | ------------ | ------------ | ---------------- |
| `2026-01-15T23:30:00Z` | `2026-01-15` | `2026-01-15` | `2026-01-16`     |
| `2026-07-15T23:30:00Z` | `2026-07-16` | `2026-07-16` | `2026-07-17`     |
| `2026-03-29T00:30:00Z` | `2026-03-29` | `2026-03-29` | `2026-03-30`     |
| `2026-03-29T01:30:00Z` | `2026-03-29` | `2026-03-29` | `2026-03-30`     |
| `2026-10-25T00:30:00Z` | `2026-10-25` | `2026-10-25` | `2026-10-26`     |
| `2026-10-25T01:30:00Z` | `2026-10-25` | `2026-10-25` | `2026-10-26`     |

Also reject malformed dates, impossible dates and invalid leap days regardless
of lexical comparison. Run the same cases in browser and API validation tests.
