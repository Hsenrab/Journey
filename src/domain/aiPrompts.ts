// AI prompts for generating Paste JSON drafts (Activity, Idea, Waypoint) in an external AI tool.
// Keep these in sync with the schemas and *ImportExample constants in ./draftJsonImport.ts and ./visit.ts.

export const activityJsonAiPrompt = `Create an import-ready JSON object for an Activity in a personal travel and life-adventure journal. An Activity is a dated historical record of something that actually happened. It captures what I did and where I did it, and may later show progress towards a larger experience, goal, or ambition. It is not a plan or suggestion for the future.

Use only the source material I provide (a website, notes, itinerary, etc.). Extract all supported useful detail, especially what happened, when, where, and any specific highlights. Do not invent missing facts. Write in a specific, factual, lightly personal tone, using the past tense and avoiding promotional language.

Return ONLY one valid JSON object matching the shape below: no array, markdown, commentary, or additional fields.

Required top-level fields:
- "date" (string, required): the real calendar date the activity happened, in "YYYY-MM-DD" format.
- "notes" (string, required): a complete plain-text account of what happened. Include all useful supported details in a few focused sentences.
- "location" (object, required): see "location shape" below.
- "references" (array of objects, required): all useful supporting source links. Use [] if none are provided.
- "photoReferences" (array of objects, required): all useful external photo links. Use [] if none are provided.

Optional top-level field (omit entirely unless clearly supported by the source):
- "category" (string, optional): exactly "bronze", "silver", or "gold". Include only when the source explicitly identifies that achievement tier.

location shape (discriminated by "kind"):
- Postcode form: { "kind": "postcode", "postcode": "<UK postcode>" }. The object may also contain numeric "latitude" (-90 to 90) and "longitude" (-180 to 180) when both are known precisely.
- Coordinates form: { "kind": "coordinates", "latitude": <number>, "longitude": <number> }. Use this only when no UK postcode is known. Latitude must be -90 to 90 and longitude must be -180 to 180.
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

Examples of the exact shape expected (return only one object for my source material):

Example 1 — activity with a postcode and supporting media:
{
  "date": "2026-08-16",
  "notes": "Took an early-morning balloon flight over the Cotswolds. The pilot explained how the balloon was controlled, and the flight ended with a clear view of the sunrise above the fields.",
  "location": { "kind": "postcode", "postcode": "GL54 2EN" },
  "references": [{ "title": "Flight details", "url": "https://example.com/flight", "description": "Operator details for the completed flight." }],
  "photoReferences": [{ "title": "Sunrise balloon flight", "url": "https://example.com/balloon.jpg", "altText": "A hot-air balloon above the Cotswolds at sunrise" }]
}

Example 2 — activity known by coordinates with no links:
{
  "date": "2026-06-20",
  "notes": "Practised juggling outdoors for an hour, working from three-catch starts up to ten consecutive catches.",
  "location": { "kind": "coordinates", "latitude": 51.8642, "longitude": -2.2382 },
  "references": [],
  "photoReferences": []
}

Now, using the source material I provide below (or that I paste after this prompt), produce a single JSON object in this exact shape.`

export const ideaJsonAiPrompt = `Create an import-ready JSON object for an Idea in a personal travel and life-adventure journal. An Idea is a planning or research record for something I might do: a possible approach, outing, venue, route, or practical next step. It is not a completed event or the larger life goal it might support.

Use only the source material I provide. Do not invent missing facts or pad sparse material. Write in a concise, practical, future-facing tone without sales language. Keep the description brief; put only useful logistics, reminders, caveats, or next steps in notes.

Return ONLY one valid JSON object matching the shape below: no array, markdown, commentary, or additional fields.

Required top-level fields:
- "title" (string, required): a short name for the idea, a few words.
- "description" (string, required): a brief description of what the idea involves.
- "notes" (string, required): free-text extra notes (logistics, reminders, etc.); can be an empty string "" if none.
- "planningState" (string, required): one of "active", "someday", or "rejected".
- "difficulty" (number, required): one of 1, 2, 3, or 4, reflecting overall commitment and complexity (not just physical effort):
  - 1 = Easy: local, low-cost, achievable within half a day with little or no preparation.
  - 2 = Moderate: some commitment, e.g. a full day or simple multi-day trip, advance booking, or extra travel.
  - 3 = Involved: substantial preparation or resources — route planning, several bookings, specialist knowledge, significant expense, or coordination with others.
  - 4 = Ambitious: a major undertaking — extensive planning, training, significant expense, international travel, or long-term commitment.
- "references" (array of objects, required): supporting source links. Use [] if none are provided.

Optional top-level fields (omit entirely if unknown):
- "rejectionReason" (string, optional): required only if "planningState" is "rejected" — a short sentence explaining why. Must be omitted entirely if "planningState" is not "rejected".
- "location" (object, optional): see "location shape" below. Omit the whole object if no location details are known.

location shape (all keys optional, include only what is known):
- "placeName" (string, optional): a short place name.
- "addressOrRegion" (string, optional): a free-text address or region description.
- "source" (string, optional): where the location information came from, e.g. "Venue website".
- "latitude" (number, optional, -90 to 90) and "longitude" (number, optional, -180 to 180): include both or neither, and only when known precisely.
- "approximate" (boolean, optional): true if the location is a rough estimate rather than exact.

references array items — each item is an object:
- "title" (string, required): short label for the link, a few words.
- "url" (string, required): a valid "https://" URL.
- "description" (string, optional): a short sentence describing the link. Omit if not useful.
- "previewImageUrl" (string, optional): a valid "https://" URL to a preview image. Omit if unknown.

Examples of the exact shape expected (return only one object for my source material):

Example 1 — filled-in researched idea:
{
  "title": "Compare Cotswolds balloon flights",
  "description": "Research local sunrise flights and choose a suitable operator.",
  "notes": "Compare launch locations, weather rebooking terms, accessibility and total cost before booking.",
  "planningState": "active",
  "difficulty": 2,
  "location": {
    "addressOrRegion": "Cotswolds",
    "source": "Operator website",
    "approximate": true
  },
  "references": [{ "title": "Flight options", "url": "https://example.com/balloon-flights", "description": "Available launch areas, prices and booking terms." }]
}

Example 2 — short idea with no useful optional detail:
{
  "title": "Try a pottery class",
  "description": "Look for a beginner pottery class.",
  "notes": "",
  "planningState": "someday",
  "difficulty": 1,
  "references": []
}

Now, using the source material I provide below (or that I paste after this prompt), produce a single JSON object in this exact shape.`

export const waypointJsonAiPrompt = `Create an import-ready JSON object for a Waypoint in a personal travel and life-adventure journal. A Waypoint is a destination or place-based experience worth achieving, such as visiting a landmark, walking a named trail, or taking a hot-air balloon flight over a particular area. It describes the outcome itself, not planning steps or the historical record of completing it. Every waypoint is filed under a challenge collection in the app, so keep it to destinations and place-based experiences rather than standalone personal goals.

Use only the source material I provide. Do not invent missing facts or pad sparse material. Write in a concise, motivating, grounded tone without hype, clichés, or promotional language. A short title and one clear sentence are often enough.

Return ONLY one valid JSON object matching the shape below: no array, markdown, commentary, or additional fields.

Required top-level fields:
- "title" (string, required): a short name for the destination or place-based experience.
- "description" (string, required): a description of what the waypoint involves and why it is worth doing, one to a few sentences.
- "category" (string, required): a short free-text category label for the waypoint, e.g. "Adventure", "Scenic", "Historic place", "Garden", or "Museum".
- "tags" (array of strings, required): short free-text keyword tags. Leave as an empty array [] if none are known.
- "completion" (object, required): see "completion shape" below.
- "references" (array of objects, required): supporting source links. Use [] if none are provided.
- "photoReferences" (array of objects, required): external photo links. Use [] if none are provided.

Optional top-level fields (omit entirely if unknown):
- "location" (object, optional): see "location shape" below. Omit the whole object if no location details are known.

completion shape (discriminated by "mode"):
- Single-completion form: { "mode": "once" }. Use this when one recorded activity is enough to consider the waypoint achieved.
- Count form: { "mode": "count", "target": <positive integer> }. Use this when the waypoint requires a set number of recorded activities; "target" is that required count.

location shape (all keys optional, include only what is known):
- "placeName" (string, optional): a short place name.
- "addressOrRegion" (string, optional): a free-text address or region description.
- "source" (string, optional): where the location information came from, e.g. "Venue website".
- "latitude" (number, optional, -90 to 90) and "longitude" (number, optional, -180 to 180): include both or neither, and only when known precisely.
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

Examples of the exact shape expected (return only one object for my source material):

Example 1 — filled-in waypoint with researched details:
{
  "title": "Take a hot-air balloon ride",
  "description": "Experience a sunrise flight in a hot-air balloon and see the landscape from above.",
  "category": "Adventure",
  "tags": ["ballooning", "flight", "bucket list"],
  "completion": { "mode": "once" },
  "location": {
    "addressOrRegion": "Cotswolds",
    "source": "Manual research",
    "approximate": true
  },
  "references": [{ "title": "Balloon ride details", "url": "https://example.com/balloon-ride", "description": "Flight format, launch area and practical requirements." }],
  "photoReferences": [{ "title": "Balloon flight", "url": "https://example.com/balloon.jpg", "altText": "A hot-air balloon floating over fields at sunrise" }]
}

Example 2 — count-based waypoint with minimal detail:
{
  "title": "Walk every Crickley Hill trail",
  "description": "Complete each of the three waymarked trails at Crickley Hill Country Park.",
  "category": "Scenic",
  "tags": ["walking"],
  "completion": { "mode": "count", "target": 3 },
  "location": { "placeName": "Crickley Hill", "addressOrRegion": "Gloucestershire" },
  "references": [],
  "photoReferences": []
}

Now, using the source material I provide below (or that I paste after this prompt), produce a single JSON object in this exact shape.`
