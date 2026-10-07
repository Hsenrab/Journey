import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Dashboard from './Dashboard'
import { WaypointsProvider } from '../features/journey/JourneyContext'
import { createDemoModeData, save, setDataMode } from '../services/storage'
import type { Activity } from '../domain/visit'

const lacockId = 'demo-foxglove-manor'
function testData() {
  const data = createDemoModeData()
  const challenge = data.challenges[0]!
  return {
    ...data,
    challenges: [challenge],
    waypoints: data.waypoints.filter((waypoint) => challenge.waypointIds.includes(waypoint.waypointId)),
    activities: [],
  }
}

const createDefaultData = testData

function activity(waypointId: string, category: 'bronze' | 'silver' | 'gold'): Activity {
  return {
    activityId: `${waypointId}-${category}`,
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

function renderDashboard() {
  return render(
    <MemoryRouter>
      <WaypointsProvider>
        <Dashboard />
      </WaypointsProvider>
    </MemoryRouter>,
  )
}

describe('Dashboard', () => {
  beforeEach(() => {
    localStorage.clear()
    save(testData())
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('shows a generic empty state when there are no challenges', () => {
    save({ ...createDefaultData(), challenges: [], waypoints: [] })
    renderDashboard()
    expect(screen.getByRole('heading', { name: 'Challenges' })).toBeInTheDocument()
    expect(screen.getByText('No challenges are available yet.')).toBeInTheDocument()
    expect(screen.queryByText('National Trust')).not.toBeInTheDocument()
  })

  it('shows a single challenge with its own name and progress', () => {
    const data = createDemoModeData()
    data.challenges = [data.challenges[0]!]
    data.waypoints = data.waypoints.filter((waypoint) => data.challenges[0]!.waypointIds.includes(waypoint.waypointId))
    data.activities = []
    save(data)
    renderDashboard()
    const challengeTitle = 'National Trust Demo Collection (Fictional)'
    expect(screen.getByRole('heading', { name: challengeTitle })).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: `${challengeTitle} completion` })).toBeInTheDocument()
    const title = screen.getByRole('heading', { name: challengeTitle })
    const challengeLink = screen.getByRole('link', { name: challengeTitle })
    expect(challengeLink).toHaveAttribute('href', '/challenges/national-trust')
    expect(challengeLink).toHaveAttribute('aria-labelledby', title.id)
  })

  it('shows zero progress when no activities are recorded', () => {
    const seed = createDefaultData()
    const challenge = seed.challenges[0]!
    seed.challenges = [challenge]
    seed.waypoints = seed.waypoints.filter((waypoint) => challenge.waypointIds.includes(waypoint.waypointId))
    seed.activities = []
    save(seed)
    renderDashboard()
    const card = screen.getByRole('heading', { name: challenge.title }).closest('.MuiCard-root')
    expect(within(card as HTMLElement).getByText('0% complete')).toBeInTheDocument()
    expect(within(card as HTMLElement).getByText(`0 of ${seed.waypoints.length} waypoints completed`)).toBeInTheDocument()
  })

  it('shows every demo challenge with its own waypoint progress and explains read-only mode', async () => {
    const demo = createDemoModeData()
    expect(demo.challenges.length).toBeGreaterThanOrEqual(2)
    setDataMode('demo-local')
    renderDashboard()
    await screen.findByText(/Demo local data is bundled sample data/)
    for (const challenge of demo.challenges) {
      const card = screen.getByRole('heading', { name: challenge.title }).closest('.MuiCard-root')
      expect(card).not.toBeNull()
      expect(
        within(card as HTMLElement).getByText(`of ${challenge.waypointIds.length} waypoints completed`, {
          exact: false,
        }),
      ).toBeInTheDocument()
    }
    expect(screen.queryByRole('button', { name: 'Add challenge' })).not.toBeInTheDocument()
  })

  it('explains when a viewer cannot add challenges', async () => {
    vi.stubEnv('MODE', 'production')
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ data: createDefaultData(), etags: {}, role: 'viewer' }), { status: 200 }),
        ),
    )
    renderDashboard()

    await waitFor(() => expect(screen.getByText(/Your Journey access is viewer only/)).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Add challenge' })).not.toBeInTheDocument()
  })

  it('counts waypoints linked from either side of a challenge', () => {
    const seed = createDefaultData()
    save({
      ...seed,
      challenges: [
        ...seed.challenges,
        {
          challengeId: 'walking',
          title: 'Walking',
          description: 'Explore on foot',
          waypointIds: [],
          supportsActivityCategories: false,
        },
      ],
      waypoints: seed.waypoints.map((waypoint) =>
        waypoint.waypointId === lacockId
          ? { ...waypoint, challengeIds: [...waypoint.challengeIds, 'walking'] }
          : waypoint,
      ),
      activities: [],
    })
    renderDashboard()
    const card = screen.getByRole('heading', { name: 'Walking' }).closest('.MuiCard-root')
    expect(within(card as HTMLElement).getByText('0 of 1 waypoints completed')).toBeInTheDocument()
  })

  it('adds a challenge from the page', async () => {
    const user = userEvent.setup()
    save({ ...createDefaultData(), challenges: [], waypoints: [] })
    renderDashboard()
    await user.click(screen.getByRole('button', { name: 'Add challenge' }))
    await user.type(screen.getByRole('textbox', { name: 'Title' }), '  Weekend walks  ')
    await user.type(screen.getByRole('textbox', { name: 'Description' }), 'Explore local trails')
    await user.click(screen.getByRole('button', { name: 'Save challenge' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Weekend walks' })).toBeInTheDocument())
    expect(screen.getByText('0 of 0 waypoints completed')).toBeInTheDocument()
    expect(screen.queryByText('No challenges are available yet.')).not.toBeInTheDocument()
    expect(screen.getAllByRole('progressbar')).toHaveLength(1)
  })

  it('clears the challenge draft when canceling and reopening the editor', async () => {
    const user = userEvent.setup()
    save({ ...createDefaultData(), challenges: [], waypoints: [] })
    renderDashboard()
    await user.click(screen.getByRole('button', { name: 'Add challenge' }))
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Discarded title')
    await user.type(screen.getByRole('textbox', { name: 'Description' }), 'Discarded description')
    await user.click(screen.getByRole('checkbox', { name: 'Use Bronze, Silver and Gold activity categories' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByRole('button', { name: 'Add challenge' }))

    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('')
    expect(screen.getByRole('textbox', { name: 'Description' })).toHaveValue('')
    expect(screen.getByRole('checkbox', { name: 'Use Bronze, Silver and Gold activity categories' })).not.toBeChecked()
  })

  it('shows inline errors for whitespace-only challenge fields', async () => {
    const user = userEvent.setup()
    save({ ...createDefaultData(), challenges: [], waypoints: [] })
    renderDashboard()
    await user.click(screen.getByRole('button', { name: 'Add challenge' }))
    await user.type(screen.getByRole('textbox', { name: 'Title' }), '   ')
    await user.type(screen.getByRole('textbox', { name: 'Description' }), '   ')
    await user.click(screen.getByRole('button', { name: 'Save challenge' }))

    expect(screen.getByText('Title is required.')).toBeInTheDocument()
    expect(screen.getByText('Description is required.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('closes the challenge editor and clears the conflict after a successful reload', async () => {
    setDataMode('demo-cosmos')
    const data = createDefaultData()
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
    renderDashboard()
    await user.click(await screen.findByRole('button', { name: 'Add challenge' }))
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Weekend walks')
    await user.type(screen.getByRole('textbox', { name: 'Description' }), 'Explore local trails')
    await user.click(screen.getByRole('button', { name: 'Save challenge' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Your data has changed in another session.')
    await user.click(screen.getByRole('button', { name: 'Reload latest' }))

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Save challenge' })).not.toBeInTheDocument()
  })

  it('keeps the conflict message and reload action when reloading fails', async () => {
    setDataMode('demo-cosmos')
    const data = createDefaultData()
    let loads = 0
    const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return new Response(JSON.stringify({ error: 'conflict' }), {
          status: 409,
          headers: { 'content-type': 'application/json' },
        })
      }
      loads += 1
      if (loads > 1) {
        return new Response(JSON.stringify({ error: 'unavailable' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ data, etags: {}, role: 'admin' }), {
        headers: { 'content-type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetch)
    const user = userEvent.setup()
    renderDashboard()
    await user.click(await screen.findByRole('button', { name: 'Add challenge' }))
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Weekend walks')
    await user.type(screen.getByRole('textbox', { name: 'Description' }), 'Explore local trails')
    await user.click(screen.getByRole('button', { name: 'Save challenge' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Your data has changed in another session.')
    await user.click(screen.getByRole('button', { name: 'Reload latest' }))

    expect(
      await screen.findByText(/Demo Cosmos could not be loaded, so read-only local demo data is shown:/),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload latest' })).toBeInTheDocument()
  })

  it('counts completed waypoints when any activity exists (including bronze)', () => {
    const seed = createDefaultData()
    const challenge = seed.challenges[0]!
    seed.challenges = [challenge]
    seed.waypoints = seed.waypoints.filter((waypoint) => challenge.waypointIds.includes(waypoint.waypointId))
    save({
      ...seed,
      activities: [
        activity('demo-foxglove-manor', 'silver'),
        activity('demo-bramblewick-gardens', 'gold'),
        activity('demo-cindercombe-mill', 'bronze'),
      ],
    })

    renderDashboard()

    expect(screen.getByText(`3 of ${seed.waypoints.length} waypoints completed`, { exact: false })).toBeInTheDocument()
  })

  it('derives status counts per waypoint and links each to a filtered Waypoints view', () => {
    const data = createDefaultData()
    const waypoint = data.waypoints.find((item) => item.waypointId === lacockId)!
    data.waypoints = [waypoint]
    data.challenges = [{ ...data.challenges[0]!, waypointIds: [lacockId] }]
    save({ ...data, activities: [activity(lacockId, 'silver')] })

    const { getByRole } = renderDashboard()

    const silverCard = getByRole('heading', { name: 'Silver' }).closest('div')
    expect(silverCard).toHaveTextContent('1')

    expect(getByRole('link', { name: 'Bronze: 0 waypoints' })).toHaveAttribute('href', '/waypoints?status=bronze')
    expect(getByRole('link', { name: 'Silver: 1 waypoint' })).toHaveAttribute('href', '/waypoints?status=silver')
    expect(getByRole('link', { name: 'Gold: 0 waypoints' })).toHaveAttribute('href', '/waypoints?status=gold')
  })

  it('formats recent activity dates for the user locale', () => {
    const data = createDefaultData()
    const waypoint = data.waypoints.find((item) => item.waypointId === lacockId)!
    data.waypoints = [waypoint]
    data.challenges = [{ ...data.challenges[0]!, waypointIds: [lacockId] }]
    save({ ...data, activities: [activity(lacockId, 'silver')] })

    renderDashboard()

    expect(screen.getByText(new Date('2026-08-01T00:00:00').toLocaleDateString(), { exact: false })).toBeInTheDocument()
  })

  it('makes recent-waypoint rows keyboard accessible links to the waypoint', () => {
    const data = createDefaultData()
    const waypoint = data.waypoints.find((item) => item.waypointId === lacockId)!
    data.waypoints = [waypoint]
    data.challenges = [{ ...data.challenges[0]!, waypointIds: [lacockId] }]
    save({ ...data, activities: [activity(lacockId, 'silver')] })

    const { getByRole } = renderDashboard()

    expect(getByRole('link', { name: /Foxglove Manor/ })).toHaveAttribute('href', `/waypoints/${lacockId}`)
  })
})
