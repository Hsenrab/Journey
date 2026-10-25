import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useNavigate } from 'react-router-dom'
import { MemoryRouter } from '../test/DataMemoryRouter'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WaypointsProvider, useWaypoints } from '../features/journey/JourneyContext'
import { createDefaultData as emptyData, createDemoModeData, load, save, setDataMode } from '../services/storage'
import ChallengeDetails from './ChallengeDetails'
import type { GpxMapLine } from '../domain/gpxMap'
import { Layout } from '../components/Layout'
import Settings from './Settings'
import LocationDetails from './LocationDetails'
import type { Activity, WaypointsData } from '../domain/visit'

function progressData(): WaypointsData {
  return {
    ...emptyData(),
    challenges: ['first', 'second'].map((challengeId) => ({
      challengeId,
      title: `${challengeId} challenge`,
      description: 'Synthetic progress fixture',
      supportsActivityCategories: true,
    })),
    waypoints: ['once', 'counted', 'other'].map((waypointId) => ({
      waypointId,
      title: `${waypointId} waypoint`,
      description: `${waypointId} description`,
      category: 'Walk',
      tags: [],
      challengeIds: ['first', 'second'],
      completion: waypointId === 'counted' ? { mode: 'count', target: 5 } : { mode: 'once' },
      referenceIds: [],
      photoReferenceIds: [],
    })),
  }
}

function progressActivity(activityId: string, waypointId?: string): Activity {
  return {
    name: 'Recorded activity',
    activityId,
    waypointId,
    challengeId: 'second',
    ideaIds: [],
    date: '2026-01-01',
    location: { kind: 'coordinates', latitude: 51, longitude: -2 },
    notes: '',
    referenceIds: [],
    photoReferenceIds: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

function member(title: string) {
  const card = screen.getByRole('heading', { name: title }).closest('.MuiCard-root')
  if (!(card instanceof HTMLElement)) throw new Error(`Missing member card: ${title}`)
  return within(card)
}

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

function SwitchMode() {
  const { setDataMode } = useWaypoints()
  return <button onClick={() => void setDataMode('demo-local')}>Switch mode</button>
}

function renderDetails(challengeId = 'national-trust', controls = false) {
  return render(
    <MemoryRouter initialEntries={[`/challenges/${challengeId}`]}>
      <WaypointsProvider>
        {controls ? (
          <Layout>
            <SwitchMode />
            <Routes>
              <Route path="/challenges/:challengeId" element={<ChallengeDetails />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Layout>
        ) : (
          <Routes>
            <Route path="/challenges/:challengeId" element={<ChallengeDetails />} />
          </Routes>
        )}
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
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it.each([false, true])('does not invent progress for missing Challenge=%s or empty membership', (missing) => {
    const data = progressData()
    data.waypoints = []
    save(data)
    renderDetails(missing ? 'missing' : 'first')
    expect(
      screen.getByText(missing ? 'Challenge not found.' : 'No waypoints linked to this challenge.'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/^Completion:/)).not.toBeInTheDocument()
  })

  it('distinguishes loading and failed Production data from missing members without progress', async () => {
    vi.stubEnv('MODE', 'production')
    let finish!: (response: Response) => void
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve
          }),
      ),
    )
    renderDetails('first')
    expect(screen.getByText('Loading challenge…')).toBeInTheDocument()
    expect(screen.queryByText(/^Completion:/)).not.toBeInTheDocument()
    await act(async () => {
      finish(
        new Response(JSON.stringify({ error: 'Synthetic load failure' }), {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'content-type': 'application/json' },
        }),
      )
    })
    expect(
      await screen.findByText(
        'Production data could not be loaded. Check the Journey API and Cosmos configuration: Journey API request failed with 503: Service Unavailable: Synthetic load failure',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('This is a load failure, not a missing challenge.')).toBeInTheDocument()
    expect(screen.queryByText('Challenge not found.')).not.toBeInTheDocument()
    expect(screen.queryByText(/^Completion:/)).not.toBeInTheDocument()
  })

  it.each([0, 1, 3])('shows once completion for %i Activities on the correct card', (count) => {
    const data = progressData()
    data.activities = Array.from({ length: count }, (_, i) => progressActivity(`once-${i}`, 'once'))
    save(data)
    renderDetails('first')
    expect(member('once waypoint').getByText(`Completion: ${count ? 'Done' : 'Not done'}`)).toBeInTheDocument()
    expect(member('other waypoint').getByText('Completion: Not done')).toBeInTheDocument()
    expect(member('once waypoint').getByText('once description')).toBeInTheDocument()
    expect(member('once waypoint').getByRole('link', { name: 'View waypoint' })).toHaveAttribute(
      'href',
      '/waypoints/once',
    )
    expect(screen.getAllByRole('link', { name: 'View waypoint' }).map((link) => link.getAttribute('href'))).toEqual([
      '/waypoints/once',
      '/waypoints/counted',
      '/waypoints/other',
    ])
  })

  it.each([
    { count: 0, target: 5 },
    { count: 2, target: 5 },
    { count: 5, target: 5 },
    { count: 7, target: 5 },
    { count: 0, target: 1 },
  ])('shows count $count of $target with explicit completion', ({ count, target }) => {
    const data = progressData()
    data.waypoints[1]!.completion = { mode: 'count', target }
    data.activities = Array.from({ length: count }, (_, i) => progressActivity(`count-${i}`, 'counted'))
    save(data)
    renderDetails('first')
    const card = member('counted waypoint')
    expect(
      card.getByText(`Completion: ${count} of ${target} ${target === 1 ? 'activity' : 'activities'}`),
    ).toBeInTheDocument()
    expect(card.getByText(count >= target ? 'Done' : 'Not done', { exact: true })).toBeInTheDocument()
  })

  it('counts only linked Activities regardless of category, date or direct Challenge link in overlapping views', () => {
    const data = progressData()
    data.activities = [
      progressActivity('linked', 'counted'),
      { ...progressActivity('awarded', 'counted'), category: 'gold', date: '2024-01-01' },
      progressActivity('direct-only'),
      progressActivity('elsewhere', 'other'),
    ]
    save(data)
    const first = renderDetails('first')
    expect(member('counted waypoint').getByText('Completion: 2 of 5 activities')).toBeInTheDocument()
    first.unmount()
    const second = renderDetails('second')
    expect(member('counted waypoint').getByText('Completion: 2 of 5 activities')).toBeInTheDocument()
    second.unmount()
    render(
      <MemoryRouter initialEntries={['/waypoints/counted']}>
        <WaypointsProvider>
          <Routes>
            <Route path="/waypoints/:id" element={<LocationDetails />} />
          </Routes>
        </WaypointsProvider>
      </MemoryRouter>,
    )
    expect(screen.getByText('Completion: 2 of 5 activities')).toBeInTheDocument()
  })

  it.each(['admin', 'viewer'] as const)(
    'recalculates loaded progress without extra reads or writes for %s',
    async (role) => {
      vi.stubEnv('MODE', 'production')
      let data = progressData()
      const fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ data, etags: {}, role }))))
      vi.stubGlobal('fetch', fetch)
      const storageWrite = vi.spyOn(Storage.prototype, 'setItem')
      let context!: ReturnType<typeof useWaypoints>
      let navigate!: ReturnType<typeof useNavigate>
      function Controls() {
        context = useWaypoints()
        navigate = useNavigate()
        return <button onClick={() => void context.reload()}>Reload data</button>
      }
      const page = () => (
        <MemoryRouter initialEntries={['/challenges/first']}>
          <WaypointsProvider>
            <Controls />
            <Routes>
              <Route path="/challenges/:challengeId" element={<ChallengeDetails />} />
              <Route path="/waypoints/:id" element={<LocationDetails />} />
            </Routes>
          </WaypointsProvider>
        </MemoryRouter>
      )
      const view = render(page())
      await screen.findByText('Completion: 0 of 5 activities')
      expect(fetch).toHaveBeenCalledTimes(1)
      view.rerender(page())
      expect(fetch).toHaveBeenCalledTimes(1)
      const added = Array.from({ length: 5 }, (_, index) => progressActivity(`added-${index}`, 'counted'))
      const stages = [
        { activities: [], count: 0, otherDone: false },
        { activities: added, count: 5, otherDone: false },
        { activities: [{ ...added[0], waypointId: 'other' }, ...added.slice(1)], count: 4, otherDone: true },
        { activities: [], count: 0, otherDone: false },
      ]
      for (const [index, stage] of stages.entries()) {
        if (index > 0) {
          data = { ...data, activities: stage.activities }
          await act(async () => {
            await context.reload()
          })
        }
        const countLabel = `Completion: ${stage.count} of 5 activities`
        const otherLabel = `Completion: ${stage.otherDone ? 'Done' : 'Not done'}`
        for (const challengeId of ['first', 'second']) {
          await act(async () => {
            await navigate(`/challenges/${challengeId}`)
          })
          expect(member('counted waypoint').getByText(countLabel, { exact: true })).toBeInTheDocument()
          expect(
            member('counted waypoint').getByText(stage.count >= 5 ? 'Done' : 'Not done', { exact: true }),
          ).toBeInTheDocument()
          expect(member('other waypoint').getByText(otherLabel, { exact: true })).toBeInTheDocument()
        }
        for (const [waypointId, label] of [
          ['counted', countLabel],
          ['other', otherLabel],
        ]) {
          await act(async () => {
            await navigate(`/waypoints/${waypointId}`)
          })
          expect(screen.getByText(label, { exact: true })).toBeInTheDocument()
        }
        await act(async () => {
          await navigate('/challenges/first')
        })
        expect(fetch).toHaveBeenCalledTimes(index + 1)
      }
      expect(fetch).toHaveBeenCalledTimes(4)
      expect(storageWrite).not.toHaveBeenCalled()
      if (role === 'admin') expect(screen.getByRole('button', { name: 'Attach GPX route' })).toBeInTheDocument()
      else expect(screen.queryByRole('button', { name: 'Attach GPX route' })).not.toBeInTheDocument()
      await act(async () => {
        await context.setDataMode('demo-local')
      })
      expect(screen.getByText('Challenge not found.')).toBeInTheDocument()
      expect(fetch).toHaveBeenCalledTimes(4)
      expect(storageWrite.mock.calls.filter(([key]) => key === 'waypoints-v1')).toEqual([])
    },
  )

  it('shows identical per-member Demo progress for admin, viewer, Demo local and warned fallback without writes', async () => {
    vi.stubEnv('MODE', 'production')
    const data = createDemoModeData()
    const baseline = new Map<string, { waypointId: string; labels: (string | null)[] }[]>()
    for (const scenario of ['admin', 'viewer', 'demo-local', 'fallback'] as const) {
      setDataMode(scenario === 'demo-local' ? 'demo-local' : 'demo-cosmos')
      const fetch = vi.fn(() =>
        Promise.resolve(
          scenario === 'fallback'
            ? new Response(JSON.stringify({ error: 'Demo unavailable' }), {
                status: 503,
                headers: { 'content-type': 'application/json' },
              })
            : new Response(JSON.stringify({ data, etags: {}, role: scenario === 'viewer' ? 'viewer' : 'admin' })),
        ),
      )
      vi.stubGlobal('fetch', fetch)
      const write = vi.spyOn(Storage.prototype, 'setItem')
      let navigate!: ReturnType<typeof useNavigate>
      function Controls() {
        navigate = useNavigate()
        return null
      }
      const view = render(
        <MemoryRouter initialEntries={[`/challenges/${data.challenges[0].challengeId}`]}>
          <WaypointsProvider>
            <Controls />
            <Routes>
              <Route path="/challenges/:challengeId" element={<ChallengeDetails />} />
            </Routes>
          </WaypointsProvider>
        </MemoryRouter>,
      )
      await screen.findByRole('heading', { name: data.challenges[0].title })
      for (const challenge of data.challenges) {
        await act(async () => {
          await navigate(`/challenges/${challenge.challengeId}`)
        })
        const members = data.waypoints.filter((waypoint) => waypoint.challengeIds.includes(challenge.challengeId))
        expect(screen.queryAllByRole('link', { name: 'View waypoint' })).toHaveLength(members.length)
        const progress = members.map((waypoint) => {
          const card = member(waypoint.title)
          expect(card.getAllByText(/^Completion:/)).toHaveLength(1)
          if (waypoint.completion.mode === 'count') expect(card.getAllByText(/^(Done|Not done)$/)).toHaveLength(1)
          return {
            waypointId: waypoint.waypointId,
            labels: card.getAllByText(/^Completion:|^(Done|Not done)$/).map((label) => label.textContent),
          }
        })
        if (scenario === 'admin') baseline.set(challenge.challengeId, progress)
        else expect(progress).toEqual(baseline.get(challenge.challengeId))
        if (scenario === 'admin') expect(screen.getByRole('group', { name: 'GPX route actions' })).toBeInTheDocument()
        else {
          expect(screen.queryByRole('group', { name: 'GPX route actions' })).not.toBeInTheDocument()
          expect(screen.getByText('Read-only mode')).toBeInTheDocument()
        }
        if (scenario === 'fallback')
          expect(screen.getByText(/Demo Cosmos data could not be loaded/)).toBeInTheDocument()
        expect(fetch).toHaveBeenCalledTimes(scenario === 'demo-local' ? 0 : 1)
      }
      expect(write).not.toHaveBeenCalled()
      view.unmount()
      write.mockRestore()
    }
  })

  it('protects removal drafts on the Settings path, confirms once, and unregisters after saving', async () => {
    const data = createDefaultData()
    data.challenges[0]!.plannedRoute = {
      fileName: 'saved.gpx',
      geometry: {
        type: 'MultiLineString',
        coordinates: [
          [
            [-2, 51],
            [-2.1, 51.1],
          ],
        ],
      },
    }
    save(data)
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderDetails('national-trust', true)
    await user.click(screen.getByRole('button', { name: 'Remove route' }))
    await user.click(screen.getByRole('link', { name: 'Settings' }))
    expect(screen.getByRole('button', { name: 'Save route' })).toBeInTheDocument()
    expect(confirm).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: 'Save route' }))
    await screen.findByText('Planned route removed.')
    await user.click(screen.getByRole('link', { name: 'Settings' }))
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(confirm).toHaveBeenCalledOnce()
  })

  it('ignores unchanged route selections and retains failed route drafts until confirmed discard', async () => {
    vi.stubEnv('MODE', 'production')
    const data = createDefaultData()
    const route = {
      fileName: 'same.gpx',
      geometry: {
        type: 'MultiLineString' as const,
        coordinates: [
          [
            [-2.1, 51.1],
            [-2.2, 51.2],
          ],
        ] as [number, number][][],
      },
    }
    data.challenges[0]!.plannedRoute = route
    const fetch = vi
      .fn()
      .mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ data, etags: {}, role: 'admin' }))))
    vi.stubGlobal('fetch', fetch)
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const view = renderDetails('national-trust', true)
    await screen.findByRole('button', { name: 'Replace GPX route' })
    const file = new File([validGpx], 'same.gpx', { type: 'application/gpx+xml' })
    Object.defineProperty(file, 'text', { value: () => Promise.resolve(validGpx) })
    fireEvent.change(view.container.querySelector('input[type="file"]')!, { target: { files: [file] } })
    await screen.findByRole('button', { name: 'Save route' })
    await user.click(screen.getByRole('link', { name: 'Settings' }))
    expect(confirm).not.toHaveBeenCalled()
    view.unmount()
    const second = renderDetails('national-trust', true)
    await user.click(await screen.findByRole('button', { name: 'Remove route' }))
    fetch.mockRejectedValueOnce(new Error('Route write denied'))
    await user.click(screen.getByRole('button', { name: 'Save route' }))
    expect(await screen.findByText('Route write denied')).toBeInTheDocument()
    await user.click(screen.getByText('Switch mode'))
    expect(screen.getByRole('button', { name: 'Save route' })).toBeInTheDocument()
    expect(confirm).toHaveBeenCalledOnce()
    confirm.mockReturnValue(true)
    await user.click(screen.getByText('Switch mode'))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save route' })).not.toBeInTheDocument())
    second.unmount()
  })

  it('discards a pending GPX read without allowing its result to resurrect the route draft', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const view = renderDetails('national-trust', true)
    let finish!: (text: string) => void
    const reading = new Promise<string>((resolve) => {
      finish = resolve
    })
    const file = new File([], 'pending.gpx', { type: 'application/gpx+xml' })
    Object.defineProperty(file, 'text', { value: () => reading })
    fireEvent.change(view.container.querySelector('input[type="file"]')!, { target: { files: [file] } })
    await user.click(screen.getByText('Switch mode'))
    expect(confirm).toHaveBeenCalledOnce()
    confirm.mockReturnValue(true)
    await user.click(screen.getByText('Switch mode'))
    await act(async () => {
      finish(validGpx)
      await reading
    })
    expect(screen.queryByRole('button', { name: 'Save route' })).not.toBeInTheDocument()
    expect(screen.queryByText('Planned route saved.')).not.toBeInTheDocument()
    expect(confirm).toHaveBeenCalledTimes(2)
  })

  it.each([false, true])(
    'preserves viewer map browsing with saved route=%s and no route writes',
    async (savedRoute) => {
      vi.stubEnv('MODE', 'production')
      const data = createDefaultData()
      data.challenges[0] = {
        ...data.challenges[0]!,
        plannedRoute: savedRoute
          ? {
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
            }
          : undefined,
      }
      const fetch = vi
        .fn()
        .mockImplementation(() => new Response(JSON.stringify({ data, etags: {}, role: 'viewer' }), { status: 200 }))
      vi.stubGlobal('fetch', fetch)
      const view = renderDetails()

      expect(
        await screen.findByText(/Your Journey access is viewer only, so you can read this data but not change it\./),
      ).toBeInTheDocument()
      expect(screen.getByTestId('challenge-map')).toHaveTextContent(savedRoute ? 'Route attached' : 'No route')
      expect(screen.getAllByRole('link', { name: 'View waypoint' }).length).toBeGreaterThan(0)
      for (const name of ['Attach GPX route', 'Replace GPX route', 'Remove route', 'Save route']) {
        expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
      }
      expect(view.container.querySelector('input[type="file"]')).toBeNull()
      expect(screen.getByRole('link', { name: 'Change the data mode in Settings' })).toHaveAttribute(
        'href',
        '/settings',
      )
      expect(fetch).toHaveBeenCalledTimes(1)
    },
  )

  it('shows the Challenge Waypoints and only the attach action when no route is present', () => {
    const data = createDefaultData()
    renderDetails()

    expect(screen.getByRole('heading', { name: 'National Trust Demo Collection (Fictional)' })).toBeInTheDocument()
    expect(screen.queryByText('No planned GPX route attached.')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Planned route' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Attach GPX route' })).toBeInTheDocument()
    expect(screen.getByTestId('challenge-map')).toHaveTextContent(
      `${data.waypoints.filter((waypoint) => waypoint.challengeIds.includes(data.challenges[0]!.challengeId)).length} waypoints`,
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
