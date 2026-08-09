import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import Activities from './Activities'
import { WaypointsProvider } from '../features/journey/JourneyContext'
import { createDefaultData, load, save } from '../services/storage'
import type { Activity } from '../domain/visit'

function renderActivities() {
  render(
    <MemoryRouter>
      <WaypointsProvider>
        <Activities />
      </WaypointsProvider>
    </MemoryRouter>,
  )
}

describe('Activities', () => {
  beforeEach(() => localStorage.clear())

  it('shows an empty state when there are no activities', () => {
    renderActivities()
    expect(screen.getByText('No activities logged yet.')).toBeInTheDocument()
  })

  it('requires location data before saving', async () => {
    const user = userEvent.setup()
    renderActivities()

    await user.click(screen.getByRole('button', { name: 'Save activity' }))

    expect(screen.getByText('Enter a valid date and location before saving.')).toBeInTheDocument()
    expect(load().activities).toEqual([])
  })

  it('saves an independent activity with location', async () => {
    const user = userEvent.setup()
    renderActivities()

    await user.type(screen.getByLabelText('Location'), 'Bristol Harbourside')
    await user.type(screen.getByLabelText('Notes'), 'Evening walk')
    await user.click(screen.getByRole('button', { name: 'Save activity' }))

    expect(screen.getByText('Activity saved.')).toBeInTheDocument()
    expect(load().activities[0]).toMatchObject({
      location: { placeName: 'Bristol Harbourside' },
      notes: 'Evening walk',
    })
  })

  it('shows waypoint title labels instead of raw ids', () => {
    const seed = createDefaultData()
    const seededActivity: Activity = {
      activityId: 'a1',
      waypointId: 'stourhead',
      challengeId: 'national-trust',
      date: '2026-08-01',
      status: 'gold',
      location: { placeName: 'Stourhead' },
      notes: '',
      photos: [],
      referenceIds: [],
      photoReferenceIds: [],
      createdAt: '2026-08-01T10:00:00.000Z',
      updatedAt: '2026-08-01T10:00:00.000Z',
    }
    save({ ...seed, activities: [seededActivity] })

    renderActivities()

    expect(screen.getByText('Waypoint: Stourhead')).toBeInTheDocument()
  })
})
