import { useMemo, useState } from 'react'
import { useBeforeUnload } from 'react-router-dom'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import {
  difficulties,
  difficultyDescriptions,
  difficultyLabels,
  planningStateLabels,
  planningStates,
  type Idea,
  type Reference,
  type WaypointsData,
} from '../domain/visit'
import type { IdeaDraft } from '../features/journey/JourneyContext'

type Props = {
  data: WaypointsData
  initialIdea?: Idea
  initialWaypointId?: string
  initialReferences?: Reference[]
  submitLabel: string
  onSubmit: (draft: IdeaDraft) => void
  onCancel?: () => void
  onDelete?: () => void
  errorMessage?: string | null
}

type EditorReference = {
  referenceId?: string
  title: string
  description: string
  url: string
  previewImageUrl: string
}

type Errors = Record<string, string>

export function IdeaEditor({
  data,
  initialIdea,
  initialWaypointId,
  initialReferences,
  submitLabel,
  onSubmit,
  onCancel,
  onDelete,
  errorMessage,
}: Props) {
  const [title, setTitle] = useState(initialIdea?.title ?? '')
  const [description, setDescription] = useState(initialIdea?.description ?? '')
  const [notes, setNotes] = useState(initialIdea?.notes ?? '')
  const [planningState, setPlanningState] = useState<Idea['planningState']>(initialIdea?.planningState ?? 'active')
  const [rejectionReason, setRejectionReason] = useState(initialIdea?.rejectionReason ?? '')
  const [difficulty, setDifficulty] = useState<Idea['difficulty']>(initialIdea?.difficulty ?? 1)
  const [waypointIds, setWaypointIds] = useState<string[]>(
    initialIdea?.waypointIds ?? (initialWaypointId ? [initialWaypointId] : []),
  )
  const [placeName, setPlaceName] = useState(initialIdea?.location?.placeName ?? '')
  const [addressOrRegion, setAddressOrRegion] = useState(initialIdea?.location?.addressOrRegion ?? '')
  const [source, setSource] = useState(initialIdea?.location?.source ?? '')
  const [latitude, setLatitude] = useState(
    initialIdea?.location?.latitude === undefined ? '' : String(initialIdea.location.latitude),
  )
  const [longitude, setLongitude] = useState(
    initialIdea?.location?.longitude === undefined ? '' : String(initialIdea.location.longitude),
  )
  const [approximate, setApproximate] = useState(initialIdea?.location?.approximate ?? false)
  const [references, setReferences] = useState<EditorReference[]>(
    (initialReferences ?? []).map((reference) => ({
      referenceId: reference.referenceId,
      title: reference.title,
      description: reference.description ?? '',
      url: reference.url,
      previewImageUrl: reference.previewImageUrl ?? '',
    })),
  )
  const [errors, setErrors] = useState<Errors>({})

  const dirty = useMemo(
    () =>
      JSON.stringify({
        title,
        description,
        notes,
        planningState,
        rejectionReason,
        difficulty,
        waypointIds,
        placeName,
        addressOrRegion,
        source,
        latitude,
        longitude,
        approximate,
        references,
      }) !==
      JSON.stringify({
        title: initialIdea?.title ?? '',
        description: initialIdea?.description ?? '',
        notes: initialIdea?.notes ?? '',
        planningState: initialIdea?.planningState ?? 'active',
        rejectionReason: initialIdea?.rejectionReason ?? '',
        difficulty: initialIdea?.difficulty ?? 1,
        waypointIds: initialIdea?.waypointIds ?? (initialWaypointId ? [initialWaypointId] : []),
        placeName: initialIdea?.location?.placeName ?? '',
        addressOrRegion: initialIdea?.location?.addressOrRegion ?? '',
        source: initialIdea?.location?.source ?? '',
        latitude: initialIdea?.location?.latitude === undefined ? '' : String(initialIdea.location.latitude),
        longitude: initialIdea?.location?.longitude === undefined ? '' : String(initialIdea.location.longitude),
        approximate: initialIdea?.location?.approximate ?? false,
        references: (initialReferences ?? []).map((reference) => ({
          referenceId: reference.referenceId,
          title: reference.title,
          description: reference.description ?? '',
          url: reference.url,
          previewImageUrl: reference.previewImageUrl ?? '',
        })),
      }),
    [
      addressOrRegion,
      approximate,
      description,
      difficulty,
      initialIdea,
      initialReferences,
      initialWaypointId,
      latitude,
      longitude,
      notes,
      placeName,
      planningState,
      references,
      rejectionReason,
      source,
      title,
      waypointIds,
    ],
  )

  useBeforeUnload(
    (event) => {
      if (dirty) event.preventDefault()
    },
    { capture: true },
  )

  const difficultyHelpId = 'idea-difficulty-help'

  const validate = (): { errors: Errors; location?: Idea['location'] } => {
    const nextErrors: Errors = {}
    if (!title.trim()) nextErrors.title = 'Idea title is required.'
    if (planningState === 'rejected' && !rejectionReason.trim())
      nextErrors.rejectionReason = 'Rejection reason is required.'

    let location: Idea['location'] | undefined
    const hasLocation =
      Boolean(placeName.trim()) ||
      Boolean(addressOrRegion.trim()) ||
      Boolean(source.trim()) ||
      Boolean(latitude.trim()) ||
      Boolean(longitude.trim())
    if (hasLocation) {
      location = {
        placeName: placeName.trim() || undefined,
        addressOrRegion: addressOrRegion.trim() || undefined,
        source: source.trim() || undefined,
        approximate: approximate || undefined,
      }
      if (latitude.trim() || longitude.trim()) {
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
            location.latitude = parsedLatitude
            location.longitude = parsedLongitude
          }
        }
      }
    }

    references.forEach((reference, index) => {
      if (!reference.title.trim()) nextErrors[`reference-${index}-title`] = 'Reference title is required.'
      if (!reference.url.trim().startsWith('https://')) {
        nextErrors[`reference-${index}-url`] = 'Reference URL must start with https://.'
      }
      if (reference.previewImageUrl.trim() && !reference.previewImageUrl.trim().startsWith('https://')) {
        nextErrors[`reference-${index}-preview`] = 'Preview image URL must start with https://.'
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
            if (Object.keys(result.errors).length > 0) {
              setErrors(result.errors)
              return
            }
            setErrors({})
            onSubmit({
              title: title.trim(),
              description: description.trim(),
              notes: notes.trim(),
              planningState,
              rejectionReason: planningState === 'rejected' ? rejectionReason.trim() : undefined,
              difficulty,
              waypointIds,
              location: result.location,
              references: references.map((reference) => ({
                referenceId: reference.referenceId,
                title: reference.title.trim(),
                description: reference.description.trim() || undefined,
                url: reference.url.trim(),
                previewImageUrl: reference.previewImageUrl.trim() || undefined,
              })),
            })
          }}
        >
          {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
          <TextField
            label="Title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            error={Boolean(errors.title)}
            helperText={errors.title}
          />
          <TextField label="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
          <TextField
            label="Notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            multiline
            minRows={4}
          />
          <FormControl>
            <InputLabel id="planning-state-label">Planning state</InputLabel>
            <Select
              labelId="planning-state-label"
              label="Planning state"
              value={planningState}
              onChange={(event) => setPlanningState(event.target.value as Idea['planningState'])}
            >
              {planningStates.map((state) => (
                <MenuItem key={state} value={state}>
                  {planningStateLabels[state]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {planningState === 'rejected' && (
            <TextField
              label="Rejection reason"
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              error={Boolean(errors.rejectionReason)}
              helperText={errors.rejectionReason}
            />
          )}
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Difficulty guidance
            </Typography>
            <Tooltip title="Difficulty reflects overall commitment and complexity, not just physical effort. Use judgement.">
              <IconButton aria-label="Difficulty guidance" size="small">
                <InfoOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
          <FormControl>
            <InputLabel id="difficulty-label">Difficulty</InputLabel>
            <Select
              labelId="difficulty-label"
              label="Difficulty"
              value={difficulty}
              onChange={(event) => setDifficulty(Number(event.target.value) as Idea['difficulty'])}
              aria-describedby={difficultyHelpId}
            >
              {difficulties.map((level) => (
                <MenuItem key={level} value={level}>
                  {difficultyLabels[level]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography id={difficultyHelpId} color="text.secondary">
            {difficultyLabels[difficulty]}: {difficultyDescriptions[difficulty]}
          </Typography>
          <Typography color="text.secondary">
            Difficulty scale: Easy, Moderate, Involved, and Ambitious. One factor may outweigh the others.
          </Typography>
          <Autocomplete
            multiple
            options={data.waypoints}
            value={data.waypoints.filter((waypoint) => waypointIds.includes(waypoint.waypointId))}
            isOptionEqualToValue={(option, value) => option.waypointId === value.waypointId}
            getOptionLabel={(option) => option.title}
            onChange={(_, values) => setWaypointIds(values.map((value) => value.waypointId))}
            renderInput={(params) => <TextField {...params} label="Linked waypoints" />}
          />
          <Stack spacing={1}>
            <Typography variant="h6">Location (optional)</Typography>
            <TextField label="Place name" value={placeName} onChange={(event) => setPlaceName(event.target.value)} />
            <TextField
              label="Address or region"
              value={addressOrRegion}
              onChange={(event) => setAddressOrRegion(event.target.value)}
            />
            <TextField label="Source" value={source} onChange={(event) => setSource(event.target.value)} />
            <TextField label="Latitude" value={latitude} onChange={(event) => setLatitude(event.target.value)} />
            <TextField label="Longitude" value={longitude} onChange={(event) => setLongitude(event.target.value)} />
            {errors.coordinates && <Typography color="error">{errors.coordinates}</Typography>}
            <FormControlLabel
              control={<Checkbox checked={approximate} onChange={(event) => setApproximate(event.target.checked)} />}
              label="Approximate location"
            />
          </Stack>
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
                setReferences((current) => [...current, { title: '', description: '', url: '', previewImageUrl: '' }])
              }
            >
              Add reference
            </Button>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button type="submit" variant="contained">
              {submitLabel}
            </Button>
            {onCancel && (
              <Button
                onClick={() => (!dirty || window.confirm('You have unsaved changes. Leave this page?')) && onCancel()}
              >
                Cancel
              </Button>
            )}
            {onDelete && (
              <Button color="error" onClick={onDelete}>
                Delete idea
              </Button>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}
