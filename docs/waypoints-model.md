# Waypoints model

## Meanings

### Waypoint

A standalone destination, experience, or activity worth doing.

Examples:

- Visiting a historic building
- Learning to juggle
- Attending a concert

Waypoints can exist independently or be included in one or more challenges.
Location data is optional.

### Challenge

A structured collection of waypoints with a shared goal.

Examples:

- A seasonal walk collection
- Historic buildings challenge

Challenge members are derived from `Waypoint.challengeIds` instead of duplicating
waypoint records or storing a second membership list.
Location data is optional.

### Idea

A planning and research record. Ideas never become Activities; an Activity is an
independent historical record that may have been inspired by zero or more Ideas.

```ts
type Idea = {
  ideaId: string
  title: string
  description: string
  notes: string
  waypointIds: string[]
  planningState: 'active' | 'someday' | 'rejected'
  rejectionReason?: string
  difficulty: 1 | 2 | 3 | 4
  location?: WaypointLocation
  referenceIds: string[]
  createdAt: string
  updatedAt: string
}
```

- `title` is required; `description` and `notes` may be empty.
- `waypointIds` holds zero, one, or many distinct existing Waypoint IDs.
- Ideas hold research links through `referenceIds` and never hold photos.
- `rejectionReason` is required when `planningState` is `rejected` and must be absent
  otherwise.
- The API owns `createdAt` and `updatedAt`.
- Location data is optional.

### Activity

A real-world event that happened. Activities are the completion/progress evidence.

Examples:

- Visited Calke Abbey on a specific date
- Practised juggling in a park
- Walked a local trail

Activities link to at most one Waypoint through `waypointId` and to Ideas through
`ideaIds: string[]`, which holds zero, one, or many distinct existing Idea IDs. An
Activity may combine several Ideas, represent something entirely new, reference Ideas
attached to other Waypoints or to no Waypoint, and be unattached itself. Activities
**must** include structured location data before they are saved (`postcode` or
coordinate pair).

Every Activity requires a nonempty title (the serialized `name` field) and a real
calendar `date` in `YYYY-MM-DD` format, no later than today in UK time
(`Europe/London`, including British Summer Time). New drafts prefill the UK date;
stored dates are not shifted by time zones. Duplicate titles/dates are allowed.
Missing titles and invalid/future dates are rejected on forms, imports, loaded
data and protected writes, not generated or silently corrected.

The editor shows saving feedback and blocks duplicate submission, conflicting
changes and discarding in-app navigation until saving settles. Expected input
errors/conflicts retain the draft for deliberate retry; unexpected failures keep
their original message at the application root. Hard unload retains the browser's
warning, not a guarantee that closing can be prevented.

GPX, References and Photos are optional collapsible sections; populated sections
open and validation reveals fields needing correction. Conditional awards are
labelled Award tier and are separate from completion. Successful Idea-origin
recording returns to the retained Idea with one-shot confirmation and updated
usage; removing that Idea link keeps the Activities destination.

## Saved locations always carry coordinates

Supplied Waypoint and Activity locations require `latitude` and `longitude` before
persistence. Waypoint form saves use atomic dataset replacement: searchable
place/address-only Waypoints are resolved once with Azure Maps Search before the
strict saved dataset is validated and written. One failed resolution rejects the
entire change, including supporting records. Imports still require resolved
coordinates.

When editing a Waypoint, changing place/address text with the saved coordinate
pair untouched submits the new text without that stale pair. Clearing both
identifying fields with the pair untouched removes the entire location, including
source and approximate metadata. A valid pair whose numeric values changed is
authoritative; unchanged coordinate-only locations and metadata-only edits retain
their coordinates. Whitespace-equivalent text and numerically equivalent coordinate
formatting are not location changes. Partial/invalid coordinates and metadata without
searchable text or coordinates are rejected. Failed saves retain the visible draft.

Entity create/update can resolve Activity postcode input, but Activity
postcode-only dataset replacement remains unsupported and tracked in
[#174](https://github.com/Hsenrab/Journey/issues/174). This Waypoint repair does not
change that boundary. Waypoint and Idea locations remain optional.

## Relationships

- A waypoint may belong to many challenges, stored only in `Waypoint.challengeIds`.
- Challenge members are derived from those assignments; Challenges store no
  duplicate `waypointIds` list. IDs must be distinct and refer to existing Challenges.
- Removing the last category-enabled assignment is rejected if it would invalidate
  existing awarded Activities. Drafts and saved history are retained, not cleared.
- A waypoint may have many activities.
- Waypoints never store Idea or Activity child-ID arrays; Ideas link to Waypoints
  through `Idea.waypointIds` and Activities through `Activity.waypointId`.
- An activity can be linked or independent.

### Derived Idea usage

Idea usage is derived exclusively from Activities whose `ideaIds` contain the Idea ID.
`used`, usage counts, completing Activities, and Activity IDs are never persisted on an
Idea. `planningState` and derived usage are independent: an Idea may be Active and used,
or Rejected and historically used.

Domain helpers in `src/domain/visit.ts` expose both directions without duplicated
persisted reverse links:

- `ideasForWaypoint(ideas, waypointId)`
- `activitiesForWaypoint(activities, waypointId)`
- `ideasForActivity(ideas, activity)`
- `activitiesUsingIdea(activities, ideaId)`
- `ideaUsageCount(activities, ideaId)`

Example: an Idea attached to `waypoint-a` may be used by an Activity recorded under
`waypoint-b` or by an unattached Activity. Moving or relinking an Idea changes only
`Idea.waypointIds`; existing Activity history is never rewritten. Multiple Activities
may use the same Idea and one Activity may use multiple Ideas.

## Completion and progress

Waypoint completion mode supports:

- `once` (completed after at least one activity)
- `count` (completed after a target number of activities)

Challenge progress is derived from completed waypoints. Waypoint completion derives
only from Activities linked through `Activity.waypointId`, never from Idea state or
derived Idea usage.

Challenge completion is the percentage of waypoints whose completion rule has been
met: for `once` waypoints, any linked activity completes the waypoint regardless of
category; for `count` waypoints, completion requires the target number of linked
activities.

Bronze/Silver/Gold describe the level of an individual visit, not Challenge
completion milestones. Most Challenges have awards disabled. An enabled Challenge
requires three explicit nonblank `awardDescriptions` explaining its fixed levels;
disabled Challenges omit the descriptions. The guidance can be edited after
recording without reclassifying visits or retaining earlier explanation versions.

An Activity requires exactly one award when its Waypoint belongs to any enabled
Challenge, and forbids an award otherwise. All named explanation sets are shown;
one level applies across shared memberships. New drafts have no tier selected.
Same-Waypoint edits retain the recorded level; moves to another eligible Waypoint
require a deliberate choice. Moving to an ineligible destination requires
acknowledgement of award removal before saving. Required awards are also enforced
on imports, loads, JSON application, and protected writes.

`waypointCompletionProgress()` in `src/domain/visit.ts` is the single source for a
waypoint's completion state. The waypoint detail page and list cards show it as a
"Completion" chip (`Done`/`Not done` for `once`, `N of target activities` for
`count`). Eligible Waypoints separately show "Highest recorded award" or
"No award recorded". Ordinary Challenge views omit awards even when a member
is eligible through another Challenge. Individual visits show "Recorded award";
the latest visit date is not the date of the maximum award.
The Dashboard percentage and Map completion icons use the same helper.

Challenge statistics distinguish exact highest-award Waypoint buckets (including
no recorded award) from individual recorded-award Activity buckets. Totals link
to matching scoped lists; shared records count once per Challenge and once
globally, never once per membership. These values are derived, not persisted.
Editing, deleting, or reassigning the sole Gold visit can lower the maximum and
updates the loaded distributions without manual reload.

Awarded Waypoint deletion and structural changes that remove the last eligible
Challenge are blocked before writes and identify affected Activities. Deleting,
disabling, or removing one shared Challenge is allowed if all retained awards
remain eligible. Settings/membership actions cannot convert unawarded history;
no migration or automatic backfill is provided.

Challenge details show completion inside each member card, between its description
and View waypoint link. Once-mode members show `Completion: Done` or
`Completion: Not done`. Count-mode members show `Completion: N of target activities`
(singular `activity` for target one) and explicit `Done`/`Not done` text.
The actual count is never capped: seven linked Activities with target five show
`7 of 5 activities` and `Done`. This is completion evidence, not an award-tier display.
These labels use the active loaded dataset and the same helper as Waypoint details;
displaying them does not fetch, persist, or change any records.

## External references

References and photo references are top-level records linked by ID from activities.
They store metadata and external HTTPS links only. Image files are not stored by the app.

## Shared validation

The schema in `src/domain/visit.ts` defines shared validation used by app and storage.

- Stable IDs are required for all top-level records.
- The API dataset schema requires IDs to be unique across all six entity types,
  not just within a type. Import and replacement reject duplicates before any writes,
  with an error identifying the duplicate ID.
- Cosmos document `id` is the entity ID without a type prefix; documents are addressed
  by `(id, datasetId)` in the `/datasetId` partition. The same ID may be used in a
  different dataset.
- Activity location is mandatory.
- Waypoint/challenge/idea location is optional.
- Relationship ID arrays must be distinct and must reference existing records.
- Import/export validates shape and version.

The executable schemas in `src/domain/visit.ts` and `api/src/lib/journeySchema.ts` are
the validation authority for this model.
