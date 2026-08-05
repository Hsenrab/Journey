import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'

describe('location list', () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  it('filters locations by a search term', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('link', { name: 'Locations' }))
    await user.type(screen.getByLabelText('Search locations'), 'Chedworth')

    expect(screen.getByText('Chedworth Roman Villa')).toBeInTheDocument()
    expect(screen.queryByText('Dyrham Park')).not.toBeInTheDocument()
  })

  it('shows each location driving distance', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('link', { name: 'Locations' }))

    expect(screen.getByText('Driving distance: 13 miles from Brockworth (~30 min drive)')).toBeInTheDocument()
  })

  it('sorts locations by nearest driving distance first', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('link', { name: 'Locations' }))
    await user.click(screen.getByRole('combobox', { name: 'Sort' }))
    await user.click(screen.getByRole('option', { name: 'Distance (nearest first)' }))

    const nearest = screen.getByText('May Hill')
    const farther = screen.getByText('Cragside')
    expect(nearest.compareDocumentPosition(farther) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('filters locations at the maximum driving distance inclusively', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('link', { name: 'Locations' }))
    await user.click(screen.getByRole('combobox', { name: 'Maximum driving distance' }))
    await user.click(screen.getByRole('option', { name: 'Up to 25 miles' }))

    expect(screen.getByText('Hidcote')).toBeInTheDocument()
    expect(screen.queryByText('Snowshill Manor and Garden')).not.toBeInTheDocument()
  })
})
