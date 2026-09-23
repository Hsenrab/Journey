import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material'
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined'
import { ActivityEditor } from '../components/ActivityEditor'
import { EmptyState } from '../components/EmptyState'
import { OwnerBadge } from '../components/OwnerBadge'
import { PageHeader } from '../components/PageHeader'
import { locationSummary, statusLabels } from '../domain/visit'
import { useWaypoints } from '../features/journey/JourneyContext'
import { JourneyConflictError } from '../services/journeyApi'

export default function Activities() {
  const { addActivity, canMutate, data, principal, reload } = useWaypoints()
  const waypointById = new Map(data.waypoints.map((waypoint) => [waypoint.waypointId, waypoint]))
  const [showEditor, setShowEditor] = useState(false)
  const [message, setMessage] = useState<{ severity: 'success' | 'error'; text: string; conflict?: boolean } | null>(
    null,
  )

  const activities = [...data.activities].sort(
    (a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt),
  )
  const reloadLatest = async () => {
    try {
      await reload()
      setMessage(null)
      setShowEditor(false)
    } catch (error) {
      setMessage({ severity: 'error', text: error instanceof Error ? error.message : 'Failed to reload activities.' })
    }
  }

  return (
    <Stack spacing={2}>
      <PageHeader title="Activities">
        {!showEditor && principal?.role !== 'viewer' && (
          <Button variant="contained" onClick={() => setShowEditor(true)}>
            Add activity
          </Button>
        )}
      </PageHeader>

      {message && (
        <Alert
          severity={message.severity}
          action={
            message.conflict ? (
              <Button color="inherit" size="small" onClick={() => void reloadLatest()}>
                Reload latest
              </Button>
            ) : undefined
          }
        >
          {message.text}
        </Alert>
      )}

      {showEditor && (
        <ActivityEditor
          data={data}
          submitLabel="Save activity"
          onSubmit={async (draft) => {
            try {
              await addActivity(draft)
              setShowEditor(false)
              setMessage({ severity: 'success', text: 'Activity saved.' })
            } catch (error) {
              setMessage({
                severity: 'error',
                text: error instanceof Error ? error.message : 'Failed to save activity.',
                conflict: error instanceof JourneyConflictError,
              })
            }
          }}
          onCancel={() => setShowEditor(false)}
        />
      )}

      <Stack spacing={2}>
        <Typography variant="h5">Activity log</Typography>
        {activities.length === 0 ? (
          <EmptyState icon={<InboxOutlinedIcon color="disabled" />} message="No activities logged yet." />
        ) : (
          activities.map((activity) => {
            const waypoint = activity.waypointId ? waypointById.get(activity.waypointId) : undefined
            return (
              <Card key={activity.activityId}>
                <CardContent>
                  <Stack spacing={1}>
                    <Typography variant="h6" component={Link} to={`/activities/${activity.activityId}`}>
                      {activity.date}
                    </Typography>
                    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                      {activity.category && <Chip label={statusLabels[activity.category]} />}
                      {waypoint && (
                        <Chip
                          component={Link}
                          clickable
                          label={`Waypoint: ${waypoint.title}`}
                          to={`/waypoints/${waypoint.waypointId}`}
                          variant="outlined"
                        />
                      )}
                    </Stack>
                    <Typography color="text.secondary">{locationSummary(activity.location)}</Typography>
                    {activity.notes && <Typography>{activity.notes.slice(0, 140)}</Typography>}
                    <Typography color="text.secondary">
                      {activity.photoReferenceIds.length} photo{activity.photoReferenceIds.length === 1 ? '' : 's'} ·{' '}
                      {activity.referenceIds.length} link{activity.referenceIds.length === 1 ? '' : 's'}
                    </Typography>
                    <OwnerBadge
                      ownerId={activity.ownerId}
                      currentUserId={principal?.userId}
                      role={principal?.role}
                      canMutate={canMutate(activity.ownerId)}
                    />
                  </Stack>
                </CardContent>
              </Card>
            )
          })
        )}
      </Stack>
    </Stack>
  )
}
