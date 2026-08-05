import { Box, Card, CardContent, Stack, Typography } from '@mui/material'
import { locations } from '../data/locations'
import { statusLabels, statusOrder } from '../domain/visit'
import { useJourney } from '../features/journey/JourneyContext'

export default function Dashboard() {
  const { statusFor } = useJourney()
  const complete = locations.filter((location) => statusOrder.indexOf(statusFor(location.locationId)) >= 2).length
  const counts = statusOrder.map((status) => ({
    status,
    count: locations.filter((location) => statusFor(location.locationId) === status).length,
  }))

  return (
    <Stack spacing={3}>
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
        {counts.map(({ status, count }) => (
          <Card key={status}>
            <CardContent>
              <Typography variant="h6">{statusLabels[status]}</Typography>
              <Typography variant="h4">{count}</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Stack>
  )
}
