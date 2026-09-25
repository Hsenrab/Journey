import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ClickableCard } from './ClickableCard'

describe('ClickableCard', () => {
  it('exposes the title as its accessible link name and supports keyboard focus', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <ClickableCard title="Example waypoint" to="/waypoints/example">
          Card content
        </ClickableCard>
      </MemoryRouter>,
    )

    const card = screen.getByRole('link', { name: 'Example waypoint' })
    expect(card).toHaveAttribute('href', '/waypoints/example')
    await user.tab()
    expect(card).toHaveFocus()
  })
})
