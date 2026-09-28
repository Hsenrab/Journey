# Challenges

Routes: `/challenges` — implemented in `src/pages/Challenges.tsx` — and
`/challenges/:challengeId` — implemented in `src/pages/ChallengeDetails.tsx`. The
challenges list is the landing view: `/` redirects to it, and the **Challenges**
navigation item and app bar title point at the same route.

## Purpose

List and manage every challenge (National Trust is ordinary data, not a special case),
and summarize progress and activity-category distribution for each challenge.

## Key behavior

- The list shows every challenge with its description and completed waypoint count.
  Admins can **Add challenge** with a title, description, and whether the challenge
  supports Bronze, Silver and Gold activity categories.
- Waypoint membership is managed from the waypoint editor's **Challenges** field. The
  challenge details page links to the Waypoints list filtered to the challenge
  (`/waypoints?challenge=<id>`) and to **Add waypoint** with the challenge preselected.
- **Edit challenge** changes the title, description, and category support and keeps
  every waypoint link. Turning off category support is rejected while any Bronze, Silver
  or Gold activity depends on it; clear those activity categories first.
- **Delete challenge** opens a confirmation that states how many waypoints lose the
  challenge and how many activity categories will be cleared. Deleting removes the
  challenge from waypoints and activities; waypoints, ideas and activities are kept.
  Activity categories are cleared only when their waypoint no longer belongs to any
  challenge that supports categories.
- Completion percentage is based on waypoint completion rules (`once`/`count`) and linked activity count.
- Category cards (Bronze/Silver/Gold) are shown only for challenges that support
  categories. They summarize waypoint category status derived from linked activities
  and link to the Waypoints list filtered by challenge and status.
- A waypoint with linked uncategorized activities can still be completed while showing `Not Started` in category summary.
- Recent activity list links back to waypoint details.
