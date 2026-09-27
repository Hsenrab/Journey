import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

function waypointNames() {
  return screen.getAllByRole('heading', { level: 6 }).map((el) => el.textContent)
}

describe('Locations', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.unstubAllGlobals())

  it('lists every waypoint by default', () => {
    renderLocations()
    expect(screen.getByText('Stourhead')).toBeInTheDocument()
    expect(screen.getByText('Dyrham Park')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Stourhead' })).toHaveAttribute('href', '/waypoints/stourhead')
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
    ['Travel time', 'Crickley Hill'],
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

  it('shows waypoint save success in an alert', async () => {
    const user = userEvent.setup()
    renderLocations(['/waypoints?mode=add'])

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'A viewpoint' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'A quiet viewpoint' } })
    fireEvent.change(screen.getAllByLabelText('Category')[0]!, { target: { value: 'Scenic' } })
    await user.click(screen.getByRole('button', { name: 'Save waypoint' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Waypoint saved.')
  }, 45_000)

  it('offers to reload the latest waypoints after a save conflict', async () => {
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
    renderLocations()
    await user.click(await screen.findByRole('button', { name: 'Add waypoint' }))

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'A viewpoint' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'A quiet viewpoint' } })
    fireEvent.change(screen.getAllByLabelText('Category')[0]!, { target: { value: 'Scenic' } })
    await user.click(screen.getByRole('button', { name: 'Save waypoint' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Your data has changed in another session.')
    expect(screen.getAllByText('Your data has changed in another session.')).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Reload latest' }))

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect(fetch.mock.calls.filter(([, init]) => !init?.method)).toHaveLength(2)
  }, 45_000)

  it('keeps the conflict alert and editor open when reloading fails', async () => {
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
    renderLocations()
    await user.click(await screen.findByRole('button', { name: 'Add waypoint' }))

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'A viewpoint' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'A quiet viewpoint' } })
    fireEvent.change(screen.getAllByLabelText('Category')[0]!, { target: { value: 'Scenic' } })
    await user.click(screen.getByRole('button', { name: 'Save waypoint' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Your data has changed in another session.')

    await user.click(screen.getByRole('button', { name: 'Reload latest' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Demo Cosmos could not be loaded'))
    expect(screen.getByRole('button', { name: 'Reload latest' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save waypoint' })).not.toBeInTheDocument()
  }, 45_000)
})
