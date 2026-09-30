import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import ChallengeDetails from './ChallengeDetails'
import { WaypointsProvider } from '../features/journey/JourneyContext'
import { createDefaultData, save } from '../services/storage'

function renderDetails() {
  return render(
    <MemoryRouter initialEntries={['/challenges/challenge-1']}>
      <WaypointsProvider>
        <Routes>
          <Route path="/challenges/:challengeId" element={<ChallengeDetails />} />
        </Routes>
      </WaypointsProvider>
    </MemoryRouter>,
  )
}

describe('ChallengeDetails', () => {
  beforeEach(() => localStorage.clear())

  it('shows linked waypoint tracks and visibility controls', () => {
    const data = createDefaultData()
    save({
      ...data,
      challenges: [
        {
          challengeId: 'challenge-1',
          title: 'River route',
          description: 'A route beside the river.',
          waypointIds: ['waypoint-1'],
          supportsActivityCategories: false,
          plannedRoute: {
            points: [
              { latitude: 51, longitude: -2 },
              { latitude: 51.1, longitude: -2.1 },
            ],
          },
        },
      ],
      waypoints: [
        {
          ...data.waypoints[0]!,
          waypointId: 'waypoint-1',
          location: { latitude: 51.05, longitude: -2.05 },
        },
      ],
      activities: [
        {
          activityId: 'linked-activity',
          ideaIds: [],
          waypointId: 'waypoint-1',
          date: '2026-08-01',
          location: { kind: 'coordinates', latitude: 51.05, longitude: -2.05 },
          notes: '',
          referenceIds: [],
          photoReferenceIds: [],
          createdAt: '2026-08-01T10:00:00.000Z',
          updatedAt: '2026-08-01T10:00:00.000Z',
          recordedTrack: {
            points: [
              { latitude: 51.02, longitude: -2.02 },
              { latitude: 51.08, longitude: -2.08 },
            ],
          },
        },
        {
          activityId: 'unlinked-activity',
          ideaIds: [],
          waypointId: undefined,
          date: '2026-08-02',
          location: { kind: 'coordinates', latitude: 52, longitude: -3 },
          notes: '',
          referenceIds: [],
          photoReferenceIds: [],
          createdAt: '2026-08-02T10:00:00.000Z',
          updatedAt: '2026-08-02T10:00:00.000Z',
          recordedTrack: {
            points: [
              { latitude: 52, longitude: -3 },
              { latitude: 52.1, longitude: -3.1 },
            ],
          },
        },
      ],
    })

    renderDetails()

    expect(screen.getByRole('img', { name: 'River route route overlay' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Planned route' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Recorded activity tracks' })).toBeChecked()
    expect(screen.getByLabelText('Recorded track: 2026-08-01')).toBeInTheDocument()
    expect(screen.queryByLabelText('Recorded track: 2026-08-02')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Waypoint: Bath Assembly Rooms')).toBeInTheDocument()
    const features = within(screen.getByRole('region', { name: 'Visible map features' })).getByRole('list')
    expect(
      within(features)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Planned route', 'Recorded track: 2026-08-01', 'Waypoint: Bath Assembly Rooms'])
  })

  it('projects and lists only visible routes, tracks, and waypoint markers', async () => {
    const user = userEvent.setup()
    const data = createDefaultData()
    const waypoint = data.waypoints[0]!
    waypoint.waypointId = 'waypoint-1'
    waypoint.challengeIds = []
    waypoint.location = { latitude: 51.05, longitude: -2.05 }
    save({
      ...data,
      challenges: [
        {
          challengeId: 'challenge-1',
          title: 'River route',
          description: 'A route beside the river.',
          waypointIds: ['waypoint-1'],
          supportsActivityCategories: false,
          plannedRoute: {
            points: [
              { latitude: 51, longitude: -2 },
              { latitude: 51.1, longitude: -2.1 },
            ],
          },
        },
      ],
      activities: [
        {
          activityId: 'linked-activity',
          ideaIds: [],
          waypointId: 'waypoint-1',
          date: '2026-08-01',
          location: { kind: 'coordinates', latitude: 52, longitude: -3 },
          notes: '',
          referenceIds: [],
          photoReferenceIds: [],
          createdAt: '2026-08-01T10:00:00.000Z',
          updatedAt: '2026-08-01T10:00:00.000Z',
          recordedTrack: {
            points: [
              { latitude: 52, longitude: -3 },
              { latitude: 52.1, longitude: -3.1 },
            ],
          },
        },
      ],
    })

    renderDetails()

    const overlay = screen.getByRole('img', { name: 'River route route overlay' })
    const plannedRoute = within(overlay).getByLabelText('Planned route')
    const pointsWithRecordedTrack = plannedRoute.getAttribute('points')
    const features = within(screen.getByRole('region', { name: 'Visible map features' })).getByRole('list')
    expect(
      within(features)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Planned route', 'Recorded track: 2026-08-01', 'Waypoint: Bath Assembly Rooms'])

    await user.click(screen.getByRole('checkbox', { name: 'Recorded activity tracks' }))
    expect(screen.queryByLabelText('Recorded track: 2026-08-01')).not.toBeInTheDocument()
    expect(within(features).queryByText('Recorded track: 2026-08-01')).not.toBeInTheDocument()
    expect(plannedRoute.getAttribute('points')).not.toBe(pointsWithRecordedTrack)

    await user.click(screen.getByRole('checkbox', { name: 'Planned route' }))
    expect(within(overlay).queryByLabelText('Planned route')).not.toBeInTheDocument()
    expect(
      within(features)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Waypoint: Bath Assembly Rooms'])
  })

  it('shows an empty state when no visible routes or waypoint markers remain', async () => {
    const user = userEvent.setup()
    const data = createDefaultData()
    data.challenges = [
      {
        challengeId: 'challenge-1',
        title: 'River route',
        description: 'A route beside the river.',
        waypointIds: [],
        supportsActivityCategories: false,
        plannedRoute: {
          points: [
            { latitude: 51, longitude: -2 },
            { latitude: 51.1, longitude: -2.1 },
          ],
        },
      },
    ]
    save(data)

    renderDetails()

    await user.click(screen.getByRole('checkbox', { name: 'Planned route' }))
    expect(screen.queryByRole('img', { name: 'River route route overlay' })).not.toBeInTheDocument()
    expect(screen.getByText('No visible routes, tracks, or waypoint locations.')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Visible map features' })).not.toBeInTheDocument()
  })

  it('adds and removes a planned route', async () => {
    const user = userEvent.setup()
    const data = createDefaultData()
    save({
      ...data,
      challenges: [
        {
          challengeId: 'challenge-1',
          title: 'River route',
          description: 'A route beside the river.',
          waypointIds: [],
          supportsActivityCategories: false,
        },
      ],
    })

    renderDetails()
    await user.click(screen.getByRole('button', { name: 'Add planned route' }))
    await user.type(
      screen.getByLabelText('Planned GPX route'),
      '<gpx><trk><trkpt lat="51" lon="-2"/><trkpt lat="51.1" lon="-2.1"/></trk></gpx>',
    )
    await user.click(screen.getByRole('button', { name: 'Save route' }))
    expect(screen.getByRole('button', { name: 'Replace planned route' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Replace planned route' }))
    await user.click(screen.getByRole('button', { name: 'Save route' }))
    expect(screen.getByRole('button', { name: 'Add planned route' })).toBeInTheDocument()
  })

  it('discards a planned route draft when canceling', async () => {
    const user = userEvent.setup()
    const data = createDefaultData()
    save({
      ...data,
      challenges: [
        {
          challengeId: 'challenge-1',
          title: 'River route',
          description: 'A route beside the river.',
          waypointIds: [],
          supportsActivityCategories: false,
        },
      ],
    })

    renderDetails()
    await user.click(screen.getByRole('button', { name: 'Add planned route' }))
    const input = screen.getByLabelText('Planned GPX route')
    await user.type(input, '<gpx><trkpt lat="51" lon="-2"/><trkpt lat="51.1" lon="-2.1"/></gpx>')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await user.click(screen.getByRole('button', { name: 'Add planned route' }))
    expect(screen.getByLabelText('Planned GPX route')).toHaveValue('')
    await user.click(screen.getByRole('button', { name: 'Save route' }))
    expect(screen.getByRole('button', { name: 'Add planned route' })).toBeInTheDocument()
  })
})
