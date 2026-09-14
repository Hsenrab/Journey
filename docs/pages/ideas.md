# Ideas

Routes:

- `/ideas` (planning list, filters, and add form)
- `/ideas/:ideaId` (idea details, edit, delete)

## Purpose

Ideas are planning records. They can link to zero or more waypoints and to zero or
more activities through activity `ideaIds`.

## List behavior

- Planning-state views: **Active**, **Someday**, **Rejected** with visible counts.
- Usage filter is independent from planning state: **All usage**, **Used ideas**, **Not used**.
- Search covers title, description, notes, linked waypoint names, reference titles,
  and reference hostnames.
- Sorting supports distance from Brockworth when coordinates exist, recently updated,
  and difficulty.
- Cards show planning state, difficulty, linked waypoints, location summary,
  reference preview, and derived usage text.

## Editor behavior

- Required fields: title, planning state, difficulty.
- Rejected ideas require a rejection reason; other planning states do not keep one.
- Description and notes are optional separate fields.
- Linked waypoints use a searchable multi-select.
- Structured location fields are optional.
- References are ordered, require HTTPS URLs, and support add/reorder/remove.
- Unsaved changes prompt before cancel/unload.
- Add mode includes **Form** and **Paste JSON** tabs. Paste JSON accepts one idea draft object,
  rejects arrays, and rejects ID fields (`ideaId`, `referenceId`).
- **Copy example JSON** copies a representative draft shape. **Load into form** validates the pasted
  JSON, keeps the pasted text on errors, and on success populates the existing form state before save.

### Idea Paste JSON draft example

```json
{
  "title": "Plan a sunrise walk",
  "description": "Try a nearby route before breakfast.",
  "notes": "Bring a flask and check weather first.",
  "waypointIds": [],
  "planningState": "active",
  "difficulty": 1,
  "location": {
    "placeName": "Brockworth",
    "addressOrRegion": "Gloucestershire",
    "source": "Manual research",
    "approximate": true
  },
  "references": [{ "title": "Route ideas", "url": "https://example.com/route" }]
}
```

## Details and deletion

- Details show usage as **Not used** or **Used in N activities** and list each linked
  activity with date and optional waypoint.
- Deleting an idea removes idea links from activities and updates the dataset.
