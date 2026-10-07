import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultData } from '../services/storage'
import { useWaypoints, WaypointsProvider } from '../features/journey/JourneyContext'
import type { Activity, AwardedStatus } from '../domain/visit'

type MapClickHandler = (event: {
  shapes?: Array<{
    getProperties?: () => { waypointId?: string; activityId?: string; cluster_id?: number; point_count?: number }
    getCoordinates?: () => number[]
    properties?: { waypointId?: string; activityId?: string; cluster_id?: number; point_count?: number }
  }>
}) => void
type TokenGetter = (resolve: (token: string) => void, reject: (error: unknown) => void) => void

const mapEvents = vi.hoisted(() => ({
  click: undefined as MapClickHandler | undefined,
  activityClick: undefined as MapClickHandler | undefined,
  waypointClusterClick: undefined as MapClickHandler | undefined,
  waypointClusterLabelClick: undefined as MapClickHandler | undefined,
  activityClusterClick: undefined as MapClickHandler | undefined,
  activityClusterLabelClick: undefined as MapClickHandler | undefined,
  ready: undefined as (() => void) | undefined,
  tokenGetter: undefined as TokenGetter | undefined,
  deferReady: false,
  sourceAdd: vi.fn(),
  gpxSourceAdd: vi.fn(),
  gpxSourceClear: vi.fn(),
  activityTrackSourceAdd: vi.fn(),
  activityTrackSourceClear: vi.fn(),
  layerOptions: new Map<string, unknown>(),
  waypointClusterLeaves: vi.fn(() =>
    Promise.resolve([
      { getProperties: () => ({ label: 'Clustered waypoint', award: 'Bronze', waypointId: 'waypoint-1' }) },
      { properties: {} },
    ]),
  ),
  activityClusterLeaves: vi.fn(() =>
    Promise.resolve([
      { properties: { label: 'Clustered activity', description: '2026-08-10', activityId: 'activity-1' } },
      { properties: {} },
    ]),
  ),
  resize: vi.fn(),
  setCamera: vi.fn(),
  mapCenters: [] as number[][],
  lineStringCoordinates: [] as number[][][],
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

function activity(waypointId: string, category: AwardedStatus): Activity {
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

vi.mock('azure-maps-control', () => ({
  AuthenticationType: { anonymous: 'anonymous' },
  Map: class {
    constructor(...args: unknown[]) {
      const options = args[1] as { center?: number[]; authOptions?: { getToken?: TokenGetter } } | undefined
      mapEvents.tokenGetter = options?.authOptions?.getToken
      if (options?.center) mapEvents.mapCenters.push(options.center)
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
        if (args[0] === 'click' && args.length === 3) {
          const layerId = (args[1] as { id?: string })?.id
          if (layerId === 'waypoint-clusters') mapEvents.waypointClusterClick = args[2] as MapClickHandler
          if (layerId === 'waypoint-cluster-labels') mapEvents.waypointClusterLabelClick = args[2] as MapClickHandler
          if (layerId === 'activity-clusters') mapEvents.activityClusterClick = args[2] as MapClickHandler
          if (layerId === 'activity-cluster-labels') mapEvents.activityClusterLabelClick = args[2] as MapClickHandler
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
    resize = mapEvents.resize
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
      getClusterLeaves: typeof mapEvents.waypointClusterLeaves
      constructor(id: string) {
        if (id === 'gpx-lines') {
          this.add = mapEvents.gpxSourceAdd
          this.clear = mapEvents.gpxSourceClear
        }
        if (id === 'activity-tracks') {
          this.add = mapEvents.activityTrackSourceAdd
          this.clear = mapEvents.activityTrackSourceClear
        }
        this.getClusterLeaves = id === 'waypoints' ? mapEvents.waypointClusterLeaves : mapEvents.activityClusterLeaves
      }
    },
  },
  layer: {
    BubbleLayer: class {
      id?: string
      constructor(_source: unknown, id: string) {
        this.id = id
      }
    },
    SymbolLayer: class {
      id?: string
      constructor(_source: unknown, id: string) {
        this.id = id
      }
    },
    LineLayer: class {
      id?: string
      constructor(_source: unknown, id: string, options: unknown) {
        this.id = id
        mapEvents.layerOptions.set(id, options)
      }
    },
  },
  data: {
    Feature: class {
      geometry: unknown
      properties?: unknown
      id?: string
      constructor(geometry: unknown, properties?: unknown, id?: string) {
        this.geometry = geometry
        this.properties = properties
        this.id = id
      }
    },
    Point: class {
      constructor(..._args: unknown[]) {}
    },
    LineString: class {
      coordinates: unknown
      constructor(coordinates: number[][]) {
        mapEvents.lineStringCoordinates.push(coordinates)
        this.coordinates = coordinates
      }
    },
  },
}))

import MapPage from './MapPage'

describe('MapPage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.unstubAllEnvs()
    setViewport(1200)
    mapEvents.click = undefined
    mapEvents.activityClick = undefined
    mapEvents.waypointClusterClick = undefined
    mapEvents.waypointClusterLabelClick = undefined
    mapEvents.activityClusterClick = undefined
    mapEvents.activityClusterLabelClick = undefined
    mapEvents.ready = undefined
    mapEvents.tokenGetter = undefined
    mapEvents.deferReady = false
    mapEvents.sourceAdd.mockClear()
    mapEvents.gpxSourceAdd.mockClear()
    mapEvents.gpxSourceClear.mockClear()
    mapEvents.activityTrackSourceAdd.mockClear()
    mapEvents.activityTrackSourceClear.mockClear()
    mapEvents.layerOptions.clear()
    mapEvents.setCamera.mockClear()
    mapEvents.waypointClusterLeaves.mockClear()
    mapEvents.activityClusterLeaves.mockClear()
    mapEvents.resize.mockClear()
    mapEvents.setCamera.mockClear()
    mapEvents.mapCenters = []
    mapEvents.lineStringCoordinates = []
    mapEvents.popupClose = undefined
    mapEvents.popupContent = undefined
  })

  it('renders accessible layer and nearby controls without a marker legend', async () => {
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
    expect(screen.getByLabelText('Nearest visible waypoints')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Find nearby waypoints' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Azure Maps interactive map')).toBeInTheDocument()
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'waypoints-tab')
    expect(screen.queryByRole('group', { name: 'Marker colour legend' })).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Waypoint filters' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Progress status' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Medal tier' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nearby origin')).toHaveValue('Brockworth, Gloucestershire')
    expect(await screen.findByText('Map access failed: Sign in required')).toBeInTheDocument()
  })

  it('applies progress and medal filters together and clears each with All', async () => {
    const data = createDefaultData()
    const [bronzeWaypoint, goldWaypoint, notStartedWaypoint] = data.waypoints
    expect(bronzeWaypoint && goldWaypoint && notStartedWaypoint).toBeTruthy()
    bronzeWaypoint!.location = { latitude: 51.84, longitude: -2.15 }
    goldWaypoint!.location = { latitude: 51.85, longitude: -2.14 }
    notStartedWaypoint!.location = { latitude: 51.86, longitude: -2.13 }
    data.activities = [activity(bronzeWaypoint!.waypointId, 'bronze'), activity(goldWaypoint!.waypointId, 'gold')]
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
    const waypointList = screen.getByLabelText('Nearest visible waypoints')

    const selectOption = async (label: string, option: string) => {
      await user.click(screen.getByRole('combobox', { name: label }))
      await user.click(screen.getByRole('option', { name: option }))
    }

    await selectOption('Progress status', 'Started')
    expect(within(waypointList).getByText(bronzeWaypoint!.title)).toBeInTheDocument()
    expect(within(waypointList).getByText(goldWaypoint!.title)).toBeInTheDocument()
    expect(within(waypointList).queryByText(notStartedWaypoint!.title)).not.toBeInTheDocument()

    await selectOption('Medal tier', 'Bronze')
    expect(within(waypointList).getByText(bronzeWaypoint!.title)).toBeInTheDocument()
    expect(within(waypointList).queryByText(goldWaypoint!.title)).not.toBeInTheDocument()

    await selectOption('Progress status', 'Not Started')
    expect(within(waypointList).queryByText(bronzeWaypoint!.title)).not.toBeInTheDocument()
    expect(within(waypointList).queryByText(notStartedWaypoint!.title)).not.toBeInTheDocument()

    await selectOption('Medal tier', 'All')
    expect(within(waypointList).getByText(notStartedWaypoint!.title)).toBeInTheDocument()
    await selectOption('Progress status', 'All')
    expect(within(waypointList).getByText(bronzeWaypoint!.title)).toBeInTheDocument()
    expect(within(waypointList).getByText(goldWaypoint!.title)).toBeInTheDocument()
    expect(within(waypointList).getByText(notStartedWaypoint!.title)).toBeInTheDocument()
  })

  it('shows a loading notice instead of filters and an empty map while production data is in flight', async () => {
    vi.stubEnv('MODE', 'production')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => new Promise<Response>(() => {})),
    )
    render(
      <MemoryRouter>
        <WaypointsProvider>
          <MapPage />
        </WaypointsProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Loading map data…')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Waypoint filters' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Azure Maps interactive map')).not.toBeInTheDocument()
    expect(screen.queryByText('No visible waypoints.')).not.toBeInTheDocument()
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
    expect(screen.getByLabelText('Nearest activities')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Waypoint filters' })).not.toBeInTheDocument()
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
    expect(screen.queryByLabelText('Nearest visible waypoints')).not.toBeVisible()

    await user.click(screen.getByRole('button', { name: 'List' }))
    expect(screen.getByLabelText('Nearest visible waypoints')).toBeVisible()
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

  it('keeps layer and medal filters while showing an explicit no-results origin error', async () => {
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
    await user.click(screen.getByRole('combobox', { name: 'Medal tier' }))
    await user.click(screen.getByRole('option', { name: 'Gold' }))
    await user.click(screen.getByRole('button', { name: 'Search' }))
    expect(await screen.findByText(/No places matched that search/)).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Activities' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('combobox', { name: 'Medal tier' })).toHaveTextContent('Gold')
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
      name: 'Canal loop',
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
    await user.click(screen.getByRole('combobox', { name: 'Medal tier' }))
    await user.click(screen.getByRole('option', { name: 'Gold' }))
    await user.click(screen.getByRole('tab', { name: 'Activities' }))
    const activityLink = screen.getByRole('link', { name: /Canal loop.*\d+\.\d miles.*2026-08-10/ })
    expect(activityLink).toHaveAttribute('title', 'Canal loop')
    expect(screen.getByLabelText('Bronze tier')).toBeInTheDocument()
    expect(screen.queryByText(/Bronze:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/NOT STARTED|GOLD|SILVER|BRONZE/)).not.toBeInTheDocument()
    expect(screen.getByText(/1 waypoint and 1 activity have no coordinates/)).toBeInTheDocument()
  })

  it('fits a recorded track and only shows its status while the track is present in Activities mode', async () => {
    const user = userEvent.setup()
    const data = createDefaultData()
    const coordinates: [number, number][] = [
      [-2.1, 51.5],
      [-2.2, 51.6],
    ]
    data.activities = [
      {
        activityId: 'activity-with-track',
        name: 'Recorded walk',
        ideaIds: [],
        date: '2026-08-10',
        location: { kind: 'coordinates', latitude: 51.5, longitude: -2.1 },
        recordedTrack: { type: 'MultiLineString', coordinates: [coordinates] },
        notes: '',
        referenceIds: [],
        photoReferenceIds: [],
        createdAt: '2026-08-10T00:00:00.000Z',
        updatedAt: '2026-08-10T00:00:00.000Z',
      },
    ]
    localStorage.setItem('waypoints-v1', JSON.stringify(data))
    let searchCount = 0
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        if (String(input).includes('/api/maps/search?')) {
          searchCount += 1
          return Promise.resolve(
            jsonResponse({
              results: [
                {
                  position: searchCount === 1 ? { lat: 52.1, lon: -2.3 } : { lat: 52.2, lon: -2.4 },
                },
              ],
            }),
          )
        }
        return Promise.resolve(jsonResponse({ token: 'entra', expiresOn: '2026-01-01', clientId: 'maps-client-id' }))
      }),
    )

    function RemoveTrack() {
      const { updateActivity } = useWaypoints()
      const activity = data.activities[0]!
      return (
        <button
          onClick={() =>
            void updateActivity(activity.activityId, {
              ...activity,
              recordedTrack: undefined,
              references: [],
              photoReferences: [],
            })
          }
        >
          Remove track
        </button>
      )
    }

    render(
      <MemoryRouter initialEntries={['/map?activityId=activity-with-track']}>
        <WaypointsProvider>
          <MapPage />
          <RemoveTrack />
        </WaypointsProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Showing the recorded track for Recorded walk.')).toBeInTheDocument()
    await vi.waitFor(() => expect(mapEvents.lineStringCoordinates).toEqual([coordinates]))
    expect(mapEvents.layerOptions.get('activity-tracks')).toMatchObject({
      strokeColor: '#1565c0',
      strokeWidth: 4,
      strokeDashArray: [2, 2],
      strokeOpacity: 0.85,
    })
    expect(mapEvents.layerOptions.get('activity-tracks-outline')).toMatchObject({
      strokeColor: '#ffffff',
      strokeWidth: 7,
      strokeDashArray: [8 / 7, 8 / 7],
    })
    expect(
      (
        mapEvents.layerOptions.get('activity-tracks-outline') as { strokeDashArray: number[]; strokeWidth: number }
      ).strokeDashArray.map((length) => length * 7),
    ).toEqual([8, 8])
    expect(mapEvents.setCamera).toHaveBeenCalledWith(
      expect.objectContaining({ bounds: [-2.2, 51.5, -2.1, 51.6], padding: 40 }),
    )
    expect(screen.getByRole('tab', { name: 'Activities' })).toHaveAttribute('aria-selected', 'true')

    await user.click(screen.getByRole('tab', { name: 'Waypoints' }))
    expect(screen.queryByText('Showing the recorded track for Recorded walk.')).not.toBeInTheDocument()
    mapEvents.setCamera.mockClear()
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await vi.waitFor(() => expect(mapEvents.mapCenters.at(-1)).toEqual([-2.3, 52.1]))
    expect(mapEvents.setCamera).not.toHaveBeenCalled()

    await user.click(screen.getByRole('tab', { name: 'Activities' }))
    expect(screen.getByText('Showing the recorded track for Recorded walk.')).toBeInTheDocument()
    await vi.waitFor(() => expect(mapEvents.activityTrackSourceAdd).toHaveBeenLastCalledWith([expect.anything()]))
    mapEvents.setCamera.mockClear()
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await vi.waitFor(() => expect(mapEvents.mapCenters.at(-1)).toEqual([-2.4, 52.2]))
    expect(mapEvents.setCamera).not.toHaveBeenCalled()
    mapEvents.activityTrackSourceClear.mockClear()

    await user.click(screen.getByRole('button', { name: 'Remove track' }))

    expect(screen.queryByText(/Showing the recorded track for/)).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Activities' })).toHaveAttribute('aria-selected', 'true')
    expect(mapEvents.activityTrackSourceClear).toHaveBeenCalled()
    expect(mapEvents.activityTrackSourceAdd).toHaveBeenLastCalledWith([])
  })

  it('uses fallback names without promoting dates to primary map list labels', async () => {
    const data = createDefaultData()
    const waypoint = data.waypoints[0]!
    waypoint.title = '   '
    waypoint.location = { ...waypoint.location, latitude: 51.84, longitude: -2.15 }
    data.activities = [
      {
        activityId: 'unnamed-activity',
        ideaIds: [],
        waypointId: waypoint.waypointId,
        date: '2026-08-10',
        category: undefined,
        location: { kind: 'coordinates', latitude: 51.85, longitude: -2.14 },
        notes: '',
        referenceIds: [],
        photoReferenceIds: [],
        createdAt: '2026-08-10T00:00:00.000Z',
        updatedAt: '2026-08-10T00:00:00.000Z',
      },
    ]
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

    const waypointLink = screen.getByRole('link', { name: /Unnamed waypoint.*\d+\.\d miles/ })
    expect(waypointLink).toHaveAttribute('title', 'Unnamed waypoint')
    expect(screen.getAllByLabelText('Not completed').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('tab', { name: 'Activities' }))

    const activityLink = screen.getByRole('link', { name: /Unnamed activity.*\d+\.\d miles.*2026-08-10/ })
    expect(activityLink).toHaveAttribute('title', 'Unnamed activity')
    expect(activityLink).toHaveTextContent(/^Unnamed activity/)
  })

  it('renders persisted challenge routes and fits the route selected from the map controls', async () => {
    const data = createDefaultData()
    const challenge = data.challenges[0]!
    data.challenges = [
      {
        ...challenge,
        plannedRoute: {
          fileName: 'route.gpx',
          geometry: {
            type: 'MultiLineString',
            coordinates: [
              [
                [-2.2, 51.8],
                [-2.1, 51.9],
              ],
              [
                [-2, 52],
                [-1.9, 52.1],
              ],
            ],
          },
        },
      },
      {
        ...challenge,
        challengeId: 'second-route',
        title: 'Second route',
        waypointIds: [],
        plannedRoute: {
          fileName: 'second-route.gpx',
          geometry: {
            type: 'MultiLineString',
            coordinates: [
              [
                [-1.8, 51.7],
                [-1.7, 51.8],
              ],
            ],
          },
        },
      },
    ]
    localStorage.setItem('waypoints-v1', JSON.stringify(data))
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) =>
        Promise.resolve(
          String(input).includes('/api/maps/search?')
            ? jsonResponse({
                results: [{ position: { lat: 52.3, lon: -2.5 } }],
              })
            : jsonResponse({ token: 'entra', expiresOn: '2026-01-01', clientId: 'maps-client-id' }),
        ),
      ),
    )
    const view = render(
      <MemoryRouter>
        <WaypointsProvider>
          <MapPage />
        </WaypointsProvider>
      </MemoryRouter>,
    )

    await vi.waitFor(() => expect(mapEvents.gpxSourceAdd).toHaveBeenCalled())
    const features = mapEvents.gpxSourceAdd.mock.calls[0]![0]
    expect(features).toHaveLength(3)
    expect(features.map((feature: { id: string }) => feature.id)).toEqual([
      'national-trust:0',
      'national-trust:1',
      'second-route:0',
    ])
    expect(mapEvents.layerOptions.get('gpx-lines')).toMatchObject({ strokeOpacity: 0.85 })
    expect(mapEvents.layerOptions.get('gpx-lines-outline')).toMatchObject({
      strokeColor: '#ffffff',
      strokeWidth: ['+', ['get', 'strokeWidth'], 3],
    })
    expect(features[0]).toMatchObject({ properties: { color: '#e65100', strokeWidth: 7 } })
    expect(features[2]).toMatchObject({ properties: { color: '#e65100', strokeWidth: 7 } })
    expect(screen.getByRole('group', { name: 'Planned routes' })).toBeInTheDocument()
    const sourceAddsBeforeSelection = mapEvents.gpxSourceAdd.mock.calls.length
    const sourceClearsBeforeSelection = mapEvents.gpxSourceClear.mock.calls.length
    await user.click(screen.getByRole('button', { name: 'National Trust' }))
    expect(mapEvents.gpxSourceAdd).toHaveBeenCalledTimes(sourceAddsBeforeSelection)
    expect(mapEvents.gpxSourceClear).toHaveBeenCalledTimes(sourceClearsBeforeSelection)
    expect(mapEvents.setCamera).toHaveBeenCalledWith({
      bounds: [-2.2, 51.8, -1.9, 52.1],
      padding: 48,
    })
    const sourceAddsBeforeNextSelection = mapEvents.gpxSourceAdd.mock.calls.length
    const sourceClearsBeforeNextSelection = mapEvents.gpxSourceClear.mock.calls.length
    await user.click(screen.getByRole('button', { name: 'Second route' }))
    expect(mapEvents.gpxSourceAdd).toHaveBeenCalledTimes(sourceAddsBeforeNextSelection)
    expect(mapEvents.gpxSourceClear).toHaveBeenCalledTimes(sourceClearsBeforeNextSelection)
    expect(mapEvents.setCamera).toHaveBeenCalledWith({
      bounds: [-1.8, 51.7, -1.7, 51.8],
      padding: 48,
    })
    mapEvents.setCamera.mockClear()
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await vi.waitFor(() => expect(mapEvents.mapCenters.at(-1)).toEqual([-2.5, 52.3]))
    expect(mapEvents.setCamera).not.toHaveBeenCalled()
    const clearCountBeforeUnmount = mapEvents.gpxSourceClear.mock.calls.length
    view.unmount()
    expect(mapEvents.gpxSourceClear).toHaveBeenCalledTimes(clearCountBeforeUnmount + 1)
  })

  it('frames selected GPX geometry crossing the antimeridian by its short longitude interval', async () => {
    const data = createDefaultData()
    const challenge = data.challenges[0]!
    data.challenges = [
      {
        ...challenge,
        plannedRoute: {
          fileName: 'dateline.gpx',
          geometry: {
            type: 'MultiLineString',
            coordinates: [
              [
                [179, 10],
                [-179, 11],
              ],
            ],
          },
        },
      },
    ]
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

    await vi.waitFor(() => expect(mapEvents.gpxSourceAdd).toHaveBeenCalled())
    const sourceAddsBeforeSelection = mapEvents.gpxSourceAdd.mock.calls.length
    const sourceClearsBeforeSelection = mapEvents.gpxSourceClear.mock.calls.length
    await user.click(screen.getByRole('button', { name: challenge.title }))
    expect(mapEvents.gpxSourceAdd).toHaveBeenCalledTimes(sourceAddsBeforeSelection)
    expect(mapEvents.gpxSourceClear).toHaveBeenCalledTimes(sourceClearsBeforeSelection)
    expect(mapEvents.setCamera).toHaveBeenCalledWith({ bounds: [179, 10, -179, 11], padding: 48 })
  })

  it('does not fit the camera to degenerate persisted route geometry', async () => {
    const data = createDefaultData()
    data.challenges = [
      {
        ...data.challenges[0]!,
        plannedRoute: {
          fileName: 'point.gpx',
          geometry: {
            type: 'MultiLineString',
            coordinates: [
              [
                [1, 2],
                [1, 2],
              ],
            ],
          },
        },
      },
    ]
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

    await vi.waitFor(() => expect(mapEvents.gpxSourceAdd).toHaveBeenCalled())
    expect(mapEvents.gpxSourceAdd).toHaveBeenCalledWith([expect.objectContaining({ id: 'national-trust:0' })])
    await user.click(screen.getByRole('button', { name: 'National Trust' }))
    expect(mapEvents.setCamera).not.toHaveBeenCalled()
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

  it('sizes the map to fill the viewport below it and resizes on window resize', async () => {
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
    mapEvents.resize.mockClear()

    const mapBox = screen.getByLabelText('Azure Maps interactive map').parentElement as HTMLElement
    vi.spyOn(mapBox, 'getBoundingClientRect').mockReturnValue({ top: 200 } as DOMRect)
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(900)

    act(() => window.dispatchEvent(new Event('resize')))

    expect(getComputedStyle(mapBox).height).toBe('676px')
    expect(mapEvents.resize).toHaveBeenCalledOnce()
  })

  it('recomputes the map height via ResizeObserver when the filters area changes size', async () => {
    let capturedCallback: (() => void) | undefined
    class FakeResizeObserver {
      constructor(callback: () => void) {
        capturedCallback = callback
      }
      observe = vi.fn()
      disconnect = vi.fn()
    }
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
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
    expect(capturedCallback).toBeDefined()
    mapEvents.resize.mockClear()

    const mapBox = screen.getByLabelText('Azure Maps interactive map').parentElement as HTMLElement
    vi.spyOn(mapBox, 'getBoundingClientRect').mockReturnValue({ top: 150 } as DOMRect)
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(800)

    act(() => capturedCallback!())

    expect(getComputedStyle(mapBox).height).toBe('626px')
    expect(mapEvents.resize).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
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
        name: 'Ridge walk',
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
    expect(mapEvents.popupContent?.querySelector('a')).toHaveTextContent('Ridge walk')
    expect(await screen.findByText('Opening waypoint details.')).toBeInTheDocument()
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
        name: 'Ridge walk',
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
      name: 'Linked garden visit',
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
    const unlinked = {
      ...activity,
      activityId: 'unlinked',
      name: undefined,
      waypointId: undefined,
      category: undefined,
    }
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
    }).not.toThrow()
    mapEvents.activityClick!({ shapes: [{ properties: { activityId: activity.activityId } }] })
    expect(mapEvents.popupContent).toHaveTextContent('ActivityLinked garden visitBronze')
    expect(mapEvents.popupContent).not.toHaveTextContent('Activity2026-08-10Bronze')
    mapEvents.activityClick!({ shapes: [{ properties: { activityId: unlinked.activityId } }] })
    expect(mapEvents.popupContent).toHaveTextContent('ActivityUnnamed activityUncategorisedNo linked waypoint')
    expect(mapEvents.popupContent?.querySelector('a')).toHaveAttribute('href', '/activities/unlinked')
  })

  it('lists the waypoints inside an activated cluster', async () => {
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
    await vi.waitFor(() => expect(mapEvents.waypointClusterClick).toBeDefined())
    expect(mapEvents.waypointClusterLabelClick).toBe(mapEvents.waypointClusterClick)
    expect(() => {
      mapEvents.waypointClusterClick!({})
      mapEvents.waypointClusterClick!({ shapes: [{ getCoordinates: () => [-2.2, 51.8] }] })
      mapEvents.waypointClusterClick!({
        shapes: [{ getCoordinates: () => [-2.2, 51.8], getProperties: () => ({ cluster_id: 42, point_count: 30 }) }],
      })
    }).not.toThrow()
    await vi.waitFor(() => expect(mapEvents.waypointClusterLeaves).toHaveBeenCalledWith(42, 25, 0))
    await vi.waitFor(() => expect(mapEvents.popupContent).toBeDefined())
    expect(mapEvents.popupContent).toHaveTextContent('Waypoints here30 in this group')
    expect(mapEvents.popupContent).toHaveTextContent('Showing the first 1. Zoom in to see the rest.')
    const links = mapEvents.popupContent!.querySelectorAll('a')
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', '/waypoints/waypoint-1')
    expect(links[0]).toHaveTextContent('Clustered waypoint')
  })

  it('lists the activities inside an activated cluster', async () => {
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
    await vi.waitFor(() => expect(mapEvents.activityClusterClick).toBeDefined())
    expect(mapEvents.activityClusterLabelClick).toBe(mapEvents.activityClusterClick)
    mapEvents.activityClusterClick!({
      shapes: [{ getCoordinates: () => [-2.2, 51.8], getProperties: () => ({ cluster_id: 43, point_count: 1 }) }],
    })
    await vi.waitFor(() => expect(mapEvents.activityClusterLeaves).toHaveBeenCalledWith(43, 25, 0))
    await vi.waitFor(() => expect(mapEvents.popupContent).toBeDefined())
    expect(mapEvents.popupContent).toHaveTextContent('Activities here1 in this group')
    expect(mapEvents.popupContent?.querySelector('a')).toHaveAttribute('href', '/activities/activity-1')
    expect(mapEvents.popupContent?.querySelector('a')).toHaveTextContent('Clustered activity')
  })

  it('ignores a stale cluster result after a marker click', async () => {
    const data = createDefaultData()
    const waypoint = data.waypoints[0]!
    waypoint.location = { ...waypoint.location, latitude: 51.84, longitude: -2.15 }
    localStorage.setItem('waypoints-v1', JSON.stringify(data))
    let resolveLeaves!: (leaves: Array<{ properties: Record<string, unknown> }>) => void
    mapEvents.waypointClusterLeaves.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveLeaves = resolve
      }),
    )
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
    await vi.waitFor(() => {
      expect(mapEvents.waypointClusterClick).toBeDefined()
      expect(mapEvents.click).toBeDefined()
    })
    mapEvents.waypointClusterClick!({
      shapes: [{ getCoordinates: () => [-2.2, 51.8], getProperties: () => ({ cluster_id: 42, point_count: 1 }) }],
    })
    mapEvents.click!({ shapes: [{ getProperties: () => ({ waypointId: waypoint.waypointId }) }] })
    await act(async () => {
      resolveLeaves([{ properties: { label: 'Stale waypoint', waypointId: 'stale' } }])
      await Promise.resolve()
    })
    expect(mapEvents.popupContent).toHaveTextContent(`Waypoint${waypoint.title}`)
    expect(mapEvents.popupContent).not.toHaveTextContent('Stale waypoint')
  })

  it('leaves the popup closed when a cluster holds no identifiable items', async () => {
    mapEvents.waypointClusterLeaves.mockResolvedValueOnce([{ properties: {} }])
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
    await vi.waitFor(() => expect(mapEvents.waypointClusterClick).toBeDefined())
    mapEvents.waypointClusterClick!({
      shapes: [{ getCoordinates: () => [-2.2, 51.8], getProperties: () => ({ cluster_id: 7, point_count: 1 }) }],
    })
    await vi.waitFor(() => expect(mapEvents.waypointClusterLeaves).toHaveBeenCalledWith(7, 25, 0))
    expect(mapEvents.popupContent).toBeUndefined()
  })
})
