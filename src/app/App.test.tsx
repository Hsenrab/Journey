import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { createDefaultData, getDataMode, save } from '../services/storage'
import type { Waypoint } from '../domain/visit'

afterEach(cleanup)

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
    { path: '/activities', add: 'Add activity', field: 'Description / notes', save: 'Save activity' },
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
    fetch.mockRejectedValueOnce(new Error('Specific save failure'))
    await user.click(screen.getByRole('button', { name: editor.save }))
    expect(await screen.findByText('Specific save failure')).toBeInTheDocument()
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

  it.each(
    editors
      .filter((editor) => editor.path !== '/challenges')
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
    if (editor.path === '/activities')
      fireEvent.change(screen.getByLabelText('Postcode'), { target: { value: 'GL1 1AA' } })
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
    expect(screen.getByRole('combobox', { name: 'Data mode' })).toHaveAttribute('aria-disabled', 'true')
    expect(getDataMode()).toBe('production')
    await act(async () => {
      if (editor.fails) fail(new Error('Unmounted save failure'))
      else finish(new Response(JSON.stringify({ data: createDefaultData(), etags: {}, role: 'admin' })))
    })
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Data mode' })).not.toHaveAttribute('aria-disabled', 'true'),
    )
    expect(window.location.pathname).toBe('/settings')
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
    await user.click(screen.getByRole('combobox', { name: 'Activity category' }))
    await user.click(screen.getByRole('option', { name: level }))
    fireEvent.change(screen.getByLabelText('Activity date'), { target: { value: date } })
    await user.click(screen.getByRole('button', { name: 'Save activity' }))
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
    expect(screen.getByText('Award tier: Gold')).toBeInTheDocument()

    await logActivity(user, 'Bronze', '2026-08-02')
    expect(screen.getByText(new Date('2026-08-01T00:00:00').toLocaleDateString())).toBeInTheDocument()
    expect(screen.getByText(new Date('2026-08-02T00:00:00').toLocaleDateString())).toBeInTheDocument()
    expect(screen.getByText('Award tier: Gold')).toBeInTheDocument()

    cleanup()
    render(<App />)
    await user.click(within(screen.getByTestId('detail-breadcrumbs')).getByRole('link', { name: 'Waypoints' }))
    await user.click(screen.getByRole('link', { name: 'Pinewood Path' }))
    expect(screen.getByText('Award tier: Gold')).toBeInTheDocument()
  }, 20000)
})
