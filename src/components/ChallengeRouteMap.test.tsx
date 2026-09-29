import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Activity, GpxGeometry } from '../domain/visit'

const mapState = vi.hoisted(() => ({
  sources: new Map<string, { add: ReturnType<typeof vi.fn>; clear: ReturnType<typeof vi.fn> }>(),
  layers: [] as Array<{ id: string; options: Record<string, unknown> }>,
}))

vi.mock('azure-maps-control', () => ({
  AuthenticationType: { anonymous: 'anonymous' },
  Map: class {
    events = {
      add: (name: string, callback: () => void) => {
        if (name === 'ready') callback()
      },
    }
    sources = { add: vi.fn() }
    layers = { add: vi.fn() }
    setCamera = vi.fn()
    dispose = vi.fn()
  },
  source: {
    DataSource: class {
      add = vi.fn()
      clear = vi.fn()
      constructor(id: string) {
        mapState.sources.set(id, this)
      }
    },
  },
  layer: {
    LineLayer: class {
      constructor(_source: unknown, id: string, options: Record<string, unknown>) {
        mapState.layers.push({ id, options })
      }
    },
  },
  data: {
    Feature: class {
      constructor(..._args: unknown[]) {}
    },
    LineString: class {
      constructor(..._args: unknown[]) {}
    },
  },
}))

import { ChallengeRouteMap } from './ChallengeRouteMap'

const geometry: GpxGeometry = {
  segments: [
    {
      points: [
        { latitude: 51, longitude: -2 },
        { latitude: 51.1, longitude: -2.1 },
      ],
    },
  ],
}

function activity(activityId: string, name: string): Activity {
  return {
    activityId,
    name,
    waypointId: 'waypoint-1',
    ideaIds: [],
    date: '2026-09-01',
    location: { kind: 'coordinates', latitude: 51, longitude: -2 },
    recordedTrack: geometry,
    notes: '',
    referenceIds: [],
    photoReferenceIds: [],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  }
}

describe('ChallengeRouteMap', () => {
  beforeEach(() => {
    mapState.sources.clear()
    mapState.layers = []
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ token: 'token', clientId: 'client' }), {
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )
  })

  it('keeps the planned route visible while group and individual controls change recorded tracks', async () => {
    const user = userEvent.setup()
    render(
      <ChallengeRouteMap
        plannedRoute={geometry}
        activities={[activity('activity-1', 'Morning walk'), activity('activity-2', 'Evening walk')]}
      />,
    )

    expect(screen.getByText('Planned route — solid blue')).toBeInTheDocument()
    expect(screen.getByText('Recorded Activity — dashed red')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Show all recorded tracks' })).toBeChecked()
    await waitFor(() => expect(mapState.sources.get('challenge-recorded-tracks')?.add).toHaveBeenCalled())

    await user.click(screen.getByRole('checkbox', { name: 'Show all recorded tracks' }))
    expect(screen.getByRole('checkbox', { name: /Morning walk/ })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Evening walk/ })).not.toBeChecked()
    expect(mapState.sources.get('challenge-recorded-tracks')?.add).toHaveBeenLastCalledWith([])
    expect(mapState.sources.get('challenge-planned-route')?.add).toHaveBeenCalled()

    await user.click(screen.getByRole('checkbox', { name: /Morning walk/ }))
    expect(screen.getByRole('checkbox', { name: /Morning walk/ })).toBeChecked()
    expect(mapState.sources.get('challenge-recorded-tracks')?.add.mock.lastCall?.[0]).toHaveLength(1)
  })

  it('uses contrasting solid and dashed layers so overlapping geometry remains distinguishable', async () => {
    render(<ChallengeRouteMap plannedRoute={geometry} activities={[activity('activity-1', 'Morning walk')]} />)

    await waitFor(() => expect(mapState.layers).toHaveLength(3))
    expect(mapState.layers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'challenge-planned-route',
          options: expect.objectContaining({ strokeColor: '#1565c0', strokeWidth: 5 }),
        }),
        expect.objectContaining({
          id: 'challenge-recorded-tracks',
          options: expect.objectContaining({ strokeColor: '#c62828', strokeDashArray: [2, 2] }),
        }),
      ]),
    )
  })

  it('shows useful empty states without requesting a map token', () => {
    render(<ChallengeRouteMap activities={[]} />)

    expect(screen.getByText('No planned route or recorded Activity tracks are available.')).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('shows recorded tracks when the Challenge has no planned route', () => {
    render(<ChallengeRouteMap activities={[activity('activity-1', 'Morning walk')]} />)

    expect(screen.getByRole('alert')).toHaveTextContent('This Challenge does not have a planned route.')
    expect(screen.getByRole('checkbox', { name: /Morning walk/ })).toBeChecked()
  })
})
