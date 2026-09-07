import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { distanceMiles } from '../domain/map'
import {
  difficultyLabels,
  ideaLocationSummary,
  ideaUsageCount,
  ideaUsageLabel,
  planningStateLabels,
  planningStates,
  type Idea,
} from '../domain/visit'
import { IdeaEditor } from '../components/IdeaEditor'
import { useWaypoints } from '../features/journey/JourneyContext'

const brockworth = { latitude: 51.844, longitude: -2.153 }

type SortKey = 'distance' | 'updated' | 'difficulty'
type UsageFilter = 'all' | 'used' | 'not-used'

function distanceFromBrockworth(idea: Idea): number | undefined {
  if (idea.location?.latitude === undefined || idea.location?.longitude === undefined) return undefined
  return distanceMiles(brockworth, { latitude: idea.location.latitude, longitude: idea.location.longitude })
}

function referenceHostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

export default function Ideas() {
  const { data, addIdea } = useWaypoints()
  const [searchParams, setSearchParams] = useSearchParams()
  const stateParam = searchParams.get('state')
  const selectedState = planningStates.includes(stateParam as Idea['planningState'])
    ? (stateParam as Idea['planningState'])
    : 'active'
  const showEditor = searchParams.get('mode') === 'add'
  const [query, setQuery] = useState('')
  const [usage, setUsage] = useState<UsageFilter>('all')
  const [sort, setSort] = useState<SortKey>('distance')
  const [message, setMessage] = useState<{ severity: 'success' | 'error'; text: string } | null>(null)

  const waypointById = useMemo(
    () => new Map(data.waypoints.map((waypoint) => [waypoint.waypointId, waypoint])),
    [data.waypoints],
  )
  const referenceById = useMemo(
    () => new Map(data.references.map((reference) => [reference.referenceId, reference])),
    [data.references],
  )
  const counts = useMemo(
    () =>
      planningStates.reduce<Record<Idea['planningState'], number>>(
        (result, state) => ({ ...result, [state]: data.ideas.filter((idea) => idea.planningState === state).length }),
        { active: 0, someday: 0, rejected: 0 },
      ),
    [data.ideas],
  )

  const filteredIdeas = useMemo(() => {
    const loweredQuery = query.trim().toLowerCase()
    return data.ideas
      .filter((idea) => idea.planningState === selectedState)
      .filter((idea) => {
        const count = ideaUsageCount(data.activities, idea.ideaId)
        if (usage === 'used') return count > 0
        if (usage === 'not-used') return count === 0
        return true
      })
      .filter((idea) => {
        if (!loweredQuery) return true
        const waypointNames = idea.waypointIds
          .map((id) => waypointById.get(id)?.title)
          .filter((name): name is string => Boolean(name))
        const ideaReferences = idea.referenceIds
          .map((id) => referenceById.get(id))
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
        const referenceTitles = ideaReferences.map((reference) => reference.title)
        const hostnames = ideaReferences.map((reference) => referenceHostname(reference.url))
        return `${idea.title} ${idea.description} ${idea.notes} ${waypointNames.join(' ')} ${referenceTitles.join(' ')} ${hostnames.join(' ')}`
          .toLowerCase()
          .includes(loweredQuery)
      })
      .sort((a, b) => {
        if (sort === 'updated') return b.updatedAt.localeCompare(a.updatedAt)
        if (sort === 'difficulty') return a.difficulty - b.difficulty || a.title.localeCompare(b.title)
        const distanceA = distanceFromBrockworth(a)
        const distanceB = distanceFromBrockworth(b)
        if (distanceA === undefined && distanceB === undefined) return a.title.localeCompare(b.title)
        if (distanceA === undefined) return 1
        if (distanceB === undefined) return -1
        return distanceA - distanceB || a.title.localeCompare(b.title)
      })
  }, [data.activities, data.ideas, query, referenceById, selectedState, sort, usage, waypointById])

  const initialWaypointId = searchParams.get('waypoint') ?? undefined

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}
      >
        <Typography variant="h4">Ideas</Typography>
        {!showEditor && (
          <Button
            variant="contained"
            onClick={() => {
              setMessage(null)
              setSearchParams((previous) => {
                const next = new URLSearchParams(previous)
                next.set('mode', 'add')
                return next
              })
            }}
          >
            Add idea
          </Button>
        )}
      </Stack>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
        {planningStates.map((state) => (
          <Button
            key={state}
            variant={selectedState === state ? 'contained' : 'outlined'}
            onClick={() =>
              setSearchParams((previous) => {
                const next = new URLSearchParams(previous)
                next.set('state', state)
                return next
              })
            }
            aria-label={`${planningStateLabels[state]} ideas (${counts[state]})`}
          >
            {planningStateLabels[state]} ({counts[state]})
          </Button>
        ))}
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField label="Search ideas" value={query} onChange={(event) => setQuery(event.target.value)} fullWidth />
        <FormControl sx={{ minWidth: 180 }}>
          <InputLabel id="idea-usage-label">Usage</InputLabel>
          <Select
            labelId="idea-usage-label"
            label="Usage"
            value={usage}
            onChange={(event) => setUsage(event.target.value as UsageFilter)}
          >
            <MenuItem value="all">All usage</MenuItem>
            <MenuItem value="used">Used ideas</MenuItem>
            <MenuItem value="not-used">Not used</MenuItem>
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 220 }}>
          <InputLabel id="idea-sort-label">Sort</InputLabel>
          <Select
            labelId="idea-sort-label"
            label="Sort"
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
          >
            <MenuItem value="distance">Distance from Brockworth</MenuItem>
            <MenuItem value="updated">Recently updated</MenuItem>
            <MenuItem value="difficulty">Difficulty</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {!showEditor && message && (
        <Typography color={message.severity === 'error' ? 'error' : 'success.main'}>{message.text}</Typography>
      )}

      {showEditor && (
        <IdeaEditor
          data={data}
          initialWaypointId={initialWaypointId}
          submitLabel="Save idea"
          onSubmit={async (draft) => {
            try {
              await addIdea(draft)
              setMessage({ severity: 'success', text: 'Idea saved.' })
              setSearchParams((previous) => {
                const next = new URLSearchParams(previous)
                next.set('state', draft.planningState)
                next.delete('mode')
                next.delete('waypoint')
                return next
              })
            } catch (error) {
              setMessage({
                severity: 'error',
                text: error instanceof Error ? error.message : 'Failed to save idea.',
              })
            }
          }}
          onCancel={() => {
            setMessage(null)
            setSearchParams((previous) => {
              const next = new URLSearchParams(previous)
              next.delete('mode')
              next.delete('waypoint')
              return next
            })
          }}
          errorMessage={message?.severity === 'error' ? message.text : null}
        />
      )}

      {filteredIdeas.length === 0 ? (
        <Typography color="text.secondary">No ideas match your filters.</Typography>
      ) : (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {filteredIdeas.map((idea) => {
            const count = ideaUsageCount(data.activities, idea.ideaId)
            const references = idea.referenceIds
              .map((id) => referenceById.get(id))
              .filter((reference) => reference !== undefined)
            const linkedWaypointNames = idea.waypointIds
              .map((id) => waypointById.get(id)?.title)
              .filter((name): name is string => Boolean(name))
            const distance = distanceFromBrockworth(idea)
            return (
              <Card key={idea.ideaId}>
                <CardContent>
                  <Stack spacing={1}>
                    <Typography variant="h6">{idea.title}</Typography>
                    <Typography color="text.secondary">{idea.description || 'No description'}</Typography>
                    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                      <Chip label={planningStateLabels[idea.planningState]} />
                      <Chip label={difficultyLabels[idea.difficulty]} />
                      <Chip label={ideaUsageLabel(count)} />
                    </Stack>
                    <Typography color="text.secondary">
                      Linked waypoints: {linkedWaypointNames.length > 0 ? linkedWaypointNames.join(', ') : 'None'}
                    </Typography>
                    <Typography color="text.secondary">Location: {ideaLocationSummary(idea.location)}</Typography>
                    {distance !== undefined && (
                      <Typography color="text.secondary">
                        Distance from Brockworth: {distance.toFixed(1)} miles
                      </Typography>
                    )}
                    {references[0] ? (
                      <Typography color="text.secondary">
                        Reference: {references[0].title} ({referenceHostname(references[0].url)})
                      </Typography>
                    ) : (
                      <Typography color="text.secondary">No references</Typography>
                    )}
                    <Button component={Link} to={`/ideas/${idea.ideaId}`}>
                      View idea
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            )
          })}
        </Box>
      )}
    </Stack>
  )
}
