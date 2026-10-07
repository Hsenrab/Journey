import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WaypointsProvider } from '../features/journey/JourneyContext'
import { createDemoModeData, load, save, setDataMode } from '../services/storage'
import ChallengeDetails from './ChallengeDetails'
import type { GpxMapLine } from '../domain/gpxMap'

vi.mock('../components/ChallengeRouteMap', () => ({
  ChallengeRouteMap: ({
    plannedRoute,
    waypoints,
    recordedTracks,
  }: {
    plannedRoute?: { fileName: string }
    waypoints: unknown[]
    recordedTracks: GpxMapLine[]
  }) => (
    <div data-testid="challenge-map">
      {`${plannedRoute ? 'Route attached' : 'No route'} · ${waypoints.length} waypoints`}
      {recordedTracks.map((track) => (
        <span key={track.id}>{track.label}</span>
      ))}
    </div>
  ),
}))

function renderDetails(challengeId = 'national-trust') {
  return render(
    <MemoryRouter initialEntries={[`/challenges/${challengeId}`]}>
      <WaypointsProvider>
        <Routes>
          <Route path="/challenges/:challengeId" element={<ChallengeDetails />} />
        </Routes>
      </WaypointsProvider>
    </MemoryRouter>,
  )
}

const validGpx = '<gpx><trk><trkseg><trkpt lat="51.1" lon="-2.1"/><trkpt lat="51.2" lon="-2.2"/></trkseg></trk></gpx>'
const createDefaultData = createDemoModeData

describe('ChallengeDetails', () => {
  beforeEach(() => {
    localStorage.clear()
    save(createDemoModeData())
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('shows the Challenge Waypoints and only the attach action when no route is present', () => {
    const data = createDefaultData()
    renderDetails()

    expect(screen.getByRole('heading', { name: 'National Trust Demo Collection (Fictional)' })).toBeInTheDocument()
    expect(screen.queryByText('No planned GPX route attached.')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Planned route' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Attach GPX route' })).toBeInTheDocument()
    expect(screen.getByTestId('challenge-map')).toHaveTextContent(
      `${data.challenges[0]!.waypointIds.length} waypoints`,
    )
    expect(screen.getAllByRole('link', { name: 'View waypoint' })[0]).toHaveAttribute(
      'href',
      `/waypoints/${data.waypoints[0]?.waypointId}`,
    )
  })

  it('does not show the map when linked Waypoints only have one coordinate', () => {
    const data = createDefaultData()
    data.waypoints = data.waypoints.map((waypoint) => ({
      ...waypoint,
      location: { latitude: 51.1 },
    }))
    save(data)
    renderDetails()

    expect(screen.queryByTestId('challenge-map')).not.toBeInTheDocument()
  })

  it('keeps only the attach action when there are no map features or GPX data', () => {
    const data = createDefaultData()
    data.waypoints = data.waypoints.map((waypoint) => ({ ...waypoint, location: undefined }))
    save(data)
    renderDetails()

    expect(screen.queryByTestId('challenge-map')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Attach GPX route' })).toBeInTheDocument()
    expect(screen.queryByText("No recorded GPX tracks linked to this challenge's Waypoints.")).not.toBeInTheDocument()
  })

  it('shows linked Activity tracks even without a planned route or located Waypoints', () => {
    const data = createDefaultData()
    data.waypoints = data.waypoints.map((waypoint) => ({ ...waypoint, location: undefined }))
    const activity = {
      ...createDemoModeData().activities[0]!,
      waypointId: data.waypoints[0]!.waypointId,
      referenceIds: [],
      photoReferenceIds: [],
      ideaIds: [],
      recordedTrack: {
        type: 'MultiLineString' as const,
        coordinates: [
          [
            [-2.1, 51.1],
            [-2.2, 51.2],
          ],
        ] as [number, number][][],
      },
    }
    data.activities = [
      { ...activity, activityId: 'linked', name: 'Linked walk' },
      { ...activity, activityId: 'unlinked', name: 'Unlinked walk', waypointId: undefined },
    ]
    save(data)
    renderDetails()

    expect(screen.getByTestId('challenge-map')).toHaveTextContent('No route')
    expect(screen.getByTestId('challenge-map')).toHaveTextContent('Linked walk')
    expect(screen.getByTestId('challenge-map')).not.toHaveTextContent('Unlinked walk')
  })

  it('attaches, saves, and reloads a planned GPX route', async () => {
    const user = userEvent.setup()
    const view = renderDetails()
    const input = view.container.querySelector('input[type="file"]')
    expect(input).not.toBeNull()

    await user.upload(input as HTMLInputElement, new File([validGpx], 'planned.gpx', { type: 'application/gpx+xml' }))
    expect(await screen.findByRole('button', { name: 'Save route' })).toBeInTheDocument()
    expect(screen.queryByText('planned.gpx')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save route' }))
    expect(await screen.findByText('Planned route saved.')).toBeInTheDocument()

    view.unmount()
    renderDetails()
    expect(screen.getByTestId('challenge-map')).toHaveTextContent('Route attached')
    expect(screen.queryByRole('heading', { name: 'Planned route' })).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'GPX route actions' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Replace GPX route' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove route' })).toBeInTheDocument()
    expect(screen.queryByText('planned.gpx')).not.toBeInTheDocument()
  })

  it('keeps the saved route when a replacement file is invalid', async () => {
    const user = userEvent.setup()
    const data = createDefaultData()
    data.challenges[0] = {
      ...data.challenges[0]!,
      plannedRoute: {
        fileName: 'saved.gpx',
        geometry: {
          type: 'MultiLineString',
          coordinates: [
            [
              [-2.1, 51.1],
              [-2.2, 51.2],
            ],
          ],
        },
      },
    }
    save(data)
    const view = renderDetails()

    const input = view.container.querySelector('input[type="file"]')
    await user.upload(input as HTMLInputElement, new File(['<gpx>'], 'broken.gpx', { type: 'application/gpx+xml' }))

    expect(await screen.findByText('The selected file is not valid XML.')).toBeInTheDocument()
    expect(screen.getByTestId('challenge-map')).toHaveTextContent('Route attached')
    expect(screen.queryByText('saved.gpx')).not.toBeInTheDocument()
  })

  it('allows retrying a corrected GPX file with the same name', async () => {
    const user = userEvent.setup()
    const view = renderDetails()
    const input = view.container.querySelector('input[type="file"]') as HTMLInputElement

    await user.upload(input, new File(['<gpx>'], 'planned.gpx', { type: 'application/gpx+xml' }))
    expect(await screen.findByText('The selected file is not valid XML.')).toBeInTheDocument()

    await user.upload(input, new File([validGpx], 'planned.gpx', { type: 'application/gpx+xml' }))
    expect(await screen.findByRole('button', { name: 'Save route' })).toBeInTheDocument()
  })

  it('blocks saving and editing a previous draft while a replacement is being parsed', async () => {
    const user = userEvent.setup()
    const view = renderDetails()
    const input = view.container.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, new File([validGpx], 'first.gpx', { type: 'application/gpx+xml' }))
    await screen.findByRole('button', { name: 'Save route' })

    let finishRead!: (contents: string) => void
    const replacement = new File([validGpx], 'second.gpx', { type: 'application/gpx+xml' })
    vi.spyOn(replacement, 'text').mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          finishRead = resolve
        }),
    )
    fireEvent.change(input, { target: { files: [replacement] } })

    expect(screen.getByRole('button', { name: 'Save route' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove route' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Replace GPX route' })).toHaveAttribute('aria-disabled', 'true')
    expect(input).toBeDisabled()

    finishRead(validGpx)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save route' })).toBeEnabled())
  })

  it('ignores an earlier GPX read that finishes after a newer selection', async () => {
    const view = renderDetails()
    const input = view.container.querySelector('input[type="file"]') as HTMLInputElement
    let finishFirst!: (contents: string) => void
    const first = new File([validGpx], 'first.gpx')
    vi.spyOn(first, 'text').mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          finishFirst = resolve
        }),
    )
    fireEvent.change(input, { target: { files: [first] } })

    const second = new File([validGpx], 'second.gpx')
    fireEvent.change(input, { target: { files: [second] } })
    expect(await screen.findByRole('button', { name: 'Save route' })).toBeInTheDocument()

    await act(async () => finishFirst(validGpx))
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Save route' }))
    await screen.findByText('Planned route saved.')
    expect(load().challenges[0]?.plannedRoute?.fileName).toBe('second.gpx')
  })

  it('removes and persists a planned route only after saving', async () => {
    const user = userEvent.setup()
    const data = createDefaultData()
    data.challenges[0] = {
      ...data.challenges[0]!,
      plannedRoute: {
        fileName: 'saved.gpx',
        geometry: {
          type: 'MultiLineString',
          coordinates: [
            [
              [-2.1, 51.1],
              [-2.2, 51.2],
            ],
          ],
        },
      },
    }
    save(data)
    renderDetails()

    await user.click(screen.getByRole('button', { name: 'Remove route' }))
    expect(screen.queryByRole('button', { name: 'Attach GPX route' })).not.toBeInTheDocument()
    expect(screen.queryByText('No planned GPX route attached.')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save route' }))
    await waitFor(() => expect(screen.getByText('Planned route removed.')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Attach GPX route' })).toBeInTheDocument()
  })

  it('shows an explicit read-only state without route controls', () => {
    setDataMode('demo-local')
    const challenge = createDemoModeData().challenges[0]!
    renderDetails(challenge.challengeId)

    expect(screen.getByText(/Demo local data is bundled sample data/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /GPX route/ })).not.toBeInTheDocument()
  })

  it('keeps a valid replacement ready when saving fails', async () => {
    setDataMode('demo-cosmos')
    const data = createDefaultData()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
        init?.method === 'POST'
          ? new Response('Unavailable', { status: 500, statusText: 'Server Error' })
          : new Response(JSON.stringify({ data, etags: {}, role: 'admin' }), {
              headers: { 'content-type': 'application/json' },
            }),
      ),
    )
    const user = userEvent.setup()
    const view = renderDetails()
    await screen.findByRole('heading', { name: 'National Trust Demo Collection (Fictional)' })
    const input = view.container.querySelector('input[type="file"]')
    fireEvent.change(input as HTMLInputElement, {
      target: { files: [new File([validGpx], 'replacement.gpx', { type: 'application/gpx+xml' })] },
    })
    await screen.findByRole('button', { name: 'Save route' })
    await user.click(screen.getByRole('button', { name: 'Save route' }))

    expect(await screen.findByText(/Journey API request failed with 500/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save route' })).toBeInTheDocument()
    expect(screen.queryByText('replacement.gpx')).not.toBeInTheDocument()
  })

  it('disables route editing while saving', async () => {
    setDataMode('demo-cosmos')
    const data = createDefaultData()
    let resolveSave!: (response: Response) => void
    const saveRequest = new Promise<Response>((resolve) => {
      resolveSave = resolve
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
        init?.method === 'POST'
          ? saveRequest
          : new Response(JSON.stringify({ data, etags: {}, role: 'admin' }), {
              headers: { 'content-type': 'application/json' },
            }),
      ),
    )
    const user = userEvent.setup()
    const view = renderDetails()
    await screen.findByRole('heading', { name: 'National Trust Demo Collection (Fictional)' })
    const input = view.container.querySelector('input[type="file"]') as HTMLInputElement

    await user.upload(input, new File([validGpx], 'planned.gpx', { type: 'application/gpx+xml' }))
    await user.click(screen.getByRole('button', { name: 'Save route' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save route' })).toBeDisabled()
    })
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Replace GPX route' })).toHaveAttribute('aria-disabled', 'true')
    expect(input).toBeDisabled()

    resolveSave(
      new Response(JSON.stringify({ data, etags: {}, role: 'admin' }), {
        headers: { 'content-type': 'application/json' },
      }),
    )
    expect(await screen.findByText('Planned route saved.')).toBeInTheDocument()
  })
})
