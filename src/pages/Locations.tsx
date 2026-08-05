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
import { statusLabels, statusOrder } from '../domain/visit'
import { useJourney } from '../features/journey/JourneyContext'

export default function Locations() {
  const { statusFor } = useJourney()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState('name')
  const [maxDistance, setMaxDistance] = useState('all')
  const list = useMemo(
    () =>
      locations
        .filter((location) => {
          const visitStatus = statusFor(location.locationId)
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
            : statusOrder.indexOf(statusFor(b.locationId)) - statusOrder.indexOf(statusFor(a.locationId))
        }),
    [maxDistance, query, sort, status, statusFor],
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
            {statusOrder.map((s) => (
              <MenuItem key={s} value={s}>
                {statusLabels[s]}
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
                  label={statusLabels[statusFor(location.locationId)]}
                  color={statusFor(location.locationId) === 'gold' ? 'success' : 'default'}
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
