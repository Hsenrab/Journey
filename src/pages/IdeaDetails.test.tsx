import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import IdeaDetails from './IdeaDetails'
import { WaypointsProvider } from '../features/journey/JourneyContext'
import { createDefaultData, load, save, setDataMode } from '../services/storage'
import type { JourneyRole } from '../services/principal'

function renderDetails(path = '/ideas/idea-1') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <WaypointsProvider>
        <Routes>
          <Route path="/ideas/:ideaId" element={<IdeaDetails />} />
          <Route path="/ideas" element={<div>Ideas list</div>} />
          <Route path="/activities/:activityId" element={<div>Activity details</div>} />
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

async function renderProductionDetails(role: JourneyRole, userId: string, ownerId: string) {
  const data = createDefaultData()
  data.ideas = [
    {
      ideaId: 'idea-1',
      ownerId,
      title: 'Try the outer trail',
      description: '',
      notes: '',
      waypointIds: ['stourhead'],
      planningState: 'active',
      difficulty: 2,
      referenceIds: [],
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    },
  ]
  stubProductionFetch(role, userId, data)
  renderDetails()
  await screen.findByRole('heading', { name: 'Try the outer trail' })
}

describe('IdeaDetails', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('shows usage and linked activities', () => {
    const seed = createDefaultData()
    save({
      ...seed,
      ideas: [
        {
          ideaId: 'idea-1',
          ownerId: 'owner-1',
          title: 'Try the outer trail',
          description: '',
          notes: '',
          waypointIds: ['stourhead'],
          planningState: 'active',
          difficulty: 2,
          referenceIds: [],
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
        },
      ],
      activities: [
        {
          activityId: 'a1',
          ownerId: 'owner-1',
          ideaIds: ['idea-1'],
          waypointId: 'stourhead',
          date: '2026-08-05',
          category: 'gold',
          location: { kind: 'postcode', postcode: 'BA12 6QF' },
          notes: '',
          referenceIds: [],
          photoReferenceIds: [],
          createdAt: '2026-08-05T00:00:00.000Z',
          updatedAt: '2026-08-05T00:00:00.000Z',
        },
      ],
    })

    renderDetails()
    expect(screen.getByText('Used in 1 activity')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View activity' })).toBeInTheDocument()
  })

  it('deletes an idea and detaches it from activities', async () => {
    const user = userEvent.setup()
    const seed = createDefaultData()
    save({
      ...seed,
      ideas: [
        {
          ideaId: 'idea-1',
          ownerId: 'owner-1',
          title: 'Try the outer trail',
          description: '',
          notes: '',
          waypointIds: [],
          planningState: 'active',
          difficulty: 2,
          referenceIds: [],
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
        },
      ],
      activities: [
        {
          activityId: 'a1',
          ownerId: 'owner-1',
          ideaIds: ['idea-1'],
          date: '2026-08-05',
          location: { kind: 'postcode', postcode: 'BA12 6QF' },
          notes: '',
          referenceIds: [],
          photoReferenceIds: [],
          createdAt: '2026-08-05T00:00:00.000Z',
          updatedAt: '2026-08-05T00:00:00.000Z',
        },
      ],
    })

    renderDetails()
    await user.click(screen.getByRole('button', { name: 'Delete idea' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(load().ideas).toEqual([])
    expect(load().activities[0]?.ideaIds).toEqual([])
  })

  it('shows not-found state for unknown idea id', () => {
    renderDetails('/ideas/missing')
    expect(screen.getByText('Idea not found.')).toBeInTheDocument()
  })

  it('renders rejected metadata and empty usage details', () => {
    const seed = createDefaultData()
    save({
      ...seed,
      ideas: [
        {
          ideaId: 'idea-1',
          ownerId: 'owner-1',
          title: 'Skipped concept',
          description: '',
          notes: '',
          waypointIds: [],
          planningState: 'rejected',
          rejectionReason: 'Not viable',
          difficulty: 3,
          location: { latitude: 51.12345, longitude: -2.54321 },
          referenceIds: [],
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
        },
      ],
      activities: [],
    })

    renderDetails()
    expect(screen.getByText('Rejection reason: Not viable')).toBeInTheDocument()
    expect(screen.getByText('Location: 51.12345, -2.54321')).toBeInTheDocument()
    expect(screen.getByText('No references linked to this idea.')).toBeInTheDocument()
    expect(screen.getByText('Not used')).toBeInTheDocument()
  })

  it('enters and exits edit mode', async () => {
    const seed = createDefaultData()
    save({
      ...seed,
      ideas: [
        {
          ideaId: 'idea-1',
          ownerId: 'owner-1',
          title: 'Try the outer trail',
          description: '',
          notes: '',
          waypointIds: [],
          planningState: 'active',
          difficulty: 2,
          referenceIds: [],
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
        },
      ],
    })

    const user = userEvent.setup()
    renderDetails()

    await user.click(screen.getByRole('button', { name: 'Edit idea' }))
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('button', { name: 'Edit idea' })).toBeInTheDocument()
  })

  it('hides edit controls for viewers', async () => {
    await renderProductionDetails('viewer', 'viewer-1', 'owner-1')

    expect(screen.queryByRole('button', { name: 'Edit idea' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete idea' })).not.toBeInTheDocument()
    expect(screen.getByText('You can view and link to this entity, but cannot modify it.')).toBeInTheDocument()
  })

  it('hides edit controls for editors on ideas they do not own', async () => {
    await renderProductionDetails('editor', 'editor-1', 'owner-1')

    expect(screen.queryByRole('button', { name: 'Edit idea' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete idea' })).not.toBeInTheDocument()
    expect(screen.getByText('You can only edit entities you created.')).toBeInTheDocument()
  })

  it('shows edit controls for editors on their own ideas', async () => {
    await renderProductionDetails('editor', 'editor-1', 'editor-1')

    expect(screen.getByRole('button', { name: 'Edit idea' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete idea' })).toBeInTheDocument()
  })

  it('shows edit controls for owners on any idea', async () => {
    await renderProductionDetails('owner', 'owner-1', 'other-owner')

    expect(screen.getByRole('button', { name: 'Edit idea' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete idea' })).toBeInTheDocument()
  })
})
