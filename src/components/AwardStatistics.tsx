import { Button, Stack, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import {
  awardableStatuses,
  countLabel,
  statusLabels,
  statusOrder,
  type AwardStatistics as Statistics,
} from '../domain/visit'

export function AwardStatistics({
  statistics,
  scopeLabel,
  challengeId,
}: {
  statistics: Statistics
  scopeLabel: string
  challengeId?: string
}) {
  const scope = challengeId === undefined ? '' : `challenge=${encodeURIComponent(challengeId)}&`
  if (!statistics.supportsAwards) return null
  return (
    <Stack spacing={2}>
      <Typography variant="h6">Waypoints by highest recorded award</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
        {statusOrder.map((tier) => (
          <Button
            key={tier}
            component={Link}
            to={`/waypoints?${scope}status=${tier}`}
            aria-label={`${scopeLabel}, highest ${statusLabels[tier]}, ${countLabel(statistics.waypointAwards[tier].length, 'waypoint')}`}
          >
            {statusLabels[tier]}: {countLabel(statistics.waypointAwards[tier].length, 'waypoint')}
          </Button>
        ))}
      </Stack>
      <Typography variant="h6">Activities by recorded award</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
        {awardableStatuses.map((tier) => (
          <Button
            key={tier}
            component={Link}
            to={`/activities?${scope}award=${tier}`}
            aria-label={`${scopeLabel}, recorded ${statusLabels[tier]}, ${countLabel(statistics.activityAwards[tier].length, 'activity')}`}
          >
            {statusLabels[tier]}: {countLabel(statistics.activityAwards[tier].length, 'activity')}
          </Button>
        ))}
      </Stack>
    </Stack>
  )
}
