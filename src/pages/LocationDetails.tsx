import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material'
import LinkIcon from '@mui/icons-material/Link'
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary'
import PlaceIcon from '@mui/icons-material/Place'
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined'
import { ActivityEditor } from '../components/ActivityEditor'
import { CardDetailRow } from '../components/CardDetailRow'
import { ClickableCard } from '../components/ClickableCard'
import { DetailPageHeader } from '../components/DetailPageHeader'
import { EmptyState } from '../components/EmptyState'
import { LoadFailureAlert } from '../components/LoadFailureAlert'
import { LoadingNotice } from '../components/LoadingNotice'
import { ReadOnlyNotice } from '../components/ReadOnlyNotice'
import { WaypointEditor } from '../components/WaypointEditor'
import {
  activitySubtitle,
  activityTitle,
  completionProgressLabel,
  completionRuleLabel,
  countLabel,
  ideaUsageCount,
  ideaUsageLabel,
  ideasForWaypoint,
  locationSummary,
  planningStateLabels,
  statusLabels,
  waypointCompletionProgress,
} from '../domain/visit'
import { useWaypoints } from '../features/journey/JourneyContext'
import { JourneyConflictError } from '../services/journeyApi'

export default function LocationDetails() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { addActivity, updateWaypoint, deleteWaypoint, activitiesFor, statusFor, data, loadState, readOnly, reload } =
    useWaypoints()
  const [showEditor, setShowEditor] = useState(false)
  const [editingWaypoint, setEditingWaypoint] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [message, setMessage] = useState<{ severity: 'success' | 'error'; text: string; conflict: boolean } | null>(
    null,
  )
  const breadcrumbs = [{ label: 'Waypoints', to: '/waypoints' }]
  const waypoint = data.waypoints.find((item) => item.waypointId === id)

  if (!waypoint) {
    return (
      <Stack spacing={3}>
        <DetailPageHeader breadcrumbs={breadcrumbs} title="Waypoint" />
        {loadState.status === 'failed' ? (
          <LoadFailureAlert message={loadState.message} description="This is a load failure, not a missing waypoint." />
        ) : loadState.status === 'loading' ? (
          <LoadingNotice message="Loading waypoint…" />
        ) : (
          <Alert severity="error">Waypoint not found.</Alert>
        )}
      </Stack>
    )
  }

  const activities = activitiesFor(id)
  const progress = waypointCompletionProgress(waypoint, data.activities)
  const waypointIdeas = ideasForWaypoint(data.ideas, id)
  const reloadLatest = async () => {
    const result = await reload()
    if (result.status === 'failure') {
      setMessage({ severity: 'error', text: result.message, conflict: true })
      return
    }
    if (result.status === 'superseded') {
      return
    }
    setMessage(null)
    setShowEditor(false)
    setEditingWaypoint(false)
    setShowDeleteDialog(false)
  }

  return (
    <Stack spacing={3}>
      <DetailPageHeader breadcrumbs={breadcrumbs} title={waypoint.title}>
        {!readOnly && !showEditor && !editingWaypoint && (
          <>
            <Button
              variant="contained"
              onClick={() => {
                setMessage(null)
                setShowEditor(true)
              }}
            >
              Log activity
            </Button>
            <Button
              onClick={() => {
                setMessage(null)
                setEditingWaypoint(true)
              }}
            >
              Edit waypoint
            </Button>
            <Button color="error" onClick={() => setShowDeleteDialog(true)}>
              Delete waypoint
            </Button>
          </>
        )}
        {!readOnly && !editingWaypoint && (
          <Button component={Link} to={`/ideas?mode=add&waypoint=${encodeURIComponent(id)}`}>
            Add idea
          </Button>
        )}
      </DetailPageHeader>
      <ReadOnlyNotice />
      {loadState.status === 'failed' && (
        <LoadFailureAlert
          message={loadState.message}
          description="This is a load failure, not an empty waypoint dataset."
        />
      )}
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <Chip
          label={`Completion: ${completionProgressLabel(waypoint, progress)}`}
          color={progress.complete ? 'success' : 'default'}
        />
        <Chip variant="outlined" label={`Award tier: ${statusLabels[statusFor(id)]}`} />
      </Stack>
      <Typography color="text.secondary">{completionRuleLabel(waypoint)}</Typography>
      <Typography>{waypoint.description}</Typography>
      <Typography color="text.secondary">
        {[waypoint.category, waypoint.location?.placeName, waypoint.location?.addressOrRegion].filter(Boolean).join(' · ')}
      </Typography>

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

      {!readOnly && editingWaypoint && (
        <WaypointEditor
          data={data}
          initialWaypoint={waypoint}
          submitLabel="Save waypoint"
          onSubmit={async (draft) => {
            try {
              await updateWaypoint(id, draft)
              setEditingWaypoint(false)
              setMessage({ severity: 'success', text: 'Waypoint saved.', conflict: false })
            } catch (error) {
              setMessage({
                severity: 'error',
                text: error instanceof Error ? error.message : 'Failed to save waypoint.',
                conflict: error instanceof JourneyConflictError,
              })
            }
          }}
          onCancel={() => {
            setMessage(null)
            setEditingWaypoint(false)
          }}
        />
      )}

      {!readOnly && showEditor && (
        <ActivityEditor
          data={data}
          initialWaypointId={id}
          submitLabel="Save activity"
          onSubmit={async (draft) => {
            try {
              await addActivity(draft)
              setShowEditor(false)
              setMessage({ severity: 'success', text: 'Activity saved.', conflict: false })
            } catch (error) {
              setMessage({
                severity: 'error',
                text: error instanceof Error ? error.message : 'Failed to save activity.',
                conflict: error instanceof JourneyConflictError,
              })
            }
          }}
          onCancel={() => {
            setMessage(null)
            setShowEditor(false)
          }}
        />
      )}

      <Stack spacing={2}>
        <Typography variant="h5">Ideas</Typography>
        {waypointIdeas.length === 0 ? (
          <EmptyState icon={<InboxOutlinedIcon color="disabled" />} message="No ideas linked to this waypoint." />
        ) : (
          waypointIdeas.map((idea) => (
            <ClickableCard key={idea.ideaId} to={`/ideas/${idea.ideaId}`}>
              {(titleId) => (
                <Stack spacing={1}>
                  <Typography id={titleId} variant="h6">
                    {idea.title}
                  </Typography>
                  <Typography color="text.secondary">
                    {planningStateLabels[idea.planningState]} ·{' '}
                    {ideaUsageLabel(ideaUsageCount(data.activities, idea.ideaId))}
                  </Typography>
                  <Typography color="text.secondary">{idea.description || 'No description'}</Typography>
                </Stack>
              )}
            </ClickableCard>
          ))
        )}
      </Stack>

      <Stack spacing={2}>
        <Typography variant="h5">Activity history</Typography>
        {activities.length === 0 && (
          <EmptyState icon={<InboxOutlinedIcon color="disabled" />} message="No activities logged yet." />
        )}
        {activities.map((activity) => {
          const subtitle = activitySubtitle(activity)
          const title = activityTitle(activity)
          return (
            <ClickableCard key={activity.activityId} to={`/activities/${activity.activityId}`}>
              {(titleId) => (
                <Stack spacing={1}>
                  <Typography id={titleId} variant="h6">
                    {title}
                  </Typography>
                  {subtitle && <Typography color="text.secondary">{subtitle}</Typography>}
                  {activity.category && (
                    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                      <Chip label={statusLabels[activity.category]} />
                    </Stack>
                  )}
                  {activity.notes && <Typography>{activity.notes}</Typography>}
                  <CardDetailRow icon={<PlaceIcon fontSize="small" />}>
                    {locationSummary(activity.location)}
                  </CardDetailRow>
                  <CardDetailRow icon={<PhotoLibraryIcon fontSize="small" />}>
                    {countLabel(activity.photoReferenceIds.length, 'photo')}
                  </CardDetailRow>
                  <CardDetailRow icon={<LinkIcon fontSize="small" />}>
                    {countLabel(activity.referenceIds.length, 'link')}
                  </CardDetailRow>
                </Stack>
              )}
            </ClickableCard>
          )
        })}
      </Stack>
      {!readOnly && (
        <Dialog open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)}>
          <DialogTitle>Delete waypoint?</DialogTitle>
          <DialogContent>
            <Typography>
              Deleting this waypoint clears it from {countLabel(activities.length, 'linked activity')} and{' '}
              {countLabel(waypointIdeas.length, 'linked idea')}. Activities and ideas are kept, and the waypoint is
              removed from linked challenges.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button
              color="error"
              onClick={async () => {
                try {
                  await deleteWaypoint(id)
                  navigate('/waypoints')
                } catch (error) {
                  setMessage({
                    severity: 'error',
                    text: error instanceof Error ? error.message : 'Failed to delete waypoint.',
                    conflict: error instanceof JourneyConflictError,
                  })
                  setShowDeleteDialog(false)
                }
              }}
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Stack>
  )
}
