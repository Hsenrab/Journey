import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import FlagIcon from '@mui/icons-material/Flag'
import LinkIcon from '@mui/icons-material/Link'
import PlaceIcon from '@mui/icons-material/Place'
import SearchOffIcon from '@mui/icons-material/SearchOff'
import { CardDetailRow } from '../components/CardDetailRow'
import { ClickableCard } from '../components/ClickableCard'
import { EmptyState } from '../components/EmptyState'
import { FilterBar } from '../components/FilterBar'
import { LoadFailureAlert } from '../components/LoadFailureAlert'
import { LoadingNotice } from '../components/LoadingNotice'
import { PageHeader } from '../components/PageHeader'
import { ReadOnlyNotice } from '../components/ReadOnlyNotice'
import {
  countLabel,
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
import { JourneyConflictError } from '../services/journeyApi'

type SortKey = 'updated' | 'difficulty'
type UsageFilter = 'all' | 'used' | 'not-used'
type StateFilter = Idea['planningState'] | 'all'

const stateFilters: StateFilter[] = ['all', ...planningStates]

function referenceHostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

export default function Ideas() {
  const { data, addIdea, loadState, readOnly, reload } = useWaypoints()
  const [searchParams, setSearchParams] = useSearchParams()
  const stateParam = searchParams.get('state')
  const selectedState: StateFilter = planningStates.includes(stateParam as Idea['planningState'])
    ? (stateParam as Idea['planningState'])
    : 'all'
  const showEditor = searchParams.get('mode') === 'add'
  const [query, setQuery] = useState('')
  const [usage, setUsage] = useState<UsageFilter>('all')
  const [sort, setSort] = useState<SortKey>('updated')
  const [message, setMessage] = useState<{
    severity: 'success' | 'error'
    text: string
    conflict: boolean
  } | null>(null)

  const reloadLatest = async () => {
    const result = await reload()
    if (result.status === 'failure') {
      setMessage({ severity: 'error', text: result.message, conflict: true })
      return
    }
    if (result.status === 'superseded') {
      return
    }
    setMessage(null)
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      next.delete('mode')
      next.delete('waypoint')
      return next
    })
  }

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
  const allCount = data.ideas.length

  const ideasMatchingSearchAndUsage = useMemo(() => {
    const loweredQuery = query.trim().toLowerCase()
    return data.ideas
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
  }, [data.activities, data.ideas, query, referenceById, usage, waypointById])

  const filteredIdeas = useMemo(() => {
    return ideasMatchingSearchAndUsage
      .filter((idea) => selectedState === 'all' || idea.planningState === selectedState)
      .sort((a, b) => {
        if (sort === 'updated') return b.updatedAt.localeCompare(a.updatedAt)
        return a.difficulty - b.difficulty || a.title.localeCompare(b.title)
      })
  }, [ideasMatchingSearchAndUsage, selectedState, sort])

  const otherStateMatchCount =
    selectedState === 'all' || filteredIdeas.length > 0 ? 0 : ideasMatchingSearchAndUsage.length

  const initialWaypointId = searchParams.get('waypoint') ?? undefined
  const clearStateFilter = () => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      next.delete('state')
      return next
    })
  }
  const clearFilters = () => {
    setQuery('')
    setUsage('all')
    clearStateFilter()
  }

  return (
    <Stack spacing={2}>
      <PageHeader title="Ideas">
        {!readOnly && !showEditor && (
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
      </PageHeader>
      <ReadOnlyNotice />
      {loadState.status === 'failed' && (
        <LoadFailureAlert
          message={loadState.message}
          description="This is a load failure, not an empty ideas dataset."
        />
      )}
      {loadState.status !== 'failed' && (
        <ToggleButtonGroup
          exclusive
          size="small"
          aria-label="Planning state"
          value={selectedState}
          onChange={(_event, state: StateFilter | null) => {
            if (state === null) return
            if (state === 'all') {
              clearStateFilter()
              return
            }
            setSearchParams((previous) => {
              const next = new URLSearchParams(previous)
              next.set('state', state)
              return next
            })
          }}
          sx={{
            flexWrap: 'wrap',
            gap: 1,
            '& .MuiToggleButtonGroup-grouped': {
              margin: 0,
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
            },
          }}
        >
          {stateFilters.map((state) => {
            const label = state === 'all' ? 'All' : planningStateLabels[state]
            const count = state === 'all' ? allCount : counts[state]
            return (
              <ToggleButton key={state} value={state} aria-label={`${label} ideas (${count})`}>
                {label} ({count})
              </ToggleButton>
            )
          })}
        </ToggleButtonGroup>
      )}
      {loadState.status !== 'failed' && (
        <FilterBar>
          <TextField label="Search ideas" value={query} onChange={(event) => setQuery(event.target.value)} />
          <TextField
            select
            label="Usage"
            value={usage}
            onChange={(event) => setUsage(event.target.value as UsageFilter)}
          >
            <MenuItem value="all">All usage</MenuItem>
            <MenuItem value="used">Used ideas</MenuItem>
            <MenuItem value="not-used">Not used</MenuItem>
          </TextField>
          <TextField select label="Sort" value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
            <MenuItem value="updated">Recently updated</MenuItem>
            <MenuItem value="difficulty">Difficulty</MenuItem>
          </TextField>
        </FilterBar>
      )}

      {message && (
        <Alert
          severity={message.severity}
          action={
            message.conflict ? (
              <Button color="inherit" size="small" onClick={() => void reloadLatest()}>
                Reload latest
              </Button>
            ) : undefined
          }
        >
          {message.text}
        </Alert>
      )}

      {!readOnly && showEditor && (
        <IdeaEditor
          data={data}
          initialWaypointId={initialWaypointId}
          submitLabel="Save idea"
          onSubmit={async (draft) => {
            try {
              await addIdea(draft)
              setMessage({ severity: 'success', text: 'Idea saved.', conflict: false })
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
                conflict: error instanceof JourneyConflictError,
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
        />
      )}

      {loadState.status === 'failed' ? null : loadState.status === 'loading' ? (
        <LoadingNotice message="Loading ideas…" />
      ) : filteredIdeas.length === 0 ? (
        <EmptyState
          icon={<SearchOffIcon color="disabled" />}
          message={
            allCount === 0
              ? 'You have no ideas yet.'
              : otherStateMatchCount > 0
                ? `No ideas match your filters in this state, but ${
                    otherStateMatchCount === 1 ? '1 idea matches' : `${otherStateMatchCount} ideas match`
                  } in other states.`
                : 'No ideas match your filters.'
          }
          action={
            otherStateMatchCount > 0 ? (
              <Button onClick={clearStateFilter}>View matches in all states</Button>
            ) : allCount > 0 ? (
              <Button onClick={clearFilters}>Clear filters</Button>
            ) : undefined
          }
        />
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
            return (
              <ClickableCard key={idea.ideaId} to={`/ideas/${idea.ideaId}`}>
                {(titleId) => (
                  <Stack spacing={1}>
                    <Typography id={titleId} variant="h6">
                      {idea.title}
                    </Typography>
                    <Typography color="text.secondary">{idea.description || 'No description'}</Typography>
                    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                      <Chip label={planningStateLabels[idea.planningState]} />
                      <Chip label={difficultyLabels[idea.difficulty]} />
                      <Chip label={ideaUsageLabel(count)} />
                    </Stack>
                    <CardDetailRow icon={<FlagIcon fontSize="small" />}>
                      {linkedWaypointNames.length > 0
                        ? `${linkedWaypointNames.length} waypoint${linkedWaypointNames.length === 1 ? '' : 's'}: ${linkedWaypointNames.join(', ')}`
                        : 'No linked waypoints'}
                    </CardDetailRow>
                    <CardDetailRow icon={<PlaceIcon fontSize="small" />}>
                      Location: {ideaLocationSummary(idea.location)}
                    </CardDetailRow>
                    <CardDetailRow icon={<LinkIcon fontSize="small" />}>
                      {countLabel(references.length, 'link')}
                      {references[0] ? ` · ${referenceHostname(references[0].url)}` : ''}
                    </CardDetailRow>
                  </Stack>
                )}
              </ClickableCard>
            )
          })}
        </Box>
      )}
    </Stack>
  )
}
