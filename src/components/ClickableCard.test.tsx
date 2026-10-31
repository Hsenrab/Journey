import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Typography } from '@mui/material'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ClickableCard } from './ClickableCard'

describe('ClickableCard', () => {
  it('forwards opt-in state, activation and the actual anchor ref', async () => {
    const anchor = createRef<HTMLAnchorElement>()
    const click = vi.fn()
    function Destination() {
      return <output>{JSON.stringify(useLocation().state)}</output>
    }
    render(
      <MemoryRouter>
        <ClickableCard to="/waypoints/one" state={{ discovery: 'one' }} onClick={click} anchorRef={anchor}>
          {(id) => <span id={id}>One</span>}
        </ClickableCard>
        <Destination />
      </MemoryRouter>,
    )
    expect(anchor.current).toBe(screen.getByRole('link', { name: 'One' }))
    await userEvent.click(anchor.current!)
    expect(click).toHaveBeenCalledOnce()
    expect(screen.getByRole('status')).toHaveTextContent('"discovery":"one"')
  })

  it('honors prevented activation without replacing the real href', () => {
    render(
      <MemoryRouter>
        <ClickableCard to="/waypoints/one" onClick={(event) => event.preventDefault()}>
          {(id) => <span id={id}>One</span>}
        </ClickableCard>
      </MemoryRouter>,
    )
    expect(fireEvent.click(screen.getByRole('link', { name: 'One' }))).toBe(false)
    expect(screen.getByRole('link', { name: 'One' })).toHaveAttribute('href', '/waypoints/one')
  })
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
