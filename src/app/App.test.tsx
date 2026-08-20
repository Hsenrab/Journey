import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'

afterEach(cleanup)

describe('waypoint list', () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  it('filters waypoints by a search term', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Search waypoints'), 'Chedworth')

    expect(screen.getByText('Chedworth Roman Villa')).toBeInTheDocument()
    expect(screen.queryByText('Dyrham Park')).not.toBeInTheDocument()
  })

  it('shows each waypoint driving distance', async () => {
    render(<App />)

    expect(screen.getByText('Driving distance: 49 miles from Brockworth (~75 min drive)')).toBeInTheDocument()
  })

  it('sorts waypoints by nearest driving distance first', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('combobox', { name: 'Sort' }))
    await user.click(screen.getByRole('option', { name: 'Distance (nearest first)' }))

    const nearest = screen.getByText('May Hill')
    const farther = screen.getByText('Quarry Bank')
    expect(nearest.compareDocumentPosition(farther) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('filters waypoints at the maximum driving distance inclusively', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('combobox', { name: 'Maximum driving distance' }))
    await user.click(screen.getByRole('option', { name: 'Up to 25 miles' }))

    expect(screen.getByText('Croome')).toBeInTheDocument()
    expect(screen.queryByText('Snowshill Manor and Garden')).not.toBeInTheDocument()
  })
})

describe('activity logging', () => {
  beforeEach(() => localStorage.clear())

  const logActivity = async (user: ReturnType<typeof userEvent.setup>, level: string, date: string) => {
    await user.click(screen.getByRole('button', { name: 'Add activity' }))
    await user.click(screen.getByRole('combobox', { name: 'Activity category' }))
    await user.click(screen.getByRole('option', { name: level }))
    await user.type(screen.getByLabelText('Postcode'), 'SN15 2LG')
    fireEvent.change(screen.getByLabelText('Activity date'), { target: { value: date } })
    await user.click(screen.getByRole('button', { name: 'Save activity' }))
  }

  // This test performs two full activity-logging flows plus a re-render, which is
  // consistently close to the default 10s timeout on slower/loaded CI runners.
  it('records activities, keeps history and derives the highest status', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getAllByRole('link', { name: 'View waypoint' })[0])

    await logActivity(user, 'Gold', '2026-08-01')
    expect(screen.getByText('Activity saved.')).toBeInTheDocument()
    expect(screen.getByText('Category summary: Gold')).toBeInTheDocument()

    await logActivity(user, 'Bronze', '2026-08-02')
    expect(screen.getByText('2026-08-01')).toBeInTheDocument()
    expect(screen.getByText('2026-08-02')).toBeInTheDocument()
    expect(screen.getByText('Category summary: Gold')).toBeInTheDocument()

    cleanup()
    render(<App />)
    await user.click(screen.getByRole('link', { name: 'Waypoints' }))
    await user.click(screen.getAllByRole('link', { name: 'View waypoint' })[0])
    expect(screen.getByText('Category summary: Gold')).toBeInTheDocument()
  }, 20000)
})
