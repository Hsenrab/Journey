import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Ideas from './Ideas'

describe('Ideas', () => {
  it('renders the ideas heading and guidance copy', () => {
    render(<Ideas />)
    expect(screen.getByRole('heading', { name: 'Ideas' })).toBeInTheDocument()
    expect(screen.getByText(/Save inspiration and research here/)).toBeInTheDocument()
  })
})
