import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Activities from './Activities'
import { WaypointsProvider } from '../features/journey/JourneyContext'
import { createDefaultData, load, save, setDataMode } from '../services/storage'
import type { Activity } from '../domain/visit'
import type { JourneyRole } from '../services/principal'

function renderActivities() {
  render(
    <MemoryRouter>
      <WaypointsProvider>
        <Activities />
      </WaypointsProvider>
    </MemoryRouter>,
  )
}

function stubProductionFetch(role: JourneyRole, userId: string, data: ReturnType<typeof createDefaultData>) {
  vi.stubEnv('MODE', 'production')
  setDataMode('production')
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/.auth/me') {
        return new Response(
          JSON.stringify({
            clientPrincipal: { identityProvider: 'aad', userId, userDetails: userId, userRoles: [role] },
          }),
          { status: 200 },
        )
      }
      if (url === '/api/journey/production') return new Response(JSON.stringify({ data, etags: {} }), { status: 200 })
      return new Response(null, { status: 404 })
    }),
  )
}

async function renderProductionActivities(role: JourneyRole, userId: string) {
  const data = createDefaultData()
  data.activities = [
    {
      activityId: 'a1',
      ownerId: 'owner-1',
      ideaIds: [],
      waypointId: 'stourhead',
      date: '2026-08-01',
      category: 'gold',
      location: { kind: 'postcode', postcode: 'BA12 6QF' },
      notes: 'Seeded',
      referenceIds: [],
      photoReferenceIds: [],
      createdAt: '2026-08-01T10:00:00.000Z',
      updatedAt: '2026-08-01T10:00:00.000Z',
    },
  ]
  stubProductionFetch(role, userId, data)
  renderActivities()
  await screen.findByRole('link', { name: '2026-08-01' })
}

describe('Activities', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
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

  it('shows waypoint title labels instead of raw ids', () => {
    const seed = createDefaultData()
    const seededActivity: Activity = {
      activityId: 'a1',
      ownerId: 'owner-1',
      ideaIds: [],
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

  it('hides add controls for viewers and shows the viewer ownership note', async () => {
    await renderProductionActivities('viewer', 'viewer-1')

    expect(screen.queryByRole('button', { name: 'Add activity' })).not.toBeInTheDocument()
    expect(screen.getByText('You can view and link to this entity, but cannot modify it.')).toBeInTheDocument()
  })

  it('shows add controls for editors and explains non-owned activities', async () => {
    await renderProductionActivities('editor', 'editor-1')

    expect(screen.getByRole('button', { name: 'Add activity' })).toBeInTheDocument()
    expect(screen.getByText('You can only edit entities you created.')).toBeInTheDocument()
  })

  it('shows add controls for owners without a restrictive note', async () => {
    await renderProductionActivities('owner', 'owner-1')

    expect(screen.getByRole('button', { name: 'Add activity' })).toBeInTheDocument()
    expect(screen.queryByText('You can only edit entities you created.')).not.toBeInTheDocument()
    expect(screen.queryByText('You can view and link to this entity, but cannot modify it.')).not.toBeInTheDocument()
  })
})
