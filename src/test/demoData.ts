import { createActivity, createDemoData, DataSchema, type WaypointsData } from '../domain/visit'

export function createDemoTestData(): WaypointsData {
  const data = createDemoData()
  return { ...data, ideas: [], activities: [] }
}

export function createAwardTestData(): WaypointsData {
  const demo = createDemoData()
  const enabled = demo.challenges[0]!
  const ordinary = demo.challenges[1]!
  const member = demo.waypoints[0]!
  return DataSchema.parse({
    challenges: [
      { ...enabled, challengeId: 'award-a', title: 'Award Challenge A' },
      {
        ...enabled,
        challengeId: 'award-b',
        title: 'Award Challenge B',
        awardDescriptions: {
          bronze: 'Short exploration',
          silver: 'Full-day exploration',
          gold: 'Overnight exploration',
        },
      },
      { ...ordinary, challengeId: 'ordinary', title: 'Ordinary Challenge' },
      { ...enabled, challengeId: 'empty', title: 'Empty Award Challenge' },
    ],
    waypoints: [
      {
        ...member,
        waypointId: 'award-w1',
        title: 'Shared Award Waypoint',
        challengeIds: ['award-a', 'award-b', 'ordinary'],
        location: undefined,
        referenceIds: [],
        photoReferenceIds: [],
      },
      {
        ...member,
        waypointId: 'award-w2',
        title: 'Silver Waypoint',
        challengeIds: ['award-a'],
        completion: { mode: 'count', target: 3 },
        location: undefined,
        referenceIds: [],
        photoReferenceIds: [],
      },
      {
        ...member,
        waypointId: 'award-w3',
        title: 'Unvisited Award Waypoint',
        challengeIds: ['award-a'],
        location: undefined,
        referenceIds: [],
        photoReferenceIds: [],
      },
      {
        ...member,
        waypointId: 'ordinary-w',
        title: 'Ordinary Waypoint',
        challengeIds: ['ordinary'],
        location: undefined,
        referenceIds: [],
        photoReferenceIds: [],
      },
    ],
    activities: [
      ...(['bronze', 'gold', 'bronze'] as const).map((category, index) =>
        createActivity({
          activityId: `award-visit-${index}`,
          name: `Shared visit ${index + 1}`,
          waypointId: 'award-w1',
          date: `2026-08-0${index + 1}`,
          category,
          location: { kind: 'postcode', postcode: 'GL1 1AA' },
        }),
      ),
      createActivity({
        activityId: 'silver-visit',
        name: 'Silver visit',
        waypointId: 'award-w2',
        date: '2026-08-01',
        category: 'silver',
        location: { kind: 'postcode', postcode: 'GL1 1AA' },
      }),
      createActivity({
        activityId: 'ordinary-visit',
        name: 'Ordinary visit',
        waypointId: 'ordinary-w',
        date: '2026-08-01',
        location: { kind: 'postcode', postcode: 'GL1 1AA' },
      }),
    ],
    ideas: [],
    references: [],
    photoReferences: [],
  })
}
