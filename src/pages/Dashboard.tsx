import { Link } from 'react-router-dom'
import { Box, Button, Card, CardContent, LinearProgress, Stack, Typography } from '@mui/material'
import { locations } from '../data/locations'
import type { Status } from '../domain/location'
import {
  progressTowards,
  recentlyVisited,
  statusCounts,
  statusOrder,
  stillToVisit,
  suggestedNext,
} from '../domain/location'
import { useJourney } from '../features/journey/JourneyContext'

const labels: Record<Status, string> = {
  'not-started': 'Not Started',
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
}

export default function Dashboard() {
  const { data } = useJourney()

  if (locations.length === 0) {
    return (
      <Stack spacing={3}>
        <Typography variant="h4">Dashboard</Typography>
        <Typography color="text.secondary">No locations are available yet.</Typography>
      </Stack>
    )
  }

  const counts = statusCounts(locations, data)
  const recent = recentlyVisited(locations, data)
  const toVisit = stillToVisit(locations, data)
  const suggestions = suggestedNext(locations, data)
  const complete = locations.filter(
    (location) => statusOrder.indexOf(data[location.locationId]?.status ?? 'not-started') >= 2,
  ).length

  return (
    <Stack spacing={4}>
      <Box>
        <Typography variant="h4">Dashboard</Typography>
        <Typography color="text.secondary">
          Brockworth, Gloucester · {complete} of {locations.length} main experiences completed
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        }}
      >
        {statusOrder.map((status) => (
          <Card key={status}>
            <CardContent>
              <Typography variant="h6">{labels[status]}</Typography>
              <Typography variant="h4">{counts[status]}</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Stack spacing={2}>
        <Typography variant="h5">Progress</Typography>
        {(['bronze', 'silver', 'gold'] as const).map((status) => {
          const percent = progressTowards(locations, data, status)
          return (
            <Box key={status}>
              <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                <Typography>{labels[status]}</Typography>
                <Typography color="text.secondary">{percent}%</Typography>
              </Stack>
              <LinearProgress variant="determinate" value={percent} aria-label={`Progress towards ${labels[status]}`} />
            </Box>
          )
        })}
      </Stack>

      <Stack spacing={2}>
        <Typography variant="h5">Recently visited</Typography>
        {recent.length === 0 ? (
          <Typography color="text.secondary">You haven't logged any visits yet.</Typography>
        ) : (
          <Stack spacing={1}>
            {recent.map((location) => (
              <Card key={location.locationId}>
                <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="h6">{location.name}</Typography>
                    <Typography color="text.secondary">
                      {labels[data[location.locationId]?.status ?? 'not-started']} · {data[location.locationId]?.date}
                    </Typography>
                  </Box>
                  <Button component={Link} to={`/locations/${location.locationId}`}>
                    View details
                  </Button>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </Stack>

      <Stack spacing={2}>
        <Typography variant="h5">Still to visit</Typography>
        {toVisit.length === 0 ? (
          <Typography color="text.secondary">You've started every location. Well done!</Typography>
        ) : (
          <Typography color="text.secondary">{toVisit.length} locations not started yet.</Typography>
        )}
      </Stack>

      <Stack spacing={2}>
        <Typography variant="h5">Suggested next locations</Typography>
        {suggestions.length === 0 ? (
          <Typography color="text.secondary">No suggestions right now — you're all caught up.</Typography>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            }}
          >
            {suggestions.map((location) => (
              <Card key={location.locationId}>
                <CardContent>
                  <Stack spacing={1}>
                    <Typography variant="h6">{location.name}</Typography>
                    <Typography color="text.secondary">
                      {location.area} · {location.travel.driveTimeMinutes} min · {location.travel.distanceMiles} miles
                    </Typography>
                    <Button component={Link} to={`/locations/${location.locationId}`}>
                      View details
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}
      </Stack>
    </Stack>
  )
}
