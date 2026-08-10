import { Link } from 'react-router-dom'
import { Box, Card, CardActionArea, CardContent, LinearProgress, Stack, Typography } from '@mui/material'
import {
  awardableStatuses,
  completedWaypointCount,
  lastActivityDate,
  recentlyVisited,
  statusCounts,
  statusForWaypoint,
  statusLabels,
} from '../domain/visit'
import { useWaypoints } from '../features/journey/JourneyContext'

export default function Dashboard() {
  const { data } = useWaypoints()
  const challenge = data.challenges.find((item) => item.challengeId === 'national-trust')

  if (!challenge) {
    return (
      <Stack spacing={3}>
        <Typography variant="h4">National Trust Challenge</Typography>
        <Typography color="text.secondary">No challenges are available yet.</Typography>
      </Stack>
    )
  }

  const waypoints = data.waypoints.filter((waypoint) => challenge.waypointIds.includes(waypoint.waypointId))
  const activities = data.activities
  const counts = statusCounts(waypoints, activities)
  const recent = recentlyVisited(waypoints, activities)
  const complete = completedWaypointCount(waypoints, activities)
  const completionPercent = waypoints.length === 0 ? 0 : Math.round((complete / waypoints.length) * 100)

  return (
    <Stack spacing={4}>
      <Typography variant="h4">National Trust Challenge</Typography>

      <Card>
        <CardContent>
          <Stack spacing={1}>
            <Typography variant="h5">{completionPercent}% complete</Typography>
            <Typography color="text.secondary">
              {complete} of {waypoints.length} waypoints completed
            </Typography>
            <LinearProgress variant="determinate" value={completionPercent} aria-label="Challenge completion" />
          </Stack>
        </CardContent>
      </Card>

      <Box>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Activity categories
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          }}
        >
          {awardableStatuses.map((status) => (
            <Card key={status}>
              <CardActionArea component={Link} to={`/waypoints?status=${status}`}>
                <CardContent>
                  <Typography variant="h6">{statusLabels[status]}</Typography>
                  <Typography variant="h4">{counts[status]}</Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      </Box>

      <Stack spacing={2}>
        <Typography variant="h5">Recently visited</Typography>
        {recent.length === 0 ? (
          <Typography color="text.secondary">You haven't logged any activities yet.</Typography>
        ) : (
          <Stack spacing={1}>
            {recent.map((waypoint) => {
              const date = lastActivityDate(activities, waypoint.waypointId)
              return (
                <Card key={waypoint.waypointId}>
                  <CardActionArea component={Link} to={`/waypoints/${waypoint.waypointId}`}>
                    <CardContent>
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={{ xs: 0.5, sm: 2 }}
                        sx={{ justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' } }}
                      >
                        <Typography variant="h6">{waypoint.title}</Typography>
                        <Typography color="text.secondary">
                          {statusLabels[statusForWaypoint(activities, waypoint.waypointId)]}
                          {date ? ` · ${new Date(`${date}T00:00:00`).toLocaleDateString()}` : ''}
                        </Typography>
                      </Stack>
                    </CardContent>
                  </CardActionArea>
                </Card>
              )
            })}
          </Stack>
        )}
      </Stack>
    </Stack>
  )
}
