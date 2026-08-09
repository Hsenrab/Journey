import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import MapPage from './MapPage'

describe('MapPage', () => {
  it('renders the map heading and limitation copy', () => {
    render(<MapPage />)
    expect(screen.getByRole('heading', { name: 'Map' })).toBeInTheDocument()
    expect(screen.getByText(/Map visualisation is not implemented yet/)).toBeInTheDocument()
  })
})
