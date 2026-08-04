import { Box, Card, CardContent, Stack, Typography } from '@mui/material'
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

export default function Dashboard() {
  const { data } = useJourney()
  const complete = locations.filter((l) => order.indexOf(data[l.id]?.status ?? 'not-started') >= 2).length
  const counts = order.map((status) => ({
    status,
    count: locations.filter((l) => (data[l.id]?.status ?? 'not-started') === status).length,
  }))

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4">Dashboard</Typography>
        <Typography color="text.secondary">
          Cheshire and Greater Manchester · {complete} of {locations.length} main experiences completed
        </Typography>
      </Box>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        }}
      >
        {counts.map(({ status, count }) => (
          <Card key={status}>
            <CardContent>
              <Typography variant="h6">{labels[status]}</Typography>
              <Typography variant="h4">{count}</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Stack>
  )
}
