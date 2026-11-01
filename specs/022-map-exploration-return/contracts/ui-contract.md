# UI Contract: Map to Detail to Map

## Entry and return

| Entry                          | Captured target                 | Return behavior                                          |
| ------------------------------ | ------------------------------- | -------------------------------------------------------- |
| Nearby Waypoint/Activity link  | Opened record                   | Same criteria/panel; current result focus                |
| Waypoint popup's direct action | Waypoint                        | Current Waypoint popup or visible Map panel              |
| Waypoint popup's Activity link | Activity plus selected Waypoint | Keep Waypoints mode; current related action if available |
| Activity popup                 | Activity                        | Current Activity popup or visible Map panel              |
| Either cluster's member link   | Opened record, not cluster ID   | Current individual selection/action or explanation       |

Every link remains a real link. Ordinary mouse/Enter activation uses SPA navigation
and captures context; modified/new-tab activation does neither. Popup close or
cluster expansion alone is not record navigation.

**Back to Map** is added alongside existing detail breadcrumbs and Challenge
return. It uses the existing discard/pending-write guard exactly once. Existing
Activity Waypoint chips, `backTarget` and deletion destinations remain unchanged.
Direct details have no invented Map breadcrumb. A valid origin still works on a
missing-record detail page.

## Restore and feedback

- Restore mode, filters, input, resolved origin, choices/handled feedback, route,
  available camera and panel. Do not infer a successful resolution from input text.
- Recompute current nearby results, labels, progress, awards, positions and geometry.
- Invalidated dataset context resets to fresh Map defaults and bare `/map` with
  explicit reset feedback; switching back does not resurrect it.
- Data load failures outrank result/selection absence. Search failures, unchosen
  choices and zero matches remain distinct; current token/render errors are not replayed.
- Apply camera after SDK readiness and current data. Initial automatic fits must
  not override return; fresh deep links and deliberate later route choices still fit.
- Rebuild popups from current records; do not reopen old cluster content.

## Accessibility and retained behavior

- Focus once to the originating available List link, current popup action, or
  visible Map panel/absence explanation. Never focus a hidden mobile panel.
- Keep full accessible labels and theme focus indicators; long labels must not
  cause horizontal overflow at 360x800 or 1280x800.
- Admin/viewer/read-only Demo support identical browsing; return performs no writes.
- Keep Map/List controls, Started/Not Started wording, applicable award semantics,
  planned-route labels, recorded-track messages and solid/dashed line distinctions.
- Existing browser-Back draft protection is not expanded by this feature.
