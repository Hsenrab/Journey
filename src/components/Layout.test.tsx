import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Layout } from './Layout'

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
  beforeEach(() => setViewport(1200))
  afterEach(() => vi.restoreAllMocks())

  it('renders navigation links and page content', () => {
    render(
      <MemoryRouter>
        <Layout>
          <div>Page content</div>
        </Layout>
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Waypoints' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Challenges' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ideas' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Activities' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Map' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByText('Page content')).toBeInTheDocument()
  })

  it('shows a menu button and toggles the drawer on small screens', async () => {
    setViewport(400)
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <Layout>
          <div>Page content</div>
        </Layout>
      </MemoryRouter>,
    )

    const menuButton = screen.getByLabelText('open navigation')
    expect(menuButton).toBeInTheDocument()

    await user.click(menuButton)
    const links = screen.getAllByRole('link', { name: 'Waypoints' })
    expect(links.length).toBeGreaterThan(0)

    await user.click(links[0])
  })
})
