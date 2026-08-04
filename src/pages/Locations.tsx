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
  const list = useMemo(
    () =>
      locations
        .filter((location) => {
          const visitStatus = data[location.id]?.status ?? 'not-started'
          return (
            (status === 'all' || visitStatus === status) &&
            `${location.name} ${location.county} ${location.type}`.toLowerCase().includes(query.toLowerCase())
          )
        })
        .sort((a, b) =>
          sort === 'name'
            ? a.name.localeCompare(b.name)
            : (data[b.id]?.status ?? 'not-started').localeCompare(data[a.id]?.status ?? 'not-started'),
        ),
    [data, query, sort, status],
  )

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Locations</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField label="Search locations" value={query} onChange={(e) => setQuery(e.target.value)} fullWidth />
        <FormControl>
          <InputLabel>Status</InputLabel>
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <MenuItem value="all">All statuses</MenuItem>
            {order.map((s) => (
              <MenuItem key={s} value={s}>
                {labels[s]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl>
          <InputLabel>Sort</InputLabel>
          <Select label="Sort" value={sort} onChange={(e) => setSort(e.target.value)}>
            <MenuItem value="name">Name</MenuItem>
            <MenuItem value="status">Progress</MenuItem>
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
          <Card key={location.id}>
            <CardContent>
              <Stack spacing={1}>
                <Typography variant="h6">{location.name}</Typography>
                <Typography color="text.secondary">
                  {location.county} · {location.type}
                </Typography>
                <Chip
                  label={labels[data[location.id]?.status ?? 'not-started']}
                  color={data[location.id]?.status === 'gold' ? 'success' : 'default'}
                />
                <Button component={Link} to={`/locations/${location.id}`}>
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
