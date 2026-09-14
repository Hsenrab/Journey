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
    expect(screen.getByRole('textbox', { name: 'AI prompt text' })).toHaveValue('Example prompt text')

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

  it('clears a prior copy error when retrying', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockRejectedValueOnce(new Error('Permission denied')).mockResolvedValueOnce(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    render(<AiPromptButton label="Widget JSON" prompt="Example prompt text" />)

    await user.click(screen.getByRole('button', { name: 'Widget JSON AI prompt' }))
    await user.click(screen.getByRole('button', { name: 'Copy prompt' }))
    expect(await screen.findByText('Could not copy prompt: Permission denied')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Copy prompt' }))
    expect(screen.queryByText('Could not copy prompt: Permission denied')).not.toBeInTheDocument()
  })
})
