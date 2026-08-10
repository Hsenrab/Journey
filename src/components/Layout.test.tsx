import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Layout } from './Layout'
import { WaypointsProvider, useWaypoints } from '../features/journey/JourneyContext'
import { createDefaultData, createDemoModeData, isDemoModeEnabled, load, save } from '../services/storage'
import type { Activity } from '../domain/visit'

function setViewport(width: number) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('max-width') ? width < 600 : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

describe('Layout', () => {
  beforeEach(() => {
    localStorage.clear()
    setViewport(1200)
  })
  afterEach(() => vi.restoreAllMocks())

  function activity(category: 'bronze' | 'silver' | 'gold' = 'silver'): Activity {
    return {
      activityId: `layout-${category}`,
      waypointId: 'dyrham-park',
      challengeId: 'national-trust',
      category,
      date: '2026-08-01',
      location: { kind: 'postcode', postcode: 'Dyrham Park' },
      notes: 'Personal visit',
      referenceIds: [],
      photoReferenceIds: [],
      createdAt: '2026-08-01T10:00:00.000Z',
      updatedAt: '2026-08-01T10:00:00.000Z',
    }
  }

  function ActivityCount() {
    const { data } = useWaypoints()
    return <div>Activities: {data.activities.length}</div>
  }

  function renderLayout(width = 1200) {
    setViewport(width)
    render(
      <MemoryRouter>
        <WaypointsProvider>
          <Layout>
            <ActivityCount />
            <div>Page content</div>
          </Layout>
        </WaypointsProvider>
      </MemoryRouter>,
    )
  }

  it('renders navigation links and page content', () => {
    renderLayout()

    expect(screen.getByRole('link', { name: 'Waypoints' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Challenges' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ideas' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Activities' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Map' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByText('Page content')).toBeInTheDocument()
  })

  it('shows a menu button and toggles the drawer on small screens', async () => {
    const user = userEvent.setup()
    renderLayout(400)

    const menuButton = screen.getByLabelText('open navigation')
    expect(menuButton).toBeInTheDocument()

    await user.click(menuButton)
    const links = screen.getAllByRole('link', { name: 'Waypoints' })
    expect(links.length).toBeGreaterThan(0)

    await user.click(links[0])
  })

  it('switches to demo data immediately and back to the personal dataset', async () => {
    const user = userEvent.setup()
    save({ ...createDefaultData(), activities: [activity()] })
    renderLayout()

    const demoSwitch = screen.getByRole('switch', { name: 'Demo data' })
    expect(demoSwitch).not.toBeChecked()
    expect(screen.getByText('Personal data')).toBeInTheDocument()
    expect(screen.getByText('Activities: 1')).toBeInTheDocument()

    await user.click(demoSwitch)

    expect(isDemoModeEnabled()).toBe(true)
    expect(await screen.findByText('Demo active')).toBeInTheDocument()
    expect(screen.getByText(`Activities: ${createDemoModeData().activities.length}`)).toBeInTheDocument()

    await user.click(screen.getByRole('switch', { name: 'Demo data' }))

    expect(isDemoModeEnabled()).toBe(false)
    expect(await screen.findByText('Personal data')).toBeInTheDocument()
    expect(screen.getByText('Activities: 1')).toBeInTheDocument()
    expect(load().activities).toEqual([activity()])
  })
})
