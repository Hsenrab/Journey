import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Locations from './Locations'
import { WaypointsProvider } from '../features/journey/JourneyContext'
import { createDefaultData, save, setDataMode } from '../services/storage'
import type { Activity, Waypoint, WaypointsData } from '../domain/visit'
import { createAwardTestData } from '../test/demoData'

function activity(waypointId: string, category: 'bronze' | 'silver' | 'gold'): Activity {
  return {
    name: 'Recorded activity',
    activityId: `${waypointId}-${category}`,
    ideaIds: [],
    waypointId,
    challengeId: 'test-challenge',
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

function waypoint(waypointId: string, title: string, area: string, category: string): Waypoint {
  return {
    waypointId,
    title,
    description: `${title} description.`,
    category,
    tags: [],
    challengeIds: ['test-challenge'],
    completion: { mode: 'once' },
    location: { addressOrRegion: area },
    referenceIds: [],
    photoReferenceIds: [],
  }
}

function testData(): WaypointsData {
  return {
    ...createDefaultData(),
    waypoints: [
      waypoint('stourhead', 'Stourhead', 'Wiltshire', 'Garden'),
      waypoint('dyrham-park', 'Dyrham Park', 'Bristol', 'Historic building'),
      waypoint('may-hill', 'May Hill', 'Gloucestershire', 'Countryside'),
      waypoint('hidcote', 'Hidcote', 'Gloucestershire', 'Garden'),
      waypoint('westbury-court-garden', 'Westbury Court Garden', 'Gloucestershire', 'Garden'),
      waypoint('corfe-castle', 'Corfe Castle', 'Dorset', 'Castle'),
    ],
    challenges: [
      {
        challengeId: 'test-challenge',
        title: 'Test challenge',
        description: 'A challenge for testing waypoint behavior.',
        supportsActivityCategories: true,
        awardDescriptions: { bronze: 'Afternoon', silver: 'Day', gold: 'Night' },
      },
    ],
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

async function openMoreFilters(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'More filters (0 active)' }))
}

function waypointNames() {
  return screen.getAllByRole('heading', { level: 6 }).map((el) => el.textContent)
}

// Full coverage runs these MUI editor interactions under enough contention to exceed Vitest's default timeout.
const SLOW_EDITOR_TEST_TIMEOUT_MS = 20_000

describe('Locations', () => {
  it('retains applicable controls for empty scoped results and clears them back to all members', async () => {
    save(createAwardTestData())
    const user = userEvent.setup()
    renderLocations(['/waypoints?challenge=award-a&status=bronze'])
    expect(screen.getByRole('combobox', { name: 'Highest recorded award' })).toBeInTheDocument()
    expect(screen.getByText('No waypoints match your search and filters.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Search waypoints'), 'missing')
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(document.querySelectorAll('.MuiCard-root')).toHaveLength(3)
  })

  it.each(['/waypoints?challenge=missing', '/waypoints?status=platinum', '/waypoints?challenge=ordinary&status=gold'])(
    'shows an explicit invalid-scope error for %s',
    (path) => {
      save(createAwardTestData())
      renderLocations([path])
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(document.querySelectorAll('.MuiCard-root')).toHaveLength(0)
    },
  )

  it('hides award metadata, filtering and ordering in an ordinary shared-member scope', () => {
    save(createAwardTestData())
    renderLocations(['/waypoints?challenge=ordinary'])
    expect(document.querySelectorAll('.MuiCard-root')).toHaveLength(2)
    expect(screen.queryByRole('combobox', { name: 'Highest recorded award' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Highest recorded award:/)).not.toBeInTheDocument()
  })
  beforeEach(() => {
    localStorage.clear()
    save(testData())
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('creates a remote text-only waypoint through replacement and adopts resolved coordinates', async () => {
    vi.stubEnv('MODE', 'production')
    const data = {
      ...createDefaultData(),
      waypoints: [],
      challenges: [],
      activities: [],
      ideas: [],
      references: [],
      photoReferences: [],
    }
    const fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      if (!init?.body) return new Response(JSON.stringify({ data, etags: {}, role: 'admin' }))
      const body = JSON.parse(String(init.body))
      expect(body.operation).toBe('replace')
      expect(body.data.waypoints[0].location).toEqual({ placeName: 'New place' })
      body.data.waypoints[0].location = { placeName: 'New place', latitude: 51, longitude: -2 }
      return new Response(JSON.stringify({ data: body.data, etags: { [body.data.waypoints[0].waypointId]: 'saved' } }))
    })
    vi.stubGlobal('fetch', fetch)
    renderLocations(['/waypoints?mode=add'])
    await screen.findByLabelText('Title')
    for (const [label, value] of Object.entries({
      Title: 'Remote place',
      Description: 'Description',
      Category: 'Walk',
      'Place name': 'New place',
    })) {
      fireEvent.change(screen.getByRole('textbox', { name: label }), { target: { value } })
    }
    fireEvent.click(screen.getByRole('button', { name: 'Save waypoint' }))
    expect(await screen.findByText('Waypoint saved.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Remote place' })).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it.each(['production', 'demo-cosmos'] as const)(
    'keeps %s viewer waypoints browsable without add controls',
    async (mode) => {
      vi.stubEnv('MODE', 'production')
      setDataMode(mode)
      const fetch = vi
        .fn()
        .mockImplementation(
          () => new Response(JSON.stringify({ data: testData(), etags: {}, role: 'viewer' }), { status: 200 }),
        )
      vi.stubGlobal('fetch', fetch)
      renderLocations(['/waypoints?mode=add'])

      expect(
        await screen.findByText(/Your Journey access is viewer only, so you can read this data but not change it\./),
      ).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Stourhead' })).toHaveAttribute('href', '/waypoints/stourhead')
      expect(screen.queryByRole('button', { name: /add waypoint/i })).not.toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Change the data mode in Settings' })).toHaveAttribute(
        'href',
        '/settings',
      )
      expect(fetch).toHaveBeenCalledTimes(1)
    },
  )

  it('preserves a declined add draft and its shortlist, then discards and reopens without writing', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const before = testData()
    renderLocations(['/waypoints?challenge=test-challenge&mode=add'])
    fireEvent.change(screen.getByLabelText('Search waypoints'), { target: { value: 'Stourhead' } })
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Abandoned title' } })
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByLabelText('Title')).toHaveValue('Abandoned title')
    expect(screen.getByLabelText('Search waypoints')).toHaveValue('Stourhead')
    expect(screen.getByRole('combobox', { name: 'Highest recorded award' })).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('waypoints-v1')!)).toEqual(before)
    confirm.mockReturnValue(true)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('button', { name: 'Save waypoint' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Search waypoints')).toHaveValue('Stourhead')
    await user.click(screen.getByRole('button', { name: 'Add waypoint' }))
    expect(screen.getByLabelText('Title')).toHaveValue('')
    await user.click(screen.getByRole('tab', { name: 'Paste JSON' }))
    expect(screen.getByLabelText('Waypoint JSON')).toHaveValue('')
    expect(JSON.parse(localStorage.getItem('waypoints-v1')!)).toEqual(before)
    expect(confirm).toHaveBeenCalledTimes(2)
  })

  it('cancels an unchanged add draft without a prompt or write', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm')
    const before = localStorage.getItem('waypoints-v1')
    renderLocations(['/waypoints?mode=add'])
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(confirm).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Save waypoint' })).not.toBeInTheDocument()
    expect(localStorage.getItem('waypoints-v1')).toBe(before)
  })

  it.each(['production', 'demo-cosmos'] as const)(
    'retains the specific %s add failure when discard is declined',
    async (mode) => {
      vi.stubEnv('MODE', 'production')
      setDataMode(mode)
      const data = createDefaultData()
      const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
        init?.method === 'POST'
          ? new Response(JSON.stringify({ error: 'Deliberate Waypoint save failure' }), {
              status: 400,
              statusText: 'Bad Request',
            })
          : new Response(JSON.stringify({ data, etags: {}, role: 'admin' })),
      )
      vi.stubGlobal('fetch', fetch)
      const user = userEvent.setup()
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
      renderLocations(['/waypoints?mode=add'])
      await screen.findByLabelText('Title')
      for (const [label, value] of Object.entries({
        Title: 'Retained title',
        Description: 'Retained description',
        Category: 'Walk',
      })) {
        fireEvent.change(screen.getByRole('textbox', { name: label }), { target: { value } })
      }
      await user.click(screen.getByRole('button', { name: 'Save waypoint' }))
      expect(await screen.findByText(/Deliberate Waypoint save failure/)).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(confirm).toHaveBeenCalledOnce()
      expect(screen.getByLabelText('Title')).toHaveValue('Retained title')
      expect(screen.getByText(/Deliberate Waypoint save failure/)).toBeInTheDocument()
      expect(screen.queryByText('Waypoint saved.')).not.toBeInTheDocument()
      expect(fetch.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
    },
  )

  it('does not open a direct add URL in Demo local', () => {
    setDataMode('demo-local')
    renderLocations(['/waypoints?mode=add'])
    expect(screen.queryByRole('button', { name: 'Save waypoint' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Change the data mode in Settings' })).toHaveAttribute('href', '/settings')
  })

  it('lists every waypoint by default', () => {
    renderLocations()
    expect(screen.getByText('Stourhead')).toBeInTheDocument()
    expect(screen.getByText('Dyrham Park')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Stourhead' })).toHaveAttribute('href', '/waypoints/stourhead')
  })

  it('shows completion progress and award tier on waypoint cards', () => {
    const data = testData()
    save({
      ...data,
      waypoints: data.waypoints.map((waypoint) =>
        waypoint.waypointId === 'stourhead' ? { ...waypoint, completion: { mode: 'count', target: 3 } } : waypoint,
      ),
      activities: [activity('stourhead', 'gold'), activity('dyrham-park', 'bronze')],
    })
    renderLocations()

    const stourhead = screen.getByRole('link', { name: 'Stourhead' })
    expect(within(stourhead).getByText('Completion: 1 of 3 activities')).toBeInTheDocument()
    expect(within(stourhead).getByText('Highest recorded award: Gold')).toBeInTheDocument()
    const dyrham = screen.getByRole('link', { name: 'Dyrham Park' })
    expect(within(dyrham).getByText('Completion: Done')).toBeInTheDocument()
    expect(within(dyrham).getByText('Highest recorded award: Bronze')).toBeInTheDocument()
    const hidcote = screen.getByRole('link', { name: 'Hidcote' })
    expect(within(hidcote).getByText('Completion: Not done')).toBeInTheDocument()
  })

  it('keeps primary filters visible and secondary filters in a closed accordion', () => {
    renderLocations()

    expect(screen.getByLabelText('Search waypoints')).toBeVisible()
    expect(screen.getByRole('combobox', { name: 'Highest recorded award' })).toBeVisible()
    expect(screen.getByRole('combobox', { name: 'Sort' })).toBeVisible()
    const summary = screen.getByRole('button', { name: 'More filters (0 active)' })
    expect(summary).toHaveAttribute('aria-expanded', 'false')
    const regionId = summary.getAttribute('aria-controls')
    expect(regionId).toBe('more-filters')
    expect(document.querySelectorAll(`#${regionId}`)).toHaveLength(1)
    expect(document.getElementById(regionId!)).toHaveAttribute('aria-labelledby', 'more-filters-header')
    expect(screen.queryByRole('combobox', { name: 'Maximum driving distance' })).not.toBeInTheDocument()
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
    save({ ...testData(), activities: [activity('stourhead', 'gold')] })
    const user = userEvent.setup()
    renderLocations()

    await user.click(screen.getAllByRole('combobox')[0])
    await user.click(screen.getByRole('option', { name: 'Gold' }))

    expect(screen.getByText('Stourhead')).toBeInTheDocument()
    expect(screen.queryByText('Dyrham Park')).not.toBeInTheDocument()
  })

  it('applies the status filter from a URL query parameter', () => {
    save({ ...testData(), activities: [activity('stourhead', 'gold')] })
    renderLocations(['/waypoints?status=gold'])

    expect(screen.getByText('Stourhead')).toBeInTheDocument()
    expect(screen.queryByText('Dyrham Park')).not.toBeInTheDocument()
  })

  it('sorts by name ascending by default', () => {
    renderLocations()
    const names = waypointNames()
    const sorted = [...names].sort((a, b) => (a ?? '').localeCompare(b ?? ''))
    expect(names).toEqual(sorted)
  })

  it('re-sorts the list when switching to award tier order', async () => {
    save({ ...testData(), activities: [activity('may-hill', 'gold'), activity('dyrham-park', 'silver')] })
    const user = userEvent.setup()
    renderLocations()

    const namesByName = waypointNames()

    await user.click(screen.getAllByRole('combobox')[1])
    await user.click(screen.getByRole('option', { name: 'Highest recorded award' }))

    const namesByProgress = waypointNames()
    expect(namesByProgress).not.toEqual(namesByName)
    expect([...namesByProgress].sort()).toEqual([...namesByName].sort())
  })

  it('sorts by last activity date', async () => {
    save({ ...testData(), activities: [activity('stourhead', 'gold')] })
    const user = userEvent.setup()
    renderLocations()

    const namesByName = waypointNames()

    await user.click(screen.getAllByRole('combobox')[1])
    await user.click(screen.getByRole('option', { name: 'Last activity date' }))

    const namesBySort = waypointNames()
    expect(namesBySort[0]).toBe('Stourhead')
    expect([...namesBySort].sort()).toEqual([...namesByName].sort())
  })

  it('shows saved custom location labels and categories', async () => {
    renderLocations()

    expect(screen.getByText('Garden · Wiltshire')).toBeInTheDocument()
    expect(screen.getByText('Historic building · Bristol')).toBeInTheDocument()
  })

  it('lists waypoints from any challenge and uses their own generic category and area', async () => {
    save({
      ...createDefaultData(),
      waypoints: [
        {
          waypointId: 'other-challenge',
          title: 'Other challenge waypoint',
          description: 'A waypoint for another challenge.',
          category: 'Custom',
          tags: [],
          challengeIds: ['other-challenge'],
          completion: { mode: 'once' },
          location: { addressOrRegion: 'Custom area' },
          referenceIds: [],
          photoReferenceIds: [],
        },
      ],
      challenges: [
        {
          challengeId: 'other-challenge',
          title: 'Other challenge',
          description: 'A separate challenge.',
          supportsActivityCategories: false,
        },
      ],
    })

    renderLocations()

    expect(screen.getByText('Other challenge waypoint')).toBeInTheDocument()
    expect(screen.getByText('Custom · Custom area')).toBeInTheDocument()
    expect(screen.queryByText('Distance unknown')).not.toBeInTheDocument()
  })

  it('filters by area and category', async () => {
    const user = userEvent.setup()
    renderLocations()

    await openMoreFilters(user)
    await user.click(screen.getByRole('combobox', { name: 'Area' }))
    await user.click(screen.getByRole('option', { name: 'Gloucestershire' }))
    expect(screen.queryByText('Stourhead')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'More filters (1 active)' })).toBeInTheDocument()

    await user.click(screen.getByRole('combobox', { name: 'Category' }))
    await user.click(screen.getByRole('option', { name: 'Garden' }))
    expect(screen.getByText('Westbury Court Garden')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'More filters (2 active)' })).toBeInTheDocument()

    await user.click(screen.getByRole('combobox', { name: 'Area' }))
    await user.click(screen.getByRole('option', { name: 'All areas' }))
    expect(screen.getByRole('button', { name: 'More filters (1 active)' })).toBeInTheDocument()
  })

  it('shows the waypoint editor and paste-json mode on add', async () => {
    const user = userEvent.setup()
    renderLocations(['/waypoints?mode=add'])

    expect(screen.getByRole('button', { name: 'Save waypoint' })).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Paste JSON' }))
    expect(screen.getByLabelText('Waypoint JSON')).toBeInTheDocument()
  })

  it(
    'shows waypoint save success in an alert',
    async () => {
      const user = userEvent.setup({ delay: null })
      renderLocations(['/waypoints?mode=add'])

      await user.type(screen.getByLabelText('Title'), 'A viewpoint')
      await user.type(screen.getByLabelText('Description'), 'A quiet viewpoint')
      await user.type(screen.getAllByLabelText('Category')[0]!, 'Scenic')
      await user.click(screen.getByRole('button', { name: 'Save waypoint' }))

      expect(screen.getByRole('alert')).toHaveTextContent('Waypoint saved.')
    },
    SLOW_EDITOR_TEST_TIMEOUT_MS,
  )

  it(
    'offers to reload the latest waypoints after a save conflict',
    async () => {
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
      const user = userEvent.setup({ delay: null })
      renderLocations()
      await user.click(await screen.findByRole('button', { name: 'Add waypoint' }))

      await user.type(screen.getByLabelText('Title'), 'A viewpoint')
      await user.type(screen.getByLabelText('Description'), 'A quiet viewpoint')
      await user.type(screen.getAllByLabelText('Category')[0]!, 'Scenic')
      await user.click(screen.getByRole('button', { name: 'Save waypoint' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Your data has changed in another session.')
      expect(screen.getAllByText('Your data has changed in another session.')).toHaveLength(1)

      await user.click(screen.getByRole('button', { name: 'Reload latest' }))

      await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
      expect(fetch.mock.calls.filter(([, init]) => !init?.method)).toHaveLength(2)
    },
    SLOW_EDITOR_TEST_TIMEOUT_MS,
  )

  it(
    'keeps the conflict alert and editor open when reloading fails',
    async () => {
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
      const user = userEvent.setup({ delay: null })
      renderLocations()
      await user.click(await screen.findByRole('button', { name: 'Add waypoint' }))

      await user.type(screen.getByLabelText('Title'), 'A viewpoint')
      await user.type(screen.getByLabelText('Description'), 'A quiet viewpoint')
      await user.type(screen.getAllByLabelText('Category')[0]!, 'Scenic')
      await user.click(screen.getByRole('button', { name: 'Save waypoint' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Your data has changed in another session.')

      await user.click(screen.getByRole('button', { name: 'Reload latest' }))

      await waitFor(() =>
        expect(screen.getByText(/Demo Cosmos could not be loaded, so read-only local demo data/)).toBeInTheDocument(),
      )
      expect(screen.getByText('Read-only mode')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Reload latest' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Save waypoint' })).not.toBeInTheDocument()
    },
    SLOW_EDITOR_TEST_TIMEOUT_MS,
  )
})
