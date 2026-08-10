import { useEffect, useMemo, useState } from 'react'
import { useBeforeUnload } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  awardableStatuses,
  statusLabels,
  waypointSupportsActivityCategory,
  type Activity,
  type ActivityLocation,
  type AwardedStatus,
  type ExternalPhotoReference,
  type Reference,
  type WaypointsData,
} from '../domain/visit'
import type { ActivityDraft } from '../features/journey/JourneyContext'

type Props = {
  data: WaypointsData
  initialActivity?: Activity
  initialWaypointId?: string
  initialReferences?: Reference[]
  initialPhotoReferences?: ExternalPhotoReference[]
  submitLabel: string
  onSubmit: (draft: ActivityDraft) => void
  onCancel?: () => void
  onDelete?: () => void
}

type Errors = Record<string, string>
type EditorReference = {
  referenceId?: string
  title: string
  url: string
  description: string
  previewImageUrl: string
}
type EditorPhotoReference = {
  photoReferenceId?: string
  title: string
  altText: string
  url: string
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function waypointInitialLocation(data: WaypointsData, waypointId: string | undefined): ActivityLocation | undefined {
  if (!waypointId) return undefined
  const waypoint = data.waypoints.find((item) => item.waypointId === waypointId)
  if (!waypoint?.location) return undefined
  if (typeof waypoint.location.latitude === 'number' && typeof waypoint.location.longitude === 'number') {
    return { kind: 'coordinates', latitude: waypoint.location.latitude, longitude: waypoint.location.longitude }
  }
  const postcode = waypoint.location.addressOrRegion ?? waypoint.location.placeName
  if (postcode) return { kind: 'postcode', postcode }
  return undefined
}

export function ActivityEditor({
  data,
  initialActivity,
  initialWaypointId,
  initialReferences,
  initialPhotoReferences,
  submitLabel,
  onSubmit,
  onCancel,
  onDelete,
}: Props) {
  const initialLocation = useMemo<ActivityLocation>(
    () =>
      initialActivity?.location ??
      waypointInitialLocation(data, initialWaypointId) ?? { kind: 'postcode', postcode: '' },
    [data, initialActivity?.location, initialWaypointId],
  )
  const [date, setDate] = useState(initialActivity?.date ?? new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState(initialActivity?.notes ?? '')
  const [waypointId, setWaypointId] = useState(initialActivity?.waypointId ?? initialWaypointId ?? '')
  const [category, setCategory] = useState<AwardedStatus | ''>(initialActivity?.category ?? '')
  const [locationKind, setLocationKind] = useState<ActivityLocation['kind']>(initialLocation.kind)
  const [postcode, setPostcode] = useState(initialLocation.kind === 'postcode' ? initialLocation.postcode : '')
  const [latitude, setLatitude] = useState(
    initialLocation.kind === 'coordinates' ? String(initialLocation.latitude) : '',
  )
  const [longitude, setLongitude] = useState(
    initialLocation.kind === 'coordinates' ? String(initialLocation.longitude) : '',
  )
  const [references, setReferences] = useState<EditorReference[]>(
    (initialReferences ?? []).map((reference) => ({
      referenceId: reference.referenceId,
      title: reference.title,
      url: reference.url,
      description: reference.description ?? '',
      previewImageUrl: reference.previewImageUrl ?? '',
    })),
  )
  const [photoReferences, setPhotoReferences] = useState<EditorPhotoReference[]>(
    (initialPhotoReferences ?? []).map((photoReference) => ({
      photoReferenceId: photoReference.photoReferenceId,
      title: photoReference.title,
      altText: photoReference.altText ?? '',
      url: photoReference.url,
    })),
  )
  const [errors, setErrors] = useState<Errors>({})
  const [message, setMessage] = useState<string | null>(null)

  const supportsCategories = waypointSupportsActivityCategory(data, waypointId || undefined)

  useEffect(() => {
    if (!supportsCategories && category) {
      setCategory('')
      setMessage('Category cleared because the selected waypoint does not support Bronze, Silver or Gold.')
    }
  }, [category, supportsCategories])

  const dirty = useMemo(() => {
    const initial = {
      date: initialActivity?.date ?? new Date().toISOString().slice(0, 10),
      notes: initialActivity?.notes ?? '',
      waypointId: initialActivity?.waypointId ?? initialWaypointId ?? '',
      category: initialActivity?.category ?? '',
      location: initialLocation,
      references: (initialReferences ?? []).map((item) => ({
        referenceId: item.referenceId,
        title: item.title,
        url: item.url,
        description: item.description ?? '',
        previewImageUrl: item.previewImageUrl ?? '',
      })),
      photoReferences: (initialPhotoReferences ?? []).map((item) => ({
        photoReferenceId: item.photoReferenceId,
        title: item.title,
        altText: item.altText ?? '',
        url: item.url,
      })),
    }

    const currentLocation =
      locationKind === 'postcode' ? { kind: 'postcode', postcode } : { kind: 'coordinates', latitude, longitude }

    return (
      JSON.stringify(initial) !==
      JSON.stringify({
        date,
        notes,
        waypointId,
        category,
        location: currentLocation,
        references,
        photoReferences,
      })
    )
  }, [
    category,
    date,
    initialActivity,
    initialLocation,
    initialPhotoReferences,
    initialReferences,
    initialWaypointId,
    latitude,
    locationKind,
    longitude,
    notes,
    photoReferences,
    postcode,
    references,
    waypointId,
  ])

  useBeforeUnload(
    (event) => {
      if (dirty) event.preventDefault()
    },
    { capture: true },
  )

  const validate = (): { errors: Errors; location?: ActivityLocation } => {
    const nextErrors: Errors = {}

    if (!isValidDate(date)) nextErrors.date = 'Please enter a valid activity date in YYYY-MM-DD format.'

    let location: ActivityLocation | undefined
    if (locationKind === 'postcode') {
      const trimmed = postcode.trim()
      if (!trimmed) nextErrors.postcode = 'Postcode is required.'
      else location = { kind: 'postcode', postcode: trimmed }
    } else {
      if (!latitude.trim() || !longitude.trim()) {
        nextErrors.coordinates = 'Enter both latitude and longitude.'
      } else {
        const parsedLatitude = Number(latitude)
        const parsedLongitude = Number(longitude)
        if (Number.isNaN(parsedLatitude) || Number.isNaN(parsedLongitude)) {
          nextErrors.coordinates = 'Latitude and longitude must be numeric.'
        } else if (parsedLatitude < -90 || parsedLatitude > 90) {
          nextErrors.coordinates = 'Latitude must be between -90 and 90.'
        } else if (parsedLongitude < -180 || parsedLongitude > 180) {
          nextErrors.coordinates = 'Longitude must be between -180 and 180.'
        } else {
          location = { kind: 'coordinates', latitude: parsedLatitude, longitude: parsedLongitude }
        }
      }
    }

    if (supportsCategories && !category) nextErrors.category = 'Select Bronze, Silver or Gold.'

    references.forEach((reference, index) => {
      if (!reference.title.trim()) nextErrors[`reference-${index}-title`] = 'Reference title is required.'
      if (!reference.url.trim().startsWith('https://')) {
        nextErrors[`reference-${index}-url`] = 'Reference URL must start with https://.'
      }
      if (reference.previewImageUrl && !reference.previewImageUrl.trim().startsWith('https://')) {
        nextErrors[`reference-${index}-preview`] = 'Preview image URL must start with https://.'
      }
    })

    photoReferences.forEach((photoReference, index) => {
      if (!photoReference.title.trim()) nextErrors[`photo-${index}-title`] = 'Photo title is required.'
      if (!photoReference.url.trim().startsWith('https://')) {
        nextErrors[`photo-${index}-url`] = 'Photo URL must start with https://.'
      }
    })

    return { errors: nextErrors, location }
  }

  return (
    <Card>
      <CardContent>
        <Stack
          component="form"
          spacing={2}
          onSubmit={(event) => {
            event.preventDefault()
            const result = validate()
            if (Object.keys(result.errors).length > 0 || !result.location) {
              setErrors(result.errors)
              return
            }
            setErrors({})
            onSubmit({
              waypointId: waypointId || undefined,
              date,
              category: supportsCategories ? category || undefined : undefined,
              location: result.location,
              notes,
              references: references.map((reference) => ({
                referenceId: reference.referenceId,
                title: reference.title.trim(),
                url: reference.url.trim(),
                description: reference.description.trim() || undefined,
                previewImageUrl: reference.previewImageUrl.trim() || undefined,
              })),
              photoReferences: photoReferences.map((photoReference) => ({
                photoReferenceId: photoReference.photoReferenceId,
                title: photoReference.title.trim(),
                altText: photoReference.altText.trim() || undefined,
                url: photoReference.url.trim(),
              })),
            })
          }}
        >
          {message && <Alert severity="info">{message}</Alert>}
          <TextField
            label="Activity date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            error={Boolean(errors.date)}
            helperText={errors.date}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Description / notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            multiline
            minRows={3}
          />
          <FormControl>
            <InputLabel id="linked-waypoint-label">Linked waypoint</InputLabel>
            <Select
              labelId="linked-waypoint-label"
              label="Linked waypoint"
              value={waypointId}
              onChange={(event) => setWaypointId(event.target.value)}
            >
              <MenuItem value="">No linked waypoint</MenuItem>
              {data.waypoints.map((waypoint) => (
                <MenuItem key={waypoint.waypointId} value={waypoint.waypointId}>
                  {waypoint.title}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {supportsCategories && (
            <FormControl error={Boolean(errors.category)}>
              <InputLabel id="activity-category-label">Activity category</InputLabel>
              <Select
                labelId="activity-category-label"
                label="Activity category"
                value={category}
                onChange={(event) => setCategory(event.target.value as AwardedStatus)}
              >
                {awardableStatuses.map((value) => (
                  <MenuItem key={value} value={value}>
                    {statusLabels[value]}
                  </MenuItem>
                ))}
              </Select>
              {errors.category && <Typography color="error">{errors.category}</Typography>}
            </FormControl>
          )}

          <FormControl>
            <InputLabel id="location-type-label">Location type</InputLabel>
            <Select
              labelId="location-type-label"
              label="Location type"
              value={locationKind}
              onChange={(event) => setLocationKind(event.target.value as ActivityLocation['kind'])}
            >
              <MenuItem value="postcode">Postcode</MenuItem>
              <MenuItem value="coordinates">Latitude and longitude</MenuItem>
            </Select>
          </FormControl>

          {locationKind === 'postcode' ? (
            <TextField
              label="Postcode"
              placeholder="e.g. GL3 4AQ"
              value={postcode}
              onChange={(event) => setPostcode(event.target.value)}
              error={Boolean(errors.postcode)}
              helperText={errors.postcode}
              slotProps={{ htmlInput: { inputMode: 'text' } }}
            />
          ) : (
            <Stack spacing={1}>
              <TextField
                label="Latitude"
                placeholder="e.g. 51.74714"
                value={latitude}
                onChange={(event) => setLatitude(event.target.value)}
                slotProps={{ htmlInput: { inputMode: 'decimal' } }}
              />
              <TextField
                label="Longitude"
                placeholder="e.g. -1.25874"
                value={longitude}
                onChange={(event) => setLongitude(event.target.value)}
                slotProps={{ htmlInput: { inputMode: 'decimal' } }}
              />
              {errors.coordinates && <Typography color="error">{errors.coordinates}</Typography>}
            </Stack>
          )}

          <Stack spacing={1}>
            <Typography variant="h6">References</Typography>
            {references.map((reference, index) => (
              <Box
                key={reference.referenceId ?? `reference-${index}`}
                sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}
              >
                <Stack spacing={1}>
                  <TextField
                    label="Reference title"
                    value={reference.title}
                    onChange={(event) =>
                      setReferences((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, title: event.target.value } : item,
                        ),
                      )
                    }
                    error={Boolean(errors[`reference-${index}-title`])}
                    helperText={errors[`reference-${index}-title`]}
                  />
                  <TextField
                    label="Reference URL"
                    value={reference.url}
                    onChange={(event) =>
                      setReferences((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, url: event.target.value } : item,
                        ),
                      )
                    }
                    error={Boolean(errors[`reference-${index}-url`])}
                    helperText={errors[`reference-${index}-url`]}
                  />
                  <TextField
                    label="Reference description"
                    value={reference.description}
                    onChange={(event) =>
                      setReferences((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, description: event.target.value } : item,
                        ),
                      )
                    }
                  />
                  <TextField
                    label="Preview image URL"
                    value={reference.previewImageUrl}
                    onChange={(event) =>
                      setReferences((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, previewImageUrl: event.target.value } : item,
                        ),
                      )
                    }
                    error={Boolean(errors[`reference-${index}-preview`])}
                    helperText={errors[`reference-${index}-preview`]}
                  />
                  <Stack direction="row" spacing={1}>
                    <IconButton
                      aria-label={`Move reference ${index + 1} up`}
                      onClick={() =>
                        setReferences((current) => {
                          if (index === 0) return current
                          const next = [...current]
                          ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
                          return next
                        })
                      }
                    >
                      <ArrowUpwardIcon />
                    </IconButton>
                    <IconButton
                      aria-label={`Move reference ${index + 1} down`}
                      onClick={() =>
                        setReferences((current) => {
                          if (index === current.length - 1) return current
                          const next = [...current]
                          ;[next[index + 1], next[index]] = [next[index], next[index + 1]]
                          return next
                        })
                      }
                    >
                      <ArrowDownwardIcon />
                    </IconButton>
                    <IconButton
                      aria-label={`Remove reference ${index + 1}`}
                      onClick={() => setReferences((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Stack>
                </Stack>
              </Box>
            ))}
            <Button
              onClick={() =>
                setReferences((current) => [...current, { title: '', url: '', description: '', previewImageUrl: '' }])
              }
            >
              Add reference
            </Button>
          </Stack>

          <Stack spacing={1}>
            <Typography variant="h6">Photos</Typography>
            {photoReferences.map((photoReference, index) => (
              <Box
                key={photoReference.photoReferenceId ?? `photo-${index}`}
                sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}
              >
                <Stack spacing={1}>
                  <TextField
                    label="Photo title"
                    value={photoReference.title}
                    onChange={(event) =>
                      setPhotoReferences((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, title: event.target.value } : item,
                        ),
                      )
                    }
                    error={Boolean(errors[`photo-${index}-title`])}
                    helperText={errors[`photo-${index}-title`]}
                  />
                  <TextField
                    label="Photo URL"
                    value={photoReference.url}
                    onChange={(event) =>
                      setPhotoReferences((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, url: event.target.value } : item,
                        ),
                      )
                    }
                    error={Boolean(errors[`photo-${index}-url`])}
                    helperText={errors[`photo-${index}-url`]}
                  />
                  <TextField
                    label="Photo alt text"
                    value={photoReference.altText}
                    onChange={(event) =>
                      setPhotoReferences((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, altText: event.target.value } : item,
                        ),
                      )
                    }
                  />
                  <Stack direction="row" spacing={1}>
                    <IconButton
                      aria-label={`Move photo ${index + 1} up`}
                      onClick={() =>
                        setPhotoReferences((current) => {
                          if (index === 0) return current
                          const next = [...current]
                          ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
                          return next
                        })
                      }
                    >
                      <ArrowUpwardIcon />
                    </IconButton>
                    <IconButton
                      aria-label={`Move photo ${index + 1} down`}
                      onClick={() =>
                        setPhotoReferences((current) => {
                          if (index === current.length - 1) return current
                          const next = [...current]
                          ;[next[index + 1], next[index]] = [next[index], next[index + 1]]
                          return next
                        })
                      }
                    >
                      <ArrowDownwardIcon />
                    </IconButton>
                    <IconButton
                      aria-label={`Remove photo ${index + 1}`}
                      onClick={() =>
                        setPhotoReferences((current) => current.filter((_, itemIndex) => itemIndex !== index))
                      }
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Stack>
                </Stack>
              </Box>
            ))}
            <Button onClick={() => setPhotoReferences((current) => [...current, { title: '', url: '', altText: '' }])}>
              Add photo reference
            </Button>
          </Stack>

          <Stack direction="row" spacing={1}>
            <Button type="submit" variant="contained">
              {submitLabel}
            </Button>
            {onCancel && (
              <Button
                onClick={() => {
                  if (!dirty || window.confirm('You have unsaved changes. Leave this page?')) onCancel()
                }}
              >
                Cancel
              </Button>
            )}
            {onDelete && (
              <Button color="error" onClick={onDelete}>
                Delete activity
              </Button>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}
