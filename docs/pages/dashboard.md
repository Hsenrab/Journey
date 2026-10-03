# Dashboard

Route: `/challenges` — implemented in `src/pages/Dashboard.tsx`. It is the landing
view: `/` redirects here, and the **Progress** navigation item and app bar title point
at the same route.

## Purpose

Summarize challenge progress and activity-category distribution for the National Trust challenge.

## Key behavior

- Completion percentage is based on waypoint completion rules (`once`/`count`) and linked activity count.
- Category cards (Bronze/Silver/Gold) summarize waypoint category status derived from linked activities that have categories.
- A waypoint with linked uncategorized activities can still be completed while showing `Not Started` in category summary.
- Recent activity list links back to waypoint details.

## Challenge route map

Open a Challenge's detail page from its card to attach, replace, or remove a planned
GPX route. The map shows the planned route as a wide solid purple line, its located
Waypoints as labelled points, and recorded Activity tracks as narrower dashed blue
lines. The planned route remains visible underneath overlapping recorded tracks.

**Show recorded Activity tracks** toggles all recorded tracks without hiding the
planned route or Waypoints. A text legend and a list of Activity names (or dates for
unnamed Activities) identify the overlays without relying on colour alone.
Only Activities linked to the Challenge's Waypoints are included, using either
direction of Challenge/Waypoint membership. A direct Activity/Challenge link alone
does not include a track.

Recorded tracks can be shown even without a planned route or located Waypoints.
Activities without GPX are omitted from the overlay, not from completion counts.
When there are no linked tracks, the map shows an explicit no-tracks message.
This is a visual comparison only: no route matching, coverage calculation, or
GPS-derived completion is performed.
