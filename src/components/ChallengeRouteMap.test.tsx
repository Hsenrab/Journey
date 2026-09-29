import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlannedRoute, Waypoint } from '../domain/visit'

const mapState = vi.hoisted(() => ({
  layerIds: [] as string[],
  sourceFeatures: new Map<string, unknown[]>(),
}))

vi.mock('azure-maps-control', () => {
  class DataSource {
    constructor(private id: string) {}
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
      dispose = vi.fn()
    },
    source: { DataSource },
    layer: { LineLayer: Layer, BubbleLayer: Layer, SymbolLayer: Layer },
    data: {
      Feature: class {
        constructor(
          public geometry: unknown,
          public properties?: unknown,
        ) {}
      },
      LineString: class {
        constructor(public coordinates: unknown) {}
      },
      Point: class {
        constructor(public coordinates: unknown) {}
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

    expect(screen.getByLabelText('Challenge route map')).toBeInTheDocument()
    expect(screen.getByLabelText('Challenge map legend')).toHaveTextContent('Planned route')
    expect(screen.getByLabelText('Challenge map legend')).toHaveTextContent('Waypoints')
    await waitFor(() =>
      expect(mapState.layerIds).toEqual([
        'challenge-route-line',
        'challenge-waypoint-symbols',
        'challenge-waypoint-labels',
      ]),
    )
    expect(mapState.sourceFeatures.get('challenge-route')).toHaveLength(1)
    expect(mapState.sourceFeatures.get('challenge-waypoints')).toHaveLength(1)
  })
})
