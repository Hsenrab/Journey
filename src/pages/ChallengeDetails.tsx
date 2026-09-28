import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material'
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined'
import { ChallengeEditor } from '../components/ChallengeEditor'
import { ClickableCard } from '../components/ClickableCard'
import { DetailPageHeader } from '../components/DetailPageHeader'
import { EmptyState } from '../components/EmptyState'
import { LoadFailureAlert } from '../components/LoadFailureAlert'
import { LoadingNotice } from '../components/LoadingNotice'
import { ReadOnlyNotice } from '../components/ReadOnlyNotice'
import {
  awardableStatuses,
  challengeDeletionImpact,
  challengeWaypoints,
  completedWaypointCount,
  countLabel,
  lastActivityDate,
  recentlyVisited,
  statusCounts,
  statusForWaypoint,
  statusLabels,
} from '../domain/visit'
import { useWaypoints } from '../features/journey/JourneyContext'
import { JourneyConflictError } from '../services/journeyApi'

export default function ChallengeDetails() {
  const { challengeId = '' } = useParams()
  const navigate = useNavigate()
  const { data, deleteChallenge, loadState, readOnly, reload, updateChallenge } = useWaypoints()
  const [editing, setEditing] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [message, setMessage] = useState<{ severity: 'success' | 'error'; text: string; conflict: boolean } | null>(
    null,
  )
  const breadcrumbs = [{ label: 'Challenges', to: '/challenges' }]
  const challenge = data.challenges.find((item) => item.challengeId === challengeId)

  if (!challenge) {
    return (
      <Stack spacing={3}>
        <DetailPageHeader breadcrumbs={breadcrumbs} title="Challenge" />
        {loadState.status === 'failed' ? (
          <LoadFailureAlert
            message={loadState.message}
            description="This is a load failure, not a missing challenge."
          />
        ) : loadState.status === 'loading' ? (
          <LoadingNotice message="Loading challenge…" />
        ) : (
          <Alert severity="error">Challenge not found.</Alert>
        )}
      </Stack>
    )
  }

  const waypoints = challengeWaypoints(challenge, data.waypoints)
  const activities = data.activities
  const counts = statusCounts(waypoints, activities)
  const recent = recentlyVisited(waypoints, activities)
  const complete = completedWaypointCount(waypoints, activities)
  const completionPercent = waypoints.length === 0 ? 0 : Math.round((complete / waypoints.length) * 100)
  const impact = challengeDeletionImpact(data, challengeId)
  const challengeQuery = `challenge=${encodeURIComponent(challengeId)}`

  const reloadLatest = async () => {
    const result = await reload()
    if (result.status === 'failure') {
      setMessage({ severity: 'error', text: result.message, conflict: true })
      return
    }
    if (result.status === 'superseded') return
    setMessage(null)
    setEditing(false)
    setShowDeleteDialog(false)
  }

  return (
    <Stack spacing={3}>
      <DetailPageHeader breadcrumbs={breadcrumbs} title={challenge.title}>
        <Button component={Link} to={`/waypoints?${challengeQuery}`}>
          View waypoints
        </Button>
        {!readOnly && !editing && (
          <>
            <Button component={Link} to={`/waypoints?mode=add&${challengeQuery}`}>
              Add waypoint
            </Button>
            <Button
              onClick={() => {
                setMessage(null)
                setEditing(true)
              }}
            >
              Edit challenge
            </Button>
            <Button color="error" onClick={() => setShowDeleteDialog(true)}>
              Delete challenge
            </Button>
          </>
        )}
      </DetailPageHeader>
      <ReadOnlyNotice />
      {loadState.status === 'failed' && (
        <LoadFailureAlert
          message={loadState.message}
          description="This is a load failure, not an empty challenge dataset."
        />
      )}
      <Typography>{challenge.description}</Typography>

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

      {!readOnly && editing && (
        <ChallengeEditor
          initialChallenge={challenge}
          submitLabel="Save challenge"
          onSubmit={async (draft) => {
            try {
              await updateChallenge(challengeId, draft)
              setEditing(false)
              setMessage({ severity: 'success', text: 'Challenge saved.', conflict: false })
            } catch (error) {
              setMessage({
                severity: 'error',
                text: error instanceof Error ? error.message : 'Failed to save challenge.',
                conflict: error instanceof JourneyConflictError,
              })
            }
          }}
          onCancel={() => {
            setMessage(null)
            setEditing(false)
          }}
        />
      )}

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

      {challenge.supportsActivityCategories && (
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
              <ClickableCard
                key={status}
                to={`/waypoints?${challengeQuery}&status=${status}`}
                ariaLabel={`${statusLabels[status]}: ${countLabel(counts[status], 'waypoint')}`}
              >
                {(titleId) => (
                  <>
                    <Typography id={titleId} variant="h6">
                      {statusLabels[status]}
                    </Typography>
                    <Typography variant="h4">{counts[status]}</Typography>
                  </>
                )}
              </ClickableCard>
            ))}
          </Box>
        </Box>
      )}

      <Stack spacing={2}>
        <Typography variant="h5">Recently visited</Typography>
        {recent.length === 0 ? (
          <EmptyState icon={<InboxOutlinedIcon color="disabled" />} message="You haven't logged any activities yet." />
        ) : (
          <Stack spacing={1}>
            {recent.map((waypoint) => {
              const date = lastActivityDate(activities, waypoint.waypointId)
              return (
                <ClickableCard key={waypoint.waypointId} to={`/waypoints/${waypoint.waypointId}`}>
                  {(titleId) => (
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={{ xs: 0.5, sm: 2 }}
                      sx={{ justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' } }}
                    >
                      <Typography id={titleId} variant="h6">
                        {waypoint.title}
                      </Typography>
                      <Typography color="text.secondary">
                        {statusLabels[statusForWaypoint(activities, waypoint.waypointId)]}
                        {date ? ` · ${new Date(`${date}T00:00:00`).toLocaleDateString()}` : ''}
                      </Typography>
                    </Stack>
                  )}
                </ClickableCard>
              )
            })}
          </Stack>
        )}
      </Stack>
      {!readOnly && (
        <Dialog open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)}>
          <DialogTitle>Delete challenge?</DialogTitle>
          <DialogContent>
            <Stack spacing={1}>
              <Typography>
                Deleting this challenge removes it from {countLabel(impact.waypoints, 'waypoint')}. Waypoints, ideas and
                activities are kept.
              </Typography>
              {impact.clearedCategories > 0 && (
                <Typography>
                  Bronze, Silver or Gold categories will be cleared from {impact.clearedCategories} of your activities
                  because their waypoints will no longer belong to a challenge that supports categories.
                </Typography>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button
              color="error"
              onClick={async () => {
                try {
                  await deleteChallenge(challengeId)
                  navigate('/challenges')
                } catch (error) {
                  setMessage({
                    severity: 'error',
                    text: error instanceof Error ? error.message : 'Failed to delete challenge.',
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
