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

Inspiration or research. Ideas can be linked to a waypoint, challenge, both, or neither.
Location data is optional.

### Activity

A real-world event that happened. Activities are the completion/progress evidence.

Examples:

- Visited Calke Abbey on a specific date
- Practised juggling in a park
- Walked a local trail

Activities may link to waypoint/challenge/idea IDs or stand alone, but they **must**
include location data before they are saved.

## Relationships

- A challenge references many waypoints.
- A waypoint may belong to many challenges.
- A waypoint may have many activities.
- An idea can reference waypoints/challenges.
- An activity can be linked or independent.

## Completion and progress

Waypoint completion mode supports:

- `once` (completed after at least one activity)
- `count` (completed after a target number of activities)

Challenge progress is derived from completed waypoints.

National Trust Bronze/Silver/Gold milestone wording is retained for challenge progress
presentation.

## External references

References and photo references store metadata and external HTTPS links only. Image files
are not stored by the application.

## Shared validation

The schema in `src/domain/visit.ts` defines shared validation used by app and storage.

- Stable IDs are required for all top-level records.
- Activity location is mandatory.
- Waypoint/challenge/idea location is optional.
- Import/export validates shape and version.
