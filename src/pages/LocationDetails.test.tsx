import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LocationDetails from './LocationDetails'
import { WaypointsProvider } from '../features/journey/JourneyContext'
import { createDefaultData, load, save, setDataMode } from '../services/storage'
import type { JourneyRole } from '../services/principal'

const lacockId = 'lacock-abbey-fox-talbot-museum-and-village'

function renderDetails(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/waypoints/${id}`]}>
      <WaypointsProvider>
        <Routes>
          <Route path="/waypoints/:id" element={<LocationDetails />} />
        </Routes>
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

async function renderProductionDetails(role: JourneyRole, userId: string, waypointOwnerId: string) {
  const data = createDefaultData()
  data.waypoints = data.waypoints.map((waypoint) =>
    waypoint.waypointId === lacockId ? { ...waypoint, ownerId: waypointOwnerId } : waypoint,
  )
  stubProductionFetch(role, userId, data)
  renderDetails(lacockId)
  await screen.findByRole('heading', { name: 'Lacock Abbey, Fox Talbot Museum and Village' })
}

describe('LocationDetails', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('shows an error when the waypoint is not found', () => {
    renderDetails('does-not-exist')
    expect(screen.getByText('Waypoint not found.')).toBeInTheDocument()
  })

  it('shows the waypoint details', () => {
    renderDetails(lacockId)
    expect(screen.getByRole('heading', { name: 'Lacock Abbey, Fox Talbot Museum and Village' })).toBeInTheDocument()
  })

  it('adds a linked activity', async () => {
    const user = userEvent.setup()
    renderDetails(lacockId)

    await user.click(screen.getByRole('button', { name: 'Log activity' }))
    await user.type(screen.getByLabelText('Description / notes'), 'Wonderful visit')
    await user.click(screen.getByRole('combobox', { name: 'Activity category' }))
    await user.click(screen.getByRole('option', { name: 'Gold' }))
    await user.click(screen.getByRole('button', { name: 'Save activity' }))

    expect(screen.getByText('Activity saved.')).toBeInTheDocument()
    expect(load().activities).toContainEqual(
      expect.objectContaining({ waypointId: lacockId, category: 'gold', notes: 'Wonderful visit' }),
    )
  })

  it('shows an error message for an invalid activity date', async () => {
    const user = userEvent.setup()
    renderDetails(lacockId)

    await user.click(screen.getByRole('button', { name: 'Log activity' }))
    const dateInput = screen.getByLabelText('Activity date')
    await user.clear(dateInput)
    await user.type(dateInput, 'not-a-date')
    await user.click(screen.getByRole('button', { name: 'Save activity' }))

    expect(screen.getByText('Please enter a valid activity date in YYYY-MM-DD format.')).toBeInTheDocument()
    expect(load().activities).toEqual([])
  })

  it('shows ideas linked to the waypoint with derived usage', () => {
    const seed = createDefaultData()
    save({
      ...seed,
      ideas: [
        {
          ideaId: 'idea-1',
          ownerId: 'owner-1',
          title: 'Scout route',
          description: '',
          notes: '',
          waypointIds: [lacockId],
          planningState: 'active',
          difficulty: 1,
          referenceIds: [],
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
        },
      ],
    })
    renderDetails(lacockId)
    expect(screen.getByRole('heading', { name: 'Ideas' })).toBeInTheDocument()
    expect(screen.getByText('Scout route')).toBeInTheDocument()
    expect(screen.getByText('Active · Not used')).toBeInTheDocument()
  })

  it('hides add controls for viewers', async () => {
    await renderProductionDetails('viewer', 'viewer-1', 'owner-1')

    expect(screen.queryByRole('button', { name: 'Log activity' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Add idea' })).not.toBeInTheDocument()
    expect(screen.getByText('You can view and link to this entity, but cannot modify it.')).toBeInTheDocument()
  })

  it('shows add controls for editors and explains non-owned waypoints', async () => {
    await renderProductionDetails('editor', 'editor-1', 'owner-1')

    expect(screen.getByRole('button', { name: 'Log activity' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Add idea' })).toBeInTheDocument()
    expect(screen.getByText('You can only edit entities you created.')).toBeInTheDocument()
  })

  it('shows add controls for owners without a restrictive note', async () => {
    await renderProductionDetails('owner', 'owner-1', 'other-owner')

    expect(screen.getByRole('button', { name: 'Log activity' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Add idea' })).toBeInTheDocument()
    expect(screen.queryByText('You can only edit entities you created.')).not.toBeInTheDocument()
    expect(screen.queryByText('You can view and link to this entity, but cannot modify it.')).not.toBeInTheDocument()
  })
})
