import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlannedRoute, Waypoint } from '../domain/visit'

const mapState = vi.hoisted(() => ({
  layerIds: [] as string[],
  sourceFeatures: new Map<string, unknown[]>(),
  cameraOptions: [] as unknown[],
}))

vi.mock('azure-maps-control', () => {
  class DataSource {
    private id: string
    constructor(id: string) {
      this.id = id
    }
    add(features: unknown[]) {
      mapState.sourceFeatures.set(this.id, features)
    }
  }
  class Layer {
    id: string
    constructor(_source: unknown, id: string) {
      this.id = id
    }
  }
  return {
    AuthenticationType: { anonymous: 'anonymous' },
    Map: class {
      events = { add: (_event: string, callback: () => void) => callback() }
      sources = { add: vi.fn() }
      layers = {
        add: (layers: Layer[]) => {
          mapState.layerIds = layers.map((layer) => layer.id)
        },
      }
      setCamera = (options: unknown) => {
        mapState.cameraOptions.push(options)
      }
      dispose = vi.fn()
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

describe('ChallengeRouteMap', () => {
  beforeEach(() => {
    mapState.layerIds = []
    mapState.sourceFeatures.clear()
    mapState.cameraOptions = []
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
        'challenge-route-line',
        'challenge-waypoint-symbols',
        'challenge-waypoint-labels',
      ]),
    )
    expect(mapState.sourceFeatures.get('challenge-route')).toHaveLength(2)
    expect(mapState.sourceFeatures.get('challenge-waypoints')).toHaveLength(1)
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
