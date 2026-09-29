import { render, screen } from '@testing-library/react'
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
    expect(screen.getByLabelText('Waypoint: Bath Assembly Rooms')).toBeInTheDocument()
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
})
