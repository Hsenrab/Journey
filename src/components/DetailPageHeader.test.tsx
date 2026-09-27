import { Button } from '@mui/material'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { DetailPageHeader } from './DetailPageHeader'

describe('DetailPageHeader', () => {
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
