# Data-Mode Switching UI Contract

Applies to FR-017/FR-018 and SC-007/SC-008; no endpoint contract changes.

| State                        | Request                        | Required result                                                                 |
| ---------------------------- | ------------------------------ | ------------------------------------------------------------------------------- |
| Mutation pending             | Switch via Settings            | Selector unavailable; selected mode unchanged.                                  |
| Mutation pending             | Direct context switch          | Explicit rejection; no preference update, load, or draft discard.               |
| Multiple mutations pending   | One settles                    | Switching remains blocked until all settle.                                     |
| Last mutation succeeds/fails | Switch afterward               | Pending restriction released; existing access/load rules still apply.           |
| Changed draft, no mutation   | Switch or navigate to Settings | Confirm before draft is lost.                                                   |
| Discard cancelled            | Continue                       | Preserve route, preference, and draft; do not load another dataset.             |
| Discard confirmed            | Continue                       | Discard old draft, then navigate/switch; do not carry draft across modes.       |
| Unchanged draft              | Switch                         | No discard prompt.                                                              |
| Save fails                   | Switch afterward               | Preserve dirty draft and require discard confirmation; no save-success message. |

Navigating to Settings is part of the real mode-switch journey because there is
no header selector. Do not claim protection by registering a dirty flag that is
removed only after unguarded navigation has already destroyed the draft.

Restore starts at backup-file acceptance, before file reading/validation. The
same blocking rule spans preparation and persistence; read/validation/write
failure releases it. No preference change or new mode load is allowed in that interval.

Entering Settings requires confirmation before a changed editor unmounts even
without a subsequent mode switch. Confirmed discard prompts only once. This
contract does not add a general guard for unrelated navigation.

Unapplied non-whitespace JSON counts as changed work, valid or invalid. Cancel
retains it; confirm discards it. Whitespace alone is not dirty. Clearing the text
does not clear dirty state from edits already applied to the form.
