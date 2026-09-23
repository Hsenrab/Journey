import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Locations from './Locations'
import { WaypointsProvider } from '../features/journey/JourneyContext'
import { createDefaultData, save, setDataMode } from '../services/storage'
import type { Activity } from '../domain/visit'
import type { JourneyRole } from '../services/principal'

function activity(waypointId: string, category: 'bronze' | 'silver' | 'gold'): Activity {
  return {
    activityId: `${waypointId}-${category}`,
    ownerId: 'owner-1',
    ideaIds: [],
    waypointId,
    challengeId: 'national-trust',
    date: '2026-08-01',
    category,
    location: { kind: 'postcode', postcode: waypointId },
    notes: '',
    referenceIds: [],
    photoReferenceIds: [],
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
  }
}

function renderLocations(initialEntries: string[] = ['/waypoints']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <WaypointsProvider>
        <Locations />
      </WaypointsProvider>
    </MemoryRouter>,
  )
}

function stubProductionFetch(role: JourneyRole, userId: string, data = createDefaultData()) {
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
      if (url === '/api/journey/production') {
        return new Response(JSON.stringify({ data, etags: {} }), { status: 200 })
      }
      return new Response(null, { status: 404 })
    }),
  )
}

async function renderProductionLocations(role: JourneyRole, userId: string) {
  stubProductionFetch(role, userId)
  renderLocations()
  await screen.findByText('Stourhead')
}

describe('Locations', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('lists every waypoint by default', () => {
    renderLocations()
    expect(screen.getByText('Stourhead')).toBeInTheDocument()
    expect(screen.getByText('Dyrham Park')).toBeInTheDocument()
  })

  it('filters by search term across title, area and category', async () => {
    const user = userEvent.setup()
    renderLocations()

    await user.type(screen.getByLabelText('Search waypoints'), 'garden')

    expect(screen.getByText('Westbury Court Garden')).toBeInTheDocument()
    expect(screen.getByText('Hidcote')).toBeInTheDocument()
    expect(screen.queryByText('Corfe Castle')).not.toBeInTheDocument()
  })

  it('filters by status', async () => {
    save({ ...createDefaultData(), activities: [activity('stourhead', 'gold')] })
    const user = userEvent.setup()
    renderLocations()

    await user.click(screen.getAllByRole('combobox')[0])
    await user.click(screen.getByRole('option', { name: 'Gold' }))

    expect(screen.getByText('Stourhead')).toBeInTheDocument()
    expect(screen.queryByText('Dyrham Park')).not.toBeInTheDocument()
  })

  it('applies the status filter from a URL query parameter', () => {
    save({ ...createDefaultData(), activities: [activity('stourhead', 'gold')] })
    renderLocations(['/waypoints?status=gold'])

    expect(screen.getByText('Stourhead')).toBeInTheDocument()
    expect(screen.queryByText('Dyrham Park')).not.toBeInTheDocument()
  })

  it('sorts by name ascending by default', () => {
    renderLocations()
    const names = screen.getAllByRole('heading', { level: 6 }).map((el) => el.textContent)
    const sorted = [...names].sort((a, b) => (a ?? '').localeCompare(b ?? ''))
    expect(names).toEqual(sorted)
  })

  it('re-sorts the list when switching to progress order', async () => {
    save({ ...createDefaultData(), activities: [activity('may-hill', 'gold'), activity('dyrham-park', 'silver')] })
    const user = userEvent.setup()
    renderLocations()

    const namesByName = screen.getAllByRole('heading', { level: 6 }).map((el) => el.textContent)

    await user.click(screen.getAllByRole('combobox')[1])
    await user.click(screen.getByRole('option', { name: 'Progress' }))

    const namesByProgress = screen.getAllByRole('heading', { level: 6 }).map((el) => el.textContent)
    expect(namesByProgress).not.toEqual(namesByName)
    expect([...namesByProgress].sort()).toEqual([...namesByName].sort())
  })

  it('sorts by distance, travel time and last activity date', async () => {
    save({ ...createDefaultData(), activities: [activity('stourhead', 'gold')] })
    const user = userEvent.setup()
    renderLocations()

    const namesByName = screen.getAllByRole('heading', { level: 6 }).map((el) => el.textContent)

    await user.click(screen.getAllByRole('combobox')[1])
    await user.click(screen.getByRole('option', { name: 'Distance (nearest first)' }))
    const namesByDistance = screen.getAllByRole('heading', { level: 6 }).map((el) => el.textContent)
    expect([...namesByDistance].sort()).toEqual([...namesByName].sort())

    await user.click(screen.getAllByRole('combobox')[1])
    await user.click(screen.getByRole('option', { name: 'Travel time' }))
    const namesByTravel = screen.getAllByRole('heading', { level: 6 }).map((el) => el.textContent)
    expect([...namesByTravel].sort()).toEqual([...namesByName].sort())

    await user.click(screen.getAllByRole('combobox')[1])
    await user.click(screen.getByRole('option', { name: 'Last activity date' }))
    const namesByLastActivity = screen.getAllByRole('heading', { level: 6 }).map((el) => el.textContent)
    expect([...namesByLastActivity].sort()).toEqual([...namesByName].sort())
  })

  it('filters by area and category', async () => {
    const user = userEvent.setup()
    renderLocations()

    await user.click(screen.getAllByRole('combobox')[3])
    await user.click(screen.getByRole('option', { name: 'Gloucestershire' }))
    expect(screen.queryByText('Stourhead')).not.toBeInTheDocument()

    await user.click(screen.getAllByRole('combobox')[3])
    await user.click(screen.getByRole('option', { name: 'All areas' }))

    await user.click(screen.getAllByRole('combobox')[4])
    await user.click(screen.getByRole('option', { name: 'Garden' }))
    expect(screen.getByText('Westbury Court Garden')).toBeInTheDocument()
  })

  it('shows the waypoint editor and paste-json mode on add', async () => {
    const user = userEvent.setup()
    renderLocations(['/waypoints?mode=add'])

    expect(screen.getByRole('button', { name: 'Save waypoint' })).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Paste JSON' }))
    expect(screen.getByLabelText('Waypoint JSON')).toBeInTheDocument()
  })

  it('hides add controls for viewers and shows the viewer ownership note', async () => {
    await renderProductionLocations('viewer', 'viewer-1')

    expect(screen.queryByRole('button', { name: 'Add waypoint' })).not.toBeInTheDocument()
    expect(screen.getAllByText('You can view and link to this entity, but cannot modify it.').length).toBeGreaterThan(0)
  })

  it('shows add controls for editors and explains non-owned waypoints', async () => {
    await renderProductionLocations('editor', 'editor-1')

    expect(screen.getByRole('button', { name: 'Add waypoint' })).toBeInTheDocument()
    expect(screen.getAllByText('You can only edit entities you created.').length).toBeGreaterThan(0)
  })

  it('shows add controls for owners without a restrictive ownership note', async () => {
    await renderProductionLocations('owner', 'owner-1')

    expect(screen.getByRole('button', { name: 'Add waypoint' })).toBeInTheDocument()
    expect(screen.queryByText('You can only edit entities you created.')).not.toBeInTheDocument()
    expect(screen.queryByText('You can view and link to this entity, but cannot modify it.')).not.toBeInTheDocument()
  })
})
