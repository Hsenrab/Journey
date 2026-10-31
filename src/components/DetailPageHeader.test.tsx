import { Button } from '@mui/material'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { DetailPageHeader } from './DetailPageHeader'

describe('DetailPageHeader', () => {
  it('forwards breadcrumb state and respects a declined activation', () => {
    function Destination() {
      return <output>{JSON.stringify(useLocation().state)}</output>
    }
    const view = render(
      <MemoryRouter>
        <DetailPageHeader
          title="One"
          breadcrumbs={[{ label: 'Results', to: '/waypoints', state: { source: 'one' } }]}
        />
        <Destination />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('link', { name: 'Results' }))
    expect(screen.getByRole('status')).toHaveTextContent('"source":"one"')
    view.unmount()
    render(
      <MemoryRouter>
        <DetailPageHeader
          title="One"
          breadcrumbs={[{ label: 'Results', to: '/waypoints', onClick: (event) => event.preventDefault() }]}
        />
      </MemoryRouter>,
    )
    expect(fireEvent.click(screen.getByRole('link', { name: 'Results' }))).toBe(false)
  })
  it('renders the breadcrumb trail, the title and header actions', () => {
    render(
      <MemoryRouter>
        <DetailPageHeader
          breadcrumbs={[
            { label: 'Waypoints', to: '/waypoints' },
            { label: 'Stourhead', to: '/waypoints/stourhead' },
          ]}
          title="2026-08-01 · Stourhead"
        >
          <Button>Edit activity</Button>
        </DetailPageHeader>
      </MemoryRouter>,
    )

    const trail = screen.getByTestId('detail-breadcrumbs')
    expect(trail).toContainElement(screen.getByRole('link', { name: 'Waypoints' }))
    expect(screen.getByRole('link', { name: 'Stourhead' })).toHaveAttribute('href', '/waypoints/stourhead')
    expect(screen.getByRole('heading', { name: '2026-08-01 · Stourhead', level: 1 })).toBeInTheDocument()
    expect(screen.getByTestId('page-header')).toContainElement(screen.getByRole('button', { name: 'Edit activity' }))
  })
})
