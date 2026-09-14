import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AiPromptButton } from './AiPromptButton'

describe('AiPromptButton', () => {
  it('opens a dialog with the prompt text and copies it to the clipboard', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    render(<AiPromptButton label="Widget JSON" prompt="Example prompt text" />)

    await user.click(screen.getByRole('button', { name: 'Widget JSON AI prompt' }))
    expect(screen.getByRole('heading', { name: 'Widget JSON AI prompt' })).toBeInTheDocument()
    expect(screen.getByDisplayValue('Example prompt text')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Copy prompt' }))
    expect(writeText).toHaveBeenCalledWith('Example prompt text')
  })

  it('shows an inline error when clipboard write is unavailable', async () => {
    const user = userEvent.setup()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    })

    render(<AiPromptButton label="Widget JSON" prompt="Example prompt text" />)

    await user.click(screen.getByRole('button', { name: 'Widget JSON AI prompt' }))
    await user.click(screen.getByRole('button', { name: 'Copy prompt' }))
    expect(screen.getByText('Clipboard is unavailable in this browser.')).toBeInTheDocument()
  })
})
