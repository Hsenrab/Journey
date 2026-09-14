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
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { ZodError } from 'zod'
import {
  DifficultySchema,
  PlanningStateSchema,
  ReferenceSchema,
  createIdea,
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
type EditorMode = 'form' | 'json'

const forbiddenImportIdFields = new Set(['ideaId', 'referenceId'])
const requiredImportFields = [
  'title',
  'description',
  'notes',
  'waypointIds',
  'planningState',
  'difficulty',
  'references',
] as const
const ideaImportExample = {
  title: 'Plan a sunrise walk',
  description: 'Try a nearby route before breakfast.',
  notes: 'Bring a flask and check weather first.',
  waypointIds: [],
  planningState: 'active',
  difficulty: 1,
  location: { placeName: 'Brockworth', addressOrRegion: 'Gloucestershire', source: 'Manual research', approximate: true },
  references: [{ title: 'Route ideas', url: 'https://example.com/route', description: '', previewImageUrl: '' }],
}

function collectForbiddenIdFields(value: unknown, ids = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((entry) => {
      collectForbiddenIdFields(entry, ids)
    })
    return ids
  }
  if (!value || typeof value !== 'object') return ids

  Object.entries(value).forEach(([key, entry]) => {
    if (forbiddenImportIdFields.has(key)) ids.add(key)
    collectForbiddenIdFields(entry, ids)
  })
  return ids
}

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
  const [mode, setMode] = useState<EditorMode>('form')
  const [jsonInput, setJsonInput] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [jsonIssues, setJsonIssues] = useState<string[]>([])
  const addMode = !initialIdea

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
            if (addMode && mode === 'json') return
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
          {addMode && (
            <Tabs
              value={mode}
              onChange={(_, next: EditorMode) => setMode(next)}
              aria-label="Idea input mode"
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab label="Form" value="form" />
              <Tab label="Paste JSON" value="json" />
            </Tabs>
          )}
          {addMode && mode === 'json' && (
            <Stack spacing={1.5}>
              <TextField
                label="Idea JSON"
                value={jsonInput}
                onChange={(event) => setJsonInput(event.target.value)}
                multiline
                minRows={10}
              />
              <Stack direction="row" spacing={1}>
                <Button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(JSON.stringify(ideaImportExample, null, 2))
                    } catch {
                      setJsonError('Clipboard copy failed.')
                    }
                  }}
                >
                  Copy example JSON
                </Button>
                <Button
                  variant="contained"
                  onClick={() => {
                    let parsed: unknown
                    try {
                      parsed = JSON.parse(jsonInput)
                    } catch {
                      setJsonError('Invalid JSON. Paste a valid JSON object.')
                      setJsonIssues([])
                      return
                    }
                    if (Array.isArray(parsed)) {
                      setJsonError('Paste a single object, not an array.')
                      setJsonIssues([])
                      return
                    }
                    if (!parsed || typeof parsed !== 'object') {
                      setJsonError('Paste a single object, not a primitive value.')
                      setJsonIssues([])
                      return
                    }

                    const foundIds = Array.from(collectForbiddenIdFields(parsed))
                    if (foundIds.length > 0) {
                      setJsonError(foundIds.map((id) => `Remove '${id}' — IDs are assigned automatically.`).join(' '))
                      setJsonIssues([])
                      return
                    }

                    const payload = parsed as Record<string, unknown>
                    const missing = requiredImportFields.filter((key) => !(key in payload))
                    if (missing.length > 0) {
                      setJsonError(`Missing required field${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}.`)
                      setJsonIssues([])
                      return
                    }
                    const unknownFields = Object.keys(payload).filter(
                      (key) =>
                        ![
                          'title',
                          'description',
                          'notes',
                          'waypointIds',
                          'planningState',
                          'rejectionReason',
                          'difficulty',
                          'location',
                          'references',
                        ].includes(key),
                    )
                    if (unknownFields.length > 0) {
                      setJsonError(
                        `Unexpected field${unknownFields.length === 1 ? '' : 's'}: ${unknownFields.join(', ')}.`,
                      )
                      setJsonIssues([])
                      return
                    }

                    const references = ReferenceSchema.omit({ referenceId: true }).array().safeParse(payload.references)
                    const planningState = PlanningStateSchema.safeParse(payload.planningState)
                    const difficulty = DifficultySchema.safeParse(payload.difficulty)

                    const nextIssues: string[] = []
                    if (!references.success) {
                      references.error.issues.forEach((issue) => {
                        nextIssues.push(`references.${issue.path.join('.')}: ${issue.message}`)
                      })
                    }
                    if (!planningState.success) {
                      planningState.error.issues.forEach((issue) => {
                        nextIssues.push(`planningState: ${issue.message}`)
                      })
                    }
                    if (!difficulty.success) {
                      difficulty.error.issues.forEach((issue) => {
                        nextIssues.push(`difficulty: ${issue.message}`)
                      })
                    }

                    try {
                      createIdea({
                        title: payload.title as string,
                        description: payload.description as string,
                        notes: payload.notes as string,
                        waypointIds: payload.waypointIds as string[],
                        planningState: payload.planningState as Idea['planningState'],
                        rejectionReason: payload.rejectionReason as string | undefined,
                        difficulty: payload.difficulty as Idea['difficulty'],
                        location: payload.location as Idea['location'],
                        referenceIds: references.success ? references.data.map((_, index) => `reference-${index}`) : [],
                      })
                    } catch (error) {
                      if (error instanceof ZodError) {
                        error.issues.forEach((issue) => {
                          nextIssues.push(`${issue.path.join('.')}: ${issue.message}`)
                        })
                      } else {
                        throw error
                      }
                    }

                    if (nextIssues.length > 0 || !references.success || !planningState.success || !difficulty.success) {
                      setJsonError('JSON does not match the idea draft shape.')
                      setJsonIssues(nextIssues)
                      return
                    }

                    setTitle(payload.title as string)
                    setDescription(payload.description as string)
                    setNotes(payload.notes as string)
                    setPlanningState(payload.planningState as Idea['planningState'])
                    setRejectionReason((payload.rejectionReason as string | undefined) ?? '')
                    setDifficulty(payload.difficulty as Idea['difficulty'])
                    setWaypointIds(payload.waypointIds as string[])
                    const location = payload.location as Idea['location'] | undefined
                    setPlaceName(location?.placeName ?? '')
                    setAddressOrRegion(location?.addressOrRegion ?? '')
                    setSource(location?.source ?? '')
                    setLatitude(location?.latitude === undefined ? '' : String(location.latitude))
                    setLongitude(location?.longitude === undefined ? '' : String(location.longitude))
                    setApproximate(location?.approximate ?? false)
                    setReferences(
                      references.data.map((reference) => ({
                        title: reference.title,
                        description: reference.description ?? '',
                        url: reference.url,
                        previewImageUrl: reference.previewImageUrl ?? '',
                      })),
                    )
                    setErrors({})
                    setJsonError(null)
                    setJsonIssues([])
                    setMode('form')
                  }}
                >
                  Load into form
                </Button>
              </Stack>
              {jsonError && <Alert severity="error">{jsonError}</Alert>}
              {jsonIssues.length > 0 && (
                <Alert severity="error">
                  {jsonIssues.map((issue) => (
                    <div key={issue}>{issue}</div>
                  ))}
                </Alert>
              )}
            </Stack>
          )}
          {(!addMode || mode === 'form') && (
            <>
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
          </>
          )}
        </Stack>
      </CardContent>
    </Card>
  )
}
