import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Locations from './Locations'
import { WaypointsProvider } from '../features/journey/JourneyContext'
import { createDefaultData, save, setDataMode } from '../services/storage'
import type { Activity } from '../domain/visit'

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
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.unstubAllGlobals())

  it('lists every waypoint by default', () => {
    renderLocations()
    expect(screen.getByText('Stourhead')).toBeInTheDocument()
    expect(screen.getByText('Dyrham Park')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Stourhead' })).toHaveAttribute('href', '/waypoints/stourhead')
  })

  it('keeps primary filters visible and secondary filters in a closed accordion', () => {
    renderLocations()

    expect(screen.getByLabelText('Search waypoints')).toBeVisible()
    expect(screen.getByRole('combobox', { name: 'Status' })).toBeVisible()
    expect(screen.getByRole('combobox', { name: 'Sort' })).toBeVisible()
    const summary = screen.getByRole('button', { name: 'More filters (0 active)' })
    expect(summary).toHaveAttribute('aria-expanded', 'false')
    const regionId = summary.getAttribute('aria-controls')
    expect(regionId).toBe('more-filters')
    expect(document.querySelectorAll(`#${regionId}`)).toHaveLength(1)
    expect(document.getElementById(regionId!)).toHaveAttribute('aria-labelledby', 'more-filters-header')
    expect(screen.getByText('Any distance')).not.toBeVisible()
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
    const names = waypointNames()
    const sorted = [...names].sort((a, b) => (a ?? '').localeCompare(b ?? ''))
    expect(names).toEqual(sorted)
  })

  it('re-sorts the list when switching to progress order', async () => {
    save({ ...createDefaultData(), activities: [activity('may-hill', 'gold'), activity('dyrham-park', 'silver')] })
    const user = userEvent.setup()
    renderLocations()

    const namesByName = waypointNames()

    await user.click(screen.getAllByRole('combobox')[1])
    await user.click(screen.getByRole('option', { name: 'Progress' }))

    const namesByProgress = waypointNames()
    expect(namesByProgress).not.toEqual(namesByName)
    expect([...namesByProgress].sort()).toEqual([...namesByName].sort())
  })

  it.each([
    ['Distance (nearest first)', 'Crickley Hill'],
    ['Drive time (where available)', 'Crickley Hill'],
    ['Last activity date', 'Stourhead'],
  ])('sorts by %s', async (sortOption, expectedFirstWaypoint) => {
    save({ ...createDefaultData(), activities: [activity('stourhead', 'gold')] })
    const user = userEvent.setup()
    renderLocations()

    const namesByName = waypointNames()

    await user.click(screen.getAllByRole('combobox')[1])
    await user.click(screen.getByRole('option', { name: sortOption }))

    const namesBySort = waypointNames()
    expect(namesBySort[0]).toBe(expectedFirstWaypoint)
    expect([...namesBySort].sort()).toEqual([...namesByName].sort())
  })

  it('keeps custom waypoints with coordinates in a distance filter', async () => {
    const data = createDefaultData()
    save({
      ...data,
      waypoints: [
        ...data.waypoints,
        {
          waypointId: 'custom-nearby',
          title: 'Custom nearby waypoint',
          description: 'A nearby custom waypoint.',
          category: 'Custom',
          tags: [],
          challengeIds: ['national-trust'],
          completion: { mode: 'once' },
          location: { latitude: 51.85, longitude: -2.15 },
          referenceIds: [],
          photoReferenceIds: [],
        },
      ],
    })
    const user = userEvent.setup()
    renderLocations()

    await openMoreFilters(user)
    await user.click(screen.getByRole('combobox', { name: 'Maximum driving distance' }))
    await user.click(screen.getByRole('option', { name: 'Up to 25 miles (plus unknown)' }))

    expect(screen.getByText('Custom nearby waypoint')).toBeInTheDocument()
    expect(screen.getByText('0.4 miles from Brockworth')).toBeInTheDocument()
  })

  it('lists waypoints assigned to any challenge and retains unknown distances in distance filters', async () => {
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
          referenceIds: [],
          photoReferenceIds: [],
        },
      ],
      challenges: [
        {
          challengeId: 'other-challenge',
          title: 'Other challenge',
          description: 'A separate challenge.',
          waypointIds: ['other-challenge'],
          supportsActivityCategories: false,
        },
      ],
    })

    const user = userEvent.setup()
    renderLocations()

    await openMoreFilters(user)
    await user.click(screen.getByRole('combobox', { name: 'Maximum driving distance' }))
    await user.click(screen.getByRole('option', { name: 'Up to 25 miles (plus unknown)' }))

    expect(screen.getByText('Other challenge waypoint')).toBeInTheDocument()
    expect(screen.getByText('Distance unknown')).toBeInTheDocument()
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
