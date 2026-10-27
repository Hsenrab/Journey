import { submitActivity } from '../test/activityActions'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { createDefaultData, getDataMode, save } from '../services/storage'
import type { Waypoint } from '../domain/visit'
import { createJourneyTestData } from '../test/demoData'

afterEach(cleanup)

describe('Challenge recording return journey', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubEnv('MODE', 'test')
    save(createJourneyTestData())
    window.history.replaceState(null, '', '/challenges/journey')
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('retains named origin, focuses success, and returns to current progress then Dashboard', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click((await screen.findAllByRole('link', { name: 'View waypoint' }))[0]!)
    expect(screen.getByRole('link', { name: 'Back to Discovery Challenge' })).toHaveAttribute(
      'href',
      '/challenges/journey',
    )
    await user.click(screen.getByRole('button', { name: 'Log activity' }))
    expect(screen.getByLabelText('Activity title')).toHaveFocus()
    await user.type(screen.getByLabelText('Activity title'), 'A recorded visit')
    await user.type(screen.getByLabelText('Postcode'), 'GL1 1AA')
    await user.click(screen.getByRole('button', { name: 'Save activity' }))
    expect(await screen.findByRole('status', { name: 'Activity saved confirmation' })).toHaveFocus()
    expect(window.location.pathname).toBe('/waypoints/once')
    await user.click(
      within(screen.getByRole('status', { name: 'Activity saved confirmation' })).getByRole('link', {
        name: 'Back to Discovery Challenge',
      }),
    )
    expect(await screen.findByText('1 of 2 waypoints completed (50%).')).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Back to Dashboard' }))
    expect(window.location.pathname).toBe('/challenges')
    expect(
      within(screen.getByRole('link', { name: 'Discovery Challenge' })).getByText('1 of 2 waypoints completed'),
    ).toBeInTheDocument()
  })

  it('does not discard a dirty Activity when a return is declined', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    render(<App />)
    await user.click((await screen.findAllByRole('link', { name: 'View waypoint' }))[0]!)
    await user.click(screen.getByRole('button', { name: 'Log activity' }))
    await user.type(screen.getByLabelText('Activity title'), 'Keep my draft')
    await user.click(screen.getByRole('link', { name: 'Back to Discovery Challenge' }))
    expect(screen.getByLabelText('Activity title')).toHaveValue('Keep my draft')
    expect(window.location.pathname).toBe('/waypoints/once')
    confirm.mockReturnValue(true)
    await user.click(screen.getByRole('link', { name: 'Back to Discovery Challenge' }))
    expect(window.location.pathname).toBe('/challenges/journey')
    expect(confirm).toHaveBeenCalledTimes(2)
  })
})

describe('editor to Settings discard journey', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubEnv('MODE', 'production')
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })
  const editors = [
    { path: '/waypoints', add: 'Add waypoint', field: 'Title', save: 'Save waypoint' },
    { path: '/ideas', add: 'Add idea', field: 'Title', save: 'Save idea' },
    { path: '/activities', add: 'Add activity', field: 'Activity title', save: 'Save activity' },
    { path: '/challenges', add: 'Add challenge', field: 'Title', save: 'Save challenge' },
  ]
  function remote() {
    const data = createDefaultData()
    const fetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      const body = init.body ? JSON.parse(init.body as string) : undefined
      return Promise.resolve(new Response(JSON.stringify({ data: body?.data ?? data, etags: {}, role: 'admin' })))
    })
    vi.stubGlobal('fetch', fetch)
    return fetch
  }
  it.each(editors)('protects changed $path drafts before Settings even without switching', async (editor) => {
    remote()
    window.history.pushState({}, '', editor.path)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: editor.add }))
    fireEvent.change(screen.getByLabelText(editor.field), { target: { value: 'Keep my draft' } })
    await user.click(screen.getByRole('link', { name: 'Settings' }))
    expect(window.location.pathname).toBe(editor.path)
    expect(screen.getByLabelText(editor.field)).toHaveValue('Keep my draft')
    expect(getDataMode()).toBe('production')
    expect(confirm).toHaveBeenCalledTimes(1)
    confirm.mockReturnValue(true)
    await user.click(screen.getByRole('link', { name: 'Settings' }))
    expect(window.location.pathname).toBe('/settings')
    expect(getDataMode()).toBe('production')
    expect(confirm).toHaveBeenCalledTimes(2)
    await user.click(screen.getByRole('combobox', { name: 'Data mode' }))
    await user.click(screen.getByRole('option', { name: 'Demo local data' }))
    expect(getDataMode()).toBe('demo-local')
    expect(confirm).toHaveBeenCalledTimes(2)
    await user.click(screen.getByRole('combobox', { name: 'Data mode' }))
    await user.click(screen.getByRole('option', { name: 'Production data' }))
    const nav = editor.path === '/challenges' ? 'Progress' : editor.path.slice(1)
    await user.click(screen.getByRole('link', { name: new RegExp(`^${nav}$`, 'i') }))
    await user.click(await screen.findByRole('button', { name: editor.add }))
    expect(screen.getByLabelText(editor.field)).toHaveValue('')
  })
  it.each(editors)('does not prompt for unchanged or unmounted $path drafts', async (editor) => {
    remote()
    window.history.pushState({}, '', editor.path)
    const confirm = vi.spyOn(window, 'confirm')
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: editor.add }))
    await user.click(screen.getByRole('link', { name: 'Settings' }))
    expect(confirm).not.toHaveBeenCalled()
    const nav = editor.path === '/challenges' ? 'Progress' : editor.path.slice(1)
    await user.click(screen.getByRole('link', { name: new RegExp(`^${nav}$`, 'i') }))
    await user.click(await screen.findByRole('button', { name: editor.add }))
    fireEvent.change(screen.getByLabelText(editor.field), { target: { value: 'Unmount me' } })
    await user.click(screen.getByRole('link', { name: editor.path === '/activities' ? 'Ideas' : 'Activities' }))
    await user.click(screen.getByRole('link', { name: 'Settings' }))
    expect(confirm).not.toHaveBeenCalled()
  })
  it.each(editors)('retains a failed $path save and clears registration after success', async (editor) => {
    const fetch = remote()
    window.history.pushState({}, '', editor.path)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: editor.add }))
    fireEvent.change(screen.getByLabelText(editor.field), { target: { value: 'New record' } })
    if (editor.path === '/waypoints' || editor.path === '/challenges')
      fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Description' } })
    if (editor.path === '/waypoints')
      fireEvent.change(screen.getByLabelText('Category', { selector: 'input' }), { target: { value: 'Walk' } })
    if (editor.path === '/activities')
      fireEvent.change(screen.getByLabelText('Postcode'), { target: { value: 'GL1 1AA' } })
    if (editor.path === '/activities')
      fetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Specific save failure' }), { status: 400 }))
    else fetch.mockRejectedValueOnce(new Error('Specific save failure'))
    await user.click(screen.getByRole('button', { name: editor.save }))
    expect(await screen.findByText(/Specific save failure/)).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Settings' }))
    expect(window.location.pathname).toBe(editor.path)
    expect(screen.getByLabelText(editor.field)).toHaveValue('New record')
    expect(confirm).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: editor.save }))
    await waitFor(() => expect(screen.queryByRole('button', { name: editor.save })).not.toBeInTheDocument())
    await user.click(screen.getByRole('link', { name: 'Settings' }))
    expect(window.location.pathname).toBe('/settings')
    expect(confirm).toHaveBeenCalledTimes(1)
  })

  it.each([false, true])('keeps a pending Activity mounted and protects Settings (failure=%s)', async (fails) => {
    const fetch = remote()
    window.history.pushState({}, '', '/activities')
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Add activity' }))
    fireEvent.change(screen.getByLabelText('Activity title'), { target: { value: 'Pending activity' } })
    fireEvent.change(screen.getByLabelText('Postcode'), { target: { value: 'GL1 1AA' } })
    let finish!: (reply: Response) => void
    fetch.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        finish = resolve
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Save activity' }))
    await user.click(screen.getByRole('link', { name: 'Settings' }))
    await user.click(screen.getByRole('link', { name: 'Ideas' }))
    expect(window.location.pathname).toBe('/activities')
    expect(screen.getByLabelText('Activity title')).toBeDisabled()
    expect(confirm).not.toHaveBeenCalled()
    const request = JSON.parse(fetch.mock.calls.at(-1)![1].body as string)
    await act(async () => {
      finish(
        fails
          ? new Response(JSON.stringify({ error: 'Pending activity rejected' }), { status: 400 })
          : new Response(JSON.stringify({ data: request.data, etags: {} })),
      )
    })
    if (fails) {
      expect(await screen.findByText(/Pending activity rejected/)).toBeInTheDocument()
      expect(screen.getByLabelText('Activity title')).toHaveValue('Pending activity')
    } else expect(await screen.findByText('Activity saved.')).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Settings' }))
    expect(window.location.pathname).toBe('/settings')
    expect(screen.getByRole('combobox', { name: 'Data mode' })).not.toHaveAttribute('aria-disabled', 'true')
    expect(confirm).toHaveBeenCalledTimes(fails ? 1 : 0)
  })

  it.each(
    editors
      .filter((editor) => editor.path !== '/challenges' && editor.path !== '/activities')
      .flatMap((editor) => [false, true].map((fails) => ({ ...editor, fails }))),
  )('keeps Settings locked across an unmounted $path save without late navigation (failure=$fails)', async (editor) => {
    const fetch = remote()
    window.history.pushState({}, '', editor.path)
    const confirm = vi.spyOn(window, 'confirm')
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: editor.add }))
    fireEvent.change(screen.getByLabelText(editor.field), { target: { value: 'Pending record' } })
    if (editor.path === '/waypoints') {
      fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Description' } })
      fireEvent.change(screen.getByLabelText('Category', { selector: 'input' }), { target: { value: 'Walk' } })
    }
    let finish!: (reply: Response) => void
    let fail!: (error: Error) => void
    const writing = new Promise<Response>((resolve, reject) => {
      finish = resolve
      fail = reject
    })
    fetch.mockReturnValueOnce(writing)
    await user.click(screen.getByRole('button', { name: editor.save }))
    await user.click(screen.getByRole('link', { name: 'Settings' }))
    expect(window.location.pathname).toBe(editor.path)
    expect(confirm).not.toHaveBeenCalled()
    await user.click(screen.getByRole('link', { name: editor.path === '/activities' ? 'Ideas' : 'Activities' }))
    await user.click(screen.getByRole('link', { name: 'Settings' }))
    expect(window.location.pathname).toBe('/activities')
    expect(screen.queryByRole('combobox', { name: 'Data mode' })).not.toBeInTheDocument()
    expect(getDataMode()).toBe('production')
    await act(async () => {
      if (editor.fails) fail(new Error('Unmounted save failure'))
      else finish(new Response(JSON.stringify({ data: createDefaultData(), etags: {}, role: 'admin' })))
    })
    expect(window.location.pathname).toBe('/activities')
    await user.click(screen.getByRole('link', { name: 'Settings' }))
    expect(screen.getByRole('combobox', { name: 'Data mode' })).not.toHaveAttribute('aria-disabled', 'true')
    expect(confirm).not.toHaveBeenCalled()
    expect(screen.queryByText(/^(Waypoint|Idea|Activity) saved\.$/)).not.toBeInTheDocument()
  })
})

const customWaypoint = (waypointId: string, title: string): Waypoint => ({
  waypointId,
  title,
  description: `${title} description`,
  category: 'Walking route',
  tags: [],
  challengeIds: ['custom-challenge'],
  completion: { mode: 'once' },
  location: { placeName: title, addressOrRegion: 'Test area', latitude: 51.86, longitude: -2.22 },
  referenceIds: [],
  photoReferenceIds: [],
})

function saveTestData() {
  save({
    ...createDefaultData(),
    waypoints: [customWaypoint('test-path', 'Pinewood Path'), customWaypoint('test-garden', 'Riverside Garden')],
    challenges: [
      {
        challengeId: 'custom-challenge',
        title: 'Personal goals',
        description: 'A custom challenge for these tests.',
        supportsActivityCategories: true,
        awardDescriptions: { bronze: 'Afternoon', silver: 'Day', gold: 'Night' },
      },
    ],
  })
}

describe('landing route', () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.pushState({}, '', '/')
  })
  afterEach(cleanup)

  it('opens on the progress dashboard', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Challenges' })).toBeInTheDocument()
    expect(screen.getByText('No challenges are available yet.')).toBeInTheDocument()
    expect(screen.queryByText('National Trust')).not.toBeInTheDocument()
  })

  it('keeps /waypoints reachable as its own route', () => {
    window.history.pushState({}, '', '/waypoints')
    render(<App />)

    expect(screen.getByLabelText('Search waypoints')).toBeInTheDocument()
  })
})

describe('waypoint list', () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.pushState({}, '', '/waypoints')
  })
  afterEach(cleanup)

  it('filters waypoints by a search term', async () => {
    const user = userEvent.setup()
    saveTestData()
    render(<App />)

    await user.type(screen.getByLabelText('Search waypoints'), 'Pinewood')

    expect(screen.getByText('Pinewood Path')).toBeInTheDocument()
    expect(screen.queryByText('Riverside Garden')).not.toBeInTheDocument()
  })

  it('shows custom waypoint details without catalogue travel metadata', async () => {
    saveTestData()
    render(<App />)

    expect(screen.getAllByText('Walking route · Test area')).toHaveLength(2)
    expect(screen.queryByText(/miles from Brockworth|min drive|Drive time/)).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Maximum driving distance' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Drive time (where available)' })).not.toBeInTheDocument()
  })
})

describe('activity logging', () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.pushState({}, '', '/waypoints')
  })

  const logActivity = async (user: ReturnType<typeof userEvent.setup>, level: string, date: string) => {
    await user.click(screen.getByRole('button', { name: 'Log activity' }))
    await user.click(screen.getByRole('combobox', { name: 'Award tier' }))
    await user.click(screen.getByRole('option', { name: level }))
    fireEvent.change(screen.getByLabelText('Activity date'), { target: { value: date } })
    await submitActivity(user, 'Save activity')
  }

  // This test performs two full activity-logging flows plus a re-render, which is
  // consistently close to the default 10s timeout on slower/loaded CI runners.
  it('records activities, keeps history and derives the highest status', async () => {
    const user = userEvent.setup()
    saveTestData()
    render(<App />)

    await user.click(screen.getByRole('link', { name: 'Pinewood Path' }))

    await logActivity(user, 'Gold', '2026-08-01')
    expect(screen.getByText('Activity saved.')).toBeInTheDocument()
    expect(screen.getByText('Highest recorded award: Gold')).toBeInTheDocument()

    await logActivity(user, 'Bronze', '2026-08-02')
    expect(screen.getByText(new Date('2026-08-01T00:00:00').toLocaleDateString())).toBeInTheDocument()
    expect(screen.getByText(new Date('2026-08-02T00:00:00').toLocaleDateString())).toBeInTheDocument()
    expect(screen.getByText('Highest recorded award: Gold')).toBeInTheDocument()

    cleanup()
    render(<App />)
    await user.click(within(screen.getByTestId('detail-breadcrumbs')).getByRole('link', { name: 'Waypoints' }))
    await user.click(screen.getByRole('link', { name: 'Pinewood Path' }))
    expect(screen.getByText('Highest recorded award: Gold')).toBeInTheDocument()
  }, 20000)
})
