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
- Open a challenge to compare its optional planned GPX route with recorded GPX
  tracks from activities linked to its waypoints. The lines are visual only and
  never change completion.
