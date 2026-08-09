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
import { locations } from '../data/locations'
import { lastActivityDates, statusLabels, statusOrder } from '../domain/visit'
import { useWaypoints } from '../features/journey/JourneyContext'

const locationById = new Map(locations.map((location) => [location.locationId, location]))
const areas = Array.from(new Set(locations.map((location) => location.area))).sort()
const categories = Array.from(new Set(locations.map((location) => location.category))).sort()

type SortKey = 'name' | 'travel' | 'distance' | 'status' | 'lastActivity'

export default function Locations() {
  const { data, statusFor } = useWaypoints()
  const activities = data.activities
  const [searchParams, setSearchParams] = useSearchParams()
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

  const list = useMemo(() => {
    const dates = lastActivityDates(activities)
    return data.waypoints
      .filter((waypoint) => waypoint.challengeIds.includes('national-trust'))
      .filter((waypoint) => {
        const source = locationById.get(waypoint.waypointId)
        if (!source) return false
        const waypointStatus = statusFor(waypoint.waypointId)
        return (
          (status === 'all' || waypointStatus === status) &&
          (maxDistance === 'all' || source.travel.distanceMiles <= Number(maxDistance)) &&
          (area === 'all' || source.area === area) &&
          (category === 'all' || source.category === category) &&
          `${waypoint.title} ${source.area} ${source.category}`.toLowerCase().includes(query.toLowerCase())
        )
      })
      .sort((a, b) => {
        const sourceA = locationById.get(a.waypointId)
        const sourceB = locationById.get(b.waypointId)
        if (!sourceA || !sourceB) return a.title.localeCompare(b.title)
        switch (sort) {
          case 'travel':
            return sourceA.travel.driveTimeMinutes - sourceB.travel.driveTimeMinutes
          case 'distance':
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
    <Stack spacing={3}>
      <Typography variant="h4">Waypoints</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ flexWrap: 'wrap' }}>
        <TextField label="Search waypoints" value={query} onChange={(e) => setQuery(e.target.value)} fullWidth />
        <FormControl sx={{ minWidth: 160 }}>
          <InputLabel id="waypoint-status-label">Status</InputLabel>
          <Select
            id="waypoint-status"
            labelId="waypoint-status-label"
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
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 160 }}>
          <InputLabel id="waypoint-sort-label">Sort</InputLabel>
          <Select
            id="waypoint-sort"
            labelId="waypoint-sort-label"
            label="Sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            <MenuItem value="name">Name</MenuItem>
            <MenuItem value="status">Progress</MenuItem>
            <MenuItem value="distance">Distance (nearest first)</MenuItem>
            <MenuItem value="travel">Travel time</MenuItem>
            <MenuItem value="lastActivity">Last activity date</MenuItem>
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 220 }}>
          <InputLabel id="maximum-driving-distance-label">Maximum driving distance</InputLabel>
          <Select
            id="maximum-driving-distance"
            labelId="maximum-driving-distance-label"
            label="Maximum driving distance"
            value={maxDistance}
            onChange={(e) => setMaxDistance(e.target.value)}
          >
            <MenuItem value="all">Any distance</MenuItem>
            <MenuItem value="25">Up to 25 miles</MenuItem>
            <MenuItem value="50">Up to 50 miles</MenuItem>
            <MenuItem value="100">Up to 100 miles</MenuItem>
            <MenuItem value="200">Up to 200 miles</MenuItem>
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 160 }}>
          <InputLabel>Area</InputLabel>
          <Select label="Area" value={area} onChange={(e) => setArea(e.target.value)}>
            <MenuItem value="all">All areas</MenuItem>
            {areas.map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 160 }}>
          <InputLabel>Category</InputLabel>
          <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <MenuItem value="all">All categories</MenuItem>
            {categories.map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>
      {list.length === 0 ? (
        <Typography color="text.secondary">No waypoints match your search and filters.</Typography>
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
            if (!source) return null
            return (
              <Card key={waypoint.waypointId}>
                <CardContent>
                  <Stack spacing={1}>
                    <Typography variant="h6">{waypoint.title}</Typography>
                    <Typography color="text.secondary">
                      {source.area} · {source.category}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Driving distance: {source.travel.distanceMiles} miles from Brockworth (~
                      {source.travel.driveTimeMinutes} min drive)
                    </Typography>
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
