# Data Model: Challenge Award Levels

**Feature**: [spec.md](./spec.md) | **API contract**: [journey-awards.md](./contracts/journey-awards.md)

## Persisted Fields

### Challenge

Keep existing identity, title, description, location, planned route, and
`supportsActivityCategories`. Add:

| Field               | Shape                                                      | Rule                                               |
| ------------------- | ---------------------------------------------------------- | -------------------------------------------------- |
| `awardDescriptions` | Object with exactly `bronze`, `silver`, `gold` string keys | Required when awards enabled; absent when disabled |
| Each description    | Trimmed nonblank string                                    | User supplied, not inferred                        |

Use strict validation for the descriptions object and reject an incomplete,
empty, unknown-key, or disabled-but-present configuration.

Explanations are current guidance. Updates preserve all Activity levels and do
not create criteria versions, snapshots, or reinterpretation jobs.

### Activity

Keep the existing scalar `category?: 'bronze' | 'silver' | 'gold'`.
Its optional shape is necessary for ineligible Activities, but the complete
graph determines whether it must be present.

| Linked Waypoint | Enabled memberships | Allowed category                            |
| --------------- | ------------------- | ------------------------------------------- |
| None            | None                | Absent only                                 |
| Existing        | Zero                | Absent only                                 |
| Existing        | One or more         | Exactly one fixed level                     |
| Missing record  | Unknown             | Invalid reference, not an ordinary Activity |

No award arrays, Challenge-specific award objects, or standalone award entity.
`Activity.challengeId`, where present, remains an independent validated direct
link and is not an eligibility source.

### Waypoint

Keep `challengeIds` as the sole membership representation. IDs remain distinct
and must resolve. Do not add child Activity IDs or persisted award/completion
values.

## Derived Values

### Eligible Challenges

For a Waypoint, resolve its current memberships and select Challenges with
`supportsActivityCategories === true`. The result also supplies the named
description sets shown during recording and global browsing.

### Highest Recorded Award

Select current Activities with that Waypoint ID and take the maximum of their
recorded categories under Bronze < Silver < Gold. No Activities means no award;
render "No award recorded" only when eligible.

Keep the existing calculation's internal empty-state sentinel if useful, but
never expose it as "Not Started" award wording. Internal status names are not
new persisted fields or a reason to rename all unrelated completion states.

### Challenge Statistics

Derive a typed result containing:

- Current distinct member Waypoint IDs.
- Current distinct Activities whose `waypointId` is one of those members.
- For enabled Challenges, Waypoint groups by highest tier plus a no-award group.
- For enabled Challenges, Activity groups by individual tier.
- Counts derived from group lengths, not separately calculated predicates.

For global award statistics, scope members to eligible Waypoints first and
deduplicate by entity ID across memberships. A shared Activity counts once in
each applicable Challenge but only once globally.

Use exact-tier buckets, not cumulative thresholds: a Gold Waypoint is not also
included in the Bronze and Silver Waypoint buckets.

## Lifecycle and Validation

1. Create an enabled Challenge only with all three explanations.
2. Before adding an enabled membership or enabling awards, validate the entire
   resulting graph. Existing unawarded visits block the change; do not backfill.
   Identify the blocking Activities and explain that these settings/membership
   actions do not convert unawarded history. Do not suggest assigning a tier
   while the Activity remains ineligible.
3. Record or edit an Activity with a required level when eligible. New Activity
   drafts have no tier selected; same-Waypoint edits preserve the recorded tier.
4. Move an awarded Activity only with the UI's explicit destination decision.
   The resulting persisted graph must satisfy the same category invariant.
5. Deleting an awarded Waypoint is blocked. Removing an enabled membership or
   deleting/disabling a Challenge is allowed only if every awarded Activity
   remains eligible elsewhere.
6. Allowed Challenge deletion detaches its membership IDs and direct
   `Activity.challengeId` references in the same transaction. Award categories
   are preserved. Direct links are not retained as dangling historical records.
7. Explicit Activity deletion or level editing recalculates highest awards and
   both statistical distributions. No permanent earned-tier record survives it.

Validate prospective graphs before writes and validate loaded/imported graphs.
Errors identify the relevant Activity and Waypoint; blocked maintenance
identifies the Activities needing deliberate handling.

## Serialization and Versions

- Cosmos Challenge document `schemaVersion`: 4, replacing 3.
- Activity document version: retain 5; other entity versions unchanged.
- Backup envelope: retain version 2; its contained graph uses these strict rules.
- Retain existing `id`, `datasetId`, entity `type`, partitioning, and ETags.
- No migration, dual reader, default descriptions, automatic awards, or schema
  upgrade on load. Old document versions and incompatible backups fail explicitly.
- Demo fixtures are fictional editable source, not persisted-data migration.
