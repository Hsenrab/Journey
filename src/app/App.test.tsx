import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'

describe('location list', () => {
  beforeEach(() => localStorage.clear())

  it('filters locations by a search term', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('link', { name: 'Locations' }))
    await user.type(screen.getByLabelText('Search locations'), 'Chedworth')

    expect(screen.getByText('Chedworth Roman Villa')).toBeInTheDocument()
    expect(screen.queryByText('Dyrham Park')).not.toBeInTheDocument()
  })
})
