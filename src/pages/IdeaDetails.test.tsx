import { submitActivity } from '../test/activityActions'
import { Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { MemoryRouter } from '../test/DataMemoryRouter'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Activities from './Activities'
import IdeaDetails from './IdeaDetails'
import { WaypointsProvider } from '../features/journey/JourneyContext'
import { createDemoModeData, load, save, setDataMode } from '../services/storage'
import { createDemoTestData } from '../test/demoData'
import { DataSchema, type WaypointsData } from '../domain/visit'

const createDefaultData = createDemoTestData

function navigationData(): WaypointsData {
  return {
    challenges: [],
    waypoints: ['first', 'second', 'elsewhere'].map((waypointId) => ({
      waypointId,
      title: waypointId === 'elsewhere' ? 'Another destination' : 'Shared destination',
      description: 'Fictional destination',
      category: 'Walk',
      tags: [],
      challengeIds: [],
      completion: { mode: 'once' },
      referenceIds: [],
      photoReferenceIds: [],
    })),
    ideas: [
      {
        ideaId: 'idea-1',
        title: 'Navigation idea',
        description: '',
        notes: '',
        waypointIds: ['second', 'first'],
        planningState: 'active',
        difficulty: 1,
        referenceIds: [],
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
      },
    ],
    activities: ['elsewhere', undefined].map((waypointId, index) => ({
      activityId: `usage-${index}`,
      name: `Recorded experience ${index}`,
      waypointId,
      ideaIds: ['idea-1'],
      date: '2026-08-05',
      location: { kind: 'coordinates', latitude: 51, longitude: -2 },
      notes: '',
      referenceIds: [],
      photoReferenceIds: [],
      createdAt: '2026-08-05T00:00:00Z',
      updatedAt: '2026-08-05T00:00:00Z',
    })),
    references: [],
    photoReferences: [],
  }
}

function Destination() {
  const { id } = useParams()
  return <div>Destination {id}</div>
}

function renderDetails(path = '/ideas/idea-1') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <WaypointsProvider>
        <Routes>
          <Route path="/ideas/:ideaId" element={<IdeaDetails />} />
          <Route path="/ideas" element={<div>Ideas list</div>} />
          <Route path="/activities/:activityId" element={<div>Activity details</div>} />
          <Route path="/waypoints/:id" element={<Destination />} />
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
  beforeEach(() => {
    localStorage.clear()
    save(createDemoTestData())
  })
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

  it('reports a failed production load instead of a missing idea', async () => {
    vi.stubEnv('MODE', 'production')
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: 'unavailable' }), { status: 500, statusText: 'Broken' }),
        ),
    )

    renderDetails()

    expect(await screen.findByText(/Production data could not be loaded/)).toBeInTheDocument()
    expect(screen.getByText('This is a load failure, not a missing idea.')).toBeInTheDocument()
    expect(screen.queryByText('Idea not found.')).not.toBeInTheDocument()
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
          waypointIds: ['demo-foxglove-manor'],
          planningState: 'active',
          difficulty: 2,
          referenceIds: [],
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
        },
      ],
      activities: [
        {
          name: 'Recorded activity',
          activityId: 'a1',
          ideaIds: ['idea-1'],
          waypointId: 'demo-foxglove-manor',
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
          name: 'Recorded activity',
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
    expect(screen.getByText(/Your Journey access is viewer only/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Change the data mode in Settings' })).toHaveAttribute('href', '/settings')
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
          waypointIds: ['demo-foxglove-manor'],
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
      '/activities?mode=add&idea=idea-1&waypoint=demo-foxglove-manor',
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
          waypointIds: ['demo-foxglove-manor', 'demo-bramblewick-gardens'],
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
          waypointIds: ['demo-foxglove-manor'],
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
    expect(screen.getByRole('combobox', { name: 'Linked waypoint' })).toHaveValue('Foxglove Manor (Demo)')
    expect(screen.getByText('Try the outer trail')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save activity' }))
    await user.type(screen.getByLabelText('Activity title'), 'Recorded idea visit')
    await user.tab()
    expect(screen.getByLabelText('Activity title')).toHaveAttribute('aria-invalid', 'false')
    expect(load().activities).toHaveLength(0)
    await user.click(screen.getByRole('combobox', { name: 'Award tier' }))
    await user.click(screen.getByRole('option', { name: 'Gold' }))
    await submitActivity(user, 'Save activity')

    expect(await screen.findByRole('heading', { name: 'Try the outer trail', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Used in 1 activity')).toBeInTheDocument()
    expect(load().activities[0]?.ideaIds).toEqual(['idea-1'])
    expect(load().activities[0]?.waypointId).toBe('demo-foxglove-manor')

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
          waypointIds: ['demo-foxglove-manor'],
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
    await user.click(screen.getByRole('combobox', { name: 'Award tier' }))
    await user.click(screen.getByRole('option', { name: 'Gold' }))
    await submitActivity(user, 'Save activity')

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
        waypointIds: ['demo-foxglove-manor'],
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
    await user.click(screen.getByRole('combobox', { name: 'Award tier' }))
    await user.click(await screen.findByRole('option', { name: 'Gold' }))
    await submitActivity(user, 'Save activity')

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

  it('renders linked destinations by identity in association order without writing', async () => {
    const data = navigationData()
    save(data)
    const user = userEvent.setup()
    renderDetails()
    const links = within(screen.getByRole('region', { name: 'Linked waypoints' })).getAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/waypoints/second', '/waypoints/first'])
    expect(links.map((link) => link.textContent)).toEqual(['Shared destination', 'Shared destination'])
    await user.click(links[1])
    expect(screen.getByText('Destination first')).toBeInTheDocument()
    expect(load()).toEqual(data)
  })

  it.each([{ ids: [] }, { ids: ['first'] }, { ids: ['second', 'first'] }])(
    'renders linked destinations for $ids',
    ({ ids }) => {
      const data = navigationData()
      data.ideas[0]!.waypointIds = ids
      save(data)
      renderDetails()
      const section = within(screen.getByRole('region', { name: 'Linked waypoints' }))
      expect(section.queryAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(
        ids.map((id) => `/waypoints/${id}`),
      )
      if (ids.length === 0) expect(section.getByText('No waypoints linked to this idea.')).toBeInTheDocument()
    },
  )

  it('keeps linked destinations as text when dirty Cancel is declined and restores them on discard', async () => {
    save(navigationData())
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    renderDetails()
    await user.click(screen.getByRole('button', { name: 'Edit idea' }))
    const title = screen.getByRole('textbox', { name: 'Title' })
    await user.clear(title)
    await user.type(title, 'Retained idea draft')
    const section = within(screen.getByRole('region', { name: 'Linked waypoints' }))
    expect(section.getAllByText('Shared destination')).toHaveLength(2)
    expect(section.queryAllByRole('link')).toHaveLength(0)
    expect(screen.getAllByRole('link', { name: 'View activity' })).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(confirm).toHaveBeenCalledWith('You have unsaved changes. Leave this page?')
    expect(title).toHaveValue('Retained idea draft')
    expect(section.queryAllByRole('link')).toHaveLength(0)
    confirm.mockReturnValue(true)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(section.getAllByRole('link')).toHaveLength(2)
    expect(load().ideas[0]!.title).toBe('Navigation idea')
  })

  it('keeps linked destinations as text through pending and failed saves and uses saved associations after retry', async () => {
    let data = navigationData()
    setDataMode('demo-cosmos')
    let release: (() => void) | undefined
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    let writes = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          writes++
          if (writes === 1) {
            await pending
            return new Response(JSON.stringify({ error: 'Deliberate Idea save failure' }), { status: 400 })
          }
          const body: { operation: unknown; data: unknown } = JSON.parse(String(init.body))
          expect(body.operation).toBe('replace')
          data = DataSchema.parse(body.data)
        }
        return new Response(JSON.stringify({ data, etags: {}, role: 'admin' }))
      }),
    )
    const user = userEvent.setup()
    renderDetails()
    await user.click(await screen.findByRole('button', { name: 'Edit idea' }))
    const title = screen.getByRole('textbox', { name: 'Title' })
    await user.clear(title)
    await user.type(title, 'Saved idea draft')
    const selection = screen.getByRole('combobox', { name: 'Linked waypoints' })
    await user.click(selection)
    await user.keyboard('{Backspace}{Escape}')
    const section = within(screen.getByRole('region', { name: 'Linked waypoints' }))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(writes).toBe(1)
    expect(section.queryAllByRole('link')).toHaveLength(0)
    release!()
    expect(
      await screen.findByText(/Journey API request failed with 400:.*Deliberate Idea save failure/),
    ).toBeInTheDocument()
    expect(title).toHaveValue('Saved idea draft')
    expect(section.queryAllByRole('link')).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByRole('button', { name: 'Edit idea' })).toBeInTheDocument()
    expect(section.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(['/waypoints/first'])
    expect(data.ideas[0]!.waypointIds).toEqual(['first'])
    expect(writes).toBe(2)
  })

  for (const planningState of ['active', 'someday', 'rejected'] as const) {
    it.each([false, true])(
      `keeps linked destinations independent of ${planningState} planning and usage=%s`,
      (used) => {
        const data = navigationData()
        data.ideas[0]!.planningState = planningState
        if (planningState === 'rejected') data.ideas[0]!.rejectionReason = 'Not this time'
        if (!used) data.activities = []
        save(data)
        renderDetails()
        expect(screen.getByText('Linked waypoints are planning associations.')).toBeInTheDocument()
        expect(screen.getByText('Usage counts activities that explicitly used this idea.')).toBeInTheDocument()
        expect(screen.getByText(used ? 'Used in 2 activities' : 'Not used')).toBeInTheDocument()
        expect(
          screen.getByText(`Planning state: ${planningState[0].toUpperCase()}${planningState.slice(1)}`),
        ).toBeInTheDocument()
        expect(load().ideas).toEqual(data.ideas)
        const section = within(screen.getByRole('region', { name: 'Linked waypoints' }))
        expect(section.getAllByRole('link')).toHaveLength(2)
        expect(section.queryByRole('link', { name: 'Another destination' })).not.toBeInTheDocument()
      },
    )
  }

  it('keeps viewer destination and usage links without offering writes', async () => {
    const data = navigationData()
    setDataMode('demo-cosmos')
    const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method ?? 'GET').toBe('GET')
      return new Response(JSON.stringify({ data, etags: {}, role: 'viewer' }))
    })
    vi.stubGlobal('fetch', fetch)
    const user = userEvent.setup()
    renderDetails()
    expect(await screen.findByText(/Your Journey access is viewer only/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Change the data mode in Settings' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit idea' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete idea' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Log activity from this idea' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'View activity' })).toHaveLength(2)
    await user.click(within(screen.getByRole('region', { name: 'Linked waypoints' })).getAllByRole('link')[0])
    expect(screen.getByText('Destination second')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('keeps bundled Demo local destinations navigable and read-only', async () => {
    const data = createDemoModeData()
    const idea = data.ideas.find((item) => item.waypointIds.length > 0)!
    setDataMode('demo-local')
    const user = userEvent.setup()
    renderDetails(`/ideas/${idea.ideaId}`)
    expect(screen.getByText(/Demo local data is bundled sample data/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit idea' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Log activity from this idea' })).not.toBeInTheDocument()
    await user.click(within(screen.getByRole('region', { name: 'Linked waypoints' })).getAllByRole('link')[0])
    expect(screen.getByText(`Destination ${idea.waypointIds[0]}`)).toBeInTheDocument()
  })

  it('does not show Activity success when recording from linked destinations is cancelled', async () => {
    save(navigationData())
    const user = userEvent.setup()
    renderDetailsWithActivities()
    await user.click(screen.getByRole('link', { name: 'Log activity from this idea' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText(/Activity saved/)).not.toBeInTheDocument()
    expect(load().activities).toHaveLength(2)
  })
})
