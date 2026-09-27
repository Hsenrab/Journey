import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Typography } from '@mui/material'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ClickableCard } from './ClickableCard'

describe('ClickableCard', () => {
  it('exposes the title as its accessible link name and supports keyboard focus', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <ClickableCard to="/waypoints/example">
          {(titleId) => (
            <>
              <Typography id={titleId}>Example waypoint</Typography>
              Card content
            </>
          )}
        </ClickableCard>
      </MemoryRouter>,
    )

    const card = screen.getByRole('link', { name: 'Example waypoint' })
    expect(card).toHaveAttribute('href', '/waypoints/example')
    expect(document.getElementById(card.getAttribute('aria-labelledby') ?? '')).toHaveTextContent('Example waypoint')
    await user.tab()
    expect(card).toHaveFocus()
  })

  it('gives each card a distinct title id', () => {
    render(
      <MemoryRouter>
        <ClickableCard to="/waypoints/one">
          {(titleId) => <Typography id={titleId}>First waypoint</Typography>}
        </ClickableCard>
        <ClickableCard to="/waypoints/two">
          {(titleId) => <Typography id={titleId}>Second waypoint</Typography>}
        </ClickableCard>
      </MemoryRouter>,
    )

    const first = screen.getByRole('link', { name: 'First waypoint' })
    const second = screen.getByRole('link', { name: 'Second waypoint' })
    expect(first.getAttribute('aria-labelledby')).not.toBe(second.getAttribute('aria-labelledby'))
  })
})
