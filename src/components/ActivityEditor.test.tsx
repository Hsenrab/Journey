import type { ComponentProps } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ActivityEditor } from './ActivityEditor'
import { createDemoModeData } from '../services/storage'
import type { ActivityDraft } from '../features/journey/JourneyContext'
import { createActivity, GpxGeometrySchema } from '../domain/visit'

const createDefaultData = createDemoModeData

function renderEditor(overrides: Partial<ComponentProps<typeof ActivityEditor>> = {}) {
  const onSubmit = vi.fn<(draft: ActivityDraft) => void>()
  const onCancel = vi.fn()
  const onDelete = vi.fn()
  const data = createDefaultData()

  render(
    <MemoryRouter>
      <ActivityEditor
        data={data}
        submitLabel="Save"
        onSubmit={onSubmit}
        onCancel={onCancel}
        onDelete={onDelete}
        {...overrides}
      />
    </MemoryRouter>,
  )

  return { data, onSubmit, onCancel, onDelete }
}

function gpxFile(xml: string, name = 'recorded.gpx') {
  const file = new File([xml], name, { type: 'application/gpx+xml' })
  Object.defineProperty(file, 'text', { value: () => Promise.resolve(xml) })
  return file
}

const gpxXml = (longitude: string) =>
  `<gpx><trk><trkseg><trkpt lat="51.5" lon="${longitude}" /><trkpt lat="51.6" lon="-2.2" /></trkseg></trk></gpx>`

describe('ActivityEditor', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('submits postcode activity data', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderEditor()

    await user.type(screen.getByLabelText('Postcode'), 'GL1 1AA')
    await user.type(screen.getByLabelText('Description / notes'), 'Nice day')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        ideaIds: [],
        location: { kind: 'postcode', postcode: 'GL1 1AA' },
        notes: 'Nice day',
      }),
    )
  })

  it('attaches and replaces a GPX track in the shared activity form', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderEditor()
    const input = screen.getByLabelText('GPX track file')
    const replacementTrack = GpxGeometrySchema.parse({
      type: 'MultiLineString',
      coordinates: [
        [
          [-3.1, 51.5],
          [-2.2, 51.6],
        ],
      ],
    })

    await user.upload(input, gpxFile(gpxXml('-2.1')))
    expect(await screen.findByText('A recorded GPX track is attached.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Replace GPX track' })).toBeInTheDocument()
    await user.upload(input, gpxFile(gpxXml('-3.1'), 'replacement.gpx'))
    await user.type(screen.getByLabelText('Postcode'), 'GL1 1AA')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ recordedTrack: replacementTrack }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ recordedTrack: replacementTrack }))
  })

  it('disables track actions while parsing and ignores stale GPX results', async () => {
    const user = userEvent.setup()
    const initialActivity = createActivity({
      activityId: 'activity-with-track',
      date: '2026-09-04',
      location: { kind: 'postcode', postcode: 'GL1 1AA' },
      recordedTrack: {
        type: 'MultiLineString',
        coordinates: [
          [
            [-2.1, 51.5],
            [-2.2, 51.6],
          ],
        ],
      },
    })
    const { onSubmit } = renderEditor({ initialActivity })
    const input = screen.getByLabelText('GPX track file')
    const pendingReads: Array<(xml: string) => void> = []
    const pendingFile = (name: string) => {
      const file = new File([], name, { type: 'application/gpx+xml' })
      Object.defineProperty(file, 'text', {
        value: () =>
          new Promise<string>((resolve) => {
            pendingReads.push(resolve)
          }),
      })
      return file
    }

    await user.upload(input, pendingFile('first.gpx'))
    expect(screen.getByRole('button', { name: 'Replace GPX track' })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('button', { name: 'Remove GPX track' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    fireEvent.submit(input.closest('form')!)
    expect(onSubmit).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { files: [pendingFile('second.gpx')] } })
    await act(async () => pendingReads[1]!(gpxXml('-3.1')))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled())
    await act(async () => pendingReads[0]!(gpxXml('-2.1')))

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        recordedTrack: {
          type: 'MultiLineString',
          coordinates: [
            [
              [-3.1, 51.5],
              [-2.2, 51.6],
            ],
          ],
        },
      }),
    )
  })

  it('removes an existing GPX track', async () => {
    const user = userEvent.setup()
    const initialActivity = createActivity({
      activityId: 'activity-with-track',
      date: '2026-09-04',
      location: { kind: 'postcode', postcode: 'GL1 1AA' },
      recordedTrack: {
        type: 'MultiLineString',
        coordinates: [
          [
            [-2.1, 51.5],
            [-2.2, 51.6],
          ],
        ],
      },
    })
    const { onSubmit } = renderEditor({ initialActivity })

    await user.click(screen.getByRole('button', { name: 'Remove GPX track' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ recordedTrack: undefined }))
  })

  it('reports invalid GPX without losing other edits or an existing track', async () => {
    const user = userEvent.setup()
    const recordedTrack = GpxGeometrySchema.parse({
      type: 'MultiLineString',
      coordinates: [
        [
          [-2.1, 51.5],
          [-2.2, 51.6],
        ],
      ],
    })
    const initialActivity = createActivity({
      activityId: 'activity-with-track',
      date: '2026-09-04',
      location: { kind: 'postcode', postcode: 'GL1 1AA' },
      recordedTrack,
    })
    const { onSubmit } = renderEditor({ initialActivity })

    await user.clear(screen.getByLabelText('Description / notes'))
    await user.type(screen.getByLabelText('Description / notes'), 'Other edits remain')
    await user.upload(screen.getByLabelText('GPX track file'), gpxFile('<not-gpx />'))

    expect(await screen.findByText('The selected file is not a GPX document.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ notes: 'Other edits remain', recordedTrack })),
    )
  })

  it('validates a missing postcode', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByText('Postcode is required.')).toBeInTheDocument()
  })

  it('validates coordinate pairs', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('combobox', { name: 'Location type' }))
    await user.click(screen.getByRole('option', { name: 'Latitude and longitude' }))
    await user.type(screen.getByLabelText('Latitude'), '91')
    await user.type(screen.getByLabelText('Longitude'), '-1')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByText('Latitude must be between -90 and 90.')).toBeInTheDocument()
  })

  it('requires complete coordinate pairs and longitude range', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('combobox', { name: 'Location type' }))
    await user.click(screen.getByRole('option', { name: 'Latitude and longitude' }))
    await user.type(screen.getByLabelText('Latitude'), '51.75')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Enter both latitude and longitude.')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Longitude'), '181')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Longitude must be between -180 and 180.')).toBeInTheDocument()
  })

  it('shows category for eligible waypoints and clears it when unlinked', async () => {
    const user = userEvent.setup()
    const { data } = renderEditor({ initialWaypointId: dataWaypointId(createDefaultData()) })

    await user.click(screen.getByRole('combobox', { name: 'Activity category' }))
    await user.click(screen.getByRole('option', { name: 'Gold' }))

    await user.click(screen.getByRole('combobox', { name: 'Linked waypoint' }))
    await user.click(screen.getByRole('option', { name: 'No linked waypoint' }))

    expect(
      screen.getByText('Category cleared because the selected waypoint does not support Bronze, Silver or Gold.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Activity category' })).not.toBeInTheDocument()

    expect(
      data.challenges.find((challenge) => challenge.challengeId === 'national-trust')?.supportsActivityCategories,
    ).toBe(true)
  })

  it('prefills the linked waypoint coordinates and still allows a postcode', async () => {
    const user = userEvent.setup()
    const data = createDefaultData()
    const waypoint = data.waypoints[0]!
    const { onSubmit } = renderEditor({ data, initialWaypointId: waypoint.waypointId })

    expect(screen.getByLabelText('Latitude')).toHaveValue(String(waypoint.location!.latitude))
    expect(screen.getByLabelText('Longitude')).toHaveValue(String(waypoint.location!.longitude))

    await user.click(screen.getByRole('combobox', { name: 'Location type' }))
    await user.click(screen.getByRole('option', { name: 'Postcode' }))
    await user.type(screen.getByLabelText('Postcode'), 'GL1 1AA')
    await user.click(screen.getByRole('combobox', { name: 'Activity category' }))
    await user.click(screen.getByRole('option', { name: 'Gold' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ location: { kind: 'postcode', postcode: 'GL1 1AA' } }),
    )
  })

  it('searches waypoints and prefills coordinates when the location is untouched', async () => {
    const user = userEvent.setup()
    const data = createDefaultData()
    const waypoint = data.waypoints[0]!
    const { onSubmit } = renderEditor({ data })

    const picker = screen.getByRole('combobox', { name: 'Linked waypoint' })
    await user.click(picker)
    await user.type(picker, waypoint.title)
    await user.click(screen.getByRole('option', { name: waypoint.title }))

    expect(screen.getByLabelText('Latitude')).toHaveValue(String(waypoint.location!.latitude))
    expect(screen.getByLabelText('Longitude')).toHaveValue(String(waypoint.location!.longitude))

    await user.click(screen.getByRole('combobox', { name: 'Activity category' }))
    await user.click(screen.getByRole('option', { name: 'Gold' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        location: {
          kind: 'coordinates',
          latitude: waypoint.location!.latitude,
          longitude: waypoint.location!.longitude,
        },
      }),
    )
  })

  it('clears auto-prefilled coordinates when selecting a waypoint without coordinates', async () => {
    const user = userEvent.setup()
    const data = createDefaultData()
    const waypoint = data.waypoints[0]!
    const waypointWithoutCoordinates = {
      ...waypoint,
      waypointId: 'waypoint-without-coordinates',
      title: 'Waypoint without coordinates',
      location: undefined,
    }
    data.waypoints.push(waypointWithoutCoordinates)
    renderEditor({ data })

    const picker = screen.getByRole('combobox', { name: 'Linked waypoint' })
    await user.click(picker)
    await user.click(screen.getByRole('option', { name: waypoint.title }))
    expect(screen.getByLabelText('Latitude')).toHaveValue(String(waypoint.location!.latitude))
    expect(screen.getByLabelText('Longitude')).toHaveValue(String(waypoint.location!.longitude))

    await user.click(picker)
    await user.click(screen.getByRole('option', { name: waypointWithoutCoordinates.title }))
    expect(screen.getByLabelText('Postcode')).toHaveValue('')

    await user.click(screen.getByRole('combobox', { name: 'Location type' }))
    await user.click(screen.getByRole('option', { name: 'Latitude and longitude' }))
    expect(screen.getByLabelText('Latitude')).toHaveValue('')
    expect(screen.getByLabelText('Longitude')).toHaveValue('')
  })

  it('does not replace a location the user entered when selecting a waypoint', async () => {
    const user = userEvent.setup()
    const data = createDefaultData()
    const waypoint = data.waypoints[0]!
    renderEditor({ data })

    await user.type(screen.getByLabelText('Postcode'), 'GL1 1AA')
    await user.click(screen.getByRole('combobox', { name: 'Linked waypoint' }))
    await user.click(screen.getByRole('option', { name: waypoint.title }))

    expect(screen.getByLabelText('Postcode')).toHaveValue('GL1 1AA')
    expect(screen.queryByLabelText('Latitude')).not.toBeInTheDocument()
  })

  it('does not treat automatic location prefill as an unsaved change', async () => {
    const user = userEvent.setup()
    const data = createDefaultData()
    const waypoint = data.waypoints[0]!
    const { onCancel } = renderEditor({ data })
    const confirmSpy = vi.spyOn(window, 'confirm')

    await user.click(screen.getByRole('combobox', { name: 'Linked waypoint' }))
    await user.click(screen.getByRole('option', { name: waypoint.title }))
    await user.click(screen.getByRole('combobox', { name: 'Linked waypoint' }))
    await user.click(screen.getByRole('option', { name: 'No linked waypoint' }))

    expect(screen.getByLabelText('Postcode')).toHaveValue('')
    expect(screen.queryByLabelText('Latitude')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(confirmSpy).not.toHaveBeenCalled()
    expect(onCancel).toHaveBeenCalled()
  })

  it('requires category when waypoint supports categories', async () => {
    const user = userEvent.setup()
    renderEditor({ initialWaypointId: dataWaypointId(createDefaultData()) })

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByText('Select Bronze, Silver or Gold.')).toBeInTheDocument()
  })

  it('supports add, reorder and remove for references and photos', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: 'Add reference' }))
    await user.click(screen.getByRole('button', { name: 'Add reference' }))
    await user.click(screen.getByRole('button', { name: 'Move reference 2 up' }))
    await user.click(screen.getByRole('button', { name: 'Remove reference 2' }))

    await user.click(screen.getByRole('button', { name: 'Add photo reference' }))
    await user.click(screen.getByRole('button', { name: 'Add photo reference' }))
    await user.click(screen.getByRole('button', { name: 'Move photo 2 up' }))
    await user.click(screen.getByRole('button', { name: 'Remove photo 2' }))

    expect(screen.getAllByLabelText('Reference title')).toHaveLength(1)
    expect(screen.getAllByLabelText('Photo title')).toHaveLength(1)
  })

  it('keeps the first reference and photo in place when moving up or down', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: 'Add reference' }))
    await user.click(screen.getByRole('button', { name: 'Move reference 1 up' }))
    await user.click(screen.getByRole('button', { name: 'Move reference 1 down' }))
    await user.click(screen.getByRole('button', { name: 'Add photo reference' }))
    await user.click(screen.getByRole('button', { name: 'Add photo reference' }))
    await user.click(screen.getByRole('button', { name: 'Move photo 1 up' }))
    await user.click(screen.getByRole('button', { name: 'Move photo 1 down' }))

    expect(screen.getAllByLabelText('Reference title')).toHaveLength(1)
    expect(screen.getAllByLabelText('Photo title')).toHaveLength(2)
  })

  it('submits trimmed reference and photo metadata', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderEditor({
      initialReferences: [
        {
          referenceId: 'r1',
          title: ' Guide ',
          url: 'https://example.com/guide ',
          description: ' Details ',
          previewImageUrl: 'https://example.com/preview.jpg ',
        },
      ],
      initialPhotoReferences: [
        { photoReferenceId: 'p1', title: ' View ', url: 'https://example.com/view.jpg ', altText: ' Alt ' },
      ],
    })

    await user.type(screen.getByLabelText('Postcode'), 'GL1 1AA')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        references: [
          expect.objectContaining({
            title: 'Guide',
            url: 'https://example.com/guide',
            description: 'Details',
            previewImageUrl: 'https://example.com/preview.jpg',
          }),
        ],
        photoReferences: [
          expect.objectContaining({
            title: 'View',
            url: 'https://example.com/view.jpg',
            altText: 'Alt',
          }),
        ],
      }),
    )
  })

  it('validates reference and photo metadata rules', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderEditor()

    await user.click(screen.getByRole('button', { name: 'Add reference' }))
    await user.type(screen.getByLabelText('Preview image URL'), 'http://example.com/preview.jpg')
    await user.click(screen.getByRole('button', { name: 'Add photo reference' }))
    await user.type(screen.getByLabelText('Photo URL'), 'http://example.com/photo.jpg')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByText('Reference title is required.')).toBeInTheDocument()
    expect(screen.getByText('Reference URL must start with https://.')).toBeInTheDocument()
    expect(screen.getByText('Preview image URL must start with https://.')).toBeInTheDocument()
    expect(screen.getByText('Photo title is required.')).toBeInTheDocument()
    expect(screen.getByText('Photo URL must start with https://.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits a valid coordinate pair', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderEditor()

    await user.click(screen.getByRole('combobox', { name: 'Location type' }))
    await user.click(screen.getByRole('option', { name: 'Latitude and longitude' }))
    await user.type(screen.getByLabelText('Latitude'), '51.75')
    await user.type(screen.getByLabelText('Longitude'), '-1.26')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ location: { kind: 'coordinates', latitude: 51.75, longitude: -1.26 } }),
    )
  })

  it('keeps selected ideas when changing or clearing waypoint', async () => {
    const user = userEvent.setup()
    const data = createDefaultData()
    data.ideas = [
      {
        ideaId: 'idea-1',
        title: 'Route option',
        description: '',
        notes: '',
        waypointIds: [data.waypoints[0]!.waypointId],
        planningState: 'active',
        difficulty: 2,
        referenceIds: [],
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
    ]
    const { onSubmit } = renderEditor({ data, initialWaypointId: data.waypoints[0]!.waypointId })

    await user.click(screen.getByRole('combobox', { name: 'Linked ideas (optional)' }))
    await user.click(screen.getByRole('option', { name: 'Route option (linked to selected waypoint)' }))
    await user.click(screen.getByRole('combobox', { name: 'Linked waypoint' }))
    await user.click(screen.getByRole('option', { name: 'No linked waypoint' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ waypointId: undefined, ideaIds: ['idea-1'] }))
  })

  it('uses waypoint coordinates as initial location when available', () => {
    const data = createDefaultData()
    data.waypoints[0] = {
      ...data.waypoints[0]!,
      location: { latitude: 51.75, longitude: -1.26 },
    }
    renderEditor({ data, initialWaypointId: data.waypoints[0]!.waypointId })
    expect(screen.getByLabelText('Latitude')).toHaveValue('51.75')
    expect(screen.getByLabelText('Longitude')).toHaveValue('-1.26')
  })

  it('prompts before cancelling dirty changes', async () => {
    const user = userEvent.setup()
    const { onCancel } = renderEditor()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    await user.type(screen.getByLabelText('Postcode'), 'GL1 1AA')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(confirmSpy).toHaveBeenCalledWith('You have unsaved changes. Leave this page?')
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('allows cancel when confirmation is accepted', async () => {
    const user = userEvent.setup()
    const { onCancel } = renderEditor()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    await user.type(screen.getByLabelText('Postcode'), 'GL1 1AA')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalled()
  })

  it('cancels immediately when there are no unsaved changes', async () => {
    const user = userEvent.setup()
    const { onCancel } = renderEditor()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalled()
  })

  it('calls delete callback', async () => {
    const user = userEvent.setup()
    const { onDelete } = renderEditor()

    await user.click(screen.getByRole('button', { name: 'Delete activity' }))

    expect(onDelete).toHaveBeenCalled()
  })

  it('loads valid pasted JSON into the form before submit', async () => {
    const user = userEvent.setup()
    const data = createDefaultData()
    const initialWaypointId = dataWaypointId(data)
    data.ideas = [
      {
        ideaId: 'idea-1',
        title: 'Route option',
        description: '',
        notes: '',
        waypointIds: [initialWaypointId],
        planningState: 'active',
        difficulty: 2,
        referenceIds: [],
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
    ]
    const { onSubmit } = renderEditor({ data, initialWaypointId })
    const payload = {
      name: 'Imported activity',
      date: '2026-09-01',
      notes: 'Loaded from JSON',
      category: 'gold',
      location: { kind: 'postcode', postcode: 'GL2 2BB' },
      references: [{ title: 'Guide', url: 'https://example.com/guide', description: '', previewImageUrl: '' }],
      photoReferences: [{ title: 'Photo', url: 'https://example.com/photo.jpg', altText: '' }],
    }

    await user.click(screen.getByRole('combobox', { name: 'Linked ideas (optional)' }))
    await user.click(screen.getByRole('option', { name: 'Route option (linked to selected waypoint)' }))
    await user.click(screen.getByRole('tab', { name: 'Paste JSON' }))
    await user.click(screen.getByLabelText('Activity JSON'))
    await user.paste(JSON.stringify(payload))
    await user.click(screen.getByRole('button', { name: 'Load into form' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        date: payload.date,
        name: payload.name,
        notes: payload.notes,
        waypointId: initialWaypointId,
        ideaIds: ['idea-1'],
        category: payload.category,
        location: payload.location,
        references: [expect.objectContaining({ title: 'Guide' })],
        photoReferences: [expect.objectContaining({ title: 'Photo' })],
      }),
    )
  })

  it('keeps pasted JSON and shows malformed and schema errors', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('tab', { name: 'Paste JSON' }))
    const input = screen.getByLabelText('Activity JSON')

    await user.click(input)
    await user.paste('{bad')
    await user.click(screen.getByRole('button', { name: 'Load into form' }))
    expect(screen.getByText('Invalid JSON. Paste a valid JSON object.')).toBeInTheDocument()
    expect(input).toHaveValue('{bad')

    await user.clear(input)
    await user.click(input)
    await user.paste(
      JSON.stringify({
        date: '2026-09-01',
        notes: 123,
        location: { kind: 'postcode', postcode: 'GL1 1AA' },
        references: [],
        photoReferences: [],
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Load into form' }))
    expect(screen.getByText('JSON does not match the activity draft shape.')).toBeInTheDocument()
    expect(screen.getByText(/notes: Invalid input/)).toBeInTheDocument()
  })

  it('rejects array input and forbidden id fields in pasted JSON', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('tab', { name: 'Paste JSON' }))
    const input = screen.getByLabelText('Activity JSON')

    await user.click(input)
    await user.paste('[]')
    await user.click(screen.getByRole('button', { name: 'Load into form' }))
    expect(screen.getByText('Paste a single object, not an array.')).toBeInTheDocument()

    await user.clear(input)
    await user.click(input)
    await user.paste(
      JSON.stringify({
        activityId: 'activity-1',
        date: '2026-09-01',
        notes: '',
        location: { kind: 'postcode', postcode: 'GL1 1AA' },
        references: [],
        photoReferences: [],
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Load into form' }))
    expect(screen.getByText(/Remove 'activityId' — IDs are assigned automatically./)).toBeInTheDocument()
  })

  it('shows an inline error when clipboard write is unavailable', async () => {
    const user = userEvent.setup()
    renderEditor()
    const originalClipboard = navigator.clipboard
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    })

    try {
      await user.click(screen.getByRole('tab', { name: 'Paste JSON' }))
      await user.click(screen.getByLabelText('Activity JSON'))
      await user.paste(
        JSON.stringify({
          date: '2026-09-01',
          notes: 123,
          location: { kind: 'postcode', postcode: 'GL1 1AA' },
          references: [],
          photoReferences: [],
        }),
      )
      await user.click(screen.getByRole('button', { name: 'Load into form' }))
      expect(screen.getByText(/notes: Invalid input/)).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Copy example JSON' }))
      expect(screen.getByText('Clipboard is unavailable in this browser.')).toBeInTheDocument()
      expect(screen.queryByText(/notes: Invalid input/)).not.toBeInTheDocument()
    } finally {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: originalClipboard,
      })
    }
  })
  it('shows an AI prompt button that opens the Activity JSON prompt dialog', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('tab', { name: 'Paste JSON' }))
    await user.click(screen.getByRole('button', { name: 'Activity JSON AI prompt' }))
    expect(screen.getByRole('heading', { name: 'Activity JSON AI prompt' })).toBeInTheDocument()
    expect(screen.getByDisplayValue(/dated historical record/)).toBeInTheDocument()
  })
})

function dataWaypointId(data: ReturnType<typeof createDefaultData>) {
  return data.waypoints[0]!.waypointId
}
