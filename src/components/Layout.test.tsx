import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Layout } from './Layout'
import { WaypointsProvider, useWaypoints } from '../features/journey/JourneyContext'
import { createDefaultData, save } from '../services/storage'

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
    expect(screen.getByRole('link', { name: 'Journey' })).toHaveAttribute('href', '/challenges')
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

  it('keeps the data mode selector out of the app bar while showing the status chip', () => {
    save({ ...createDefaultData(), activities: [] })
    renderLayout()

    expect(screen.queryByRole('combobox', { name: 'Data mode' })).not.toBeInTheDocument()
    expect(screen.getByText('Production')).toBeInTheDocument()
    expect(screen.getByText('Activities: 0')).toBeInTheDocument()
  })
})
