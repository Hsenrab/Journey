import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Activities from './Activities'
import IdeaDetails from './IdeaDetails'
import { WaypointsProvider } from '../features/journey/JourneyContext'
import { createDefaultData, load, save, setDataMode } from '../services/storage'

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

function BackButton() {
  const navigate = useNavigate()
  return <button onClick={() => navigate(-1)}>Back</button>
}

function renderDetailsWithActivities(path = '/ideas/idea-1') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <WaypointsProvider>
        <BackButton />
        <Routes>
          <Route path="/ideas/:ideaId" element={<IdeaDetails />} />
          <Route path="/ideas" element={<div>Ideas list</div>} />
          <Route path="/activities" element={<Activities />} />
        </Routes>
      </WaypointsProvider>
    </MemoryRouter>,
  )
}

describe('IdeaDetails', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('breadcrumbs back to the idea list', async () => {
    const user = userEvent.setup()
    renderDetails('/ideas/missing')

    await user.click(screen.getByRole('link', { name: 'Ideas' }))
    expect(screen.getByText('Ideas list')).toBeInTheDocument()
  })

  it('shows usage and linked activities', () => {
    const seed = createDefaultData()
    save({
      ...seed,
      ideas: [
        {
          ideaId: 'idea-1',
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
    expect(screen.getByRole('link', { name: 'Ideas' })).toHaveAttribute('href', '/ideas')
  })

  it('renders rejected metadata and empty usage details', () => {
    const seed = createDefaultData()
    save({
      ...seed,
      ideas: [
        {
          ideaId: 'idea-1',
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

  it('does not offer idea mutations to a viewer', async () => {
    vi.stubEnv('MODE', 'production')
    const seed = createDefaultData()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              ...seed,
              ideas: [
                {
                  ideaId: 'idea-1',
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
            },
            etags: {},
            role: 'viewer',
          }),
        ),
      ),
    )

    renderDetails()

    expect(await screen.findByRole('heading', { name: 'Try the outer trail', level: 1 })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit idea' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete idea' })).not.toBeInTheDocument()
  })

  it('links to the activity editor with the idea pre-populated when there is no linked waypoint', () => {
    const seed = createDefaultData()
    save({
      ...seed,
      ideas: [
        {
          ideaId: 'idea-1',
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

    renderDetails()
    expect(screen.getByRole('link', { name: 'Log activity from this idea' })).toHaveAttribute(
      'href',
      '/activities?mode=add&idea=idea-1',
    )
  })

  it('carries the single linked waypoint into the activity editor deep link', () => {
    const seed = createDefaultData()
    save({
      ...seed,
      ideas: [
        {
          ideaId: 'idea-1',
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
    })

    renderDetails()
    expect(screen.getByRole('link', { name: 'Log activity from this idea' })).toHaveAttribute(
      'href',
      '/activities?mode=add&idea=idea-1&waypoint=stourhead',
    )
  })

  it('does not pre-select a waypoint when the idea links to several', () => {
    const seed = createDefaultData()
    save({
      ...seed,
      ideas: [
        {
          ideaId: 'idea-1',
          title: 'Try the outer trail',
          description: '',
          notes: '',
          waypointIds: ['stourhead', 'bath-skyline'],
          planningState: 'active',
          difficulty: 2,
          referenceIds: [],
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
        },
      ],
    })

    renderDetails()
    expect(screen.getByRole('link', { name: 'Log activity from this idea' })).toHaveAttribute(
      'href',
      '/activities?mode=add&idea=idea-1',
    )
  })

  it('hides the log activity action for a viewer', async () => {
    vi.stubEnv('MODE', 'production')
    const seed = createDefaultData()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              ...seed,
              ideas: [
                {
                  ideaId: 'idea-1',
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
            },
            etags: {},
            role: 'viewer',
          }),
        ),
      ),
    )

    renderDetails()

    expect(await screen.findByRole('heading', { name: 'Try the outer trail', level: 1 })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Log activity from this idea' })).not.toBeInTheDocument()
  })

  it('logs an activity from an idea, pre-filling the idea and its single linked waypoint', async () => {
    const user = userEvent.setup()
    const seed = createDefaultData()
    save({
      ...seed,
      ideas: [
        {
          ideaId: 'idea-1',
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
    })

    renderDetailsWithActivities()
    await user.click(screen.getByRole('link', { name: 'Log activity from this idea' }))

    expect(await screen.findByText('Activities')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Linked waypoint' })).toHaveTextContent('Stourhead')
    expect(screen.getByText('Try the outer trail')).toBeInTheDocument()

    await user.click(screen.getByRole('combobox', { name: 'Activity category' }))
    await user.click(screen.getByRole('option', { name: 'Gold' }))
    await user.click(screen.getByRole('button', { name: 'Save activity' }))

    expect(await screen.findByRole('heading', { name: 'Try the outer trail', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Used in 1 activity')).toBeInTheDocument()
    expect(load().activities[0]?.ideaIds).toEqual(['idea-1'])
    expect(load().activities[0]?.waypointId).toBe('stourhead')

    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('heading', { name: 'Try the outer trail', level: 1 })).toBeInTheDocument()
    expect(screen.queryByText('Activities')).not.toBeInTheDocument()
  })

  it('stays on activities after saving when the preselected idea link was removed', async () => {
    const user = userEvent.setup()
    const seed = createDefaultData()
    save({
      ...seed,
      ideas: [
        {
          ideaId: 'idea-1',
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
    })

    renderDetailsWithActivities()
    await user.click(screen.getByRole('link', { name: 'Log activity from this idea' }))

    const ideaChip = (await screen.findByText('Try the outer trail')).closest('.MuiChip-root') as HTMLElement
    await user.click(within(ideaChip).getByTestId('CancelIcon'))
    await user.click(screen.getByRole('combobox', { name: 'Activity category' }))
    await user.click(screen.getByRole('option', { name: 'Gold' }))
    await user.click(screen.getByRole('button', { name: 'Save activity' }))

    expect(await screen.findByText('Activity saved.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Try the outer trail', level: 1 })).not.toBeInTheDocument()
    expect(load().activities[0]?.ideaIds).toEqual([])
  })

  it('keeps the user on the activity editor and shows an error when logging an activity fails', async () => {
    setDataMode('demo-cosmos')
    const data = createDefaultData()
    data.ideas = [
      {
        ideaId: 'idea-1',
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
    const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return new Response(JSON.stringify({ error: 'conflict' }), {
          status: 409,
          headers: { 'content-type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ data, etags: {}, role: 'admin' }), {
        headers: { 'content-type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetch)

    const user = userEvent.setup()
    renderDetailsWithActivities()
    await user.click(await screen.findByRole('link', { name: 'Log activity from this idea' }))

    expect(await screen.findByText('Activities')).toBeInTheDocument()
    await user.click(screen.getByRole('combobox', { name: 'Activity category' }))
    await user.click(await screen.findByRole('option', { name: 'Gold' }))
    await user.click(screen.getByRole('button', { name: 'Save activity' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Your data has changed in another session.')
    expect(screen.getByRole('button', { name: 'Save activity' })).toBeInTheDocument()
  })

  it('enters and exits edit mode', async () => {
    const seed = createDefaultData()
    save({
      ...seed,
      ideas: [
        {
          ideaId: 'idea-1',
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
})
