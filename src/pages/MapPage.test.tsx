import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, MemoryRouter, Outlet, Route, RouterProvider, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDemoModeData, save, setDataMode } from '../services/storage'
import { useWaypoints, WaypointsProvider } from '../features/journey/JourneyContext'
import { createActivity, type Activity, type AwardedStatus } from '../domain/visit'
import LocationDetails from './LocationDetails'
import ActivityDetails from './ActivityDetails'
import { mapExplorationState } from '../features/journey/mapExploration'

type MapClickHandler = (event: {
  shapes?: Array<{
    getProperties?: () => { waypointId?: string; activityId?: string; cluster_id?: number; point_count?: number }
    getCoordinates?: () => number[]
    type?: 'Feature'
    geometry?: { type: 'Point'; coordinates: number[] }
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
  attachPopup: false,
  camera: { center: [-2, 51] as [number, number], zoom: 8, bearing: 0, pitch: 0 },
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
  popupPosition: undefined as number[] | undefined,
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
    name: 'Recorded activity',
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
    getCamera = vi.fn(() => mapEvents.camera)
    setCamera = mapEvents.setCamera
    dispose = vi.fn(() => mapEvents.popupContent?.remove())
    resize = mapEvents.resize
  },
  Popup: class {
    getOptions = () => ({ content: mapEvents.popupContent })
    setOptions = vi.fn((options: { content?: HTMLElement; position?: number[] }) => {
      mapEvents.popupContent = options.content
      mapEvents.popupPosition = options.position
    })
    open = vi.fn(() => {
      if (mapEvents.attachPopup && mapEvents.popupContent) document.body.append(mapEvents.popupContent)
    })
    close = vi.fn(() => {
      mapEvents.popupContent?.remove()
      mapEvents.popupClose?.()
    })
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

const createDefaultData = createDemoModeData

function explorationData() {
  const data = createDefaultData()
  data.waypoints = [data.waypoints[0]!]
  data.waypoints[0]!.location = { latitude: 51.5, longitude: -2 }
  data.activities = [
    createActivity({
      activityId: 'return-activity',
      name: 'Return activity',
      waypointId: data.waypoints[0]!.waypointId,
      category: 'bronze',
      date: '2026-08-01',
      location: { kind: 'coordinates', latitude: 51.5, longitude: -2 },
      recordedTrack: {
        type: 'MultiLineString',
        coordinates: [
          [
            [-2, 51.5],
            [-1.9, 51.6],
          ],
        ],
      },
    }),
  ]
  data.challenges[0]!.plannedRoute = {
    fileName: 'return.gpx',
    geometry: {
      type: 'MultiLineString',
      coordinates: [
        [
          [-2, 51.5],
          [-1.9, 51.6],
        ],
      ],
    },
  }
  return data
}

function renderExploration(initial = '/map', state?: unknown, seed?: unknown) {
  let journey!: ReturnType<typeof useWaypoints>
  function Probe() {
    journey = useWaypoints()
    if (seed && journey.mapExploration.lookup('source').kind === 'absent') {
      const hint = journey.mapExploration.capture('source', seed)
      if (typeof state === 'object' && state !== null) Object.assign(state, hint)
    }
    return null
  }
  const router = createMemoryRouter(
    [
      {
        element: (
          <WaypointsProvider>
            <Probe />
            <Outlet />
          </WaypointsProvider>
        ),
        children: [
          { path: '/map', element: <MapPage /> },
          { path: '/waypoints/:id', element: <LocationDetails /> },
          { path: '/activities/:activityId', element: <ActivityDetails /> },
        ],
      },
    ],
    { initialEntries: [{ pathname: initial, state, key: 'source' }] },
  )
  const view = render(<RouterProvider router={router} />)
  return { ...view, router, journey: () => journey }
}

const roundTrips = (['waypoint', 'activity'] as const).flatMap((kind) =>
  (['nearby', 'marker', 'cluster'] as const).flatMap((path) =>
    (['contextual', 'browser'] as const).map((back) => ({ kind, path, back })),
  ),
)

describe('MapPage', () => {
  beforeEach(() => {
    localStorage.clear()
    save(createDemoModeData())
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
    mapEvents.attachPopup = false
    mapEvents.camera = { center: [-2, 51], zoom: 8, bearing: 0, pitch: 0 }
    mapEvents.sourceAdd.mockClear()
    mapEvents.gpxSourceAdd.mockClear()
    mapEvents.gpxSourceClear.mockClear()
    mapEvents.activityTrackSourceAdd.mockClear()
    mapEvents.activityTrackSourceClear.mockClear()
    mapEvents.layerOptions.clear()
    mapEvents.setCamera.mockClear()
    mapEvents.waypointClusterLeaves
      .mockReset()
      .mockResolvedValue([
        { getProperties: () => ({ label: 'Clustered waypoint', award: 'Bronze', waypointId: 'waypoint-1' }) },
        { properties: {} },
      ])
    mapEvents.activityClusterLeaves
      .mockReset()
      .mockResolvedValue([
        { properties: { label: 'Clustered activity', description: '2026-08-10', activityId: 'activity-1' } },
        { properties: {} },
      ])
    mapEvents.resize.mockClear()
    mapEvents.setCamera.mockClear()
    mapEvents.mapCenters = []
    mapEvents.lineStringCoordinates = []
    mapEvents.popupClose = undefined
    mapEvents.popupContent = undefined
    mapEvents.popupPosition = undefined
  })

  it.each(roundTrips)(
    'restores $kind from $path through $back return without searches/writes or refitting',
    async ({ kind, path, back }) => {
      const data = explorationData()
      save(data)
      setViewport(360)
      mapEvents.attachPopup = true
      const fetch = vi.fn((url: string) =>
        Promise.resolve(
          jsonResponse(
            url.startsWith('/api/maps/search')
              ? { results: [{ address: { freeformAddress: 'Origin' }, position: { lat: 51.5, lon: -2 } }] }
              : { token: 'entra', expiresOn: '2026-01-01', clientId: 'maps-client-id' },
          ),
        ),
      )
      vi.stubGlobal('fetch', fetch)
      const view = renderExploration()
      const user = userEvent.setup()
      if (kind === 'activity') await user.click(screen.getByRole('tab', { name: 'Activities' }))
      fireEvent.change(screen.getByRole('textbox', { name: /Nearby origin/ }), { target: { value: 'Origin' } })
      await user.click(screen.getByRole('button', { name: 'Search' }))
      await user.click(screen.getByRole('button', { name: data.challenges[0]!.title }))
      await user.click(screen.getByRole('button', { name: path === 'nearby' ? 'List' : 'Map' }))
      fireEvent.change(screen.getByRole('textbox', { name: /Nearby origin/ }), {
        target: { value: 'Unresolved edited text' },
      })
      const id = kind === 'waypoint' ? data.waypoints[0]!.waypointId : 'return-activity'
      const title = kind === 'waypoint' ? data.waypoints[0]!.title : 'Return activity'
      const captured = { center: [-3.1, 52.2] as [number, number], zoom: 13.25, bearing: 37, pitch: 24 }
      mapEvents.camera = captured
      if (path === 'nearby') {
        await user.click(
          within(
            screen.getByLabelText(kind === 'waypoint' ? 'Nearest visible waypoints' : 'Nearest activities'),
          ).getByRole('link', { name: (name) => name.startsWith(title) }),
        )
      } else if (path === 'marker') {
        act(() =>
          (kind === 'waypoint' ? mapEvents.click : mapEvents.activityClick)?.({
            shapes: [{ getProperties: () => (kind === 'waypoint' ? { waypointId: id } : { activityId: id }) }],
          }),
        )
        await user.click(
          within(mapEvents.popupContent!).getByRole('link', {
            name: kind === 'waypoint' ? 'View waypoint' : 'View details',
          }),
        )
      } else {
        if (kind === 'waypoint')
          mapEvents.waypointClusterLeaves.mockResolvedValue([
            { getProperties: () => ({ label: title, award: 'Started', waypointId: id }) },
          ])
        else
          mapEvents.activityClusterLeaves.mockResolvedValue([
            { properties: { label: title, description: 'Current activity', activityId: id } },
          ])
        await act(async () =>
          (kind === 'waypoint' ? mapEvents.waypointClusterClick : mapEvents.activityClusterClick)?.({
            shapes: [
              {
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [-2, 51.5] },
                properties: { cluster_id: 3, point_count: 1 },
              },
            ],
          }),
        )
        await user.click(within(mapEvents.popupContent!).getByRole('link', { name: title }))
      }
      expect(await screen.findByRole('link', { name: 'Back to Map' })).toBeInTheDocument()
      expect(view.journey().mapExploration.lookup('source')).toMatchObject({
        metadata: {
          mode: kind === 'waypoint' ? 'waypoints' : 'activities',
          originQuery: 'Unresolved edited text',
          origin: { latitude: 51.5, longitude: -2 },
          camera: captured,
          entryPath: path,
        },
      })
      mapEvents.setCamera.mockClear()
      if (back === 'contextual') await user.click(screen.getByRole('link', { name: 'Back to Map' }))
      else await act(async () => view.router.navigate(-1))
      expect(await screen.findByRole('textbox', { name: /Nearby origin/ })).toHaveValue('Unresolved edited text')
      await waitFor(() => expect(mapEvents.setCamera).toHaveBeenLastCalledWith(captured))
      expect(screen.getByRole('button', { name: path === 'nearby' ? 'List' : 'Map' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      if (path === 'nearby') {
        const result = within(
          screen.getByLabelText(kind === 'waypoint' ? 'Nearest visible waypoints' : 'Nearest activities'),
        ).getByRole('link', { name: (name) => name.startsWith(title) })
        expect(result).toHaveFocus()
      } else
        expect(
          within(mapEvents.popupContent!).getByRole('link', {
            name: kind === 'waypoint' ? 'View waypoint' : 'View details',
          }),
        ).toHaveFocus()
      expect(fetch.mock.calls.filter(([url]) => url.startsWith('/api/maps/search'))).toHaveLength(1)
      expect(fetch.mock.calls.every(([url]) => url.startsWith('/api/maps/'))).toBe(true)
    },
  )

  it('captures no metadata for modified or default-prevented popup activation', async () => {
    const data = explorationData()
    save(data)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ token: 'entra', clientId: 'maps-client-id' })))
    const view = renderExploration()
    await waitFor(() => expect(mapEvents.click).toBeDefined())
    act(() => mapEvents.click?.({ shapes: [{ getProperties: () => ({ waypointId: data.waypoints[0]!.waypointId }) }] }))
    const link = within(mapEvents.popupContent!).getByRole('link', { name: 'View waypoint' })
    for (const modifier of ['ctrlKey', 'metaKey', 'shiftKey', 'altKey']) {
      fireEvent.click(link, { [modifier]: true })
      expect(view.journey().mapExploration.lookup('source')).toEqual({ kind: 'absent' })
    }
    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    event.preventDefault()
    link.dispatchEvent(event)
    expect(view.journey().mapExploration.lookup('source')).toEqual({ kind: 'absent' })
    expect(view.router.state.location.pathname).toBe('/map')
  })

  it('retains a related Activity origin in Waypoints mode without conflating opened and selected records', async () => {
    const data = explorationData()
    save(data)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ token: 'entra', clientId: 'maps-client-id' })))
    const view = renderExploration()
    await waitFor(() => expect(mapEvents.click).toBeDefined())
    act(() => mapEvents.click?.({ shapes: [{ getProperties: () => ({ waypointId: data.waypoints[0]!.waypointId }) }] }))
    await userEvent.setup().click(within(mapEvents.popupContent!).getByRole('link', { name: 'Return activity' }))
    expect(view.journey().mapExploration.lookup('source')).toMatchObject({
      metadata: {
        mode: 'waypoints',
        selection: { kind: 'waypoint', id: data.waypoints[0]!.waypointId },
        openedRecord: { kind: 'activity', id: 'return-activity' },
      },
    })
  })

  it('waits for current SDK readiness, preserves choices/feedback, and does not steal later focus', async () => {
    const data = explorationData()
    save(data)
    mapEvents.deferReady = true
    const seed = {
      mode: 'activities',
      progressFilter: 'all',
      medalFilter: 'all',
      mobilePanel: 'list',
      originQuery: 'Edited',
      origin: { latitude: 51.5, longitude: -2 },
      originChoices: [{ label: 'Unchosen', latitude: 52, longitude: -3 }],
      searchFeedback: 'Specific search failure',
      openedRecord: { kind: 'activity' as const, id: 'return-activity' },
      entryPath: 'nearby',
      camera: { center: [-3, 52], zoom: 11, bearing: 12, pitch: 4 },
      selectedRouteChallengeId: data.challenges[0]!.challengeId,
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ token: 'entra', clientId: 'maps-client-id' })))
    const view = renderExploration('/map', mapExplorationState('source', seed.openedRecord, 'fixture'), seed)
    await waitFor(() => expect(mapEvents.ready).toBeDefined())
    expect(mapEvents.setCamera).not.toHaveBeenCalled()
    expect(screen.getByText('Specific search failure')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Unchosen' })).toBeInTheDocument()
    await act(async () => view.journey().reload())
    act(() => mapEvents.ready?.())
    await waitFor(() => expect(mapEvents.setCamera).toHaveBeenLastCalledWith(seed.camera))
    const input = screen.getByRole('textbox', { name: /Nearby origin/ })
    input.focus()
    await act(async () => view.journey().reload())
    act(() => mapEvents.ready?.())
    expect(input).toHaveFocus()
  })

  it.each(['rename', 'move', 'coordinates', 'delete', 'progress', 'award', 'route', 'track'] as const)(
    'resolves current data after %s without retaining stale content or changing captured framing',
    async (change) => {
      const data = explorationData()
      save(data)
      mapEvents.attachPopup = true
      const waypoint = data.waypoints[0]!
      const seed = {
        mode: 'waypoints',
        progressFilter: 'started',
        medalFilter: 'bronze',
        mobilePanel: 'map',
        originQuery: 'Origin',
        origin: { latitude: 51.5, longitude: -2 },
        originChoices: [],
        selection: { kind: 'waypoint', id: waypoint.waypointId },
        openedRecord: { kind: 'waypoint' as const, id: waypoint.waypointId },
        entryPath: 'marker',
        selectedRouteChallengeId: data.challenges[0]!.challengeId,
        trackActivityId: 'return-activity',
        camera: { center: [-3, 52], zoom: 11, bearing: 10, pitch: 20 },
      }
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ token: 'entra', clientId: 'maps-client-id' })))
      const view = renderExploration(
        `/waypoints/${waypoint.waypointId}`,
        mapExplorationState('source', seed.openedRecord, 'fixture'),
        seed,
      )
      if (change === 'rename') waypoint.title = 'Current renamed waypoint'
      if (change === 'move') waypoint.location = { latitude: 52, longitude: -3 }
      if (change === 'coordinates') waypoint.location = { addressOrRegion: 'No coordinates' }
      if (change === 'delete') {
        data.waypoints = []
        data.activities = []
        data.ideas = []
      }
      if (change === 'progress') data.activities = []
      if (change === 'award') data.activities[0]!.category = 'gold'
      if (change === 'route') data.challenges[0]!.plannedRoute = undefined
      if (change === 'track') data.activities[0]!.recordedTrack = undefined
      save(data)
      await act(async () => view.journey().reload())
      await userEvent.setup().click(screen.getByRole('link', { name: 'Back to Map' }))
      await waitFor(() => expect(mapEvents.setCamera).toHaveBeenLastCalledWith(seed.camera))
      if (change === 'rename')
        expect(
          within(mapEvents.popupContent!).getByRole('heading', { name: 'Current renamed waypoint' }),
        ).toBeInTheDocument()
      else if (change === 'move') {
        expect(mapEvents.popupPosition).toEqual([-3, 52])
        expect(screen.getByText(/\d+\.\d miles/)).not.toHaveTextContent('0.0 miles')
      } else if (change === 'route')
        expect(screen.getByText('The selected planned route is no longer available.')).toBeInTheDocument()
      else if (change === 'track')
        expect(screen.getByText('The selected recorded track is no longer available.')).toBeInTheDocument()
      else {
        expect(screen.getByText(/The originating waypoint is no longer available/)).toBeInTheDocument()
        expect(mapEvents.popupContent).toBeUndefined()
      }
    },
  )

  it('permanently resets accepted dataset changes and drops old track intent, including away and back', async () => {
    const data = explorationData()
    save(data)
    const seed = {
      mode: 'activities',
      progressFilter: 'all',
      medalFilter: 'all',
      mobilePanel: 'list',
      originQuery: 'Old origin',
      originChoices: [],
      trackActivityId: 'return-activity',
      openedRecord: { kind: 'activity' as const, id: 'return-activity' },
      entryPath: 'nearby',
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ token: 'entra', clientId: 'maps-client-id' })))
    const view = renderExploration(
      '/activities/return-activity',
      mapExplorationState('source', seed.openedRecord, 'fixture'),
      seed,
    )
    await act(async () => view.journey().setDataMode('demo-local'))
    expect(screen.getByRole('link', { name: 'Back to Map' })).toHaveAttribute('href', '/map')
    await userEvent.setup().click(screen.getByRole('link', { name: 'Back to Map' }))
    expect(screen.getByText('Map exploration was reset because the dataset changed.')).toBeInTheDocument()
    expect(view.router.state.location.pathname + view.router.state.location.search).toBe('/map')
    expect(screen.getByRole('textbox', { name: /Nearby origin/ })).toHaveValue('')
    expect(screen.getByRole('tab', { name: 'Waypoints' })).toHaveAttribute('aria-selected', 'true')
    await act(async () => view.journey().setDataMode('production'))
    expect(screen.getByRole('textbox', { name: /Nearby origin/ })).toHaveValue('')
    expect(view.journey().mapExploration.lookup('source')).toMatchObject({ kind: 'invalidated' })
  })

  it('resets the mounted Map on effective Demo fallback and does not revive it on recovery', async () => {
    const data = explorationData()
    vi.stubEnv('MODE', 'production')
    setDataMode('demo-cosmos')
    let fail = false
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.startsWith('/api/journey'))
          return fail
            ? Promise.reject(new Error('Specific Demo return failure'))
            : Promise.resolve(new Response(JSON.stringify({ data, etags: {}, role: 'viewer' })))
        return Promise.resolve(
          new Response(JSON.stringify({ token: 'entra', clientId: 'maps-client-id' }), {
            headers: { 'content-type': 'application/json' },
          }),
        )
      }),
    )
    const seed = {
      mode: 'activities',
      progressFilter: 'all',
      medalFilter: 'all',
      mobilePanel: 'list',
      originQuery: 'Old origin',
      originChoices: [],
      openedRecord: { kind: 'activity' as const, id: 'return-activity' },
      entryPath: 'nearby',
      camera: { center: [-3, 52], zoom: 11 },
    }
    const view = renderExploration('/map', mapExplorationState('source', seed.openedRecord, 'fixture'), seed)
    await waitFor(() => expect(view.journey().loadState.status).toBe('loaded'))
    await waitFor(() => expect(mapEvents.setCamera).toHaveBeenLastCalledWith(seed.camera))
    fail = true
    await act(async () => view.journey().reload())
    expect(view.journey().activeDataMode).toBe('demo-local')
    expect(view.journey().loadError).toContain('Specific Demo return failure')
    expect(screen.getByRole('textbox', { name: /Nearby origin/ })).toHaveValue('')
    expect(screen.getByText('Map exploration was reset because the dataset changed.')).toBeInTheDocument()
    fail = false
    await act(async () => view.journey().reload())
    expect(view.journey().activeDataMode).toBe('demo-cosmos')
    expect(screen.getByRole('textbox', { name: /Nearby origin/ })).toHaveValue('')
    expect(view.journey().mapExploration.lookup('source')).toMatchObject({ kind: 'invalidated' })
    expect(mapEvents.setCamera.mock.calls.filter(([camera]) => camera.zoom === 11)).toHaveLength(1)
  })

  it('shows a failed load rather than absence, then restores after a same-dataset recovery', async () => {
    const data = explorationData()
    save(data)
    vi.stubEnv('MODE', 'production')
    let fail = false
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(
          url.startsWith('/api/journey')
            ? new Response(
                JSON.stringify(fail ? { error: 'Specific return load failure' } : { data, etags: {}, role: 'viewer' }),
                { status: fail ? 503 : 200, statusText: fail ? 'Service Unavailable' : 'OK' },
              )
            : new Response(JSON.stringify({ token: 'entra', clientId: 'maps-client-id' }), {
                headers: { 'content-type': 'application/json' },
              }),
        ),
      ),
    )
    const seed = {
      mode: 'activities',
      progressFilter: 'all',
      medalFilter: 'all',
      mobilePanel: 'list',
      originQuery: 'Origin',
      origin: { latitude: 51.5, longitude: -2 },
      originChoices: [],
      openedRecord: { kind: 'activity' as const, id: 'return-activity' },
      entryPath: 'nearby',
      camera: { center: [-3, 52], zoom: 11 },
    }
    const view = renderExploration(
      '/activities/return-activity',
      mapExplorationState('source', seed.openedRecord, 'fixture'),
      seed,
    )
    await waitFor(() => expect(view.journey().loadState.status).toBe('loaded'))
    fail = true
    await act(async () => view.journey().reload())
    await userEvent.setup().click(screen.getByRole('link', { name: 'Back to Map' }))
    expect(screen.getByText(/Production data could not be loaded/)).toBeInTheDocument()
    expect(screen.queryByText(/no longer/)).not.toBeInTheDocument()
    expect(mapEvents.setCamera).not.toHaveBeenCalled()
    fail = false
    await act(async () => view.journey().reload())
    await waitFor(() => expect(mapEvents.setCamera).toHaveBeenLastCalledWith(seed.camera))
    expect(screen.getByRole('link', { name: /Return activity/ })).toHaveFocus()
  })

  it('keeps independent visits and followed entries coherent across Back and Forward', async () => {
    const data = explorationData()
    save(data)
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(
          jsonResponse(
            url.startsWith('/api/maps/search')
              ? { results: [{ position: { lat: 52, lon: -3 } }] }
              : { token: 'entra', clientId: 'maps-client-id' },
          ),
        ),
      ),
    )
    const seed = {
      mode: 'activities',
      progressFilter: 'all',
      medalFilter: 'all',
      mobilePanel: 'list',
      originQuery: 'First origin',
      origin: { latitude: 51.5, longitude: -2 },
      originChoices: [],
      openedRecord: { kind: 'activity' as const, id: 'return-activity' },
      entryPath: 'nearby',
      camera: { center: [-2, 51.5], zoom: 10 },
    }
    const view = renderExploration('/map', mapExplorationState('source', seed.openedRecord, 'fixture'), seed)
    const user = userEvent.setup()
    await user.click(screen.getByRole('link', { name: /Return activity/ }))
    await user.click(screen.getByRole('link', { name: 'Back to Map' }))
    const firstReturnKey = view.router.state.location.key
    expect(view.journey().mapExploration.lookup(firstReturnKey)).toMatchObject({
      metadata: { originQuery: 'First origin' },
    })
    await act(async () => view.router.navigate('/map'))
    expect(screen.getByRole('textbox', { name: /Nearby origin/ })).toHaveValue('')
    await user.click(screen.getByRole('tab', { name: 'Activities' }))
    fireEvent.change(screen.getByRole('textbox', { name: /Nearby origin/ }), { target: { value: 'Second origin' } })
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await user.click(screen.getByRole('link', { name: /Return activity/ }))
    await act(async () => view.router.navigate(-1))
    expect(screen.getByRole('textbox', { name: /Nearby origin/ })).toHaveValue('Second origin')
    await act(async () => view.router.navigate(-1))
    expect(screen.getByRole('textbox', { name: /Nearby origin/ })).toHaveValue('First origin')
    await act(async () => view.router.navigate(1))
    expect(screen.getByRole('textbox', { name: /Nearby origin/ })).toHaveValue('Second origin')
  })

  it('adds a direct Waypoint popup action even with no Activities', async () => {
    const data = explorationData()
    data.activities = []
    save(data)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ token: 'entra', clientId: 'maps-client-id' })))
    renderExploration()
    await waitFor(() => expect(mapEvents.click).toBeDefined())
    act(() => mapEvents.click?.({ shapes: [{ getProperties: () => ({ waypointId: data.waypoints[0]!.waypointId }) }] }))
    expect(within(mapEvents.popupContent!).getByRole('link', { name: 'View waypoint' })).toHaveAttribute(
      'href',
      `/waypoints/${data.waypoints[0]!.waypointId}`,
    )
    expect(mapEvents.popupContent).toHaveTextContent('No recorded activities yet')
  })

  it('captures nearby navigation before readiness without inventing a camera', async () => {
    save(explorationData())
    mapEvents.deferReady = true
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(
          jsonResponse(
            url.startsWith('/api/maps/search')
              ? { results: [{ position: { lat: 51.5, lon: -2 } }] }
              : { token: 'entra', clientId: 'maps-client-id' },
          ),
        ),
      ),
    )
    const view = renderExploration()
    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: 'Activities' }))
    fireEvent.change(screen.getByRole('textbox', { name: /Nearby origin/ }), { target: { value: 'Origin' } })
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await user.click(screen.getByRole('link', { name: /Return activity/ }))
    const entry = view.journey().mapExploration.lookup('source')
    expect(entry.kind).toBe('current')
    if (entry.kind !== 'current') throw new Error('Expected captured exploration.')
    expect(entry.metadata.camera).toBeUndefined()
  })

  it.each(['ambiguous', 'no-match', 'failure'] as const)(
    'captures and restores actual %s search feedback independently of the last resolved origin',
    async (condition) => {
      save(explorationData())
      let searches = 0
      const fetch = vi.fn((url: string) => {
        if (!url.startsWith('/api/maps/search'))
          return Promise.resolve(jsonResponse({ token: 'entra', clientId: 'maps-client-id' }))
        searches++
        if (searches === 1) return Promise.resolve(jsonResponse({ results: [{ position: { lat: 51.5, lon: -2 } }] }))
        if (condition === 'failure')
          return Promise.resolve({ ok: false, text: () => Promise.resolve('Specific search failure') })
        return Promise.resolve(
          jsonResponse({
            results:
              condition === 'ambiguous'
                ? [
                    { position: { lat: 52, lon: -3 }, address: { freeformAddress: 'First choice' } },
                    { position: { lat: 53, lon: -4 }, address: { freeformAddress: 'Second choice' } },
                  ]
                : [],
          }),
        )
      })
      vi.stubGlobal('fetch', fetch)
      const view = renderExploration()
      const user = userEvent.setup()
      await user.click(screen.getByRole('tab', { name: 'Activities' }))
      const input = screen.getByRole('textbox', { name: /Nearby origin/ })
      fireEvent.change(input, { target: { value: 'Resolved' } })
      await user.click(screen.getByRole('button', { name: 'Search' }))
      fireEvent.change(input, { target: { value: 'Unresolved' } })
      await user.click(screen.getByRole('button', { name: 'Search' }))
      await user.click(screen.getByRole('link', { name: /Return activity/ }))
      expect(view.journey().mapExploration.lookup('source')).toMatchObject({
        metadata: {
          originQuery: 'Unresolved',
          origin: { latitude: 51.5, longitude: -2 },
        },
      })
      await user.click(screen.getByRole('link', { name: 'Back to Map' }))
      if (condition === 'ambiguous') {
        expect(screen.getByRole('button', { name: 'First choice' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Second choice' })).toBeInTheDocument()
      } else
        expect(
          screen.getByText(
            condition === 'failure'
              ? 'Nearby search failed: Specific search failure'
              : 'No places matched that search. Choose another postcode or place.',
          ),
        ).toBeInTheDocument()
      expect(searches).toBe(2)
    },
  )

  it('retains a current Waypoint popup when the related opened Activity disappears', async () => {
    const data = explorationData()
    save(data)
    mapEvents.attachPopup = true
    const waypointId = data.waypoints[0]!.waypointId
    const seed = {
      mode: 'waypoints',
      progressFilter: 'all',
      medalFilter: 'all',
      mobilePanel: 'map',
      originQuery: '',
      originChoices: [],
      selection: { kind: 'waypoint', id: waypointId },
      openedRecord: { kind: 'activity' as const, id: 'return-activity' },
      entryPath: 'marker',
      camera: { center: [-3, 52], zoom: 11 },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ token: 'entra', clientId: 'maps-client-id' })))
    const view = renderExploration(
      '/activities/return-activity',
      mapExplorationState('source', seed.openedRecord, 'fixture'),
      seed,
    )
    data.activities = []
    save(data)
    await act(async () => view.journey().reload())
    await userEvent.setup().click(screen.getByRole('link', { name: 'Back to Map' }))
    await waitFor(() =>
      expect(
        screen.getByText('The originating activity is no longer linked to this waypoint.').closest('[role="alert"]'),
      ).toHaveFocus(),
    )
    expect(within(mapEvents.popupContent!).getByRole('link', { name: 'View waypoint' })).toHaveAttribute(
      'href',
      `/waypoints/${waypointId}`,
    )
    expect(within(mapEvents.popupContent!).queryByRole('link', { name: 'Return activity' })).not.toBeInTheDocument()
  })

  it('clears an inapplicable restored award filter visibly rather than hiding an active filter', async () => {
    const data = explorationData()
    const seed = {
      mode: 'waypoints',
      progressFilter: 'all',
      medalFilter: 'bronze',
      mobilePanel: 'list',
      originQuery: 'Origin',
      origin: { latitude: 51.5, longitude: -2 },
      originChoices: [],
      openedRecord: { kind: 'waypoint' as const, id: data.waypoints[0]!.waypointId },
      entryPath: 'nearby',
    }
    data.activities = []
    for (const challenge of data.challenges) {
      challenge.supportsActivityCategories = false
      delete challenge.awardDescriptions
    }
    save(data)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ token: 'entra', clientId: 'maps-client-id' })))
    renderExploration('/map', mapExplorationState('source', seed.openedRecord, 'fixture'), seed)
    expect(
      await screen.findByText('The highest recorded award filter no longer applies to this dataset.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Highest recorded award' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: (name) => name.startsWith(data.waypoints[0]!.title) })).toHaveFocus()
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
    expect(screen.getByRole('combobox', { name: 'Highest recorded award' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Nearby origin/ })).toHaveValue('')
    expect(screen.getByText('Choose a nearby origin to see waypoints.')).toBeInTheDocument()
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
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ token: 'entra', expiresOn: '2026-01-01', clientId: 'maps-client-id' }))
        .mockResolvedValueOnce(
          jsonResponse({
            results: [{ address: { freeformAddress: 'Example' }, position: { lat: 51.84, lon: -2.15 } }],
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
    const waypointList = screen.getByLabelText('Nearest visible waypoints')

    const selectOption = async (label: string, option: string) => {
      await user.click(screen.getByRole('combobox', { name: label }))
      await user.click(screen.getByRole('option', { name: option }))
    }

    await user.type(screen.getByRole('textbox', { name: /Nearby origin/ }), 'Example')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await within(waypointList).findByText(bronzeWaypoint!.title)

    await selectOption('Progress status', 'Started')
    expect(within(waypointList).getByText(bronzeWaypoint!.title)).toBeInTheDocument()
    expect(within(waypointList).getByText(goldWaypoint!.title)).toBeInTheDocument()
    expect(within(waypointList).queryByText(notStartedWaypoint!.title)).not.toBeInTheDocument()

    await selectOption('Highest recorded award', 'Bronze')
    expect(within(waypointList).getByText(bronzeWaypoint!.title)).toBeInTheDocument()
    expect(within(waypointList).queryByText(goldWaypoint!.title)).not.toBeInTheDocument()

    await selectOption('Progress status', 'Not Started')
    expect(within(waypointList).queryByText(bronzeWaypoint!.title)).not.toBeInTheDocument()
    expect(within(waypointList).queryByText(notStartedWaypoint!.title)).not.toBeInTheDocument()

    await selectOption('Highest recorded award', 'All')
    expect(within(waypointList).getByText(notStartedWaypoint!.title)).toBeInTheDocument()
    await selectOption('Progress status', 'All')
    expect(within(waypointList).getByText(bronzeWaypoint!.title)).toBeInTheDocument()
    expect(within(waypointList).getByText(goldWaypoint!.title)).toBeInTheDocument()
    expect(within(waypointList).getByText(notStartedWaypoint!.title)).toBeInTheDocument()
  })

  it('treats an uncategorized linked activity as started progress', async () => {
    const data = createDefaultData()
    const waypoint = data.waypoints[0]!
    waypoint.location = { latitude: 51.84, longitude: -2.15 }
    const uncategorizedActivity = activity(waypoint.waypointId, 'bronze')
    delete uncategorizedActivity.category
    waypoint.challengeIds = []
    data.activities = [uncategorizedActivity]
    localStorage.setItem('waypoints-v1', JSON.stringify(data))
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ token: 'entra', expiresOn: '2026-01-01', clientId: 'maps-client-id' }))
        .mockResolvedValueOnce(
          jsonResponse({
            results: [{ address: { freeformAddress: 'Example' }, position: { lat: 51.84, lon: -2.15 } }],
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
    const waypointList = screen.getByLabelText('Nearest visible waypoints')

    await user.type(screen.getByRole('textbox', { name: /Nearby origin/ }), 'Example')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await within(waypointList).findByText(waypoint.title)

    await user.click(screen.getByRole('combobox', { name: 'Progress status' }))
    await user.click(screen.getByRole('option', { name: 'Started' }))

    expect(within(waypointList).getByText(waypoint.title)).toBeInTheDocument()
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
    expect(screen.getByText('Choose a nearby origin to see activities.')).toBeInTheDocument()
    expect(screen.queryByText('No mapped activities yet.')).not.toBeInTheDocument()
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
    await user.click(screen.getByRole('combobox', { name: 'Highest recorded award' }))
    await user.click(screen.getByRole('option', { name: 'Gold' }))
    await user.type(screen.getByRole('textbox', { name: /Nearby origin/ }), 'no match')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    expect(await screen.findByText(/No places matched that search/)).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Activities' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('combobox', { name: 'Highest recorded award' })).toHaveTextContent('Gold')
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
              { address: { freeformAddress: 'Place A' }, position: { lat: 51.8, lon: -2.1 } },
              { address: { freeformAddress: 'Place B' }, position: { lat: 51.9, lon: -2.2 } },
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
    await user.type(screen.getByRole('textbox', { name: /Nearby origin/ }), 'Example')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    expect(await screen.findByText('Choose a nearby origin')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Place A' }))
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
    await user.type(screen.getByRole('textbox', { name: /Nearby origin/ }), 'Oxford')
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
    await user.type(screen.getByRole('textbox', { name: /Nearby origin/ }), 'Example')
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
      name: 'Recorded activity',
      activityId: 'postcode-activity',
      ideaIds: [],
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
      vi
        .fn()
        .mockImplementation((input: RequestInfo | URL) =>
          Promise.resolve(
            String(input).includes('/api/maps/search?')
              ? jsonResponse({ results: [{ position: { lat: 51.8, lon: -2.2 } }] })
              : jsonResponse({ token: 'entra', expiresOn: '2026-01-01', clientId: 'maps-client-id' }),
          ),
        ),
    )
    render(
      <MemoryRouter>
        <WaypointsProvider>
          <MapPage />
        </WaypointsProvider>
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('combobox', { name: 'Highest recorded award' }))
    await user.click(screen.getByRole('option', { name: 'Gold' }))
    await user.type(screen.getByRole('textbox', { name: /Nearby origin/ }), 'Example')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await user.click(screen.getByRole('tab', { name: 'Activities' }))
    const activityLink = screen.getByRole('link', { name: /Canal loop.*\d+\.\d miles.*2026-08-10/ })
    expect(activityLink).toHaveAttribute('title', 'Canal loop')
    expect(screen.getAllByLabelText('Bronze tier').length).toBeGreaterThan(0)
    expect(screen.queryByText(/Bronze:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/NOT STARTED|GOLD|SILVER|BRONZE/)).not.toBeInTheDocument()
    expect(screen.getByText(/1 waypoint and 1 activity have no coordinates/)).toBeInTheDocument()
  })

  it('fits a recorded track and only shows its status while the track is present in Activities mode', async () => {
    const user = userEvent.setup()
    const data = createDefaultData()
    data.waypoints = []
    data.challenges = []
    data.ideas = []
    data.references = []
    data.photoReferences = []
    data.activities = []
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
    await user.type(screen.getByRole('textbox', { name: /Nearby origin/ }), 'Example')
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

  it('uses required Activity titles and waypoint fallback names without promoting dates to primary labels', async () => {
    const data = createDefaultData()
    const waypoint = data.waypoints[0]!
    waypoint.title = '   '
    waypoint.location = { ...waypoint.location, latitude: 51.84, longitude: -2.15 }
    data.activities = [
      {
        name: 'Recorded activity',
        activityId: 'named-activity',
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
      },
    ]
    localStorage.setItem('waypoints-v1', JSON.stringify(data))
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation((input: RequestInfo | URL) =>
          Promise.resolve(
            String(input).includes('/api/maps/search?')
              ? jsonResponse({ results: [{ position: { lat: 51.8, lon: -2.2 } }] })
              : jsonResponse({ token: 'entra', expiresOn: '2026-01-01', clientId: 'maps-client-id' }),
          ),
        ),
    )
    render(
      <MemoryRouter>
        <WaypointsProvider>
          <MapPage />
        </WaypointsProvider>
      </MemoryRouter>,
    )

    await user.type(screen.getByRole('textbox', { name: /Nearby origin/ }), 'Example')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    const waypointLink = screen.getByRole('link', { name: /Unnamed waypoint.*\d+\.\d miles/ })
    expect(waypointLink).toHaveAttribute('title', 'Unnamed waypoint')
    expect(screen.getAllByLabelText('Not completed').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('tab', { name: 'Activities' }))

    const activityLink = screen.getByRole('link', { name: /Recorded activity.*\d+\.\d miles.*2026-08-10/ })
    expect(activityLink).toHaveAttribute('title', 'Recorded activity')
    expect(activityLink).toHaveTextContent(/^Recorded activity/)
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
      ...data.challenges.slice(1).map((challenge) => ({ ...challenge, plannedRoute: undefined })),
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
    await user.click(screen.getByRole('button', { name: 'National Trust Demo Collection (Fictional)' }))
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
    await user.type(screen.getByRole('textbox', { name: /Nearby origin/ }), 'Example')
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
      ...data.challenges.slice(1).map((challenge) => ({ ...challenge, plannedRoute: undefined })),
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
      ...data.challenges.slice(1).map((challenge) => ({ ...challenge, plannedRoute: undefined })),
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
    await user.click(screen.getByRole('button', { name: 'National Trust Demo Collection (Fictional)' }))
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
    expect(() =>
      act(() => {
        mapEvents.click!({})
        mapEvents.click!({ shapes: [{ getProperties: () => ({}) }] })
        mapEvents.click!({ shapes: [{ properties: { waypointId: 'unknown' } }] })
        mapEvents.click!({ shapes: [{ getProperties: () => ({ waypointId: waypoint.waypointId }) }] })
      }),
    ).not.toThrow()
    expect(mapEvents.popupContent).toHaveTextContent(
      `Waypoint${waypoint.title}Highest recorded award: SilverView waypointRecorded activities`,
    )
    expect(mapEvents.popupContent).not.toHaveTextContent('Not started')
    expect(mapEvents.popupContent?.querySelector('a[href="/activities/linked-activity"]')).toHaveTextContent(
      'Ridge walk',
    )
    expect(await screen.findByText('Selected waypoint.')).toBeInTheDocument()
    act(() => mapEvents.popupClose?.())
    expect(screen.queryByText('Selected waypoint.')).not.toBeInTheDocument()
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
    act(() => mapEvents.click!({ shapes: [{ getProperties: () => ({ waypointId: waypoint.waypointId }) }] }))
    const link = mapEvents.popupContent?.querySelector('a[href="/activities/linked-activity"]')
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
    act(() => mapEvents.click!({ shapes: [{ getProperties: () => ({ waypointId: waypoint.waypointId }) }] }))
    expect(mapEvents.popupContent).toHaveTextContent('No recorded activities yet')
    expect(mapEvents.popupContent?.querySelector('a')).toHaveAttribute('href', `/waypoints/${waypoint.waypointId}`)
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
      name: 'Independent garden visit',
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
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Activities' }))
    expect(() => {
      mapEvents.activityClick!({})
      mapEvents.activityClick!({ shapes: [{ properties: { activityId: 'unknown' } }] })
    }).not.toThrow()
    act(() => mapEvents.activityClick!({ shapes: [{ properties: { activityId: activity.activityId } }] }))
    expect(mapEvents.popupContent).toHaveTextContent('ActivityLinked garden visitRecorded award: Bronze')
    expect(mapEvents.popupContent).not.toHaveTextContent('Activity2026-08-10Bronze')
    act(() => mapEvents.activityClick!({ shapes: [{ properties: { activityId: unlinked.activityId } }] }))
    expect(mapEvents.popupContent).toHaveTextContent('ActivityIndependent garden visitNo linked waypoint')
    expect(mapEvents.popupContent?.querySelector('a')).toHaveAttribute('href', '/activities/unlinked')
  })

  it.each(['Feature', 'Shape'])('lists the waypoints inside an activated %s cluster', async (kind) => {
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
        shapes: [
          kind === 'Feature'
            ? {
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [-2.2, 51.8] },
                properties: { cluster_id: 42, point_count: 30 },
              }
            : { getCoordinates: () => [-2.2, 51.8], getProperties: () => ({ cluster_id: 42, point_count: 30 }) },
        ],
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
    expect(mapEvents.popupPosition).toEqual([-2.2, 51.8])
  })

  it.each(['Feature', 'Shape'])('lists the activities inside an activated %s cluster', async (kind) => {
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
      shapes: [
        kind === 'Feature'
          ? {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [-2.2, 51.8] },
              properties: { cluster_id: 43, point_count: 1 },
            }
          : { getCoordinates: () => [-2.2, 51.8], getProperties: () => ({ cluster_id: 43, point_count: 1 }) },
      ],
    })
    await vi.waitFor(() => expect(mapEvents.activityClusterLeaves).toHaveBeenCalledWith(43, 25, 0))
    await vi.waitFor(() => expect(mapEvents.popupContent).toBeDefined())
    expect(mapEvents.popupContent).toHaveTextContent('Activities here1 in this group')
    expect(mapEvents.popupContent?.querySelector('a')).toHaveAttribute('href', '/activities/activity-1')
    expect(mapEvents.popupContent?.querySelector('a')).toHaveTextContent('Clustered activity')
    expect(mapEvents.popupPosition).toEqual([-2.2, 51.8])
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
