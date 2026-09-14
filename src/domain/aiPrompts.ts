// AI prompts for generating Paste JSON drafts (Activity, Idea, Waypoint) in an external AI tool.
// Keep these in sync with the schemas and *ImportExample constants in ./draftJsonImport.ts and ./visit.ts.

export const activityJsonAiPrompt = `You are helping me create a single JSON object describing a real-world Activity for a personal travel/adventure log app. Use any source material I provide (a website, notes, itinerary, etc.) to fill in the fields. Return ONLY a single JSON object matching the shape below — not an array, not markdown, no commentary.

Do NOT output generated entity or nested-item IDs: never include "activityId", "referenceId", or "photoReferenceId", because the app assigns those automatically. Link IDs ("ideaIds" and optional "waypointId") are allowed only when I provide existing IDs.

Required top-level fields:
- "date" (string, required): the calendar date the activity happened or is planned for, in "YYYY-MM-DD" format.
- "notes" (string, required): a free-text summary of the activity, roughly one or two sentences.
- "ideaIds" (array of strings, required): IDs of linked ideas in this app. Leave as an empty array [] unless I have told you specific existing idea IDs to use.
- "location" (object, required): see "location shape" below.
- "references" (array, required): supporting links. Leave as an empty array [] if none are known.
- "photoReferences" (array, required): supporting photos. Leave as an empty array [] if none are known.

Optional top-level fields (omit entirely if unknown — do not include empty strings unless noted):
- "waypointId" (string, optional): the ID of an existing waypoint in this app to link the activity to. Only include this if I have told you the exact ID; otherwise omit it.
- "category" (string, optional): one of "bronze", "silver", or "gold", only if the activity should be recorded as achieving that award tier for a linked waypoint. Omit if not applicable.

location shape (discriminated by "kind"):
- Postcode form: { "kind": "postcode", "postcode": "<UK postcode string>", "latitude"?: <number -90..90>, "longitude"?: <number -180..180> }. Use this when you know a UK postcode. Coordinates are optional extras, only include if known.
- Coordinates form: { "kind": "coordinates", "latitude": <number -90..90>, "longitude": <number -180..180> }. Use this only when no postcode is known but you have precise coordinates. Both latitude and longitude are required in this form.
- Do not mix fields from both forms in one object.

references array items — each item is an object:
- "title" (string, required): short label for the link, a few words.
- "url" (string, required): a valid "https://" URL.
- "description" (string, optional): a short sentence describing the link. Omit if not useful.
- "previewImageUrl" (string, optional): a valid "https://" URL to a preview image. Omit if unknown.

photoReferences array items — each item is an object:
- "title" (string, required): short label for the photo, a few words.
- "url" (string, required): a valid "https://" URL to the photo.
- "altText" (string, optional): a short accessible description of the photo. Omit if unknown.

Example of the exact shape expected (values are illustrative only):
{
  "date": "2026-01-15",
  "notes": "A short summary of the activity.",
  "waypointId": "",
  "ideaIds": [],
  "location": { "kind": "postcode", "postcode": "GL1 1AA" },
  "references": [{ "title": "Trip notes", "url": "https://example.com/notes" }],
  "photoReferences": [{ "title": "Viewpoint photo", "url": "https://example.com/photo.jpg" }]
}

Now, using the source material I provide below (or that I paste after this prompt), produce a single JSON object in this exact shape.`

export const ideaJsonAiPrompt = `You are helping me create a single JSON object describing a real-world Idea (a planned or considered activity) for a personal travel/adventure log app. Use any source material I provide (a website, notes, itinerary, etc.) to fill in the fields. Return ONLY a single JSON object matching the shape below — not an array, not markdown, no commentary.

Do NOT output generated entity or nested-item IDs: never include "ideaId" or "referenceId", because the app assigns those automatically. Link IDs ("waypointIds") are allowed only when I provide existing IDs.

Required top-level fields:
- "title" (string, required): a short name for the idea, a few words.
- "description" (string, required): a description of what the idea involves, one to a few sentences.
- "notes" (string, required): free-text extra notes (logistics, reminders, etc.); can be an empty string "" if none.
- "waypointIds" (array of strings, required): IDs of linked waypoints in this app. Leave as an empty array [] unless I have told you specific existing waypoint IDs to use.
- "planningState" (string, required): one of "active", "someday", or "rejected".
- "difficulty" (number, required): one of 1, 2, 3, or 4, reflecting overall commitment and complexity (not just physical effort):
  - 1 = Easy: local, low-cost, achievable within half a day with little or no preparation.
  - 2 = Moderate: some commitment, e.g. a full day or simple multi-day trip, advance booking, or extra travel.
  - 3 = Involved: substantial preparation or resources — route planning, several bookings, specialist knowledge, significant expense, or coordination with others.
  - 4 = Ambitious: a major undertaking — extensive planning, training, significant expense, international travel, or long-term commitment.
- "references" (array, required): supporting links. Leave as an empty array [] if none are known.

Optional top-level fields (omit entirely if unknown):
- "rejectionReason" (string, optional): required only if "planningState" is "rejected" — a short sentence explaining why. Must be omitted entirely if "planningState" is not "rejected".
- "location" (object, optional): see "location shape" below. Omit the whole object if no location details are known.

location shape (all keys optional, include only what is known):
- "placeName" (string, optional): a short place name.
- "addressOrRegion" (string, optional): a free-text address or region description.
- "source" (string, optional): where this location information came from, e.g. "Manual research".
- "latitude" (number, optional, -90..90) and "longitude" (number, optional, -180..180): only include if known precisely; coordinates are not required.
- "approximate" (boolean, optional): true if the location is a rough estimate rather than exact.

references array items — each item is an object:
- "title" (string, required): short label for the link, a few words.
- "url" (string, required): a valid "https://" URL.
- "description" (string, optional): a short sentence describing the link. Omit if not useful.
- "previewImageUrl" (string, optional): a valid "https://" URL to a preview image. Omit if unknown.

Example of the exact shape expected (values are illustrative only):
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

Now, using the source material I provide below (or that I paste after this prompt), produce a single JSON object in this exact shape.`

export const waypointJsonAiPrompt = `You are helping me create a single JSON object describing a real-world Waypoint (a place of interest) for a personal travel/adventure log app. Use any source material I provide (a website, notes, itinerary, etc.) to fill in the fields. Return ONLY a single JSON object matching the shape below — not an array, not markdown, no commentary.

Do NOT output generated entity or nested-item IDs: never include "waypointId", "referenceId", or "photoReferenceId", because the app assigns those automatically. Link IDs ("challengeIds") are allowed only when I provide existing IDs.

Required top-level fields:
- "title" (string, required): the name of the place, a few words.
- "description" (string, required): a description of the place, one to a few sentences.
- "category" (string, required): a short free-text category label for the place, e.g. "Scenic", "Museum", "Castle".
- "tags" (array of strings, required): short free-text keyword tags. Leave as an empty array [] if none are known.
- "challengeIds" (array of strings, required): IDs of challenges in this app that this waypoint belongs to. Leave as an empty array [] unless I have told you specific existing challenge IDs to use (e.g. "national-trust").
- "completion" (object, required): see "completion shape" below.
- "references" (array, required): supporting links. Leave as an empty array [] if none are known.
- "photoReferences" (array, required): supporting photos. Leave as an empty array [] if none are known.

Optional top-level fields (omit entirely if unknown):
- "location" (object, optional): see "location shape" below. Omit the whole object if no location details are known.

completion shape (discriminated by "mode"):
- Single-visit form: { "mode": "once" }. Use this when a single recorded activity is enough to consider the waypoint complete.
- Count form: { "mode": "count", "target": <positive integer> }. Use this when a set number of activities are required to consider the waypoint complete; "target" is that required count.

location shape (all keys optional, include only what is known):
- "placeName" (string, optional): a short place name.
- "addressOrRegion" (string, optional): a free-text address or region description.
- "source" (string, optional): where this location information came from, e.g. "Manual research".
- "latitude" (number, optional, -90..90) and "longitude" (number, optional, -180..180): only include if known precisely; coordinates are not required.
- "approximate" (boolean, optional): true if the location is a rough estimate rather than exact.

references array items — each item is an object:
- "title" (string, required): short label for the link, a few words.
- "url" (string, required): a valid "https://" URL.
- "description" (string, optional): a short sentence describing the link. Omit if not useful.
- "previewImageUrl" (string, optional): a valid "https://" URL to a preview image. Omit if unknown.

photoReferences array items — each item is an object:
- "title" (string, required): short label for the photo, a few words.
- "url" (string, required): a valid "https://" URL to the photo.
- "altText" (string, optional): a short accessible description of the photo. Omit if unknown.

Example of the exact shape expected (values are illustrative only):
{
  "title": "Sunrise viewpoint",
  "description": "A local spot for early walks.",
  "category": "Scenic",
  "tags": ["sunrise"],
  "challengeIds": ["national-trust"],
  "completion": { "mode": "once" },
  "location": {
    "placeName": "Brockworth",
    "addressOrRegion": "Gloucestershire",
    "source": "Manual research",
    "approximate": true
  },
  "references": [{ "title": "Waypoint guide", "url": "https://example.com/guide" }],
  "photoReferences": [{ "title": "Waypoint photo", "url": "https://example.com/photo.jpg" }]
}

Now, using the source material I provide below (or that I paste after this prompt), produce a single JSON object in this exact shape.`
