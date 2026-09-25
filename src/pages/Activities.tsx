import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material'
import LinkIcon from '@mui/icons-material/Link'
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary'
import PlaceIcon from '@mui/icons-material/Place'
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined'
import { ActivityEditor } from '../components/ActivityEditor'
import { CardDetailRow } from '../components/CardDetailRow'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { activitySubtitle, activityTitle, countLabel, locationSummary, statusLabels } from '../domain/visit'
import { useWaypoints } from '../features/journey/JourneyContext'
import { JourneyConflictError } from '../services/journeyApi'

export default function Activities() {
  const { data, addActivity, readOnly, reload } = useWaypoints()
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
        {!readOnly && !showEditor && (
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

      {!readOnly && showEditor && (
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
            const subtitle = [activitySubtitle(activity), waypoint?.title].filter(Boolean).join(' · ')
            return (
              <Card key={activity.activityId}>
                <CardContent>
                  <Stack spacing={1}>
                    <Typography variant="h6" component={Link} to={`/activities/${activity.activityId}`}>
                      {activityTitle(activity)}
                    </Typography>
                    {subtitle && <Typography color="text.secondary">{subtitle}</Typography>}
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
                    <CardDetailRow icon={<PlaceIcon fontSize="small" />}>
                      {locationSummary(activity.location)}
                    </CardDetailRow>
                    {activity.notes && <Typography>{activity.notes.slice(0, 140)}</Typography>}
                    <CardDetailRow icon={<PhotoLibraryIcon fontSize="small" />}>
                      {countLabel(activity.photoReferenceIds.length, 'photo')}
                    </CardDetailRow>
                    <CardDetailRow icon={<LinkIcon fontSize="small" />}>
                      {countLabel(activity.referenceIds.length, 'link')}
                    </CardDetailRow>
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
