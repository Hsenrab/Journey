import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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
import type { Status } from '../domain/location'
import { useJourney } from '../features/journey/JourneyContext'

const labels: Record<Status, string> = {
  'not-started': 'Not Started',
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
}
const order: Status[] = ['not-started', 'bronze', 'silver', 'gold']

export default function Locations() {
  const { data } = useJourney()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState('name')
  const [maxDistance, setMaxDistance] = useState('all')
  const list = useMemo(
    () =>
      locations
        .filter((location) => {
          const visitStatus = data[location.locationId]?.status ?? 'not-started'
          return (
            (status === 'all' || visitStatus === status) &&
            (maxDistance === 'all' || location.travel.distanceMiles <= Number(maxDistance)) &&
            `${location.name} ${location.area} ${location.category}`.toLowerCase().includes(query.toLowerCase())
          )
        })
        .sort((a, b) => {
          if (sort === 'distance') return a.travel.distanceMiles - b.travel.distanceMiles
          return sort === 'name'
            ? a.name.localeCompare(b.name)
            : (data[b.locationId]?.status ?? 'not-started').localeCompare(data[a.locationId]?.status ?? 'not-started')
        }),
    [data, maxDistance, query, sort, status],
  )

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Locations</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField label="Search locations" value={query} onChange={(e) => setQuery(e.target.value)} fullWidth />
        <FormControl>
          <InputLabel id="location-status-label">Status</InputLabel>
          <Select
            id="location-status"
            labelId="location-status-label"
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <MenuItem value="all">All statuses</MenuItem>
            {order.map((s) => (
              <MenuItem key={s} value={s}>
                {labels[s]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl>
          <InputLabel id="location-sort-label">Sort</InputLabel>
          <Select
            id="location-sort"
            labelId="location-sort-label"
            label="Sort"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <MenuItem value="name">Name</MenuItem>
            <MenuItem value="status">Progress</MenuItem>
            <MenuItem value="distance">Distance (nearest first)</MenuItem>
          </Select>
        </FormControl>
        <FormControl>
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
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
        }}
      >
        {list.map((location) => (
          <Card key={location.locationId}>
            <CardContent>
              <Stack spacing={1}>
                <Typography variant="h6">{location.name}</Typography>
                <Typography color="text.secondary">
                  {location.area} · {location.category}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Driving distance: {location.travel.distanceMiles} miles from Brockworth (~
                  {location.travel.driveTimeMinutes} min drive)
                </Typography>
                <Chip
                  label={labels[data[location.locationId]?.status ?? 'not-started']}
                  color={data[location.locationId]?.status === 'gold' ? 'success' : 'default'}
                />
                <Button component={Link} to={`/locations/${location.locationId}`}>
                  View details
                </Button>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Stack>
  )
}
