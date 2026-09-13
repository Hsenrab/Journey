import { render, screen } from '@testing-library/react'
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined'
import { describe, expect, it } from 'vitest'
import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  it('shows an icon, message, and optional action', () => {
    render(
      <EmptyState
        icon={<InboxOutlinedIcon data-testid="empty-state-icon" />}
        message="Nothing here yet."
        action={<button type="button">Add one</button>}
      />,
    )

    expect(screen.getByTestId('empty-state-icon')).toBeInTheDocument()
    expect(screen.getByText('Nothing here yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add one' })).toBeInTheDocument()
  })
})
