import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Link, RouterProvider } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ActivityEditor } from './ActivityEditor'
import { ApplicationError } from '../app/App'
import { createDefaultData } from '../services/storage'
import { ukToday } from '../domain/activityDate'
import type { ActivityDraft } from '../features/journey/JourneyContext'

function setup(onSubmit = vi.fn<(draft: ActivityDraft) => Promise<boolean>>().mockResolvedValue(true)) {
  const onSaved = vi.fn()
  const router = createMemoryRouter(
    [
      {
        path: '/',
        errorElement: <ApplicationError />,
        element: (
          <>
            <Link to="/elsewhere">Leave editor</Link>
            <ActivityEditor data={createDefaultData()} submitLabel="Save" onSubmit={onSubmit} onSaved={onSaved} />
          </>
        ),
      },
      { path: '/elsewhere', element: <p>Elsewhere</p> },
    ],
    { initialEntries: ['/elsewhere', '/', '/elsewhere'], initialIndex: 1 },
  )
  render(<RouterProvider router={router} />)
  return { router, onSubmit, onSaved, user: userEvent.setup() }
}

function fill() {
  fireEvent.change(screen.getByLabelText('Activity title'), { target: { value: '  Evening walk  ' } })
  fireEvent.change(screen.getByLabelText('Postcode'), { target: { value: 'GL1 1AA' } })
}

describe('Activity recording lifecycle', () => {
  it('prefills UK today, focuses missing title and rejects future dates without submitting', async () => {
    const { user, onSubmit } = setup()
    expect(screen.getByLabelText('Activity date')).toHaveValue(ukToday())
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByLabelText('Activity title')).toHaveFocus()
    expect(screen.getByLabelText('Activity title')).toHaveAccessibleDescription('Activity title is required.')
    fill()
    fireEvent.change(screen.getByLabelText('Activity date'), { target: { value: '9999-01-01' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByLabelText('Activity date')).toHaveFocus()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('locks synchronously, blocks navigation, retains a failed draft and allows deliberate retry', async () => {
    let finish!: (value: boolean) => void
    const onSubmit = vi
      .fn<(draft: ActivityDraft) => Promise<boolean>>()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve
          }),
      )
      .mockResolvedValueOnce(true)
    const { user, router, onSaved } = setup(onSubmit)
    fill()
    const form = screen.getByRole('button', { name: 'Save' }).closest('form')!
    act(() => {
      fireEvent.submit(form)
      fireEvent.submit(form)
    })
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status')).toHaveTextContent('Saving...')
    expect(screen.getByLabelText('Activity title')).toBeDisabled()
    await user.click(screen.getByRole('link', { name: 'Leave editor' }))
    expect(router.state.location.pathname).toBe('/')
    await act(async () => {
      router.navigate(-1)
    })
    expect(router.state.location.pathname).toBe('/')
    await act(async () => {
      router.navigate(1)
    })
    expect(router.state.location.pathname).toBe('/')
    const unload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(unload)
    expect(unload.defaultPrevented).toBe(true)
    await act(async () => {
      finish(false)
    })
    expect(onSaved).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Activity title')).toHaveValue('  Evening walk  ')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSubmit).toHaveBeenCalledTimes(2)
    expect(onSubmit).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Evening walk' }))
    expect(onSaved).toHaveBeenCalledTimes(1)
    await act(async () => {
      await router.navigate('/elsewhere')
    })
    expect(screen.getByText('Elsewhere')).toBeInTheDocument()
  })

  it('renders unexpected failures at the actual root error element with the original message', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const onSubmit = vi
        .fn<(draft: ActivityDraft) => Promise<boolean>>()
        .mockRejectedValue(new Error('Unexpected exact failure'))
      const { user, onSaved } = setup(onSubmit)
      fill()
      await user.click(screen.getByRole('button', { name: 'Save' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('Unexpected exact failure')
      expect(onSaved).not.toHaveBeenCalled()
    } finally {
      consoleError.mockRestore()
    }
  })

  it('starts evidence collapsed, preserves content and reveals the first invalid attachment field', async () => {
    const { user, onSubmit } = setup()
    fill()
    const summary = screen.getByRole('button', { name: 'References (optional)' })
    expect(summary).toHaveAttribute('aria-expanded', 'false')
    await user.click(summary)
    await user.click(screen.getByRole('button', { name: 'Add reference' }))
    await user.click(summary)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.getByLabelText('Reference title')).toHaveFocus())
    expect(summary).toHaveAttribute('aria-expanded', 'true')
    expect(onSubmit).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Reference title'), { target: { value: 'Walk details' } })
    fireEvent.change(screen.getByLabelText('Reference URL'), { target: { value: 'https://example.com/walk' } })
    await user.click(summary)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        references: [expect.objectContaining({ title: 'Walk details' })],
      }),
    )
  })
})
