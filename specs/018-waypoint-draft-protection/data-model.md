# Data Model: Waypoint Draft Protection

**Feature**: [spec.md](./spec.md)

No persisted entity, backup, schema version, Cosmos document or API payload changes.
Only the existing editor's transient lifecycle becomes explicit.

## Existing records and draft

| Concept        | Relevant content                                                                  | Invariant                                                                        |
| -------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Saved Waypoint | Existing ID, content, membership, completion, location and evidence IDs           | Cancel changes no saved record.                                                  |
| Waypoint draft | Form fields, Challenge selections, completion, location and ordered evidence rows | Declining preserves every current value and position.                            |
| JSON draft     | Current/last-applied text and parse issues                                        | Unapplied non-whitespace text contributes to dirtiness; comparison is unchanged. |
| Visible errors | Component validation/JSON errors and existing parent message                      | Declining clears nothing; failure uses existing presentation.                    |

Initial values remain those already selected by the editor and parent. Do not
create a normalized baseline or change evidence loading.

## Local UI state

| State            | Representation                                                   | Lifetime                                                     |
| ---------------- | ---------------------------------------------------------------- | ------------------------------------------------------------ |
| Dirty            | Existing `formDirty` plus the current unapplied-JSON condition   | Derived from the current draft.                              |
| Saving           | Boolean state for rendering and ref for immediate exclusion      | Valid submission until callback settlement.                  |
| Fatal error      | Nullable envelope containing the original `unknown` thrown value | An escaped rejection causes a render-time throw to the root. |
| Discard decision | Native-confirm return value                                      | Consumed during Cancel; not stored.                          |

The fatal envelope distinguishes no failure from a rejection whose value is
itself falsy. No serializable state machine or shared lifecycle service is added.

## State transitions

| Starting condition    | Event                             | Result                                                                          |
| --------------------- | --------------------------------- | ------------------------------------------------------------------------------- |
| Not saving, unchanged | Cancel                            | Parent Cancel once; no prompt/write.                                            |
| Not saving, changed   | Cancel, decline                   | Exact editor retained; no callback, reset or write.                             |
| Not saving, changed   | Cancel, accept                    | Parent Cancel once; parent closes the abandoned editor.                         |
| Not saving            | Invalid submission                | Existing validation; no saving lock or mutation.                                |
| Not saving            | Valid submission                  | Capture validated payload, synchronously lock and invoke async callback once.   |
| Saving                | Cancel or repeated submit attempt | No extra callback, confirmation or editor closure.                              |
| Saving                | Parent handles success            | Existing success/close behavior; local lock released on settlement.             |
| Saving                | Parent handles failure            | Release lock; retain draft, tab and existing failure information.               |
| Saving                | Callback rejects unexpectedly     | Release lock; surface exact thrown value at the root, without fallback/success. |
| Abandoned editor      | Open again                        | Saved values/new defaults, not abandoned draft recovery.                        |

## Validation and relationship rules

All current Waypoint validation remains authoritative, including count targets,
coordinates, required content, evidence URLs and protected Challenge/award history.
Cancelling runs no new validation.

Whitespace-only JSON and tab switching alone remain clean. Restoring all initial
values is clean when no unapplied JSON remains. Loading JSON can change the form;
clearing its input does not make those form changes disappear.

Roles and dataset permissions stay outside this state model. Read-only users
receive no new editor or mutation path.
