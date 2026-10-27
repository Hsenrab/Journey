import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Link, RouterProvider } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ActivityEditor } from './ActivityEditor'
import { ApplicationError } from '../app/App'
import { createDefaultData } from '../services/storage'
import { ukToday } from '../domain/activityDate'
import type { ActivityDraft } from '../features/journey/JourneyContext'
import { createAwardTestData } from '../test/demoData'

function setup(
  onSubmit = vi.fn<(draft: ActivityDraft) => Promise<boolean>>().mockResolvedValue(true),
  focusOnOpen = false,
  data = createDefaultData(),
) {
  const onSaved = vi.fn()
  const router = createMemoryRouter(
    [
      {
        path: '/',
        errorElement: <ApplicationError />,
        element: (
          <>
            <Link to="/elsewhere">Leave editor</Link>
            <ActivityEditor
              data={data}
              submitLabel="Save"
              onSubmit={onSubmit}
              onSaved={onSaved}
              focusOnOpen={focusOnOpen}
            />
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
  it('updates reported award feedback after tier and destination selections without writing', async () => {
    const { user, onSubmit } = setup(undefined, false, createAwardTestData())
    fill()
    await user.type(screen.getByRole('combobox', { name: 'Linked waypoint' }), 'Shared Award')
    await user.click(screen.getByRole('option', { name: 'Shared Award Waypoint' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Select Bronze, Silver or Gold.')).toBeInTheDocument()
    await user.click(screen.getByRole('combobox', { name: 'Award tier' }))
    await user.click(screen.getByRole('option', { name: 'Gold' }))
    expect(screen.queryByText('Select Bronze, Silver or Gold.')).not.toBeInTheDocument()
    await user.clear(screen.getByRole('combobox', { name: 'Linked waypoint' }))
    await user.type(screen.getByRole('combobox', { name: 'Linked waypoint' }), 'Ordinary Waypoint')
    await user.click(screen.getByRole('option', { name: 'Ordinary Waypoint' }))
    expect(screen.queryByRole('combobox', { name: 'Award tier' })).not.toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('keeps reported photo errors attached to current rows after reordering', async () => {
    const { user, onSubmit } = setup()
    fill()
    await user.click(screen.getByRole('button', { name: 'Photos (optional)' }))
    await user.click(screen.getByRole('button', { name: 'Add photo reference' }))
    await user.type(screen.getByLabelText('Photo title'), 'Valid photo')
    await user.type(screen.getByLabelText('Photo URL'), 'https://example.com/photo')
    await user.click(screen.getByRole('button', { name: 'Add photo reference' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await user.click(screen.getByRole('button', { name: 'Move photo 2 up' }))
    expect(screen.getAllByLabelText('Photo title')[0]).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getAllByLabelText('Photo title')[1]).toHaveAttribute('aria-invalid', 'false')
    expect(screen.getAllByLabelText('Photo title')[1]).toHaveValue('Valid photo')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('updates reported errors on blur without moving focus, writing, or exposing unrelated untouched errors', async () => {
    const { user, onSubmit } = setup()
    await user.click(screen.getByRole('button', { name: 'Save' }))
    const title = screen.getByLabelText('Activity title')
    const postcode = screen.getByLabelText('Postcode')
    await user.type(title, 'Corrected visit')
    await user.tab()
    expect(title).toHaveAttribute('aria-invalid', 'false')
    expect(postcode).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Activity date')).toHaveFocus()
    await user.clear(title)
    await user.tab()
    expect(title).toHaveAttribute('aria-invalid', 'true')
    await user.type(title, 'Retained visit')
    await user.click(screen.getByRole('combobox', { name: 'Location type' }))
    await user.click(screen.getByRole('option', { name: 'Latitude and longitude' }))
    expect(screen.getByLabelText('Latitude')).toHaveAccessibleDescription('Enter both latitude and longitude.')
    await user.type(screen.getByLabelText('Latitude'), '51')
    await user.type(screen.getByLabelText('Longitude'), '-2')
    await user.tab()
    expect(screen.getByLabelText('Latitude')).toHaveAttribute('aria-invalid', 'false')
    expect(screen.getByLabelText('Activity title')).toHaveValue('Retained visit')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('opts into initial focus only for the explicit recording entry', async () => {
    const { user } = setup(undefined, true)
    expect(screen.getByLabelText('Activity title')).toHaveFocus()
    await user.click(screen.getByLabelText('Postcode'))
    await user.type(screen.getByLabelText('Postcode'), 'GL1')
    expect(screen.getByLabelText('Postcode')).toHaveFocus()
  })

  it('revalidates indexed reported evidence after removing another row', async () => {
    const { user, onSubmit } = setup()
    fill()
    await user.click(screen.getByRole('button', { name: 'References (optional)' }))
    await user.click(screen.getByRole('button', { name: 'Add reference' }))
    await user.type(screen.getByLabelText('Reference title'), 'Valid reference')
    await user.type(screen.getByLabelText('Reference URL'), 'https://example.com')
    await user.click(screen.getByRole('button', { name: 'Add reference' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await user.click(screen.getByRole('button', { name: 'Remove reference 1' }))
    expect(screen.getByLabelText('Reference title')).toHaveAttribute('aria-invalid', 'true')
    await user.type(screen.getByLabelText('Reference title'), 'Corrected reference')
    await user.tab()
    expect(screen.getByLabelText('Reference title')).toHaveAttribute('aria-invalid', 'false')
    expect(screen.getByLabelText('Reference URL')).toHaveAttribute('aria-invalid', 'true')
    expect(onSubmit).not.toHaveBeenCalled()
  })

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
