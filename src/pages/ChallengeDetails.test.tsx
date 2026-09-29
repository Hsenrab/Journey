import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WaypointsProvider } from '../features/journey/JourneyContext'
import { createDefaultData, createDemoModeData, save, setDataMode } from '../services/storage'
import ChallengeDetails from './ChallengeDetails'

vi.mock('../components/ChallengeRouteMap', () => ({
  ChallengeRouteMap: ({ plannedRoute, waypoints }: { plannedRoute?: { fileName: string }; waypoints: unknown[] }) => (
    <div data-testid="challenge-map">{`${plannedRoute?.fileName ?? 'No route'} · ${waypoints.length} waypoints`}</div>
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
})
