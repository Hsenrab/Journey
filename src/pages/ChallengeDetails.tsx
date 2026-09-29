import { Link, useParams } from 'react-router-dom'
import { Breadcrumbs, Stack, Typography } from '@mui/material'
import { ChallengeRouteMap } from '../components/ChallengeRouteMap'
import { LoadFailureAlert } from '../components/LoadFailureAlert'
import { LoadingNotice } from '../components/LoadingNotice'
import { PageHeader } from '../components/PageHeader'
import { challengeRecordedActivities, challengeWaypoints } from '../domain/challenge'
import { useWaypoints } from '../features/journey/JourneyContext'

export default function ChallengeDetails() {
  const { challengeId } = useParams()
  const { data, loadState } = useWaypoints()

  if (loadState.status === 'loading') return <LoadingNotice message="Loading Challenge…" />
  if (loadState.status === 'failed') {
    return <LoadFailureAlert message={loadState.message} description="The Challenge could not be loaded." />
  }

  const challenge = data.challenges.find((item) => item.challengeId === challengeId)
  if (!challenge) return <Typography>Challenge not found.</Typography>

  const waypoints = challengeWaypoints(challenge, data.waypoints)
  const activities = challengeRecordedActivities(challenge, data.waypoints, data.activities)

  return (
    <Stack spacing={3}>
      <Breadcrumbs aria-label="Breadcrumb">
        <Link to="/challenges">Challenges</Link>
        <Typography color="text.primary">{challenge.title}</Typography>
      </Breadcrumbs>
      <PageHeader title={challenge.title} />
      <Typography color="text.secondary">{challenge.description}</Typography>
      <Typography color="text.secondary">
        {waypoints.length} {waypoints.length === 1 ? 'Waypoint' : 'Waypoints'} · {activities.length}{' '}
        {activities.length === 1 ? 'recorded track' : 'recorded tracks'}
      </Typography>
      <ChallengeRouteMap plannedRoute={challenge.plannedRoute} activities={activities} />
    </Stack>
  )
}
