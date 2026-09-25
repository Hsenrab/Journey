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
        <ClickableCard titleId="example-waypoint-title" to="/waypoints/example">
          <Typography id="example-waypoint-title">Example waypoint</Typography>
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
