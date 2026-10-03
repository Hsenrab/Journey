import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WaypointsProvider } from '../features/journey/JourneyContext'
import { createDefaultData, createDemoModeData, save, setDataMode } from '../services/storage'
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
      {`${plannedRoute?.fileName ?? 'No route'} · ${waypoints.length} waypoints`}
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

describe('ChallengeDetails', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('shows the Challenge Waypoints and empty route state', () => {
    const data = createDefaultData()
    renderDetails()

    expect(screen.getByRole('heading', { name: 'National Trust' })).toBeInTheDocument()
    expect(screen.getByText('No planned GPX route attached.')).toBeInTheDocument()
    expect(screen.getByTestId('challenge-map')).toHaveTextContent(`${data.waypoints.length} waypoints`)
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

  it('shows the no-tracks state when no map features are available', () => {
    const data = createDefaultData()
    data.waypoints = data.waypoints.map((waypoint) => ({ ...waypoint, location: undefined }))
    save(data)
    renderDetails()

    expect(screen.queryByTestId('challenge-map')).not.toBeInTheDocument()
    expect(screen.getByText("No recorded GPX tracks linked to this challenge's Waypoints.")).toBeInTheDocument()
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
    expect(await screen.findByText(/planned.gpx · Ready to save/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save route' }))
    expect(await screen.findByText('Planned route saved.')).toBeInTheDocument()

    view.unmount()
    renderDetails()
    expect(screen.getByText('planned.gpx')).toBeInTheDocument()
    expect(screen.getByTestId('challenge-map')).toHaveTextContent('planned.gpx')
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
    expect(screen.getByText('saved.gpx')).toBeInTheDocument()
    expect(screen.getByTestId('challenge-map')).toHaveTextContent('saved.gpx')
  })

  it('allows retrying a corrected GPX file with the same name', async () => {
    const user = userEvent.setup()
    const view = renderDetails()
    const input = view.container.querySelector('input[type="file"]') as HTMLInputElement

    await user.upload(input, new File(['<gpx>'], 'planned.gpx', { type: 'application/gpx+xml' }))
    expect(await screen.findByText('The selected file is not valid XML.')).toBeInTheDocument()

    await user.upload(input, new File([validGpx], 'planned.gpx', { type: 'application/gpx+xml' }))
    expect(await screen.findByText(/planned.gpx · Ready to save/)).toBeInTheDocument()
  })

  it('blocks saving and editing a previous draft while a replacement is being parsed', async () => {
    const user = userEvent.setup()
    const view = renderDetails()
    const input = view.container.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, new File([validGpx], 'first.gpx', { type: 'application/gpx+xml' }))
    await screen.findByText(/first.gpx · Ready to save/)

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
    expect(screen.getByText(/first.gpx · Ready to save/)).toBeInTheDocument()

    finishRead(validGpx)
    expect(await screen.findByText(/second.gpx · Ready to save/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save route' })).toBeEnabled()
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
    expect(await screen.findByText(/second.gpx · Ready to save/)).toBeInTheDocument()

    await act(async () => finishFirst(validGpx))
    expect(screen.getByText(/second.gpx · Ready to save/)).toBeInTheDocument()
    expect(screen.queryByText(/first.gpx/)).not.toBeInTheDocument()
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
    expect(screen.getByText('No planned GPX route attached.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save route' }))
    await waitFor(() => expect(screen.getByText('Planned route removed.')).toBeInTheDocument())
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
    await screen.findByRole('heading', { name: 'National Trust' })
    const input = view.container.querySelector('input[type="file"]')
    fireEvent.change(input as HTMLInputElement, {
      target: { files: [new File([validGpx], 'replacement.gpx', { type: 'application/gpx+xml' })] },
    })
    await screen.findByText(/replacement.gpx · Ready to save/)
    await user.click(screen.getByRole('button', { name: 'Save route' }))

    expect(await screen.findByText(/Journey API request failed with 500/)).toBeInTheDocument()
    expect(screen.getByText(/replacement.gpx · Ready to save/)).toBeInTheDocument()
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
    await screen.findByRole('heading', { name: 'National Trust' })
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
