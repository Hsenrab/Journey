# Data Model: Activity Recording Experience

## Activity

Retain the existing entity shape except for stricter validation:

| Property                                     | Contract                                                                                      |
| -------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `activityId`                                 | Existing stable identifier; unchanged                                                         |
| `name`                                       | Required string, trimmed and nonempty; displayed as Activity title                            |
| `date`                                       | Required `YYYY-MM-DD`, real calendar date, no later than current UK date                      |
| `waypointId`, `challengeId`, `ideaIds`       | Existing optional/supported relationships and integrity rules                                 |
| `location`                                   | Existing required postcode/coordinate location; API persistence requires resolved coordinates |
| `category`                                   | Existing optional award value, conditionally required by the editor                           |
| `notes`, references, photos, `recordedTrack` | Existing optional evidence and ordering semantics                                             |
| `createdAt`, `updatedAt`                     | Existing timestamps; not subject to Activity-date cutoff                                      |

Identical titles/dates are not unique identifiers. No generated title and no
date shifting. Display title is always `name`; date remains supporting text.

## Cosmos envelope

- Activity `schemaVersion` becomes **5**, replacing versions 3 and 4.
- Keep `id`, `datasetId`, `type`, partitioning, ETags, and other entity versions.
- Old version or invalid Activity data is an explicit load/write failure.
- No migration, in-place hosted correction, fallback title, or filtering.
- Production failures still block writes; preserve only the existing visibly
  warned Demo Cosmos-to-local fallback.

## Activity draft

`ActivityDraft.name` and the corresponding JSON draft property are required
strings. The date remains a calendar string. Existing Waypoint/Idea preselection,
location prefill and attachments remain unchanged. Applying JSON validates first
and populates a form; it does not write records.

Backup import and replacement data validate the whole dataset before writing.
Export still contains only the active successfully loaded dataset.

## UK date rules

- Zone: `Europe/London`, including BST.
- Compute current UK date when validating; never freeze it at module load.
- Derive the initial form date using the same helper.
- Compare valid zero-padded calendar strings only after real-date validation.
- No timestamp conversion of a stored Activity date.
- Date tests can supply a fixed instant; production uses the current clock.
- No user-configurable zone or timezone service.

## Save lifecycle (ephemeral UI only)

| State   | Entry                                     | Allowed behavior                                                               |
| ------- | ----------------------------------------- | ------------------------------------------------------------------------------ |
| Ready   | Editor opened or previous attempt settled | Edit, validate, cancel with existing dirty confirmation                        |
| Invalid | Submit fails local validation             | Retain draft, reveal/focus first error, no mutation                            |
| Saving  | Valid submit acquires synchronous lock    | Announce saving; block duplicate/conflicting actions and discarding navigation |
| Failed  | Handled mutation failure                  | Show exact error/conflict action; unlock and retain draft for deliberate retry |
| Saved   | Mutation succeeded and lock released      | Run page-specific success callback/destination                                 |

No serialized save-state record, background retry, queue or idempotency database.
Unexpected rejection releases the lock before propagating its specific error.
The local duplicate guard is not a guarantee against ambiguous network outcomes,
multiple tabs, or independently initiated saves.

## Optional sections (ephemeral UI only)

Separate expanded flags for GPX, References and Photos. Empty new sections start
closed; populated initial/applied sections open. Toggling does not remove content.
An invalid section opens for correction and its summary indicates errors.
Control/error associations and focus targets follow actual rendered reading order.

## Success feedback (ephemeral routing state)

A typed Activity-saved marker identifies the actual saved Activity, not a guessed
title/date match. IdeaDetails shows it once after successful return and consumes
it by replacing history state without the marker. Derived usage remains sourced
from Activity links. Do not persist notifications or fetch solely for confirmation.
