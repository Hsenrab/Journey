import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ReadOnlyNotice } from './ReadOnlyNotice'
import { WaypointsProvider, useWaypoints } from '../features/journey/JourneyContext'
import { createDefaultData, setDataMode } from '../services/storage'

function renderNotice() {
  render(
    <MemoryRouter>
      <WaypointsProvider>
        <ReadOnlyNotice />
      </WaypointsProvider>
    </MemoryRouter>,
  )
}

describe('ReadOnlyNotice', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('renders nothing when the active data is writable', () => {
    renderNotice()

    expect(screen.queryByText('Read-only mode')).not.toBeInTheDocument()
  })

  it('explains demo local data and links to Settings', async () => {
    setDataMode('demo-local')
    renderNotice()

    await screen.findByText('Read-only mode')
    expect(screen.getByText(/Demo local data is bundled sample data/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Change the data mode in Settings' })).toHaveAttribute('href', '/settings')
  })

  it('explains viewer access', async () => {
    vi.stubEnv('MODE', 'production')
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(
          () => new Response(JSON.stringify({ data: createDefaultData(), etags: {}, role: 'viewer' }), { status: 200 }),
        ),
    )
    renderNotice()

    await waitFor(() => expect(screen.getByText(/Your Journey access is viewer only/)).toBeInTheDocument())
  })

  it('explains the local demo fallback', async () => {
    setDataMode('demo-cosmos')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Cosmos unavailable')))
    renderNotice()

    await waitFor(() => expect(screen.getByText(/Demo Cosmos data could not be loaded/)).toBeInTheDocument())
  })

  it('explains a terminal load error', async () => {
    setDataMode('production')
    vi.stubEnv('MODE', 'production')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Journey unavailable')))
    renderNotice()

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'The selected data failed to load, so nothing can be changed.',
      ),
    )
  })

  it('hides the previous explanation while a new data mode loads', async () => {
    setDataMode('demo-local')
    vi.stubEnv('MODE', 'production')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => new Promise(() => {})),
    )

    function SwitchMode() {
      const { setDataMode: changeDataMode } = useWaypoints()
      return <button onClick={() => void changeDataMode('production')}>Switch to production</button>
    }

    render(
      <MemoryRouter>
        <WaypointsProvider>
          <ReadOnlyNotice />
          <SwitchMode />
        </WaypointsProvider>
      </MemoryRouter>,
    )

    await screen.findByText(/Demo local data is bundled sample data/)
    fireEvent.click(screen.getByRole('button', { name: 'Switch to production' }))
    await waitFor(() => expect(screen.queryByText('Read-only mode')).not.toBeInTheDocument())
  })
})
