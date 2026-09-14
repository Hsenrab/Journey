import { Button } from '@mui/material'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PageHeader } from './PageHeader'

describe('PageHeader', () => {
  it('keeps the title and header controls together', () => {
    render(
      <PageHeader title="Map">
        <Button>Waypoints</Button>
        <Button>Complete</Button>
      </PageHeader>,
    )

    const header = screen.getByTestId('page-header')
    expect(header).toContainElement(screen.getByRole('heading', { name: 'Map', level: 1 }))
    expect(header).toContainElement(screen.getByRole('button', { name: 'Waypoints' }))
    expect(header).toContainElement(screen.getByRole('button', { name: 'Complete' }))
  })
})
