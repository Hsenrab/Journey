import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultData } from '../services/storage'
import { WaypointsProvider } from '../features/journey/JourneyContext'

type MapClickHandler = (event: {
  shapes?: Array<{ getProperties?: () => { waypointId?: string }; properties?: { waypointId?: string } }>
}) => void

const mapEvents = vi.hoisted(() => ({ click: undefined as MapClickHandler | undefined }))

vi.mock('azure-maps-control', () => ({
  AuthenticationType: { sas: 'sas' },
  Map: class {
    events = {
      add: (...args: unknown[]) => {
        if (args[0] === 'ready' && args.length === 2) (args[1] as () => void)()
        if (args[0] === 'click' && args.length === 3) mapEvents.click = args[2] as MapClickHandler
      },
    }
    sources = { add: vi.fn() }
    layers = { add: vi.fn() }
    dispose = vi.fn()
  },
  Popup: class {
    setOptions = vi.fn()
    open = vi.fn()
  },
  source: {
    DataSource: class {
      add = vi.fn()
      clear = vi.fn()
    },
  },
  layer: { BubbleLayer: class {}, SymbolLayer: class {} },
  data: {
    Feature: class {
      constructor(..._args: unknown[]) {}
    },
    Point: class {
      constructor(..._args: unknown[]) {}
    },
  },
}))

import MapPage from './MapPage'

describe('MapPage', () => {
  beforeEach(() => {
    localStorage.clear()
    mapEvents.click = undefined
  })

  it('renders accessible layer, status, and nearby controls', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, text: () => Promise.resolve('Sign in required') }))
    render(
      <MemoryRouter>
        <WaypointsProvider>
          <MapPage />
        </WaypointsProvider>
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Map' })).toBeInTheDocument()
    expect(screen.getByLabelText('Show waypoints')).toBeChecked()
    expect(screen.getByLabelText('Show activities')).toBeChecked()
    expect(screen.getByLabelText('Waypoint status: Gold')).toBeChecked()
    expect(screen.getByLabelText('Nearby origin')).toHaveValue('Brockworth, Gloucestershire')
    expect(await screen.findByText('Map access failed: Sign in required')).toBeInTheDocument()
  })

  it('reports an HTML response from the Maps API instead of attempting to parse it as JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'text/html' }),
      }),
    )
    render(
      <MemoryRouter>
        <WaypointsProvider>
          <MapPage />
        </WaypointsProvider>
      </MemoryRouter>,
    )
    expect(await screen.findByText('Map access returned text/html instead of JSON.')).toBeInTheDocument()
  })

  it('keeps layer and status filters while showing an explicit no-results origin error', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ token: 'sas', expiresOn: '2026-01-01' }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ results: [] }) }),
    )
    render(
      <MemoryRouter>
        <WaypointsProvider>
          <MapPage />
        </WaypointsProvider>
      </MemoryRouter>,
    )
    await user.click(screen.getByLabelText('Show activities'))
    await user.click(screen.getByLabelText('Waypoint status: Gold'))
    await user.click(screen.getByRole('button', { name: 'Search' }))
    expect(await screen.findByText(/No places matched that search/)).toBeInTheDocument()
    expect(screen.getByLabelText('Show activities')).not.toBeChecked()
    expect(screen.getByLabelText('Waypoint status: Gold')).not.toBeChecked()
  })

  it('requires an explicit selection for ambiguous nearby origins', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ token: 'sas', expiresOn: '2026-01-01' }) })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [
                { address: { freeformAddress: 'Brockworth A' }, position: { lat: 51.8, lon: -2.1 } },
                { address: { freeformAddress: 'Brockworth B' }, position: { lat: 51.9, lon: -2.2 } },
              ],
            }),
        }),
    )
    render(
      <MemoryRouter>
        <WaypointsProvider>
          <MapPage />
        </WaypointsProvider>
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: 'Search' }))
    expect(await screen.findByText('Choose a nearby origin')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Brockworth A' }))
    expect(screen.queryByText('Choose a nearby origin')).not.toBeInTheDocument()
  })

  it('uses the sole nearby search result', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ token: 'sas', expiresOn: '2026-01-01' }) })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [{ address: { freeformAddress: 'Oxford' }, position: { lat: 51.752, lon: -1.258 } }],
            }),
        }),
    )
    render(
      <MemoryRouter>
        <WaypointsProvider>
          <MapPage />
        </WaypointsProvider>
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: 'Search' }))
    expect(screen.queryByText('Choose a nearby origin')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert', { name: /error/i })).not.toBeInTheDocument()
  })

  it('shows the Maps search failure message', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ token: 'sas', expiresOn: '2026-01-01' }) })
        .mockResolvedValueOnce({ ok: false, text: () => Promise.resolve('Search requires authentication') }),
    )
    render(
      <MemoryRouter>
        <WaypointsProvider>
          <MapPage />
        </WaypointsProvider>
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: 'Search' }))
    expect(await screen.findByText('Nearby search failed: Search requires authentication')).toBeInTheDocument()
  })

  it('adds coordinate-bearing waypoints and activities to the enabled map layers', async () => {
    const data = createDefaultData()
    const waypoint = data.waypoints[0]!
    waypoint.location = { ...waypoint.location, latitude: 51.84, longitude: -2.15 }
    data.activities.push({
      activityId: 'activity',
      waypointId: waypoint.waypointId,
      date: '2026-08-10',
      category: 'bronze',
      location: { kind: 'coordinates', latitude: 51.85, longitude: -2.14 },
      notes: '',
      referenceIds: [],
      photoReferenceIds: [],
      createdAt: '2026-08-10T00:00:00.000Z',
      updatedAt: '2026-08-10T00:00:00.000Z',
    })
    data.activities.push({
      activityId: 'postcode-activity',
      waypointId: 'missing-waypoint',
      date: '2026-08-10',
      category: undefined,
      location: { kind: 'postcode', postcode: 'GL3 4AA' },
      notes: '',
      referenceIds: [],
      photoReferenceIds: [],
      createdAt: '2026-08-10T00:00:00.000Z',
      updatedAt: '2026-08-10T00:00:00.000Z',
    })
    localStorage.setItem('waypoints-v1', JSON.stringify(data))
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ token: 'sas', expiresOn: '2026-01-01' }) }),
    )
    render(
      <MemoryRouter>
        <WaypointsProvider>
          <MapPage />
        </WaypointsProvider>
      </MemoryRouter>,
    )
    await user.click(screen.getByLabelText('Waypoint status: Gold'))
    await user.click(screen.getByLabelText('Show activities'))
    await user.click(screen.getByLabelText('Show activities'))
    expect(screen.getByRole('link', { name: /Bronze:.*miles/ })).toBeInTheDocument()
  })

  it('handles map marker clicks with and without a matching waypoint', async () => {
    const data = createDefaultData()
    const waypoint = data.waypoints[0]!
    waypoint.location = { ...waypoint.location, latitude: 51.84, longitude: -2.15 }
    localStorage.setItem('waypoints-v1', JSON.stringify(data))
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ token: 'sas', expiresOn: '2026-01-01' }) }),
    )
    render(
      <MemoryRouter>
        <WaypointsProvider>
          <MapPage />
        </WaypointsProvider>
      </MemoryRouter>,
    )
    await vi.waitFor(() => expect(mapEvents.click).toBeDefined())
    expect(() => {
      mapEvents.click!({})
      mapEvents.click!({ shapes: [{ getProperties: () => ({}) }] })
      mapEvents.click!({ shapes: [{ properties: { waypointId: 'unknown' } }] })
      mapEvents.click!({ shapes: [{ getProperties: () => ({ waypointId: waypoint.waypointId }) }] })
    }).not.toThrow()
    expect(await screen.findByRole('status')).toHaveTextContent('Opening waypoint details.')
  })
})
