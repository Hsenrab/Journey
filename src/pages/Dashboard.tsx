import { Link } from 'react-router-dom'
import { Box, Button, Card, CardContent, LinearProgress, Stack, Typography } from '@mui/material'
import {
  challengeMilestone,
  completedWaypointCount,
  lastActivityDate,
  progressTowards,
  recentlyVisited,
  statusCounts,
  statusForWaypoint,
  statusLabels,
  statusOrder,
} from '../domain/visit'
import { useWaypoints } from '../features/journey/JourneyContext'

export default function Dashboard() {
  const { data } = useWaypoints()
  const challenge = data.challenges.find((item) => item.challengeId === 'national-trust')

  if (!challenge) {
    return (
      <Stack spacing={3}>
        <Typography variant="h4">Challenges</Typography>
        <Typography color="text.secondary">No challenges are available yet.</Typography>
      </Stack>
    )
  }

  const waypoints = data.waypoints.filter((waypoint) => challenge.waypointIds.includes(waypoint.waypointId))
  const activities = data.activities
  const counts = statusCounts(waypoints, activities)
  const recent = recentlyVisited(waypoints, activities)
  const complete = completedWaypointCount(waypoints, activities)
  const milestone = challengeMilestone(waypoints, activities)

  return (
    <Stack spacing={4}>
      <Box>
        <Typography variant="h4">Challenges</Typography>
        <Typography color="text.secondary">National Trust · {statusLabels[milestone]} milestone</Typography>
      </Box>

      <Card>
        <CardContent>
          <Stack spacing={1}>
            <Typography variant="h5">National Trust</Typography>
            <Typography color="text.secondary">
              {complete} of {waypoints.length} waypoints completed
            </Typography>
          </Stack>
        </CardContent>
      </Card>

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
              <Typography variant="h6">{statusLabels[status]}</Typography>
              <Typography variant="h4">{counts[status]}</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Stack spacing={2}>
        <Typography variant="h5">Progress</Typography>
        {(['bronze', 'silver', 'gold'] as const).map((status) => {
          const percent = progressTowards(waypoints, activities, status)
          return (
            <Box key={status}>
              <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                <Typography>{statusLabels[status]}</Typography>
                <Typography color="text.secondary">{percent}%</Typography>
              </Stack>
              <LinearProgress variant="determinate" value={percent} aria-label={`Progress towards ${statusLabels[status]}`} />
            </Box>
          )
        })}
      </Stack>

      <Stack spacing={2}>
        <Typography variant="h5">Recently visited</Typography>
        {recent.length === 0 ? (
          <Typography color="text.secondary">You haven't logged any activities yet.</Typography>
        ) : (
          <Stack spacing={1}>
            {recent.map((waypoint) => (
              <Card key={waypoint.waypointId}>
                <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="h6">{waypoint.title}</Typography>
                    <Typography color="text.secondary">
                      {statusLabels[statusForWaypoint(activities, waypoint.waypointId)]} ·{' '}
                      {lastActivityDate(activities, waypoint.waypointId)}
                    </Typography>
                  </Box>
                  <Button component={Link} to={`/waypoints/${waypoint.waypointId}`}>
                    View waypoint
                  </Button>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </Stack>
    </Stack>
  )
}
