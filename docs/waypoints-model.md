# Waypoints model

## Meanings

### Waypoint

A standalone destination, experience, or activity worth doing.

Examples:

- Visiting a National Trust property
- Learning to juggle
- Attending a concert

Waypoints can exist independently or be included in one or more challenges.
Location data is optional.

### Challenge

A structured collection of waypoints with a shared goal.

Examples:

- National Trust
- A seasonal walk collection
- Historic buildings challenge

Challenges reference waypoint IDs instead of duplicating waypoint records.
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

## Saved locations always carry coordinates

A Waypoint or Activity location that reaches the API is resolved to `latitude` and
`longitude` before it is persisted. Postcode-only and place-only input is geocoded
once with Azure Maps Search at save time, and a location that cannot be resolved
rejects the write instead of being saved without coordinates. Waypoint and Idea
locations remain optional; once a location is supplied for a Waypoint or an Activity
it must resolve to coordinates. The static seed catalogue carries coordinates from a
one-time offline backfill rather than runtime geocoding.

## Relationships

- A challenge references many waypoints.
- A waypoint may belong to many challenges.
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

Bronze/Silver/Gold describe how well an activity fits the challenge — they are not
challenge completion milestones. Category selection is only available when the selected
waypoint belongs to a challenge with explicit `supportsActivityCategories: true`.
Waypoint completion still counts linked activities even when they have no category.

## External references

References and photo references are top-level records linked by ID from activities.
They store metadata and external HTTPS links only. Image files are not stored by the app.

## Shared validation

The schema in `src/domain/visit.ts` defines shared validation used by app and storage.

- Stable IDs are required for all top-level records.
- Activity location is mandatory.
- Waypoint/challenge/idea location is optional.
- Relationship ID arrays must be distinct and must reference existing records.
- Import/export validates shape and version.

The executable schemas in `src/domain/visit.ts` and `api/src/lib/journeySchema.ts` are
the validation authority for this model.
