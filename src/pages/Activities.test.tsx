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

  it('preserves entered values when validation fails', async () => {
    const user = userEvent.setup()
    renderActivities()

    await user.click(screen.getByRole('button', { name: 'Add activity' }))
    await user.click(screen.getByRole('combobox', { name: 'Location type' }))
    await user.click(screen.getByRole('option', { name: 'Latitude and longitude' }))
    await user.type(screen.getByLabelText('Latitude'), 'not-a-number')
    await user.type(screen.getByLabelText('Longitude'), '-1.26')
    await user.click(screen.getByRole('button', { name: 'Save activity' }))

    expect(screen.getByText('Latitude and longitude must be numeric.')).toBeInTheDocument()
    expect(screen.getByLabelText('Latitude')).toHaveValue('not-a-number')
    expect(load().activities).toEqual([])
  })

  it('cancels adding an activity without saving it', async () => {
    const user = userEvent.setup()
    renderActivities()

    await user.click(screen.getByRole('button', { name: 'Add activity' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByRole('button', { name: 'Add activity' })).toBeInTheDocument()
    expect(load().activities).toEqual([])
  })

  it('saves an independent activity with postcode location', async () => {
    const user = userEvent.setup()
    renderActivities()

    await user.click(screen.getByRole('button', { name: 'Add activity' }))
    await user.type(screen.getByLabelText('Postcode'), 'GL1 1AA')
    await user.type(screen.getByLabelText('Description / notes'), 'Evening walk')
    await user.click(screen.getByRole('button', { name: 'Save activity' }))

    expect(screen.getByText('Activity saved.')).toBeInTheDocument()
    expect(load().activities[0]).toMatchObject({
      location: { kind: 'postcode', postcode: 'GL1 1AA' },
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
      category: 'gold',
      location: { kind: 'postcode', postcode: 'BA12 6QF' },
      notes: '',
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
