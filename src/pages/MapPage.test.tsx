import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultData } from '../services/storage'
import { WaypointsProvider } from '../features/journey/JourneyContext'

type MapClickHandler = (event: {
  shapes?: Array<{
    getProperties?: () => { waypointId?: string; activityId?: string; cluster_id?: number }
    getCoordinates?: () => number[]
    properties?: { waypointId?: string; activityId?: string; cluster_id?: number }
  }>
}) => void
type TokenGetter = (resolve: (token: string) => void, reject: (error: unknown) => void) => void

const mapEvents = vi.hoisted(() => ({
  click: undefined as MapClickHandler | undefined,
  activityClick: undefined as MapClickHandler | undefined,
  clusterClick: undefined as MapClickHandler | undefined,
  ready: undefined as (() => void) | undefined,
  tokenGetter: undefined as TokenGetter | undefined,
  deferReady: false,
  sourceAdd: vi.fn(),
  clusterExpansionZoom: vi.fn(() => Promise.resolve(12)),
  setCamera: vi.fn(),
  popupClose: undefined as (() => void) | undefined,
  popupContent: undefined as HTMLElement | undefined,
}))

function setViewport(width: number) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => {
      let matches = false
      if (query.includes('max-width')) {
        const match = query.match(/max-width:\s*([0-9.]+)px/)
        matches = match ? width <= Number(match[1]!) : false
      } else if (query.includes('min-width')) {
        const match = query.match(/min-width:\s*([0-9.]+)px/)
        matches = match ? width >= Number(match[1]!) : false
      }
      return {
        matches,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }
    }),
  })
}

function jsonResponse(body: unknown) {
  return {
    ok: true,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve(body),
  }
}

vi.mock('azure-maps-control', () => ({
  AuthenticationType: { anonymous: 'anonymous' },
  Map: class {
    constructor(...args: unknown[]) {
      const options = args[1] as { authOptions?: { getToken?: TokenGetter } } | undefined
      mapEvents.tokenGetter = options?.authOptions?.getToken
    }
    events = {
      add: (...args: unknown[]) => {
        if (args[0] === 'ready' && args.length === 2) {
          mapEvents.ready = args[1] as () => void
          if (!mapEvents.deferReady) mapEvents.ready()
        }
        if (args[0] === 'click' && args.length === 3 && (args[1] as { id?: string })?.id === 'waypoints') {
          mapEvents.click = args[2] as MapClickHandler
        }
        if (args[0] === 'click' && args.length === 3 && (args[1] as { id?: string })?.id === 'activities') {
          mapEvents.activityClick = args[2] as MapClickHandler
        }
        if (
          args[0] === 'click' &&
          args.length === 3 &&
          (args[1] as { id?: string })?.id === 'waypoint-cluster-labels'
        ) {
          mapEvents.clusterClick = args[2] as MapClickHandler
        }
        if (args[0] === 'close' && args.length === 3) {
          mapEvents.popupClose = args[2] as () => void
        }
      },
    }
    sources = { add: vi.fn() }
    layers = { add: vi.fn() }
    imageSprite = { add: vi.fn() }
    getCamera = vi.fn(() => ({ zoom: 8 }))
    setCamera = mapEvents.setCamera
    dispose = vi.fn()
  },
  Popup: class {
    setOptions = vi.fn((options: { content?: HTMLElement }) => {
      mapEvents.popupContent = options.content
    })
    open = vi.fn()
    close = vi.fn(() => mapEvents.popupClose?.())
  },
  source: {
    DataSource: class {
      add = mapEvents.sourceAdd
      clear = vi.fn()
      getClusterExpansionZoom = mapEvents.clusterExpansionZoom
    },
  },
  layer: {
    BubbleLayer: class {},
    SymbolLayer: class {
      id?: string
      constructor(_source: unknown, id: string) {
        this.id = id
      }
    },
  },
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
    setViewport(1200)
    mapEvents.click = undefined
    mapEvents.activityClick = undefined
    mapEvents.clusterClick = undefined
    mapEvents.ready = undefined
    mapEvents.tokenGetter = undefined
    mapEvents.deferReady = false
    mapEvents.sourceAdd.mockClear()
    mapEvents.clusterExpansionZoom.mockClear()
    mapEvents.setCamera.mockClear()
    mapEvents.popupClose = undefined
    mapEvents.popupContent = undefined
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
    expect(screen.getByRole('tab', { name: 'Waypoints' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Activities' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('heading', { name: 'Nearest visible waypoints' })).toBeInTheDocument()
    expect(screen.getByLabelText('Azure Maps interactive map')).toBeInTheDocument()
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'waypoints-tab')
    expect(screen.getByRole('group', { name: 'Marker colour legend' })).toBeInTheDocument()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Waypoint filters (4 of 4 statuses selected)' }))
    expect(screen.getByRole('checkbox', { name: 'Gold' })).toBeChecked()
    await user.click(screen.getByRole('checkbox', { name: 'Gold' }))
    expect(screen.getByRole('button', { name: 'Waypoint filters (3 of 4 statuses selected)' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nearby origin')).toHaveValue('Brockworth, Gloucestershire')
    expect(await screen.findByText('Map access failed: Sign in required')).toBeInTheDocument()
  })

  it('reports an HTML response from the Maps API instead of attempting to parse it as JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
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

  it('switches exclusively between waypoint and activity modes', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, text: () => Promise.resolve('Sign in required') }))
    render(
      <MemoryRouter>
        <WaypointsProvider>
          <MapPage />
        </WaypointsProvider>
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('tab', { name: 'Activities' }))
    expect(screen.getByRole('tab', { name: 'Waypoints' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tab', { name: 'Activities' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: 'Nearest activities' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Waypoint filters/ })).not.toBeInTheDocument()
  })

  it('defaults to the map view on small screens and lets the user switch to the list', async () => {
    setViewport(400)
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, text: () => Promise.resolve('Sign in required') }))
    render(
      <MemoryRouter>
        <WaypointsProvider>
          <MapPage />
        </WaypointsProvider>
      </MemoryRouter>,
    )

    expect(screen.getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Azure Maps interactive map')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Nearest visible waypoints' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'List' }))
    expect(screen.getByRole('heading', { name: 'Nearest visible waypoints' })).toBeInTheDocument()
    expect(screen.getByLabelText('Azure Maps interactive map')).not.toBeVisible()
  })

  it('explains that the Maps API is missing when the environment has no linked API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, text: () => Promise.resolve('') }))
    render(
      <MemoryRouter>
        <WaypointsProvider>
          <MapPage />
        </WaypointsProvider>
      </MemoryRouter>,
    )
    expect(await screen.findByText(/Map access is unavailable in this environment/)).toBeInTheDocument()
  })

  it('keeps layer and status filters while showing an explicit no-results origin error', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ token: 'entra', expiresOn: '2026-01-01', clientId: 'maps-client-id' }))
        .mockResolvedValueOnce(jsonResponse({ results: [] })),
    )
    render(
      <MemoryRouter>
        <WaypointsProvider>
          <MapPage />
        </WaypointsProvider>
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: /Waypoint filters/ }))
    await user.click(screen.getByRole('checkbox', { name: 'Gold' }))
    await user.click(screen.getByRole('button', { name: 'Search' }))
    expect(await screen.findByText(/No places matched that search/)).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Activities' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('checkbox', { name: 'Gold' })).not.toBeChecked()
  })

  it('requires an explicit selection for ambiguous nearby origins', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ token: 'entra', expiresOn: '2026-01-01', clientId: 'maps-client-id' }))
        .mockResolvedValueOnce(
          jsonResponse({
            results: [
              { address: { freeformAddress: 'Brockworth A' }, position: { lat: 51.8, lon: -2.1 } },
              { address: { freeformAddress: 'Brockworth B' }, position: { lat: 51.9, lon: -2.2 } },
            ],
          }),
        ),
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
        .mockResolvedValueOnce(jsonResponse({ token: 'entra', expiresOn: '2026-01-01', clientId: 'maps-client-id' }))
        .mockResolvedValueOnce(
          jsonResponse({
            results: [{ address: { freeformAddress: 'Oxford' }, position: { lat: 51.752, lon: -1.258 } }],
          }),
        ),
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
        .mockResolvedValueOnce(jsonResponse({ token: 'entra', expiresOn: '2026-01-01', clientId: 'maps-client-id' }))
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
      ideaIds: [],
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
      ideaIds: [],
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
    data.waypoints[1]!.location = undefined
    localStorage.setItem('waypoints-v1', JSON.stringify(data))
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ token: 'entra', expiresOn: '2026-01-01', clientId: 'maps-client-id' })),
    )
    render(
      <MemoryRouter>
        <WaypointsProvider>
          <MapPage />
        </WaypointsProvider>
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: /Waypoint filters/ }))
    await user.click(screen.getByRole('checkbox', { name: 'Gold' }))
    await user.click(screen.getByRole('tab', { name: 'Activities' }))
    expect(screen.getByRole('link', { name: /Bronze:.*miles/ })).toBeInTheDocument()
    expect(screen.getByText(/1 waypoint and 1 activity have no coordinates/)).toBeInTheDocument()
  })

  it('omits the missing-coordinate notice when every record is geocoded', async () => {
    localStorage.setItem('waypoints-v1', JSON.stringify(createDefaultData()))
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ token: 'entra', expiresOn: '2026-01-01', clientId: 'maps-client-id' })),
    )
    render(
      <MemoryRouter>
        <WaypointsProvider>
          <MapPage />
        </WaypointsProvider>
      </MemoryRouter>,
    )

    await vi.waitFor(() => expect(mapEvents.sourceAdd).toHaveBeenCalled())
    expect(screen.queryByText(/have no coordinates/)).not.toBeInTheDocument()
  })

  it('adds features after the real SDK signals that the map is ready', async () => {
    const data = createDefaultData()
    const waypoint = data.waypoints[0]!
    waypoint.location = { ...waypoint.location, latitude: 51.84, longitude: -2.15 }
    localStorage.setItem('waypoints-v1', JSON.stringify(data))
    mapEvents.deferReady = true
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ token: 'entra', expiresOn: '2026-01-01', clientId: 'maps-client-id' })),
    )

    render(
      <MemoryRouter>
        <WaypointsProvider>
          <MapPage />
        </WaypointsProvider>
      </MemoryRouter>,
    )
    await vi.waitFor(() => expect(mapEvents.ready).toBeDefined())
    expect(mapEvents.sourceAdd).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('Loading map')

    act(() => mapEvents.ready!())

    await vi.waitFor(() => expect(mapEvents.sourceAdd).toHaveBeenCalled())
    expect(screen.queryByText('Loading map')).not.toBeInTheDocument()
  })

  it('refreshes the Maps token after the initial token is consumed', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ token: 'initial', expiresOn: '2027-01-01', clientId: 'maps-client-id' }))
        .mockResolvedValueOnce(
          jsonResponse({ token: 'refreshed', expiresOn: '2027-01-01', clientId: 'maps-client-id' }),
        ),
    )

    render(
      <MemoryRouter>
        <WaypointsProvider>
          <MapPage />
        </WaypointsProvider>
      </MemoryRouter>,
    )

    await vi.waitFor(() => expect(mapEvents.tokenGetter).toBeDefined())
    const tokens: string[] = []
    mapEvents.tokenGetter!(
      (token) => tokens.push(token),
      () => undefined,
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
    mapEvents.tokenGetter!(
      (token) => tokens.push(token),
      () => undefined,
    )

    await vi.waitFor(() => expect(tokens).toEqual(['initial', 'refreshed']))
  })

  it('handles map marker clicks with and without a matching waypoint', async () => {
    const data = createDefaultData()
    const waypoint = data.waypoints[0]!
    waypoint.location = { ...waypoint.location, latitude: 51.84, longitude: -2.15 }
    data.activities = [
      {
        activityId: 'linked-activity',
        ideaIds: [],
        waypointId: waypoint.waypointId,
        date: '2026-08-11',
        category: 'silver',
        location: { kind: 'coordinates', latitude: 51.85, longitude: -2.14 },
        notes: '',
        referenceIds: [],
        photoReferenceIds: [],
        createdAt: '2026-08-11T00:00:00.000Z',
        updatedAt: '2026-08-11T00:00:00.000Z',
      },
    ]
    localStorage.setItem('waypoints-v1', JSON.stringify(data))
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ token: 'entra', expiresOn: '2026-01-01', clientId: 'maps-client-id' })),
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
    expect(mapEvents.popupContent).toHaveTextContent(`Waypoint${waypoint.title}Recorded activities`)
    expect(mapEvents.popupContent).not.toHaveTextContent('Not started')
    expect(mapEvents.popupContent?.querySelector('a')).toHaveAttribute('href', '/activities/linked-activity')
    expect(mapEvents.popupContent?.querySelector('a')).toHaveTextContent('2026-08-11 · Silver')
    expect(await screen.findByRole('status')).toHaveTextContent('Opening waypoint details.')
    act(() => mapEvents.popupClose?.())
    expect(screen.queryByText('Opening waypoint details.')).not.toBeInTheDocument()
  })

  it('navigates via the router when a popup activity link is clicked', async () => {
    const data = createDefaultData()
    const waypoint = data.waypoints[0]!
    waypoint.location = { ...waypoint.location, latitude: 51.84, longitude: -2.15 }
    data.activities = [
      {
        activityId: 'linked-activity',
        ideaIds: [],
        waypointId: waypoint.waypointId,
        date: '2026-08-11',
        category: 'silver',
        location: { kind: 'coordinates', latitude: 51.85, longitude: -2.14 },
        notes: '',
        referenceIds: [],
        photoReferenceIds: [],
        createdAt: '2026-08-11T00:00:00.000Z',
        updatedAt: '2026-08-11T00:00:00.000Z',
      },
    ]
    localStorage.setItem('waypoints-v1', JSON.stringify(data))
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ token: 'entra', expiresOn: '2026-01-01', clientId: 'maps-client-id' })),
    )
    render(
      <MemoryRouter initialEntries={['/map']}>
        <WaypointsProvider>
          <Routes>
            <Route path="/map" element={<MapPage />} />
            <Route path="/activities/:activityId" element={<div>Activity details</div>} />
          </Routes>
        </WaypointsProvider>
      </MemoryRouter>,
    )
    await vi.waitFor(() => expect(mapEvents.click).toBeDefined())
    mapEvents.click!({ shapes: [{ getProperties: () => ({ waypointId: waypoint.waypointId }) }] })
    const link = mapEvents.popupContent?.querySelector('a')
    expect(link).toHaveAttribute('href', '/activities/linked-activity')
    await userEvent.click(link!)
    expect(await screen.findByText('Activity details')).toBeInTheDocument()
  })

  it('shows an empty-state popup when a waypoint has no recorded activities', async () => {
    const data = createDefaultData()
    const waypoint = data.waypoints[0]!
    waypoint.location = { ...waypoint.location, latitude: 51.84, longitude: -2.15 }
    data.activities = []
    localStorage.setItem('waypoints-v1', JSON.stringify(data))
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ token: 'entra', expiresOn: '2026-01-01', clientId: 'maps-client-id' })),
    )
    render(
      <MemoryRouter>
        <WaypointsProvider>
          <MapPage />
        </WaypointsProvider>
      </MemoryRouter>,
    )
    await vi.waitFor(() => expect(mapEvents.click).toBeDefined())
    mapEvents.click!({ shapes: [{ getProperties: () => ({ waypointId: waypoint.waypointId }) }] })
    expect(mapEvents.popupContent).toHaveTextContent('No recorded activities yet')
    expect(mapEvents.popupContent?.querySelector('a')).toBeNull()
  })

  it('shows activity marker details for linked and unlinked activities', async () => {
    const data = createDefaultData()
    const activity = {
      activityId: 'linked',
      ideaIds: [],
      waypointId: data.waypoints[0]!.waypointId,
      date: '2026-08-10',
      category: 'bronze' as const,
      location: { kind: 'coordinates' as const, latitude: 51.86, longitude: -2.22 },
      notes: '',
      referenceIds: [],
      photoReferenceIds: [],
      createdAt: '2026-08-10T00:00:00.000Z',
      updatedAt: '2026-08-10T00:00:00.000Z',
    }
    const unlinked = { ...activity, activityId: 'unlinked', waypointId: undefined, category: undefined }
    data.activities = [activity, unlinked]
    localStorage.setItem('waypoints-v1', JSON.stringify(data))
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ token: 'entra', expiresOn: '2026-01-01', clientId: 'maps-client-id' })),
    )
    render(
      <MemoryRouter>
        <WaypointsProvider>
          <MapPage />
        </WaypointsProvider>
      </MemoryRouter>,
    )
    await vi.waitFor(() => expect(mapEvents.activityClick).toBeDefined())
    expect(() => {
      mapEvents.activityClick!({})
      mapEvents.activityClick!({ shapes: [{ properties: { activityId: 'unknown' } }] })
      mapEvents.activityClick!({ shapes: [{ properties: { activityId: activity.activityId } }] })
      mapEvents.activityClick!({ shapes: [{ properties: { activityId: unlinked.activityId } }] })
    }).not.toThrow()
    expect(mapEvents.popupContent).toHaveTextContent('Activity2026-08-10UncategorisedNo linked waypoint')
    expect(mapEvents.popupContent?.querySelector('a')).toHaveAttribute('href', '/activities/unlinked')
  })

  it('zooms into an activated cluster', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ token: 'entra', expiresOn: '2026-01-01', clientId: 'maps-client-id' })),
    )
    render(
      <MemoryRouter>
        <WaypointsProvider>
          <MapPage />
        </WaypointsProvider>
      </MemoryRouter>,
    )
    await vi.waitFor(() => expect(mapEvents.clusterClick).toBeDefined())
    expect(() => {
      mapEvents.clusterClick!({})
      mapEvents.clusterClick!({ shapes: [{ getCoordinates: () => [-2.2, 51.8] }] })
      mapEvents.clusterClick!({
        shapes: [{ getCoordinates: () => [-2.2, 51.8], getProperties: () => ({ cluster_id: 42 }) }],
      })
    }).not.toThrow()
    await vi.waitFor(() => expect(mapEvents.clusterExpansionZoom).toHaveBeenCalledWith(42))
    expect(mapEvents.setCamera).toHaveBeenCalledWith({ center: [-2.2, 51.8], zoom: 12 })
  })
})
