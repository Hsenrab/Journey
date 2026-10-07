import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import SearchOffIcon from '@mui/icons-material/SearchOff'
import { ClickableCard } from '../components/ClickableCard'
import { EmptyState } from '../components/EmptyState'
import { FilterBar } from '../components/FilterBar'
import { LoadFailureAlert } from '../components/LoadFailureAlert'
import { LoadingNotice } from '../components/LoadingNotice'
import { PageHeader } from '../components/PageHeader'
import { ReadOnlyNotice } from '../components/ReadOnlyNotice'
import { WaypointEditor } from '../components/WaypointEditor'
import {
  completionProgressLabel,
  lastActivityDates,
  statusLabels,
  statusOrder,
  waypointCompletionProgress,
} from '../domain/visit'
import { useWaypoints } from '../features/journey/JourneyContext'
import { JourneyConflictError } from '../services/journeyApi'

type SortKey = 'name' | 'status' | 'lastActivity'

export default function Locations() {
  const { addWaypoint, data, loadState, readOnly, reload, statusFor } = useWaypoints()
  const activities = data.activities
  const [searchParams, setSearchParams] = useSearchParams()
  const showEditor = searchParams.get('mode') === 'add'
  const status = searchParams.get('status') ?? 'all'
  const setStatus = (value: string) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        if (value === 'all') next.delete('status')
        else next.set('status', value)
        return next
      },
      { replace: true },
    )
  }
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('name')
  const [area, setArea] = useState('all')
  const [category, setCategory] = useState('all')
  const activeMoreFilterCount = [area, category].filter((value) => value !== 'all').length
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
      return next
    })
  }

  const areas = useMemo(
    () =>
      Array.from(
        new Set(
          data.waypoints.map((waypoint) => waypoint.location?.addressOrRegion ?? 'Unspecified'),
        ),
      ).sort(),
    [data.waypoints],
  )
  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          data.waypoints.map((waypoint) => waypoint.category),
        ),
      ).sort(),
    [data.waypoints],
  )

  const list = useMemo(() => {
    const dates = lastActivityDates(activities)
    return data.waypoints
      .filter((waypoint) => {
        const waypointArea = waypoint.location?.addressOrRegion ?? 'Unspecified'
        const waypointStatus = statusFor(waypoint.waypointId)
        return (
          (status === 'all' || waypointStatus === status) &&
          (area === 'all' || waypointArea === area) &&
          (category === 'all' || waypoint.category === category) &&
          `${waypoint.title} ${waypointArea} ${waypoint.category}`.toLowerCase().includes(query.toLowerCase())
        )
      })
      .sort((a, b) => {
        switch (sort) {
          case 'status':
            return statusOrder.indexOf(statusFor(b.waypointId)) - statusOrder.indexOf(statusFor(a.waypointId))
          case 'lastActivity':
            return (dates.get(b.waypointId) ?? '').localeCompare(dates.get(a.waypointId) ?? '')
          default:
            return a.title.localeCompare(b.title)
        }
      })
  }, [activities, area, category, data.waypoints, query, sort, status, statusFor])

  return (
    <Stack spacing={2}>
      <PageHeader title="Waypoints">
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
            Add waypoint
          </Button>
        )}
      </PageHeader>
      <ReadOnlyNotice />
      {loadState.status === 'failed' && (
        <LoadFailureAlert
          message={loadState.message}
          description="This is a load failure, not an empty waypoint dataset."
        />
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
        <WaypointEditor
          data={data}
          submitLabel="Save waypoint"
          onSubmit={async (draft) => {
            try {
              await addWaypoint(draft)
              setMessage({ severity: 'success', text: 'Waypoint saved.', conflict: false })
              setSearchParams((previous) => {
                const next = new URLSearchParams(previous)
                next.delete('mode')
                return next
              })
            } catch (error) {
              setMessage({
                severity: 'error',
                text: error instanceof Error ? error.message : 'Failed to save waypoint.',
                conflict: error instanceof JourneyConflictError,
              })
            }
          }}
          onCancel={() => {
            setMessage(null)
            setSearchParams((previous) => {
              const next = new URLSearchParams(previous)
              next.delete('mode')
              return next
            })
          }}
        />
      )}
      {loadState.status !== 'failed' && (
        <FilterBar>
          <TextField label="Search waypoints" value={query} onChange={(e) => setQuery(e.target.value)} />
          <TextField
            id="waypoint-status"
            select
            label="Award tier"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <MenuItem value="all">All award tiers</MenuItem>
            {statusOrder.map((s) => (
              <MenuItem key={s} value={s}>
                {statusLabels[s]}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            id="waypoint-sort"
            select
            label="Sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            <MenuItem value="name">Name</MenuItem>
            <MenuItem value="status">Award tier</MenuItem>
            <MenuItem value="lastActivity">Last activity date</MenuItem>
          </TextField>
        </FilterBar>
      )}
      {loadState.status !== 'failed' && (
        <Accordion disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls="more-filters" id="more-filters-header">
            <Typography>More filters ({activeMoreFilterCount} active)</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <FilterBar>
              <TextField select label="Area" value={area} onChange={(e) => setArea(e.target.value)}>
                <MenuItem value="all">All areas</MenuItem>
                {areas.map((item) => (
                  <MenuItem key={item} value={item}>
                    {item}
                  </MenuItem>
                ))}
              </TextField>
              <TextField select label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
                <MenuItem value="all">All categories</MenuItem>
                {categories.map((item) => (
                  <MenuItem key={item} value={item}>
                    {item}
                  </MenuItem>
                ))}
              </TextField>
            </FilterBar>
          </AccordionDetails>
        </Accordion>
      )}
      {loadState.status === 'failed' ? null : loadState.status === 'loading' ? (
        <LoadingNotice message="Loading waypoints…" />
      ) : list.length === 0 ? (
        <EmptyState icon={<SearchOffIcon color="disabled" />} message="No waypoints match your search and filters." />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          }}
        >
          {list.map((waypoint) => {
            const waypointStatus = statusFor(waypoint.waypointId)
            const progress = waypointCompletionProgress(waypoint, activities)
            return (
              <ClickableCard key={waypoint.waypointId} to={`/waypoints/${waypoint.waypointId}`}>
                {(titleId) => (
                  <Stack spacing={1}>
                    <Typography id={titleId} variant="h6">
                      {waypoint.title}
                    </Typography>
                    <Typography color="text.secondary">
                      {[waypoint.category, waypoint.location?.addressOrRegion].filter(Boolean).join(' · ')}
                    </Typography>
                    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                      <Chip
                        label={`Completion: ${completionProgressLabel(waypoint, progress)}`}
                        color={progress.complete ? 'success' : 'default'}
                      />
                      <Chip variant="outlined" label={`Award tier: ${statusLabels[waypointStatus]}`} />
                    </Stack>
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
