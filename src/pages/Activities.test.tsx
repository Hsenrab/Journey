import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

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

  it('shows activity names, formatted fallback dates, waypoint labels and detail counts', () => {
    const seed = createDefaultData()
    const namedActivity: Activity = {
      activityId: 'a1',
      ideaIds: [],
      waypointId: 'stourhead',
      challengeId: 'national-trust',
      date: '2026-08-01',
      name: 'Summer visit',
      category: 'gold',
      location: { kind: 'postcode', postcode: 'BA12 6QF' },
      notes: '',
      referenceIds: ['ref-1'],
      photoReferenceIds: ['photo-1'],
      createdAt: '2026-08-01T10:00:00.000Z',
      updatedAt: '2026-08-01T10:00:00.000Z',
    }
    const unnamedActivity: Activity = {
      activityId: 'a2',
      ideaIds: [],
      date: '2026-08-02',
      location: { kind: 'postcode', postcode: 'GL1 1AA' },
      notes: '',
      referenceIds: [],
      photoReferenceIds: [],
      createdAt: '2026-08-02T10:00:00.000Z',
      updatedAt: '2026-08-02T10:00:00.000Z',
    }
    save({ ...seed, activities: [namedActivity, unnamedActivity] })

    renderActivities()

    expect(screen.getByRole('link', { name: 'Summer visit' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: new Date('2026-08-02T00:00:00').toLocaleDateString() })).toBeInTheDocument()
    expect(screen.getByText('Waypoint: Stourhead')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Waypoint: Stourhead' })).not.toBeInTheDocument()
    expect(screen.getByText('1 photo')).toBeInTheDocument()
    expect(screen.getByText('1 link')).toBeInTheDocument()
  })

  it('does not offer activity mutations to a viewer', async () => {
    vi.stubEnv('MODE', 'production')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: createDefaultData(), etags: {}, role: 'viewer' }))),
    )

    renderActivities()

    expect(await screen.findByText('No activities logged yet.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add activity' })).not.toBeInTheDocument()
  })
})
