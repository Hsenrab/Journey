import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Alert, Box, Button, Card, CardContent, Chip, MenuItem, Stack, TextField, Typography } from '@mui/material'
import SearchOffIcon from '@mui/icons-material/SearchOff'
import { EmptyState } from '../components/EmptyState'
import { FilterBar } from '../components/FilterBar'
import { PageHeader } from '../components/PageHeader'
import { WaypointEditor } from '../components/WaypointEditor'
import { locations } from '../data/locations'
import { lastActivityDates, statusLabels, statusOrder } from '../domain/visit'
import { useWaypoints } from '../features/journey/JourneyContext'
import { JourneyConflictError } from '../services/journeyApi'

const locationById = new Map(locations.map((location) => [location.locationId, location]))

type SortKey = 'name' | 'travel' | 'distance' | 'status' | 'lastActivity'

export default function Locations() {
  const { addWaypoint, data, reload, statusFor } = useWaypoints()
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
  const [message, setMessage] = useState<{
    severity: 'success' | 'error'
    text: string
    conflict: boolean
  } | null>(null)

  const reloadLatest = async () => {
    const loadFailure = await reload()
    if (loadFailure) {
      setMessage({ severity: 'error', text: loadFailure, conflict: true })
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

  const list = useMemo(() => {
    const dates = lastActivityDates(activities)
    return data.waypoints
      .filter((waypoint) => waypoint.challengeIds.includes('national-trust'))
      .filter((waypoint) => {
        const source = locationById.get(waypoint.waypointId)
        const waypointArea = source?.area ?? 'Custom'
        const waypointCategory = source?.category ?? waypoint.category
        const waypointStatus = statusFor(waypoint.waypointId)
        const withinDistance =
          maxDistance === 'all' || (source ? source.travel.distanceMiles <= Number(maxDistance) : false)
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
          case 'distance':
            if (!sourceA && !sourceB) return a.title.localeCompare(b.title)
            if (!sourceA) return 1
            if (!sourceB) return -1
            return sourceA.travel.distanceMiles - sourceB.travel.distanceMiles
          case 'status':
            return statusOrder.indexOf(statusFor(b.waypointId)) - statusOrder.indexOf(statusFor(a.waypointId))
          case 'lastActivity':
            return (dates.get(b.waypointId) ?? '').localeCompare(dates.get(a.waypointId) ?? '')
          default:
            return a.title.localeCompare(b.title)
        }
      })
  }, [activities, area, category, data.waypoints, maxDistance, query, sort, status, statusFor])

  return (
    <Stack spacing={2}>
      <PageHeader title="Waypoints">
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
            Add waypoint
          </Button>
        )}
      </PageHeader>
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
      {showEditor && (
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
      <FilterBar>
        <TextField
          label="Search waypoints"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          size="small"
          fullWidth
        />
        <TextField
          id="waypoint-status"
          select
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          size="small"
          fullWidth
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
          size="small"
          fullWidth
        >
          <MenuItem value="name">Name</MenuItem>
          <MenuItem value="status">Progress</MenuItem>
          <MenuItem value="distance">Distance (nearest first)</MenuItem>
          <MenuItem value="travel">Travel time</MenuItem>
          <MenuItem value="lastActivity">Last activity date</MenuItem>
        </TextField>
        <TextField
          id="maximum-driving-distance"
          select
          label="Maximum driving distance"
          value={maxDistance}
          onChange={(e) => setMaxDistance(e.target.value)}
          size="small"
          fullWidth
        >
          <MenuItem value="all">Any distance</MenuItem>
          <MenuItem value="25">Up to 25 miles</MenuItem>
          <MenuItem value="50">Up to 50 miles</MenuItem>
          <MenuItem value="100">Up to 100 miles</MenuItem>
          <MenuItem value="200">Up to 200 miles</MenuItem>
        </TextField>
        <TextField select label="Area" value={area} onChange={(e) => setArea(e.target.value)} size="small" fullWidth>
          <MenuItem value="all">All areas</MenuItem>
          {areas.map((item) => (
            <MenuItem key={item} value={item}>
              {item}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          size="small"
          fullWidth
        >
          <MenuItem value="all">All categories</MenuItem>
          {categories.map((item) => (
            <MenuItem key={item} value={item}>
              {item}
            </MenuItem>
          ))}
        </TextField>
      </FilterBar>
      {list.length === 0 ? (
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
            return (
              <Card key={waypoint.waypointId}>
                <CardContent>
                  <Stack spacing={1}>
                    <Typography variant="h6">{waypoint.title}</Typography>
                    <Typography color="text.secondary">
                      {(source?.area ?? 'Custom') + ' · ' + (source?.category ?? waypoint.category)}
                    </Typography>
                    {source ? (
                      <Typography variant="body2" color="text.secondary">
                        Driving distance: {source.travel.distanceMiles} miles from Brockworth (~
                        {source.travel.driveTimeMinutes} min drive)
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Driving distance unavailable for custom waypoints.
                      </Typography>
                    )}
                    <Chip
                      label={statusLabels[statusFor(waypoint.waypointId)]}
                      color={statusFor(waypoint.waypointId) === 'gold' ? 'success' : 'default'}
                    />
                    <Button component={Link} to={`/waypoints/${waypoint.waypointId}`}>
                      View waypoint
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
