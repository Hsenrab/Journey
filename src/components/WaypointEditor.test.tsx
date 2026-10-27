import type { ComponentProps } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WaypointEditor } from './WaypointEditor'
import { createDefaultData } from '../services/storage'
import type { WaypointDraft } from '../features/journey/JourneyContext'
import { WaypointsProvider, useWaypoints } from '../features/journey/JourneyContext'
import { waypointImportExample } from '../domain/draftJsonImport'
import { ApplicationError } from '../app/App'
import type { Waypoint } from '../domain/visit'

function SwitchMode() {
  const { setDataMode } = useWaypoints()
  return <button onClick={() => void setDataMode('demo-local')}>Switch mode</button>
}

function renderEditor(overrides: Partial<ComponentProps<typeof WaypointEditor>> = {}) {
  const onSubmit = vi.fn<(draft: WaypointDraft) => Promise<void>>().mockResolvedValue(undefined)
  const onCancel = vi.fn()
  const data = createDefaultData()
  render(
    <MemoryRouter>
      <WaypointEditor data={data} submitLabel="Save waypoint" onSubmit={onSubmit} onCancel={onCancel} {...overrides} />
    </MemoryRouter>,
  )
  return { onSubmit, onCancel }
}

describe('WaypointEditor', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  const savedWaypoint: Waypoint = {
    waypointId: 'draft-test',
    title: 'Saved waypoint',
    description: 'Saved description',
    category: 'Walk',
    tags: [],
    challengeIds: [],
    completion: { mode: 'once' },
    referenceIds: [],
    photoReferenceIds: [],
  }

  it.each(['new', 'edit'])(
    'preserves every field and both tabs when declining dirty Cancel in %s mode',
    async (mode) => {
      const user = userEvent.setup()
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
      const data = createDefaultData()
      data.challenges.push({
        challengeId: 'planning',
        title: 'Planning challenge',
        description: 'Fictional challenge',
        supportsActivityCategories: false,
      })
      const { onSubmit, onCancel } = renderEditor({
        data,
        initialWaypoint: mode === 'edit' ? savedWaypoint : undefined,
        errorMessage: 'Specific retained save error',
      })
      await user.click(screen.getByRole('combobox', { name: 'Challenges' }))
      await user.click(screen.getByRole('option', { name: 'Planning challenge' }))
      await user.click(screen.getByRole('tab', { name: 'Paste JSON' }))
      const payload = {
        ...waypointImportExample,
        title: 'Draft title',
        tags: ['research', 'visit'],
        completion: { mode: 'count', target: 3 },
        location: { placeName: 'Draft place', latitude: 51, longitude: -2, approximate: true },
        references: [
          { title: 'Second guide first', url: 'https://example.com/second' },
          { title: 'First guide second', url: 'https://example.com/first' },
        ],
        photoReferences: [
          { title: 'Second photo first', url: 'https://example.com/second.jpg', altText: 'Second' },
          { title: 'First photo second', url: 'https://example.com/first.jpg', altText: 'First' },
        ],
      }
      fireEvent.change(screen.getByLabelText('Waypoint JSON'), { target: { value: JSON.stringify(payload) } })
      await user.click(screen.getByRole('button', { name: 'Load into form' }))
      fireEvent.change(screen.getByRole('textbox', { name: 'Category' }), { target: { value: '' } })
      await user.click(screen.getByRole('button', { name: 'Save waypoint' }))
      expect(screen.getByText('Waypoint category is required.')).toBeInTheDocument()
      const values = () =>
        screen.getAllByRole<HTMLInputElement | HTMLTextAreaElement>('textbox').map((field) => field.value)
      const before = values()
      await user.click(screen.getByRole('tab', { name: 'Paste JSON' }))
      fireEvent.change(screen.getByLabelText('Waypoint JSON'), { target: { value: '{invalid' } })
      await user.click(screen.getByRole('button', { name: 'Load into form' }))
      for (let attempt = 0; attempt < 2; attempt++) await user.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(confirm).toHaveBeenCalledTimes(2)
      expect(confirm).toHaveBeenCalledWith('You have unsaved Waypoint changes. Discard them?')
      expect(screen.getByRole('tab', { name: 'Paste JSON' })).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByLabelText('Waypoint JSON')).toHaveValue('{invalid')
      expect(screen.getByText('Invalid JSON. Paste a valid JSON object.')).toBeInTheDocument()
      expect(screen.getByText('Specific retained save error')).toBeInTheDocument()
      await user.click(screen.getByRole('tab', { name: 'Form' }))
      expect(values()).toEqual(before)
      expect(screen.getByText('Planning challenge')).toBeInTheDocument()
      expect(screen.getByRole('combobox', { name: 'Completion mode' })).toHaveTextContent('Count')
      expect(screen.getByLabelText('Approximate location')).toBeChecked()
      expect(screen.getByText('Waypoint category is required.')).toBeInTheDocument()
      expect(onSubmit).not.toHaveBeenCalled()
      expect(onCancel).not.toHaveBeenCalled()
    },
  )

  it.each(['new', 'edit'])('confirms deliberate discard without submitting in %s mode', async (mode) => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { onSubmit, onCancel } = renderEditor({ initialWaypoint: mode === 'edit' ? savedWaypoint : undefined })
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Abandoned title' } })
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(confirm).toHaveBeenCalledOnce()
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it.each(['new', 'edit'])('cancels unchanged and fully reverted %s drafts without prompting', async (mode) => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm')
    const initialWaypoint = mode === 'edit' ? savedWaypoint : undefined
    const { onSubmit, onCancel } = renderEditor({ initialWaypoint })
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Temporary' } })
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: initialWaypoint?.title ?? '' } })
    await user.click(screen.getByRole('button', { name: 'Add reference' }))
    await user.click(screen.getByRole('button', { name: 'Remove reference 1' }))
    await user.click(screen.getByRole('button', { name: 'Add photo reference' }))
    await user.click(screen.getByRole('button', { name: 'Remove photo 1' }))
    await user.click(screen.getByRole('tab', { name: 'Paste JSON' }))
    fireEvent.change(screen.getByLabelText('Waypoint JSON'), { target: { value: ' \n ' } })
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(2)
    expect(confirm).not.toHaveBeenCalled()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('does not treat validation errors alone as unsaved changes', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm')
    const { onSubmit, onCancel } = renderEditor()
    await user.click(screen.getByRole('button', { name: 'Save waypoint' }))
    expect(screen.getByText('Waypoint title is required.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
    expect(confirm).not.toHaveBeenCalled()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('omits Cancel when no callback was provided', () => {
    renderEditor({ onCancel: undefined })
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
  })

  it('locks a pending waypoint save synchronously and restores the retained draft after settlement', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    let finish!: () => void
    const pending = new Promise<void>((resolve) => {
      finish = resolve
    })
    const onSubmit = vi
      .fn<(draft: WaypointDraft) => Promise<void>>()
      .mockReturnValueOnce(pending)
      .mockResolvedValue(undefined)
    const { onCancel } = renderEditor({
      initialWaypoint: savedWaypoint,
      onSubmit,
      errorMessage: 'Handled save failure',
    })
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Retained draft' } })
    const cancel = screen.getByRole('button', { name: 'Cancel' })
    const form = cancel.closest('form')!
    act(() => {
      fireEvent.submit(form)
      fireEvent.submit(form)
      fireEvent.click(cancel)
    })
    expect(onSubmit).toHaveBeenCalledOnce()
    expect(onCancel).not.toHaveBeenCalled()
    expect(confirm).not.toHaveBeenCalled()
    expect(cancel).toBeDisabled()
    expect(screen.getByLabelText('Title')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled()
    expect(form).toHaveAttribute('aria-busy', 'true')
    await act(async () => finish())
    expect(cancel).toBeEnabled()
    expect(screen.getByLabelText('Title')).toBeEnabled()
    expect(screen.getByLabelText('Title')).toHaveValue('Retained draft')
    expect(screen.getByText('Handled save failure')).toBeInTheDocument()
    await user.click(cancel)
    expect(confirm).toHaveBeenCalledOnce()
    expect(onCancel).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Save waypoint' }))
    expect(onSubmit).toHaveBeenCalledTimes(2)
    expect(screen.getByLabelText('Title')).toHaveValue('Retained draft')
  })

  it.each([new Error('Exact unexpected Waypoint failure'), 0])(
    'surfaces an escaped callback failure at the root: %s',
    async (failure) => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      try {
        const onSubmit = vi.fn<(draft: WaypointDraft) => Promise<void>>().mockRejectedValue(failure)
        const router = createMemoryRouter([
          {
            path: '/',
            errorElement: <ApplicationError />,
            element: (
              <WaypointEditor
                data={createDefaultData()}
                initialWaypoint={savedWaypoint}
                submitLabel="Save"
                onSubmit={onSubmit}
              />
            ),
          },
        ])
        render(<RouterProvider router={router} />)
        await userEvent.setup().click(screen.getByRole('button', { name: 'Save' }))
        expect(await screen.findByRole('alert')).toHaveTextContent(
          failure instanceof Error ? failure.message : String(failure),
        )
      } finally {
        consoleError.mockRestore()
      }
    },
  )

  it.each([
    {
      name: 'changed name',
      changes: { 'Place name': 'New place' },
      expected: { placeName: 'New place', addressOrRegion: 'Old address', source: 'Survey' },
    },
    {
      name: 'changed address',
      changes: { 'Address or region': 'New address' },
      expected: { placeName: 'Old place', addressOrRegion: 'New address', source: 'Survey' },
    },
    { name: 'cleared named location', changes: { 'Place name': '', 'Address or region': '' }, expected: undefined },
    {
      name: 'manual pair with cleared text',
      changes: { 'Place name': '', 'Address or region': '', Latitude: '52' },
      expected: { latitude: 52, longitude: -2, source: 'Survey' },
    },
    {
      name: 'equivalent input',
      changes: { 'Place name': ' Old place ', Latitude: '51.0' },
      expected: {
        placeName: 'Old place',
        addressOrRegion: 'Old address',
        latitude: 51,
        longitude: -2,
        source: 'Survey',
      },
    },
    {
      name: 'metadata change',
      changes: { Source: 'Manual' },
      expected: {
        placeName: 'Old place',
        addressOrRegion: 'Old address',
        latitude: 51,
        longitude: -2,
        source: 'Manual',
      },
    },
    {
      name: 'cleared pair',
      changes: { Latitude: '', Longitude: '' },
      expected: { placeName: 'Old place', addressOrRegion: 'Old address', source: 'Survey' },
    },
  ])('submits effective location for $name without changing visible fields', async ({ changes, expected }) => {
    const initialWaypoint = {
      waypointId: 'one',
      title: 'Existing',
      description: 'Description',
      category: 'Walk',
      tags: [],
      challengeIds: [],
      completion: { mode: 'once' as const },
      referenceIds: [],
      photoReferenceIds: [],
      location: {
        placeName: 'Old place',
        addressOrRegion: 'Old address',
        latitude: 51,
        longitude: -2,
        source: 'Survey',
      },
    }
    const { onSubmit } = renderEditor({ initialWaypoint, errorMessage: 'Resolution failed' })
    for (const [label, value] of Object.entries(changes)) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } })
    }
    fireEvent.click(screen.getByRole('button', { name: 'Save waypoint' }))
    expect(onSubmit).toHaveBeenCalledOnce()
    if (expected)
      expect(onSubmit.mock.calls[0][0].location).toEqual({
        approximate: undefined,
        placeName: undefined,
        addressOrRegion: undefined,
        ...expected,
      })
    else expect(onSubmit.mock.calls[0][0].location).toBeUndefined()
    for (const [label, value] of Object.entries(changes)) expect(screen.getByLabelText(label)).toHaveValue(value)
    expect(screen.getByText('Resolution failed')).toBeInTheDocument()
  })

  it.each([
    { latitude: '51', longitude: '', source: '', message: 'Enter both latitude and longitude.' },
    { latitude: '91', longitude: '-2', source: '', message: 'Latitude must be between -90 and 90.' },
    { latitude: '', longitude: '', source: 'Metadata', message: 'Enter a place name, address, or both coordinates.' },
  ])('rejects invalid location input: $message', ({ latitude, longitude, source, message }) => {
    const { onSubmit } = renderEditor()
    for (const [label, value] of Object.entries({
      Title: 'Title',
      Description: 'Description',
      Category: 'Walk',
      Latitude: latitude,
      Longitude: longitude,
      Source: source,
    })) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } })
    }
    fireEvent.click(screen.getByRole('button', { name: 'Save waypoint' }))
    expect(screen.getByText(message)).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('preserves an unchanged coordinate-only location', async () => {
    const initialWaypoint = {
      waypointId: 'coordinates',
      title: 'Existing',
      description: 'Description',
      category: 'Walk',
      tags: [],
      challengeIds: [],
      completion: { mode: 'once' as const },
      referenceIds: [],
      photoReferenceIds: [],
      location: { latitude: 51, longitude: -2 },
    }
    const { onSubmit } = renderEditor({ initialWaypoint })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save waypoint' })))
    expect(onSubmit.mock.calls[0][0].location).toEqual({ latitude: 51, longitude: -2 })
  })

  it('submits a JSON-loaded searchable add location through the same validation path', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderEditor()
    await user.click(screen.getByRole('tab', { name: 'Paste JSON' }))
    fireEvent.change(screen.getByLabelText('Waypoint JSON'), {
      target: {
        value: JSON.stringify({
          ...waypointImportExample,
          location: { placeName: 'New place' },
        }),
      },
    })
    await user.click(screen.getByRole('button', { name: 'Load into form' }))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save waypoint' })))
    expect(onSubmit.mock.calls[0][0].location).toEqual({ placeName: 'New place' })
  })

  it.each(['{invalid', JSON.stringify(waypointImportExample)])(
    'preserves unapplied JSON on cancellation and discards it on a direct switch: %s',
    async (text) => {
      localStorage.clear()
      const user = userEvent.setup()
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
      render(
        <MemoryRouter>
          <WaypointsProvider>
            <SwitchMode />
            <WaypointEditor
              data={createDefaultData()}
              submitLabel="Save"
              onSubmit={vi.fn().mockResolvedValue(undefined)}
              onCancel={vi.fn()}
            />
          </WaypointsProvider>
        </MemoryRouter>,
      )
      await user.click(screen.getByRole('tab', { name: 'Paste JSON' }))
      fireEvent.change(screen.getByLabelText('Waypoint JSON'), { target: { value: text } })
      await user.click(screen.getByText('Switch mode'))
      expect(confirm).toHaveBeenCalledTimes(1)
      expect(screen.getByLabelText('Waypoint JSON')).toHaveValue(text)
      confirm.mockReturnValue(true)
      await user.click(screen.getByText('Switch mode'))
      expect(screen.getByLabelText('Title')).toHaveValue('')
      await user.click(screen.getByRole('tab', { name: 'Paste JSON' }))
      expect(screen.getByLabelText('Waypoint JSON')).toHaveValue('')
    },
  )

  it('ignores whitespace JSON but clearing JSON retains applied form/reference/photo dirtiness', async () => {
    const user = userEvent.setup()
    renderEditor()
    await user.click(screen.getByRole('tab', { name: 'Paste JSON' }))
    fireEvent.change(screen.getByLabelText('Waypoint JSON'), { target: { value: ' \n ' } })
    const unchanged = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(unchanged)
    expect(unchanged.defaultPrevented).toBe(false)
    fireEvent.change(screen.getByLabelText('Waypoint JSON'), {
      target: { value: JSON.stringify(waypointImportExample) },
    })
    await user.click(screen.getByRole('button', { name: 'Load into form' }))
    await user.click(screen.getByRole('tab', { name: 'Paste JSON' }))
    fireEvent.change(screen.getByLabelText('Waypoint JSON'), { target: { value: '' } })
    const changed = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(changed)
    expect(changed.defaultPrevented).toBe(true)
  })

  it('tracks applied form edits separately from unapplied JSON', async () => {
    const user = userEvent.setup()
    renderEditor()
    const text = JSON.stringify({
      title: 'Imported',
      description: 'Imported description',
      category: 'Walk',
      tags: [],
      completion: { mode: 'once' },
      references: [],
      photoReferences: [],
    })
    const isDirty = () => {
      const event = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(event)
      return event.defaultPrevented
    }
    await user.click(screen.getByRole('tab', { name: 'Paste JSON' }))
    fireEvent.change(screen.getByLabelText('Waypoint JSON'), { target: { value: text } })
    await user.click(screen.getByRole('button', { name: 'Load into form' }))
    expect(isDirty()).toBe(true)
    for (const label of ['Title', 'Description', 'Category'])
      fireEvent.change(screen.getByLabelText(label), { target: { value: '' } })
    expect(isDirty()).toBe(false)
    await user.click(screen.getByRole('tab', { name: 'Paste JSON' }))
    expect(screen.getByLabelText('Waypoint JSON')).toHaveValue(text)
    fireEvent.change(screen.getByLabelText('Waypoint JSON'), { target: { value: '{invalid' } })
    await user.click(screen.getByRole('button', { name: 'Load into form' }))
    expect(isDirty()).toBe(true)
    fireEvent.change(screen.getByLabelText('Waypoint JSON'), { target: { value: text } })
    expect(isDirty()).toBe(false)
  })

  it('validates required fields, completion, coordinates, references and photos', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderEditor()

    await user.click(screen.getByRole('button', { name: 'Save waypoint' }))
    expect(screen.getByText('Waypoint title is required.')).toBeInTheDocument()
    expect(screen.getByText('Waypoint description is required.')).toBeInTheDocument()
    expect(screen.getByText('Waypoint category is required.')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'A viewpoint' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'A quiet viewpoint' } })
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Scenic' } })
    await user.click(screen.getByRole('combobox', { name: 'Completion mode' }))
    await user.click(screen.getByRole('option', { name: 'Count' }))
    fireEvent.change(screen.getByLabelText('Completion target'), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '91' } })
    fireEvent.change(screen.getByLabelText('Longitude'), { target: { value: '-1' } })
    await user.click(screen.getByRole('button', { name: 'Add reference' }))
    await user.click(screen.getByRole('button', { name: 'Add photo reference' }))
    await user.click(screen.getByRole('button', { name: 'Save waypoint' }))

    expect(screen.getByText('Target must be a positive whole number.')).toBeInTheDocument()
    expect(screen.getByText('Latitude must be between -90 and 90.')).toBeInTheDocument()
    expect(screen.getByText('Reference title is required.')).toBeInTheDocument()
    expect(screen.getByText('Reference URL must start with https://.')).toBeInTheDocument()
    expect(screen.getByText('Photo title is required.')).toBeInTheDocument()
    expect(screen.getByText('Photo URL must start with https://.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits trimmed fields with a valid count completion and coordinates', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderEditor()

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: ' A viewpoint ' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: ' A quiet viewpoint ' } })
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: ' Scenic ' } })
    fireEvent.change(screen.getByLabelText('Tags (comma-separated)'), { target: { value: ' sunrise,  walk ,, ' } })
    await user.click(screen.getByRole('combobox', { name: 'Completion mode' }))
    await user.click(screen.getByRole('option', { name: 'Count' }))
    fireEvent.change(screen.getByLabelText('Completion target'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Place name'), { target: { value: ' Brockworth ' } })
    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '51.75' } })
    fireEvent.change(screen.getByLabelText('Longitude'), { target: { value: '-1.26' } })
    await user.click(screen.getByLabelText('Approximate location'))
    await user.click(screen.getByRole('button', { name: 'Save waypoint' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'A viewpoint',
        description: 'A quiet viewpoint',
        category: 'Scenic',
        tags: ['sunrise', 'walk'],
        completion: { mode: 'count', target: 2 },
        location: {
          placeName: 'Brockworth',
          latitude: 51.75,
          longitude: -1.26,
          approximate: true,
        },
      }),
    )
  })

  it('adds and removes references and photo references', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: 'Add reference' }))
    await user.click(screen.getByRole('button', { name: 'Remove reference 1' }))
    await user.click(screen.getByRole('button', { name: 'Add photo reference' }))
    await user.click(screen.getByRole('button', { name: 'Remove photo 1' }))

    expect(screen.queryByText('Reference 1')).not.toBeInTheDocument()
    expect(screen.queryByText('Photo 1')).not.toBeInTheDocument()
  })

  it('loads valid pasted JSON into the form before submit', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderEditor()
    const payload = {
      title: 'Load from JSON',
      description: 'A waypoint loaded from pasted JSON',
      category: 'Scenic',
      tags: ['sunrise', 'walk'],
      completion: { mode: 'count', target: 2 },
      location: { placeName: 'Brockworth', approximate: true },
      references: [{ title: 'Guide', url: 'https://example.com/guide', description: '', previewImageUrl: '' }],
      photoReferences: [{ title: 'Photo', url: 'https://example.com/photo.jpg', altText: '' }],
    }

    await user.click(screen.getByRole('tab', { name: 'Paste JSON' }))
    await user.click(screen.getByLabelText('Waypoint JSON'))
    await user.paste(JSON.stringify(payload))
    await user.click(screen.getByRole('button', { name: 'Load into form' }))
    await user.click(screen.getByRole('button', { name: 'Save waypoint' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: payload.title,
        description: payload.description,
        category: payload.category,
        tags: payload.tags,
        challengeIds: [],
        completion: payload.completion,
        references: [expect.objectContaining({ title: 'Guide' })],
        photoReferences: [expect.objectContaining({ title: 'Photo' })],
      }),
    )
  })

  it('keeps pasted JSON and shows malformed and schema errors', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('tab', { name: 'Paste JSON' }))
    const input = screen.getByLabelText('Waypoint JSON')

    await user.click(input)
    await user.paste('{bad')
    await user.click(screen.getByRole('button', { name: 'Load into form' }))
    expect(screen.getByText('Invalid JSON. Paste a valid JSON object.')).toBeInTheDocument()
    expect(input).toHaveValue('{bad')

    await user.clear(input)
    await user.click(input)
    await user.paste(
      JSON.stringify({
        title: 'Bad draft',
        description: 123,
        category: 'Scenic',
        tags: [],
        completion: { mode: 'once' },
        references: [],
        photoReferences: [],
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Load into form' }))
    expect(screen.getByText('JSON does not match the waypoint draft shape.')).toBeInTheDocument()
    expect(screen.getByText(/description: Invalid input/)).toBeInTheDocument()
  })

  it('rejects arrays and forbidden id fields in pasted JSON', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('tab', { name: 'Paste JSON' }))
    const input = screen.getByLabelText('Waypoint JSON')

    await user.click(input)
    await user.paste('[]')
    await user.click(screen.getByRole('button', { name: 'Load into form' }))
    expect(screen.getByText('Paste a single object, not an array.')).toBeInTheDocument()

    await user.clear(input)
    await user.click(input)
    await user.paste(
      JSON.stringify({
        waypointId: 'waypoint-1',
        title: 'Bad draft',
        description: '',
        category: 'Scenic',
        tags: [],
        completion: { mode: 'once' },
        references: [],
        photoReferences: [],
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Load into form' }))
    expect(screen.getByText(/Remove 'waypointId' — IDs are assigned automatically./)).toBeInTheDocument()
  })

  it('shows clipboard errors and clears JSON issues', async () => {
    const user = userEvent.setup()
    renderEditor()
    const originalClipboard = navigator.clipboard
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })

    try {
      await user.click(screen.getByRole('tab', { name: 'Paste JSON' }))
      await user.click(screen.getByLabelText('Waypoint JSON'))
      await user.paste(
        JSON.stringify({
          title: 'Bad draft',
          description: 123,
          category: 'Scenic',
          tags: [],
          completion: { mode: 'once' },
          references: [],
          photoReferences: [],
        }),
      )
      await user.click(screen.getByRole('button', { name: 'Load into form' }))
      expect(screen.getByText(/description: Invalid input/)).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Copy example JSON' }))
      expect(screen.getByText('Clipboard is unavailable in this browser.')).toBeInTheDocument()
      expect(screen.queryByText(/description: Invalid input/)).not.toBeInTheDocument()
    } finally {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: originalClipboard })
    }
  })

  it('shows an AI prompt button that opens the Waypoint JSON prompt dialog', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('tab', { name: 'Paste JSON' }))
    await user.click(screen.getByRole('button', { name: 'Waypoint JSON AI prompt' }))
    expect(screen.getByRole('heading', { name: 'Waypoint JSON AI prompt' })).toBeInTheDocument()
    expect(screen.getByDisplayValue(/destination or place-based experience/)).toBeInTheDocument()
  })
})
