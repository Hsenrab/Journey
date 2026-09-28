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
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar'
import RouteIcon from '@mui/icons-material/Route'
import SearchOffIcon from '@mui/icons-material/SearchOff'
import { CardDetailRow } from '../components/CardDetailRow'
import { ClickableCard } from '../components/ClickableCard'
import { EmptyState } from '../components/EmptyState'
import { FilterBar } from '../components/FilterBar'
import { LoadFailureAlert } from '../components/LoadFailureAlert'
import { LoadingNotice } from '../components/LoadingNotice'
import { PageHeader } from '../components/PageHeader'
import { ReadOnlyNotice } from '../components/ReadOnlyNotice'
import { WaypointEditor } from '../components/WaypointEditor'
import { locations } from '../data/locations'
import { brockworth, distanceMiles, waypointCoordinates } from '../domain/map'
import { lastActivityDates, statusLabels, statusOrder } from '../domain/visit'
import { useWaypoints } from '../features/journey/JourneyContext'
import { JourneyConflictError } from '../services/journeyApi'

const locationById = new Map(locations.map((location) => [location.locationId, location]))
type SortKey = 'name' | 'travel' | 'distance' | 'status' | 'lastActivity'

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
  const [maxDistance, setMaxDistance] = useState('all')
  const [area, setArea] = useState('all')
  const [category, setCategory] = useState('all')
  const activeMoreFilterCount = [maxDistance, area, category].filter((value) => value !== 'all').length
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
          data.waypoints.map((waypoint) => {
            const source = locationById.get(waypoint.waypointId)
            return source?.area ?? 'Custom'
          }),
        ),
      ).sort(),
    [data.waypoints],
  )
  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          data.waypoints.map((waypoint) => {
            const source = locationById.get(waypoint.waypointId)
            return source?.category ?? waypoint.category
          }),
        ),
      ).sort(),
    [data.waypoints],
  )
  const distanceByWaypointId = useMemo(
    () =>
      new Map(
        data.waypoints.map((waypoint) => {
          const coordinates = waypointCoordinates(waypoint)
          return [waypoint.waypointId, coordinates ? distanceMiles(brockworth, coordinates) : undefined]
        }),
      ),
    [data.waypoints],
  )

  const list = useMemo(() => {
    const dates = lastActivityDates(activities)
    return data.waypoints
      .filter((waypoint) => {
        const source = locationById.get(waypoint.waypointId)
        const distance = distanceByWaypointId.get(waypoint.waypointId)
        const waypointArea = source?.area ?? 'Custom'
        const waypointCategory = source?.category ?? waypoint.category
        const waypointStatus = statusFor(waypoint.waypointId)
        // Retain unknown distances so filters never silently hide saved waypoints.
        const withinDistance = maxDistance === 'all' || distance === undefined || distance <= Number(maxDistance)
        return (
          (status === 'all' || waypointStatus === status) &&
          withinDistance &&
          (area === 'all' || waypointArea === area) &&
          (category === 'all' || waypointCategory === category) &&
          `${waypoint.title} ${waypointArea} ${waypointCategory}`.toLowerCase().includes(query.toLowerCase())
        )
      })
      .sort((a, b) => {
        const sourceA = locationById.get(a.waypointId)
        const sourceB = locationById.get(b.waypointId)
        switch (sort) {
          case 'travel':
            if (!sourceA && !sourceB) return a.title.localeCompare(b.title)
            if (!sourceA) return 1
            if (!sourceB) return -1
            return sourceA.travel.driveTimeMinutes - sourceB.travel.driveTimeMinutes
          case 'distance': {
            const distanceA = distanceByWaypointId.get(a.waypointId)
            const distanceB = distanceByWaypointId.get(b.waypointId)
            if (distanceA === undefined && distanceB === undefined) return a.title.localeCompare(b.title)
            if (distanceA === undefined) return 1
            if (distanceB === undefined) return -1
            return distanceA - distanceB || a.title.localeCompare(b.title)
          }
          case 'status':
            return statusOrder.indexOf(statusFor(b.waypointId)) - statusOrder.indexOf(statusFor(a.waypointId))
          case 'lastActivity':
            return (dates.get(b.waypointId) ?? '').localeCompare(dates.get(a.waypointId) ?? '')
          default:
            return a.title.localeCompare(b.title)
        }
      })
  }, [activities, area, category, data.waypoints, distanceByWaypointId, maxDistance, query, sort, status, statusFor])

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
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <MenuItem value="all">All statuses</MenuItem>
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
            <MenuItem value="status">Progress</MenuItem>
            <MenuItem value="distance">Distance (nearest first)</MenuItem>
            <MenuItem value="travel">Drive time (where available)</MenuItem>
            <MenuItem value="lastActivity">Last activity date</MenuItem>
          </TextField>
        </FilterBar>
      )}
      {loadState.status !== 'failed' && (
        <Accordion disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls="more-filters" id="more-filters-header">
            <Typography>More filters ({activeMoreFilterCount} active)</Typography>
          </AccordionSummary>
          <AccordionDetails id="more-filters">
            <FilterBar>
              <TextField
                id="maximum-driving-distance"
                select
                label="Maximum driving distance"
                value={maxDistance}
                onChange={(e) => setMaxDistance(e.target.value)}
              >
                <MenuItem value="all">Any distance</MenuItem>
                <MenuItem value="25">Up to 25 miles (plus unknown)</MenuItem>
                <MenuItem value="50">Up to 50 miles (plus unknown)</MenuItem>
                <MenuItem value="100">Up to 100 miles (plus unknown)</MenuItem>
                <MenuItem value="200">Up to 200 miles (plus unknown)</MenuItem>
              </TextField>
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
            const source = locationById.get(waypoint.waypointId)
            const distance = distanceByWaypointId.get(waypoint.waypointId)
            const waypointStatus = statusFor(waypoint.waypointId)
            return (
              <ClickableCard key={waypoint.waypointId} to={`/waypoints/${waypoint.waypointId}`}>
                {(titleId) => (
                  <Stack spacing={1}>
                    <Typography id={titleId} variant="h6">
                      {waypoint.title}
                    </Typography>
                    <Typography color="text.secondary">
                      {(source?.area ?? 'Custom') + ' · ' + (source?.category ?? waypoint.category)}
                    </Typography>
                    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                      <Chip
                        label={statusLabels[waypointStatus]}
                        color={waypointStatus === 'gold' ? 'success' : 'default'}
                      />
                    </Stack>
                    <CardDetailRow icon={<RouteIcon fontSize="small" />}>
                      {distance === undefined ? 'Distance unknown' : `${distance.toFixed(1)} miles from Brockworth`}
                    </CardDetailRow>
                    {source ? (
                      <CardDetailRow icon={<DirectionsCarIcon fontSize="small" />}>
                        {source.travel.driveTimeMinutes} min drive
                      </CardDetailRow>
                    ) : (
                      <CardDetailRow icon={<DirectionsCarIcon fontSize="small" />}>
                        Drive time unavailable
                      </CardDetailRow>
                    )}
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
