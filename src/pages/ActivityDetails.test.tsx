import { render, screen } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ActivityDetails from './ActivityDetails'
import { WaypointsProvider } from '../features/journey/JourneyContext'
import { createDefaultData, load, save, setDataMode } from '../services/storage'
import type { JourneyRole } from '../services/principal'

function renderDetails(path = '/activities/a1') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <WaypointsProvider>
        <Routes>
          <Route path="/activities/:activityId" element={<ActivityDetails />} />
          <Route path="/waypoints/:id" element={<div>Waypoint details</div>} />
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
  data.activities = [
    {
      activityId: 'a1',
      ownerId,
      ideaIds: [],
      waypointId: 'stourhead',
      date: '2026-08-01',
      category: 'gold',
      location: { kind: 'postcode', postcode: 'BA12 6QF' },
      notes: 'Excellent visit',
      referenceIds: [],
      photoReferenceIds: [],
      createdAt: '2026-08-01T10:00:00.000Z',
      updatedAt: '2026-08-01T10:00:00.000Z',
    },
  ]
  stubProductionFetch(role, userId, data)
  renderDetails()
  await screen.findByRole('heading', { name: '2026-08-01 · Stourhead' })
}

describe('ActivityDetails', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('shows not found for unknown ids', () => {
    renderDetails('/activities/missing')
    expect(screen.getByText('Activity not found.')).toBeInTheDocument()
  })

  it('renders linked references and photos', () => {
    const seed = createDefaultData()
    save({
      ...seed,
      ideas: [
        {
          ideaId: 'idea-1',
          ownerId: 'owner-1',
          title: 'Orangery idea',
          description: '',
          notes: '',
          waypointIds: ['stourhead'],
          planningState: 'active',
          difficulty: 1,
          referenceIds: [],
          createdAt: '2026-07-01T00:00:00.000Z',
          updatedAt: '2026-07-01T00:00:00.000Z',
        },
      ],
      references: [
        ...seed.references,
        { referenceId: 'r1', ownerId: 'owner-1', title: 'Guide', url: 'https://example.com/guide' },
      ],
      photoReferences: [
        { photoReferenceId: 'p1', ownerId: 'owner-1', title: 'View', url: 'https://example.com/view.jpg' },
      ],
      activities: [
        {
          activityId: 'a1',
          ownerId: 'owner-1',
          ideaIds: ['idea-1'],
          waypointId: 'stourhead',
          date: '2026-08-01',
          category: 'gold',
          location: { kind: 'postcode', postcode: 'BA12 6QF' },
          notes: 'Excellent visit',
          referenceIds: ['r1'],
          photoReferenceIds: ['p1'],
          createdAt: '2026-08-01T10:00:00.000Z',
          updatedAt: '2026-08-01T10:00:00.000Z',
        },
      ],
    })

    renderDetails()

    expect(screen.getByRole('heading', { name: '2026-08-01 · Stourhead' })).toBeInTheDocument()
    expect(screen.getByText('Guide')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'View' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Orangery idea' })).toBeInTheDocument()
  })

  it('renders empty optional fields and invalid reference hostnames', () => {
    const seed = createDefaultData()
    save({
      ...seed,
      references: [{ referenceId: 'r1', ownerId: 'owner-1', title: 'Link', url: 'https://example.com' }],
      activities: [
        {
          activityId: 'a1',
          ownerId: 'owner-1',
          ideaIds: [],
          date: '2026-08-01',
          location: { kind: 'postcode', postcode: 'BA12 6QF' },
          notes: '',
          referenceIds: ['r1'],
          photoReferenceIds: [],
          createdAt: '2026-08-01T10:00:00.000Z',
          updatedAt: '2026-08-01T10:00:00.000Z',
        },
      ],
    })

    renderDetails()

    expect(screen.getByText('No description recorded.')).toBeInTheDocument()
    expect(screen.getByText('No photos linked to this activity.')).toBeInTheDocument()
    expect(screen.getByText('example.com')).toBeInTheDocument()
  })

  it('deletes an activity after confirmation', async () => {
    const user = userEvent.setup()
    const seed = createDefaultData()
    save({
      ...seed,
      references: [
        ...seed.references,
        { referenceId: 'r1', ownerId: 'owner-1', title: 'Guide', url: 'https://example.com/guide' },
      ],
      activities: [
        {
          activityId: 'a1',
          ownerId: 'owner-1',
          ideaIds: [],
          waypointId: 'stourhead',
          date: '2026-08-01',
          category: 'gold',
          location: { kind: 'postcode', postcode: 'BA12 6QF' },
          notes: 'Excellent visit',
          referenceIds: ['r1'],
          photoReferenceIds: [],
          createdAt: '2026-08-01T10:00:00.000Z',
          updatedAt: '2026-08-01T10:00:00.000Z',
        },
      ],
    })

    renderDetails()

    await user.click(screen.getByRole('button', { name: 'Delete activity' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(load().activities).toEqual([])
    expect(load().references.some((reference) => reference.referenceId === 'r1')).toBe(false)
  })

  it('keeps data unchanged when delete is cancelled', async () => {
    const user = userEvent.setup()
    const seed = createDefaultData()
    save({
      ...seed,
      activities: [
        {
          activityId: 'a1',
          ownerId: 'owner-1',
          ideaIds: [],
          waypointId: 'stourhead',
          date: '2026-08-01',
          category: 'gold',
          location: { kind: 'postcode', postcode: 'BA12 6QF' },
          notes: 'Excellent visit',
          referenceIds: [],
          photoReferenceIds: [],
          createdAt: '2026-08-01T10:00:00.000Z',
          updatedAt: '2026-08-01T10:00:00.000Z',
        },
      ],
    })

    renderDetails()

    await user.click(screen.getByRole('button', { name: 'Delete activity' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(load().activities).toHaveLength(1)
  })

  it('supports editing and photo navigation', async () => {
    const user = userEvent.setup()
    const seed = createDefaultData()
    save({
      ...seed,
      photoReferences: [
        { photoReferenceId: 'p1', ownerId: 'owner-1', title: 'View one', url: 'https://example.com/one.jpg' },
        { photoReferenceId: 'p2', ownerId: 'owner-1', title: 'View two', url: 'https://example.com/two.jpg' },
      ],
      activities: [
        {
          activityId: 'a1',
          ownerId: 'owner-1',
          ideaIds: [],
          waypointId: 'stourhead',
          date: '2026-08-01',
          category: 'gold',
          location: { kind: 'postcode', postcode: 'BA12 6QF' },
          notes: 'Excellent visit',
          referenceIds: [],
          photoReferenceIds: ['p1', 'p2'],
          createdAt: '2026-08-01T10:00:00.000Z',
          updatedAt: '2026-08-01T10:00:00.000Z',
        },
      ],
    })

    renderDetails()

    await user.click(screen.getByRole('button', { name: 'Next photo' }))
    expect(screen.getByText('2 of 2: View two')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Previous photo' }))
    expect(screen.getByText('1 of 2: View one')).toBeInTheDocument()

    const img = screen.getByRole('img', { name: 'View one' })
    fireEvent.error(img)
    expect(screen.getByText('Image failed to load: View one')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Edit activity' }))
    await user.clear(screen.getByLabelText('Description / notes'))
    await user.type(screen.getByLabelText('Description / notes'), 'Updated notes')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(load().activities[0]?.notes).toBe('Updated notes')
    expect(screen.getByText('Activity updated.')).toBeInTheDocument()
  })

  it('hides edit controls for viewers', async () => {
    await renderProductionDetails('viewer', 'viewer-1', 'owner-1')

    expect(screen.queryByRole('button', { name: 'Edit activity' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete activity' })).not.toBeInTheDocument()
    expect(screen.getByText('You can view and link to this entity, but cannot modify it.')).toBeInTheDocument()
  })

  it('hides edit controls for editors on activities they do not own', async () => {
    await renderProductionDetails('editor', 'editor-1', 'owner-1')

    expect(screen.queryByRole('button', { name: 'Edit activity' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete activity' })).not.toBeInTheDocument()
    expect(screen.getByText('You can only edit entities you created.')).toBeInTheDocument()
  })

  it('shows edit controls for editors on their own activities', async () => {
    await renderProductionDetails('editor', 'editor-1', 'editor-1')

    expect(screen.getByRole('button', { name: 'Edit activity' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete activity' })).toBeInTheDocument()
  })

  it('shows edit controls for owners on any activity', async () => {
    await renderProductionDetails('owner', 'owner-1', 'other-owner')

    expect(screen.getByRole('button', { name: 'Edit activity' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete activity' })).toBeInTheDocument()
  })
})
