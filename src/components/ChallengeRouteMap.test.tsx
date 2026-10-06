import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlannedRoute, Waypoint } from '../domain/visit'
import type { GpxMapLine } from '../domain/gpxMap'

const mapState = vi.hoisted(() => ({
  layerIds: [] as string[],
  sourceFeatures: new Map<string, unknown[]>(),
  cameraOptions: [] as unknown[],
  layerOptions: new Map<string, unknown>(),
  sourceInstances: new Map<string, unknown>(),
  created: vi.fn(),
  disposed: vi.fn(),
}))

vi.mock('azure-maps-control', () => {
  class DataSource {
    readonly id: string
    constructor(id: string) {
      this.id = id
    }
    add(features: unknown[]) {
      mapState.sourceFeatures.set(this.id, features)
    }
    clear() {
      mapState.sourceFeatures.set(this.id, [])
    }
  }
  class Layer {
    id: string
    constructor(_source: unknown, id: string, options: unknown) {
      this.id = id
      mapState.layerOptions.set(id, options)
    }
  }
  return {
    AuthenticationType: { anonymous: 'anonymous' },
    Map: class {
      constructor() {
        mapState.created()
      }
      events = { add: (_event: string, callback: () => void) => callback() }
      sources = {
        add: (sources: DataSource[]) => {
          for (const source of sources) mapState.sourceInstances.set(source.id, source)
        },
        getById: (id: string) => mapState.sourceInstances.get(id),
      }
      layers = {
        add: (layers: Layer[]) => {
          mapState.layerIds = layers.map((layer) => layer.id)
        },
      }
      setCamera = (options: unknown) => {
        mapState.cameraOptions.push(options)
      }
      dispose = mapState.disposed
    },
    source: { DataSource },
    layer: { LineLayer: Layer, BubbleLayer: Layer, SymbolLayer: Layer },
    data: {
      Feature: class {
        geometry: unknown
        properties?: unknown
        constructor(geometry: unknown, properties?: unknown) {
          this.geometry = geometry
          this.properties = properties
        }
      },
      LineString: class {
        coordinates: unknown
        constructor(coordinates: unknown) {
          this.coordinates = coordinates
        }
      },
      Point: class {
        coordinates: unknown
        constructor(coordinates: unknown) {
          this.coordinates = coordinates
        }
      },
      BoundingBox: {
        fromPositions: (positions: unknown[]) => ({ positions }),
      },
    },
  }
})

import { ChallengeRouteMap } from './ChallengeRouteMap'

const route: PlannedRoute = {
  fileName: 'route.gpx',
  geometry: {
    type: 'MultiLineString',
    coordinates: [
      [
        [-2.1, 51.1],
        [-2.2, 51.2],
      ],
      [
        [1, 54],
        [1.1, 54.1],
      ],
    ],
  },
}
const waypoint: Waypoint = {
  waypointId: 'waypoint-1',
  title: 'Route stop',
  description: 'A stop',
  category: 'Walk',
  tags: [],
  challengeIds: ['challenge-1'],
  completion: { mode: 'once' },
  location: { latitude: 51.15, longitude: -2.15 },
  referenceIds: [],
  photoReferenceIds: [],
}
const track: GpxMapLine = { id: 'activity-1', label: 'Recorded walk', segments: route.geometry.coordinates }

describe('ChallengeRouteMap', () => {
  beforeEach(() => {
    mapState.layerIds = []
    mapState.sourceFeatures.clear()
    mapState.cameraOptions = []
    mapState.layerOptions.clear()
    mapState.sourceInstances.clear()
    mapState.created.mockClear()
    mapState.disposed.mockClear()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ token: 'token', clientId: 'client' }), {
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )
  })

  it('renders route lines and linked Waypoints with distinct map layers', async () => {
    render(<ChallengeRouteMap plannedRoute={route} waypoints={[waypoint]} />)

    expect(await screen.findByLabelText('Challenge route map')).toBeInTheDocument()
    expect(screen.getByLabelText('Challenge map legend')).toHaveTextContent('Planned route')
    expect(screen.getByLabelText('Challenge map legend')).toHaveTextContent('Waypoints')
    await waitFor(() =>
      expect(mapState.layerIds).toEqual([
        'challenge-route-outline',
        'challenge-route-line',
        'challenge-track-outline',
        'challenge-track-lines',
        'challenge-waypoint-symbols',
        'challenge-waypoint-labels',
      ]),
    )
    await waitFor(() => expect(mapState.sourceFeatures.get('challenge-route')).toHaveLength(2))
    expect(mapState.sourceFeatures.get('challenge-waypoints')).toHaveLength(1)
    expect(mapState.layerOptions.get('challenge-route-line')).toMatchObject({
      strokeColor: '#e65100',
      strokeWidth: 7,
      strokeOpacity: 0.85,
    })
    expect(mapState.layerOptions.get('challenge-track-lines')).toMatchObject({
      strokeColor: '#1565c0',
      strokeWidth: 4,
      strokeDashArray: [2, 2],
      strokeOpacity: 0.85,
    })
    expect(mapState.layerOptions.get('challenge-route-outline')).toMatchObject({
      strokeColor: '#ffffff',
      strokeWidth: 10,
    })
    expect(mapState.layerOptions.get('challenge-track-outline')).toMatchObject({
      strokeColor: '#ffffff',
      strokeWidth: 7,
      strokeDashArray: [2, 2],
    })
    expect(mapState.cameraOptions).toEqual([
      {
        bounds: {
          positions: [
            [-2.1, 51.1],
            [-2.2, 51.2],
            [1, 54],
            [1.1, 54.1],
            [-2.15, 51.15],
          ],
        },
        padding: 40,
      },
    ])
  })

  it('centers the map when there is only one located waypoint', async () => {
    render(<ChallengeRouteMap waypoints={[waypoint]} />)

    await waitFor(() => expect(mapState.cameraOptions).toEqual([{ center: [-2.15, 51.15], zoom: 9 }]))
  })

  it('keeps overlapping planned and recorded segments distinguishable and toggles only tracks', async () => {
    const user = userEvent.setup()
    render(<ChallengeRouteMap plannedRoute={route} waypoints={[waypoint]} recordedTracks={[track]} />)

    const toggle = await screen.findByRole('checkbox', { name: 'Show recorded Activity tracks (1)' })
    await waitFor(() => expect(mapState.sourceFeatures.get('challenge-tracks')).toHaveLength(2))
    expect(toggle).toBeChecked()
    expect(screen.getByLabelText('Recorded Activity tracks')).toHaveTextContent('Recorded walk')
    expect(mapState.sourceFeatures.get('challenge-tracks')).toEqual([
      expect.objectContaining({ geometry: { coordinates: route.geometry.coordinates[0] } }),
      expect.objectContaining({ geometry: { coordinates: route.geometry.coordinates[1] } }),
    ])

    await user.click(toggle)
    expect(mapState.sourceFeatures.get('challenge-tracks')).toEqual([])
    expect(mapState.sourceFeatures.get('challenge-route')).toHaveLength(2)
    expect(mapState.sourceFeatures.get('challenge-waypoints')).toHaveLength(1)
    expect(screen.queryByLabelText('Recorded Activity tracks')).not.toBeInTheDocument()
    await user.click(toggle)
    expect(mapState.sourceFeatures.get('challenge-tracks')).toHaveLength(2)
    expect(mapState.created).toHaveBeenCalledTimes(1)
  })

  it('shows tracks without a planned route or located Waypoints and fits their extent', async () => {
    render(<ChallengeRouteMap waypoints={[]} recordedTracks={[track]} />)

    await waitFor(() => expect(mapState.sourceFeatures.get('challenge-tracks')).toHaveLength(2))
    expect(mapState.sourceFeatures.get('challenge-route')).toEqual([])
    expect(mapState.cameraOptions).toEqual([{ bounds: { positions: route.geometry.coordinates.flat() }, padding: 40 }])
  })

  it('updates geometry without recreating the map and disposes on unmount', async () => {
    const view = render(<ChallengeRouteMap plannedRoute={route} waypoints={[waypoint]} recordedTracks={[track]} />)
    await waitFor(() => expect(mapState.sourceFeatures.get('challenge-tracks')).toHaveLength(2))

    view.rerender(<ChallengeRouteMap waypoints={[]} recordedTracks={[]} />)
    expect(mapState.sourceFeatures.get('challenge-tracks')).toEqual([])
    expect(mapState.sourceFeatures.get('challenge-route')).toEqual([])
    expect(mapState.sourceFeatures.get('challenge-waypoints')).toEqual([])
    expect(screen.getByText("No recorded GPX tracks linked to this challenge's Waypoints.")).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(mapState.created).toHaveBeenCalledTimes(1)
    expect(mapState.disposed).not.toHaveBeenCalled()
    view.unmount()
    expect(mapState.disposed).toHaveBeenCalledTimes(1)
  })

  it('shows loading instead of an empty map while the token is pending', async () => {
    let finishRequest!: (response: Response) => void
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            finishRequest = resolve
          }),
      ),
    )
    render(<ChallengeRouteMap plannedRoute={route} waypoints={[waypoint]} />)

    expect(screen.getByRole('status')).toHaveTextContent('Loading challenge map…')
    expect(screen.queryByLabelText('Challenge route map')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Challenge map legend')).not.toBeInTheDocument()

    finishRequest(
      new Response(JSON.stringify({ token: 'token', clientId: 'client' }), {
        headers: { 'content-type': 'application/json' },
      }),
    )
    expect(await screen.findByLabelText('Challenge route map')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
