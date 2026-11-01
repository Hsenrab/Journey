import { submitActivity } from '../test/activityActions'
import { MemoryRouter } from '../test/DataMemoryRouter'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Activities from './Activities'
import { WaypointsProvider, useWaypoints } from '../features/journey/JourneyContext'
import { Route, Routes, useNavigate } from 'react-router-dom'
import ActivityDetails from './ActivityDetails'
import { createDefaultData, load, save } from '../services/storage'
import { createActivity, createIdea, type Activity } from '../domain/visit'
import { createDemoTestData, createAwardTestData } from '../test/demoData'

function renderActivities(path = '/activities') {
  let journey: ReturnType<typeof useWaypoints> | undefined
  let navigate: ReturnType<typeof useNavigate> | undefined
  function Probe() {
    journey = useWaypoints()
    navigate = useNavigate()
    return null
  }
  render(
    <MemoryRouter initialEntries={[path]}>
      <WaypointsProvider>
        <Probe />
        <Routes>
          <Route path="/activities" element={<Activities />} />
          <Route path="/activities/:activityId" element={<ActivityDetails />} />
          <Route path="/settings" element={<div>Settings destination</div>} />
          <Route path="/ideas/:ideaId" element={<div>Idea destination</div>} />
        </Routes>
      </WaypointsProvider>
    </MemoryRouter>,
  )
  return {
    get journey() {
      if (!journey) throw new Error('Journey test probe was not mounted.')
      return journey
    },
    get navigate() {
      if (!navigate) throw new Error('Router test probe was not mounted.')
      return navigate
    },
  }
}

function historyData() {
  const data = createAwardTestData()
  data.waypoints[0]!.title = 'Botanical destination'
  data.activities[0] = {
    ...data.activities[0]!,
    name: 'Morning walk',
    notes: `${'x'.repeat(150)} garden`,
    updatedAt: '2026-08-01T00:00:00.000Z',
    location: { kind: 'coordinates', latitude: 51, longitude: -2 },
  }
  data.activities[1] = {
    ...data.activities[1]!,
    name: 'Morning walk',
    notes: 'garden',
    date: data.activities[0]!.date,
    updatedAt: '2026-08-04T00:00:00.000Z',
    location: { kind: 'coordinates', latitude: 51, longitude: -2 },
  }
  data.activities.push(
    createActivity({
      activityId: 'outside',
      name: 'Garden outside',
      date: '2026-08-05',
      location: { kind: 'coordinates', latitude: 52, longitude: -1 },
    }),
  )
  return data
}

function resultIds() {
  return [...document.querySelectorAll<HTMLAnchorElement>('a.MuiCardActionArea-root')].map((link) =>
    link.getAttribute('href')!.split('/').pop(),
  )
}

function search(query: string) {
  fireEvent.change(screen.getByLabelText('Search activities'), { target: { value: query } })
}

describe('Activities', () => {
  it('clears corrected reported title feedback before saving an independent Activity', async () => {
    const user = userEvent.setup()
    renderActivities()
    await user.click(screen.getByRole('button', { name: 'Add activity' }))
    await user.click(screen.getByRole('button', { name: 'Save activity' }))
    const title = screen.getByLabelText('Activity title')
    await user.type(title, 'Corrected independent visit')
    await user.tab()
    expect(title).toHaveAttribute('aria-invalid', 'false')
    expect(screen.getByLabelText('Postcode')).toHaveAttribute('aria-invalid', 'true')
    expect(load().activities).toHaveLength(0)
  })

  beforeEach(() => localStorage.clear())
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it.each([
    ['bronze', 2],
    ['silver', 1],
    ['gold', 1],
  ])('shows the exact scoped %s Activity group', (award, count) => {
    save(createAwardTestData())
    renderActivities(`/activities?challenge=award-a&award=${award}`)
    expect(document.querySelectorAll('.MuiCard-root')).toHaveLength(count)
    expect(screen.getByRole('link', { name: 'Back to Award Challenge A Statistics' })).toHaveAttribute(
      'href',
      '/challenges/award-a#statistics',
    )
  })

  it('rejects unsupported award filters instead of showing an unfiltered list', () => {
    save(createAwardTestData())
    renderActivities('/activities?challenge=ordinary&award=gold')
    expect(screen.getByRole('alert')).toHaveTextContent('Award filters do not apply to an ordinary Challenge.')
    expect(document.querySelectorAll('.MuiCard-root')).toHaveLength(0)
  })

  it('omits awards from ordinary shared-member visits', () => {
    save(createAwardTestData())
    renderActivities('/activities?challenge=ordinary')
    expect(document.querySelectorAll('.MuiCard-root')).toHaveLength(4)
    expect(screen.queryByText(/Recorded award:/)).not.toBeInTheDocument()
  })

  it('shows an empty state when there are no activities', () => {
    renderActivities()
    expect(screen.getByText('No activities logged yet.')).toBeInTheDocument()
  })

  it('preserves entered values when validation fails', async () => {
    const user = userEvent.setup()
    renderActivities()

    await user.click(screen.getByRole('button', { name: 'Add activity' }))
    await user.click(screen.getByRole('combobox', { name: 'Location type' }))
    await user.click(screen.getByRole('option', { name: 'Latitude and longitude' }))
    await user.type(screen.getByLabelText('Latitude'), 'not-a-number')
    await user.type(screen.getByLabelText('Longitude'), '-1.26')
    await submitActivity(user, 'Save activity')

    expect(screen.getByText('Latitude and longitude must be numeric.')).toBeInTheDocument()
    expect(screen.getByLabelText('Latitude')).toHaveValue('not-a-number')
    expect(load().activities).toEqual([])
  })

  it('cancels adding an activity without saving it', async () => {
    const user = userEvent.setup()
    renderActivities()

    await user.click(screen.getByRole('button', { name: 'Add activity' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByRole('button', { name: 'Add activity' })).toBeInTheDocument()
    expect(load().activities).toEqual([])
  })

  it('saves an independent activity with postcode location', async () => {
    const user = userEvent.setup()
    renderActivities()

    await user.click(screen.getByRole('button', { name: 'Add activity' }))
    await user.type(screen.getByLabelText('Postcode'), 'GL1 1AA')
    await user.type(screen.getByLabelText('Description / notes'), 'Evening walk')
    await submitActivity(user, 'Save activity')

    expect(screen.getByText('Activity saved.')).toBeInTheDocument()
    expect(load().activities[0]).toMatchObject({
      location: { kind: 'postcode', postcode: 'GL1 1AA' },
      notes: 'Evening walk',
    })
  })

  it('shows required activity titles, supporting dates, waypoint labels and detail counts', () => {
    const seed = createDemoTestData()
    const namedActivity: Activity = {
      activityId: 'a1',
      ideaIds: [],
      waypointId: 'demo-foxglove-manor',
      challengeId: 'national-trust',
      date: '2026-08-01',
      name: 'Summer visit',
      category: 'gold',
      location: { kind: 'postcode', postcode: 'BA12 6QF' },
      notes: '',
      referenceIds: ['ref-1'],
      photoReferenceIds: ['photo-1'],
      createdAt: '2026-08-01T10:00:00.000Z',
      updatedAt: '2026-08-01T10:00:00.000Z',
    }
    const independentActivity: Activity = {
      name: 'Independent walk',
      activityId: 'a2',
      ideaIds: [],
      date: '2026-08-02',
      location: { kind: 'postcode', postcode: 'GL1 1AA' },
      notes: '',
      referenceIds: [],
      photoReferenceIds: [],
      createdAt: '2026-08-02T10:00:00.000Z',
      updatedAt: '2026-08-02T10:00:00.000Z',
    }
    save({ ...seed, activities: [namedActivity, independentActivity] })

    renderActivities()

    expect(screen.getByRole('link', { name: 'Summer visit' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Independent walk' })).toBeInTheDocument()
    expect(screen.getByText(new Date('2026-08-02T00:00:00').toLocaleDateString())).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View Foxglove Manor (Demo) waypoint' })).toHaveAttribute(
      'href',
      '/waypoints/demo-foxglove-manor',
    )
    expect(screen.getByText('1 photo')).toBeInTheDocument()
    expect(screen.getByText('1 link')).toBeInTheDocument()
  })

  it('shows a loading notice instead of the empty state while production data is in flight', async () => {
    vi.stubEnv('MODE', 'production')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => new Promise<Response>(() => {})),
    )

    renderActivities()

    expect(await screen.findByText('Loading activities…')).toBeInTheDocument()
    expect(screen.queryByText('No activities logged yet.')).not.toBeInTheDocument()
  })

  it('does not offer activity mutations to a viewer', async () => {
    vi.stubEnv('MODE', 'production')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: createDefaultData(), etags: {}, role: 'viewer' }))),
    )

    renderActivities()

    expect(await screen.findByText('No activities logged yet.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add activity' })).not.toBeInTheDocument()
    expect(screen.getByText(/Your Journey access is viewer only/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Change the data mode in Settings' })).toHaveAttribute('href', '/settings')
  })

  it('matches full notes/current Waypoint text and preserves exact scoped identity and date ties', () => {
    save(historyData())
    renderActivities('/activities?challenge=award-a')
    search('garden walk')
    expect(resultIds()).toEqual(['award-visit-1', 'award-visit-0'])
    search('botanical walk')
    expect(resultIds()).toEqual(['award-visit-1', 'award-visit-0'])
    expect(screen.getAllByRole('link', { name: 'Morning walk' })[1]).toHaveAttribute(
      'href',
      '/activities/award-visit-0',
    )
  })

  it.each([
    ['bronze', 'award-visit-0'],
    ['gold', 'award-visit-1'],
    ['silver', 'silver-visit'],
  ])('intersects search with the exact %s award', (award, id) => {
    save(historyData())
    renderActivities(`/activities?challenge=award-a&award=${award}`)
    search(award === 'silver' ? 'silver' : 'garden')
    expect(resultIds()).toEqual([id])
  })

  it('clears only the query, restores the scope and focuses one input', async () => {
    save(historyData())
    renderActivities('/activities?challenge=award-a&award=bronze')
    const before = resultIds()
    search('absent')
    expect(screen.getByText('No activities match "absent".')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Clear search' })).toHaveLength(1)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Clear search' }))
    expect(screen.getByLabelText('Search activities')).toHaveFocus()
    expect(resultIds()).toEqual(before)
    expect(screen.getByRole('combobox', { name: 'Recorded award' })).toHaveTextContent('Bronze')
    search('   ')
    expect(resultIds()).toEqual(before)
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument()
  })

  it('distinguishes a valid empty scope from query no-match and empty data', () => {
    save(historyData())
    renderActivities('/activities?challenge=empty')
    search('absent')
    expect(screen.getByText('No activities in this scope.')).toBeInTheDocument()
    expect(screen.queryByText(/No activities match/)).not.toBeInTheDocument()
  })

  it('gives invalid scope precedence over an existing no-match query', async () => {
    save(historyData())
    const view = renderActivities()
    search('absent')
    await act(async () => view.navigate('/activities?challenge=ordinary&award=gold'))
    expect(screen.getByRole('alert')).toHaveTextContent('Award filters do not apply')
    expect(screen.queryByText(/No activities match/)).not.toBeInTheDocument()
    await act(async () => view.navigate('/activities'))
    expect(screen.getByLabelText('Search activities')).toHaveValue('absent')
  })

  it('retains query on award changes and Add/Cancel, without registering a draft', async () => {
    save(historyData())
    const view = renderActivities('/activities?challenge=award-a&award=bronze')
    const confirm = vi.spyOn(window, 'confirm')
    search('garden walk')
    await userEvent.setup().click(screen.getByRole('combobox', { name: 'Recorded award' }))
    await userEvent.setup().click(screen.getByRole('option', { name: 'Gold' }))
    expect(screen.getByLabelText('Search activities')).toHaveValue('garden walk')
    expect(resultIds()).toEqual(['award-visit-1'])
    await userEvent.setup().click(screen.getByRole('button', { name: 'Add activity' }))
    await userEvent.setup().click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByLabelText('Search activities')).toHaveValue('garden walk')
    expect(confirm).not.toHaveBeenCalled()
    expect(view.journey.confirmNavigation('Settings')).toBe(true)
  })

  it('actually unmounts history and resets on Back/Forward after departure', async () => {
    save(historyData())
    const view = renderActivities()
    search('garden walk')
    await userEvent.setup().click(screen.getAllByRole('link', { name: 'Morning walk' })[0]!)
    expect(screen.queryByLabelText('Search activities')).not.toBeInTheDocument()
    await act(async () => view.navigate(-1))
    expect(screen.getByLabelText('Search activities')).toHaveValue('')
    search('absent')
    await act(async () => view.navigate(1))
    await act(async () => view.navigate(-1))
    expect(screen.getByLabelText('Search activities')).toHaveValue('')
  })

  it('retains search while saving an excluded independent record and preserves saved feedback', async () => {
    save(historyData())
    const view = renderActivities()
    search('garden walk')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Add activity' }))
    fireEvent.change(screen.getByLabelText('Activity title'), { target: { value: 'Unrelated saved visit' } })
    await userEvent.setup().click(screen.getByRole('combobox', { name: 'Location type' }))
    await userEvent.setup().click(screen.getByRole('option', { name: 'Latitude and longitude' }))
    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '51' } })
    fireEvent.change(screen.getByLabelText('Longitude'), { target: { value: '-2' } })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Save activity' }))
    expect(await screen.findByText('Activity saved.')).toBeInTheDocument()
    expect(screen.getByLabelText('Search activities')).toHaveValue('garden walk')
    expect(resultIds()).toEqual(['award-visit-1', 'award-visit-0'])
    expect(view.journey.data.activities.some((item) => item.name === 'Unrelated saved visit')).toBe(true)
  })

  it('preserves Idea-origin return when the saved draft retains its Idea', async () => {
    const data = historyData()
    data.ideas.push(createIdea({ ideaId: 'origin', title: 'Origin idea', planningState: 'active', difficulty: 1 }))
    save(data)
    renderActivities('/activities?mode=add&idea=origin')
    search('garden')
    fireEvent.change(screen.getByLabelText('Activity title'), { target: { value: 'Idea experience' } })
    await userEvent.setup().click(screen.getByRole('combobox', { name: 'Location type' }))
    await userEvent.setup().click(screen.getByRole('option', { name: 'Latitude and longitude' }))
    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '51' } })
    fireEvent.change(screen.getByLabelText('Longitude'), { target: { value: '-2' } })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Save activity' }))
    expect(await screen.findByText('Idea destination')).toBeInTheDocument()
  })

  it('preserves specific Production failure rather than rendering a successful empty search', async () => {
    vi.stubEnv('MODE', 'production')
    let failed = false
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        failed
          ? new Response(JSON.stringify({ error: 'Specific history failure' }), {
              status: 503,
              headers: { 'content-type': 'application/json' },
            })
          : new Response(JSON.stringify({ data: historyData(), etags: {}, role: 'admin' })),
      ),
    )
    const view = renderActivities()
    await screen.findByLabelText('Search activities')
    search('absent')
    failed = true
    await act(async () => {
      await view.journey.reload()
    })
    expect(screen.getAllByRole('alert').map((alert) => alert.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining('Specific history failure')]),
    )
    expect(screen.queryByText(/No activities match/)).not.toBeInTheDocument()
    expect(resultIds()).toEqual([])
  })

  it('retains query on same-mode reload, searches current saved truth and does not issue query requests', async () => {
    vi.stubEnv('MODE', 'production')
    let data = historyData()
    const fetch = vi.fn(async () => new Response(JSON.stringify({ data, etags: {}, role: 'viewer' })))
    vi.stubGlobal('fetch', fetch)
    const view = renderActivities()
    await screen.findByLabelText('Search activities')
    const initialReads = fetch.mock.calls.length
    search('garden walk')
    search('garden')
    expect(fetch).toHaveBeenCalledTimes(initialReads)
    expect(screen.queryByRole('button', { name: 'Add activity' })).not.toBeInTheDocument()
    data = { ...data, activities: data.activities.filter((item) => item.activityId !== 'award-visit-0') }
    data.waypoints[0]!.title = 'Renamed destination'
    await act(async () => {
      await view.journey.reload()
    })
    expect(screen.getByLabelText('Search activities')).toHaveValue('garden')
    expect(resultIds()).not.toContain('award-visit-0')
    search('renamed walk')
    expect(resultIds()).toEqual(['award-visit-1'])
  })

  it('permanently resets effective fallback/recovery query without changing selected mode', async () => {
    localStorage.setItem('journey-data-mode-v1', 'demo-cosmos')
    let failed = false
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        failed
          ? new Response(JSON.stringify({ error: 'Specific Demo history failure' }), {
              status: 503,
              headers: { 'content-type': 'application/json' },
            })
          : new Response(JSON.stringify({ data: historyData(), etags: {}, role: 'admin' })),
      ),
    )
    const view = renderActivities()
    await screen.findByLabelText('Search activities')
    search('garden walk')
    failed = true
    await act(async () => {
      await view.journey.reload()
    })
    expect(screen.getByLabelText('Search activities')).toHaveValue('')
    expect(view.journey.dataMode).toBe('demo-cosmos')
    expect(screen.getByText(/Demo Cosmos data could not be loaded/)).toBeInTheDocument()
    expect(view.journey.loadState).toEqual({
      status: 'loaded',
      warning: expect.stringContaining('Specific Demo history failure'),
    })
    search('fallback query')
    failed = false
    await act(async () => {
      await view.journey.reload()
    })
    expect(screen.getByLabelText('Search activities')).toHaveValue('')
    expect(resultIds()).toHaveLength(historyData().activities.length)
  })

  it('retains input focus/query while loading and ignores superseded saved responses', async () => {
    vi.stubEnv('MODE', 'production')
    const response = (data = historyData()) => new Response(JSON.stringify({ data, etags: {}, role: 'viewer' }))
    const fetch = vi.fn(async () => response())
    vi.stubGlobal('fetch', fetch)
    const view = renderActivities()
    const input = await screen.findByLabelText('Search activities')
    input.focus()
    search('garden walk')
    let releaseOld!: (value: Response) => void
    let releaseLatest!: (value: Response) => void
    fetch
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            releaseOld = resolve
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            releaseLatest = resolve
          }),
      )
    let oldLoad!: ReturnType<typeof view.journey.reload>
    let latestLoad!: ReturnType<typeof view.journey.reload>
    await act(async () => {
      oldLoad = view.journey.reload()
    })
    expect(screen.getByText('Loading activities…')).toBeInTheDocument()
    expect(screen.queryByText(/No activities match/)).not.toBeInTheDocument()
    expect(input).toHaveFocus()
    expect(input).toHaveValue('garden walk')
    await act(async () => {
      latestLoad = view.journey.reload()
    })
    const current = historyData()
    current.activities = current.activities.filter((item) => item.activityId !== 'award-visit-0')
    await act(async () => {
      releaseLatest(response(current))
      expect(await latestLoad).toEqual({ status: 'success' })
    })
    expect(resultIds()).toEqual(['award-visit-1'])
    await act(async () => {
      releaseOld(response())
      expect(await oldLoad).toEqual({ status: 'superseded' })
    })
    expect(input).toHaveFocus()
    expect(input).toHaveValue('garden walk')
    expect(resultIds()).toEqual(['award-visit-1'])
  })

  it('resets accepted selections but retains declined and pending-blocked selections', async () => {
    save(historyData())
    const view = renderActivities()
    search('garden')
    const draftId = Symbol('test draft')
    const unregister = view.journey.registerDraft(draftId, true)
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    await act(async () => {
      expect(await view.journey.setDataMode('demo-local')).toBe('cancelled')
    })
    expect(screen.getByLabelText('Search activities')).toHaveValue('garden')
    unregister()
    let release!: () => void
    let pending!: Promise<void>
    await act(async () => {
      pending = view.journey.runMutation(
        () =>
          new Promise<void>((resolve) => {
            release = resolve
          }),
      )
    })
    await expect(view.journey.setDataMode('demo-local')).rejects.toThrow(
      'Cannot switch data modes while a Journey mutation is pending.',
    )
    expect(screen.getByLabelText('Search activities')).toHaveValue('garden')
    await act(async () => {
      release()
      await pending
    })
    await act(async () => {
      await view.journey.setDataMode('demo-local')
    })
    expect(screen.getByLabelText('Search activities')).toHaveValue('')
    search('local query')
    await act(async () => {
      await view.journey.setDataMode('production')
    })
    expect(screen.getByLabelText('Search activities')).toHaveValue('')
  })

  it('retains a postcode-only draft and specific geocoding failure without showing an unsaved Activity', async () => {
    vi.stubEnv('MODE', 'production')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, init?: RequestInit) =>
        init?.method === 'POST'
          ? new Response(JSON.stringify({ error: 'Azure Maps found no coordinates for "UNKNOWN".' }), {
              status: 400,
              headers: { 'content-type': 'application/json' },
            })
          : new Response(JSON.stringify({ data: historyData(), etags: {}, role: 'admin' })),
      ),
    )
    renderActivities()
    await screen.findByLabelText('Search activities')
    search('unsaved postcode visit')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Add activity' }))
    fireEvent.change(screen.getByLabelText('Activity title'), { target: { value: 'unsaved postcode visit' } })
    fireEvent.change(screen.getByLabelText('Postcode'), { target: { value: 'UNKNOWN' } })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Save activity' }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Azure Maps found no coordinates for "UNKNOWN".'),
    )
    expect(screen.getByLabelText('Activity title')).toHaveValue('unsaved postcode visit')
    expect(screen.getByLabelText('Postcode')).toHaveValue('UNKNOWN')
    expect(resultIds()).toEqual([])
    expect(screen.getByText('No activities match "unsaved postcode visit".')).toBeInTheDocument()
  })

  it('keeps query and currently saved records during a failed save and discards no draft', async () => {
    localStorage.setItem('journey-data-mode-v1', 'demo-cosmos')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) =>
        init?.method === 'POST'
          ? new Response(JSON.stringify({ error: 'conflict' }), { status: 409 })
          : new Response(JSON.stringify({ data: historyData(), etags: {}, role: 'admin' })),
      ),
    )
    renderActivities()
    await screen.findByLabelText('Search activities')
    search('unsaved clue')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Add activity' }))
    fireEvent.change(screen.getByLabelText('Activity title'), { target: { value: 'unsaved clue' } })
    await userEvent.setup().click(screen.getByRole('combobox', { name: 'Location type' }))
    await userEvent.setup().click(screen.getByRole('option', { name: 'Latitude and longitude' }))
    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '51' } })
    fireEvent.change(screen.getByLabelText('Longitude'), { target: { value: '-2' } })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Save activity' }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Your data has changed in another session.'),
    )
    expect(screen.getByLabelText('Activity title')).toHaveValue('unsaved clue')
    expect(resultIds()).toEqual([])
    expect(screen.getByText('No activities match "unsaved clue".')).toBeInTheDocument()
  })
})
