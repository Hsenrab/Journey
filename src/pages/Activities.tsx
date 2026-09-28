import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, Button, Chip, Stack, Typography } from '@mui/material'
import LinkIcon from '@mui/icons-material/Link'
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary'
import PlaceIcon from '@mui/icons-material/Place'
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined'
import { ActivityEditor } from '../components/ActivityEditor'
import { CardDetailRow } from '../components/CardDetailRow'
import { ClickableCard } from '../components/ClickableCard'
import { EmptyState } from '../components/EmptyState'
import { LoadFailureAlert } from '../components/LoadFailureAlert'
import { LoadingNotice } from '../components/LoadingNotice'
import { PageHeader } from '../components/PageHeader'
import { ReadOnlyNotice } from '../components/ReadOnlyNotice'
import { activitySubtitle, activityTitle, countLabel, locationSummary, statusLabels } from '../domain/visit'
import { useWaypoints } from '../features/journey/JourneyContext'
import { JourneyConflictError } from '../services/journeyApi'

export default function Activities() {
  const { data, addActivity, loadState, readOnly, reload } = useWaypoints()
  const waypointById = new Map(data.waypoints.map((waypoint) => [waypoint.waypointId, waypoint]))
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const showEditor = searchParams.get('mode') === 'add'
  const initialWaypointId = searchParams.get('waypoint') ?? undefined
  const initialIdeaId = searchParams.get('idea') ?? undefined
  const initialIdeaIds = useMemo(() => (initialIdeaId ? [initialIdeaId] : undefined), [initialIdeaId])
  const [message, setMessage] = useState<{ severity: 'success' | 'error'; text: string; conflict: boolean } | null>(
    null,
  )

  const activities = [...data.activities].sort(
    (a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt),
  )
  const clearEditorParams = () => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      next.delete('mode')
      next.delete('waypoint')
      next.delete('idea')
      return next
    })
  }
  const openEditor = () => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      next.delete('waypoint')
      next.delete('idea')
      next.set('mode', 'add')
      return next
    })
  }
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
    clearEditorParams()
  }

  return (
    <Stack spacing={2}>
      <PageHeader title="Activities">
        {!readOnly && !showEditor && (
          <Button
            variant="contained"
            onClick={() => {
              setMessage(null)
              openEditor()
            }}
          >
            Add activity
          </Button>
        )}
      </PageHeader>
      <ReadOnlyNotice />

      {loadState.status === 'failed' && (
        <LoadFailureAlert
          message={loadState.message}
          description="This is a load failure, not an empty activity log."
        />
      )}

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
          initialWaypointId={initialWaypointId}
          initialIdeaIds={initialIdeaIds}
          submitLabel="Save activity"
          onSubmit={async (draft) => {
            try {
              await addActivity(draft)
              if (initialIdeaId && draft.ideaIds.includes(initialIdeaId)) {
                navigate(`/ideas/${initialIdeaId}`, { replace: true })
                return
              }
              clearEditorParams()
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
            clearEditorParams()
          }}
        />
      )}

      <Stack spacing={2}>
        <Typography variant="h5">Activity log</Typography>
        {loadState.status === 'failed' ? null : loadState.status === 'loading' ? (
          <LoadingNotice message="Loading activities…" />
        ) : activities.length === 0 ? (
          <EmptyState icon={<InboxOutlinedIcon color="disabled" />} message="No activities logged yet." />
        ) : (
          activities.map((activity) => {
            const waypoint = activity.waypointId ? waypointById.get(activity.waypointId) : undefined
            const title = activityTitle(activity)
            const subtitle = [activitySubtitle(activity), waypoint?.title].filter(Boolean).join(' · ')
            return (
              <Stack key={activity.activityId} spacing={1}>
                <ClickableCard to={`/activities/${activity.activityId}`}>
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
                  )}
                </ClickableCard>
                {waypoint && (
                  <Button component={Link} to={`/waypoints/${waypoint.waypointId}`} variant="outlined">
                    View {waypoint.title} waypoint
                  </Button>
                )}
              </Stack>
            )
          })
        )}
      </Stack>
    </Stack>
  )
}
