# Dashboard

Route: `/challenges` — implemented in `src/pages/Dashboard.tsx`. It is the landing
view: `/` redirects here, and the **Progress** navigation item and app bar title point
at the same route.

## Purpose

Summarize Challenge completion and clearly distinguish highest Waypoint awards
from individual Activity awards.

## Key behavior

- Completion percentage is the rounded percentage of completed member Waypoints,
  not the percentage of recorded Activities. A count-based member can gain an
  Activity without changing the overall percentage until its target is reached.
  Empty Challenges are 0%, not 100%.
- Challenge details show the same completed/total and percentage, an explanation,
  and an action to the first incomplete member in existing order. Member progress
  precedes optional map/route administration. Complete and empty Challenges have
  no suggested incomplete member.
- Opening a member from a Challenge preserves a named return on its Waypoint,
  including recording and successful confirmation. Challenge details offer
  **Back to Dashboard** without a menu or browser Back.
- Award-enabled Challenges require user-written Bronze, Silver, and Gold explanations.
  Ordinary Challenges default to awards disabled.
- Global award distributions count eligible Waypoints by exact highest award and
  Activities by recorded award. Shared records count once globally. Matching links
  open the contributing record lists; ordinary-only datasets omit distributions.
- Recent visits link to Waypoint details and show completion separately from
  the highest recorded award and latest visit date. Ordinary Waypoints omit award
  indicators; applicable unrecorded awards say **No award recorded**.
- Challenge details expose definitions, editable award settings, protected deletion,
  and Statistics. Ordinary Challenges retain member, Activity, and completion
  totals without award distributions. Enabled distributions include no-award
  members, explicit zeros, and scoped drill-downs with return navigation.

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
