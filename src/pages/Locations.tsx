import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
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
  awardFilterError,
  awardStatistics,
  waypointSupportsActivityCategory,
} from '../domain/visit'
import { useWaypoints } from '../features/journey/JourneyContext'
import { JourneyConflictError } from '../services/journeyApi'
import {
  isPlainDiscoveryActivation,
  waypointDiscoveryState,
  type DiscoveryCriteria,
} from '../features/journey/waypointDiscovery'

type SortKey = DiscoveryCriteria['sort']

const returnFocusStyle = { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 }

export default function Locations() {
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const { addWaypoint, data, loadState, readOnly, reload, statusFor, waypointDiscovery, confirmNavigation } =
    useWaypoints()
  const activities = data.activities
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const entry = waypointDiscovery.lookup(location.key, location.state)
  const initialView = () => ({
    key: location.key,
    scope: waypointDiscovery.scope,
    query: entry.kind === 'current' ? entry.criteria.query : '',
    area: entry.kind === 'current' ? entry.criteria.area : 'all',
    category: entry.kind === 'current' ? entry.criteria.category : 'all',
    sort: entry.kind === 'current' ? entry.criteria.sort : ('name' as SortKey),
    returnId: entry.kind === 'current' ? entry.waypointId : undefined,
  })
  const [view, setView] = useState(initialView)
  const ownQuery = useRef<{ fromKey: string; search: string } | undefined>(undefined)
  if (view.key !== location.key || view.scope !== waypointDiscovery.scope) {
    const continuation =
      view.scope === waypointDiscovery.scope &&
      ownQuery.current?.fromKey === view.key &&
      ownQuery.current.search === location.search
    setView(continuation ? { ...view, key: location.key, returnId: undefined } : initialView())
  }
  const { query, area, category, sort } = view
  const updateControls = (patch: Partial<Pick<typeof view, 'query' | 'area' | 'category' | 'sort'>>) =>
    setView((previous) => ({ ...previous, ...patch, returnId: undefined }))
  const setQuery = (query: string) => updateControls({ query })
  const setArea = (area: string) => updateControls({ area })
  const setCategory = (category: string) => updateControls({ category })
  const setSort = (sort: SortKey) => updateControls({ sort })
  const invalidated = entry.kind === 'invalidated'
  const showEditor = !invalidated && searchParams.get('mode') === 'add'
  const status = invalidated ? 'all' : (searchParams.get('status') ?? 'all')
  const challengeId = invalidated ? undefined : (searchParams.get('challenge') ?? undefined)
  const changeQuery = (update: (params: URLSearchParams) => URLSearchParams, replace = false) => {
    const next = update(new URLSearchParams(searchParams))
    ownQuery.current = { fromKey: location.key, search: next.size ? `?${next}` : '' }
    updateControls({})
    const state: unknown = location.state
    setSearchParams(next, {
      replace,
      state:
        entry.kind === 'current'
          ? {
              ...(typeof state === 'object' && state !== null ? state : {}),
              ...waypointDiscoveryState(location.key, entry.waypointId),
            }
          : state,
    })
  }
  useLayoutEffect(() => {
    if (ownQuery.current?.fromKey !== location.key) ownQuery.current = undefined
    if (entry.kind === 'invalidated') {
      void navigate('/waypoints', { replace: true })
      return
    }
    waypointDiscovery.follow(location.key, entry, { query, area, category, sort, status, challengeId })
  }, [waypointDiscovery, location.key, entry, query, area, category, sort, status, challengeId, navigate])
  const filterError = awardFilterError(data, { challengeId, status })
  const statistics = useMemo(
    () => (filterError ? undefined : awardStatistics(data, challengeId)),
    [data, challengeId, filterError],
  )
  const challenge = data.challenges.find((item) => item.challengeId === challengeId)
  const awardsApplicable = statistics?.supportsAwards === true
  const setStatus = (value: string) => {
    changeQuery((previous) => {
      const next = new URLSearchParams(previous)
      if (value === 'all') next.delete('status')
      else next.set('status', value)
      return next
    }, true)
  }
  useEffect(() => {
    if (loadState.status === 'loaded' && !awardsApplicable && sort === 'status')
      setView((previous) => ({ ...previous, sort: 'name' }))
  }, [awardsApplicable, sort, loadState.status])
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
    changeQuery((previous) => {
      const next = new URLSearchParams(previous)
      next.delete('mode')
      return next
    })
  }

  const areas = useMemo(
    () =>
      Array.from(new Set(data.waypoints.map((waypoint) => waypoint.location?.addressOrRegion ?? 'Unspecified'))).sort(),
    [data.waypoints],
  )
  const categories = useMemo(
    () => Array.from(new Set(data.waypoints.map((waypoint) => waypoint.category))).sort(),
    [data.waypoints],
  )
  const areaOptions = area === 'all' || areas.includes(area) ? areas : [...areas, area].sort()
  const categoryOptions =
    category === 'all' || categories.includes(category) ? categories : [...categories, category].sort()

  const list = useMemo(() => {
    const dates = lastActivityDates(activities)
    return (challengeId === undefined ? data.waypoints : (statistics?.waypoints ?? []))
      .filter((waypoint) => {
        const waypointArea = waypoint.location?.addressOrRegion ?? 'Unspecified'
        const waypointStatus = statusFor(waypoint.waypointId)
        return (
          (status === 'all' ||
            (waypointSupportsActivityCategory(data, waypoint.waypointId) && waypointStatus === status)) &&
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
  }, [activities, area, category, data, query, sort, status, statusFor, challengeId, statistics])

  const anchors = useRef(new Map<string, HTMLAnchorElement>())
  const absenceRef = useRef<HTMLDivElement>(null)
  const focusedEntry = useRef<string | undefined>(undefined)
  const absence =
    view.returnId && !list.some((item) => item.waypointId === view.returnId)
      ? data.waypoints.some((item) => item.waypointId === view.returnId)
        ? 'The Waypoint you opened no longer matches these filters.'
        : 'The Waypoint you opened is no longer available.'
      : undefined
  useEffect(() => {
    if (loadState.status !== 'loaded' || filterError || !view.returnId || focusedEntry.current === view.key) return
    const target = absence ? absenceRef.current : anchors.current.get(view.returnId)
    if (!target) return
    focusedEntry.current = view.key
    target.scrollIntoView({ block: 'center' })
    target.focus({ preventScroll: true })
  }, [loadState.status, filterError, view.returnId, view.key, absence])

  return (
    <Stack spacing={2}>
      <PageHeader title="Waypoints">
        {!readOnly && !showEditor && (
          <Button
            variant="contained"
            onClick={() => {
              setMessage(null)
              changeQuery((previous) => {
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
      {challenge && (
        <Stack spacing={1}>
          <Typography>
            Challenge scope: {challenge.title}
            {awardsApplicable ? '. Waypoints by highest recorded award.' : ''}
          </Typography>
          <Button component={Link} to={`/challenges/${encodeURIComponent(challenge.challengeId)}#statistics`}>
            Back to {challenge.title} Statistics
          </Button>
        </Stack>
      )}
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
              if (!mounted.current) return
              setMessage({ severity: 'success', text: 'Waypoint saved.', conflict: false })
              changeQuery((previous) => {
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
            changeQuery((previous) => {
              const next = new URLSearchParams(previous)
              next.delete('mode')
              return next
            })
          }}
        />
      )}
      {loadState.status !== 'failed' && !filterError && (
        <FilterBar>
          <TextField label="Search waypoints" value={query} onChange={(e) => setQuery(e.target.value)} />
          {awardsApplicable && (
            <TextField
              id="waypoint-status"
              select
              label="Highest recorded award"
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
          )}
          <TextField
            id="waypoint-sort"
            select
            label="Sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            <MenuItem value="name">Name</MenuItem>
            {awardsApplicable && <MenuItem value="status">Highest recorded award</MenuItem>}
            <MenuItem value="lastActivity">Last activity date</MenuItem>
          </TextField>
        </FilterBar>
      )}
      {(status !== 'all' || query || area !== 'all' || category !== 'all') && (
        <Button
          onClick={() => {
            setStatus('all')
            setQuery('')
            setArea('all')
            setCategory('all')
          }}
        >
          Clear filters
        </Button>
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
                {areaOptions.map((item) => (
                  <MenuItem key={item} value={item}>
                    {item}
                    {!areas.includes(item) ? ' (no current waypoints)' : ''}
                  </MenuItem>
                ))}
              </TextField>
              <TextField select label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
                <MenuItem value="all">All categories</MenuItem>
                {categoryOptions.map((item) => (
                  <MenuItem key={item} value={item}>
                    {item}
                    {!categories.includes(item) ? ' (no current waypoints)' : ''}
                  </MenuItem>
                ))}
              </TextField>
            </FilterBar>
          </AccordionDetails>
        </Accordion>
      )}
      {loadState.status === 'loaded' && !filterError && absence && (
        <Alert severity="info" tabIndex={-1} ref={absenceRef} sx={{ '&:focus': returnFocusStyle }}>
          {absence}
        </Alert>
      )}
      {loadState.status === 'failed' ? null : loadState.status === 'loading' ? (
        <LoadingNotice message="Loading waypoints…" />
      ) : filterError ? (
        <Alert severity="error">{filterError}</Alert>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<SearchOffIcon color="disabled" />}
          message={
            data.waypoints.length === 0
              ? 'No waypoints in this dataset.'
              : 'No waypoints match your search and filters.'
          }
        />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            '& a:focus': returnFocusStyle,
          }}
        >
          {list.map((waypoint) => {
            const waypointStatus = statusFor(waypoint.waypointId)
            const progress = waypointCompletionProgress(waypoint, activities)
            return (
              <ClickableCard
                key={waypoint.waypointId}
                to={`/waypoints/${waypoint.waypointId}`}
                state={waypointDiscoveryState(location.key, waypoint.waypointId)}
                onClick={(event) => {
                  if (!isPlainDiscoveryActivation(event)) return
                  if (!confirmNavigation('Waypoint')) {
                    event.preventDefault()
                    return
                  }
                  waypointDiscovery.capture(
                    location.key,
                    { query, area, category, sort, status, challengeId },
                    waypoint.waypointId,
                  )
                }}
                anchorRef={(node) => {
                  if (node) anchors.current.set(waypoint.waypointId, node)
                  else anchors.current.delete(waypoint.waypointId)
                }}
              >
                {(titleId) => (
                  <Stack spacing={1} sx={{ overflowWrap: 'anywhere' }}>
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
                      {awardsApplicable && waypointSupportsActivityCategory(data, waypoint.waypointId) && (
                        <Chip variant="outlined" label={`Highest recorded award: ${statusLabels[waypointStatus]}`} />
                      )}
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
