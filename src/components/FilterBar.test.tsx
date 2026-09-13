import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FilterBar } from './FilterBar'

describe('FilterBar', () => {
  it('places each control in its own grid item', () => {
    const { container } = render(
      <FilterBar>
        <input aria-label="First filter" />
        <input aria-label="Second filter" />
      </FilterBar>,
    )

    expect(container.firstElementChild?.children).toHaveLength(2)
    expect(container.firstElementChild?.children[0]).toContainElement(
      container.querySelector('[aria-label="First filter"]'),
    )
    expect(container.firstElementChild?.children[1]).toContainElement(
      container.querySelector('[aria-label="Second filter"]'),
    )
  })
})
