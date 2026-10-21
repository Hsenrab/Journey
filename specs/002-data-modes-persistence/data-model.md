# Safe Mode Switching: Transient State

No persisted entities, storage keys, or schemas change.

## Pending mutation

- Tracks all active save/delete/route/restore/clear operations across page lifetime.
- Constraint: switching remains blocked until every pending operation settles.
- Transitions: idle -> pending -> idle; both success and failure release participation.
- Original dataset and request payload remain bound when the operation starts.
- Restore participation starts at backup-file acceptance before reading/validation,
  continues through persistence, and releases on read, validation, or write failure.
- Failures retain their specific errors; no retry or success notification on failure.

## Editor draft participation

- Uses existing baseline/current draft comparison: unchanged or changed.
- Includes Waypoint, Idea, Activity, Challenge creation, and planned-route drafts.
- Non-whitespace unapplied JSON is changed state, even when invalid; whitespace
  alone is not. Clearing JSON does not clear dirty state from applied form edits.
- Changed + cancel discard: route, mode preference, and draft remain unchanged.
- Changed + confirm discard: old draft cleared before navigation/switch.
- Entering Settings from a changed editor confirms before unmount even without a
  later mode switch; accepted discard must not cause a second mode-selection prompt.
- Unchanged: no confirmation.
- Failed save retains changed state; successful save/unmount removes stale registration.
- Neither draft contents nor registration persist across application sessions.
