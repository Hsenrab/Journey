import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ZodError } from 'zod'
import { Alert, Button, Card, CardContent, Stack, Typography } from '@mui/material'
import { ChallengeRouteMap } from '../components/ChallengeRouteMap'
import { DetailPageHeader } from '../components/DetailPageHeader'
import { LoadFailureAlert } from '../components/LoadFailureAlert'
import { LoadingNotice } from '../components/LoadingNotice'
import { ReadOnlyNotice } from '../components/ReadOnlyNotice'
import {
  ChallengeAwardFields,
  ChallengeAwardDefinitions,
  emptyAwardDescriptions,
} from '../components/ChallengeAwardFields'
import { AwardStatistics } from '../components/AwardStatistics'
import { parseGpxFile } from '../domain/gpx'
import { challengeRecordedTracks } from '../domain/gpxMap'
import {
  challengeWaypoints,
  challengeCompletionSummary,
  completionProgressLabel,
  waypointCompletionProgress,
  type PlannedRoute,
  AwardDescriptionsSchema,
  AwardValidationError,
  awardStatistics,
  completedWaypointCount,
  countLabel,
  statusForWaypoint,
  statusLabels,
} from '../domain/visit'
import { useJourneyDraft, useWaypoints } from '../features/journey/JourneyContext'
import { JourneyConflictError, JourneyInputError } from '../services/journeyApi'
import { challengeJourneyState } from '../features/journey/challengeJourney'

type Message = { severity: 'success' | 'error'; text: string; conflict?: boolean }

export default function ChallengeDetails() {
  const { challengeId = '' } = useParams()
  const {
    data,
    dataMode,
    activeDataMode,
    confirmNavigation,
    loadState,
    readOnly,
    reload,
    updateChallengeRoute,
    updateChallengeAwards,
    deleteChallenge,
  } = useWaypoints()
  const navigate = useNavigate()
  const challenge = data.challenges.find((item) => item.challengeId === challengeId)
  const [draftRoute, setDraftRoute] = useState<PlannedRoute | null | undefined>()
  const [message, setMessage] = useState<Message | null>(null)
  const [saving, setSaving] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [editingAwards, setEditingAwards] = useState(false)
  const [awardsEnabled, setAwardsEnabled] = useState(false)
  const [descriptions, setDescriptions] = useState(emptyAwardDescriptions)
  const [awardErrors, setAwardErrors] = useState(false)
  const [fatal, setFatal] = useState<{ error: unknown } | null>(null)
  const parsingRef = useRef(false)
  const selectionGeneration = useRef(0)
  useEffect(
    () => () => {
      selectionGeneration.current += 1
    },
    [],
  )
  useJourneyDraft(
    parsing ||
      (editingAwards &&
        (awardsEnabled !== challenge?.supportsActivityCategories ||
          JSON.stringify(descriptions) !== JSON.stringify(challenge?.awardDescriptions ?? emptyAwardDescriptions))) ||
      (draftRoute !== undefined && JSON.stringify(draftRoute ?? undefined) !== JSON.stringify(challenge?.plannedRoute)),
  )
  const waypoints = useMemo(
    () => (challenge ? challengeWaypoints(challenge, data.waypoints) : []),
    [challenge, data.waypoints],
  )
  const recordedTracks = useMemo(
    () => (challenge ? challengeRecordedTracks(challenge, data.waypoints, data.activities) : []),
    [challenge, data.waypoints, data.activities],
  )
  const breadcrumbs = [{ label: 'Challenges', to: '/challenges' }]
  if (fatal) throw fatal.error

  const dashboardReturn = (
    <Button
      component={Link}
      to="/challenges"
      onClick={(event) => {
        if (
          event.button === 0 &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.shiftKey &&
          !event.altKey &&
          !confirmNavigation('Dashboard')
        )
          event.preventDefault()
      }}
    >
      Back to Dashboard
    </Button>
  )
  if (!challenge || loadState.status !== 'loaded') {
    return (
      <Stack spacing={3}>
        <DetailPageHeader breadcrumbs={breadcrumbs} title="Challenge">
          {dashboardReturn}
        </DetailPageHeader>
        {loadState.status === 'loaded' && <ReadOnlyNotice />}
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

  const completion = challengeCompletionSummary(waypoints, data.activities)
  const nextWaypoint = waypoints.find((waypoint) => !waypointCompletionProgress(waypoint, data.activities).complete)
  const originState = (waypointId: string) =>
    challengeJourneyState(challengeId, waypointId, { dataMode, activeDataMode, loaded: true })
  const displayedRoute = draftRoute === undefined ? challenge.plannedRoute : (draftRoute ?? undefined)
  const statistics = awardStatistics(data, challengeId)
  const changeAwards = async (operation: 'save' | 'delete') => {
    if (saving || parsingRef.current) return
    if (operation === 'save') {
      setAwardErrors(true)
      if (awardsEnabled && !AwardDescriptionsSchema.safeParse(descriptions).success) return
    } else if (
      !window.confirm(
        'Delete this Challenge? Its Waypoint memberships and direct Activity links will be detached. Recorded awards must remain eligible through another Challenge or deletion will be blocked.',
      )
    )
      return
    setSaving(true)
    try {
      if (operation === 'delete') {
        await deleteChallenge(challengeId)
        navigate('/challenges')
      } else {
        await updateChallengeAwards(challengeId, {
          supportsActivityCategories: awardsEnabled,
          ...(awardsEnabled ? { awardDescriptions: descriptions } : {}),
        })
        setEditingAwards(false)
        setMessage({ severity: 'success', text: 'Award settings saved. Recorded levels are unchanged.' })
      }
    } catch (error) {
      if (!(
        error instanceof AwardValidationError ||
        error instanceof ZodError ||
        error instanceof JourneyInputError ||
        error instanceof JourneyConflictError
      )) {
        setFatal({ error })
        return
      }
      setMessage({ severity: 'error', text: error.message, conflict: error instanceof JourneyConflictError })
    } finally {
      setSaving(false)
    }
  }
  const hasMapFeatures =
    displayedRoute !== undefined ||
    recordedTracks.length > 0 ||
    waypoints.some((waypoint) => waypoint.location?.latitude !== undefined && waypoint.location.longitude !== undefined)

  const selectFile = async (file: File | undefined) => {
    if (!file || saving) return
    const generation = ++selectionGeneration.current
    parsingRef.current = true
    setParsing(true)
    try {
      const route = await parseGpxFile(file)
      if (generation !== selectionGeneration.current) return
      setDraftRoute(route)
      setMessage(null)
    } catch (cause) {
      if (generation !== selectionGeneration.current) return
      setMessage({ severity: 'error', text: cause instanceof Error ? cause.message : String(cause) })
    } finally {
      if (generation === selectionGeneration.current) {
        parsingRef.current = false
        setParsing(false)
      }
    }
  }

  const saveRoute = async () => {
    if (saving || parsingRef.current) return
    setSaving(true)
    try {
      await updateChallengeRoute(challengeId, draftRoute ?? undefined)
      setDraftRoute(undefined)
      setMessage({
        severity: 'success',
        text: draftRoute ? 'Planned route saved.' : 'Planned route removed.',
      })
    } catch (cause) {
      setMessage({
        severity: 'error',
        text: cause instanceof Error ? cause.message : String(cause),
        conflict: cause instanceof JourneyConflictError,
      })
    } finally {
      setSaving(false)
    }
  }

  const reloadLatest = async () => {
    const result = await reload()
    if (result.status === 'failure') {
      setMessage({ severity: 'error', text: result.message, conflict: true })
      return
    }
    if (result.status === 'superseded') return
    setDraftRoute(undefined)
    setEditingAwards(false)
    setMessage(null)
  }

  return (
    <Stack spacing={3}>
      <DetailPageHeader breadcrumbs={breadcrumbs} title={challenge.title}>
        {dashboardReturn}
      </DetailPageHeader>
      <ReadOnlyNotice />
      <Stack spacing={1} aria-label="Challenge completion" sx={{ overflowWrap: 'anywhere' }}>
        <Typography variant="h5" component="h2">
          Challenge progress
        </Typography>
        <Typography>
          {completion.completed} of {completion.total} waypoints completed ({completion.percentage}%).
        </Typography>
        <Typography color="text.secondary">
          Completion percentage counts completed Waypoints, not Activities. A count-based Waypoint can make progress
          before the percentage changes.
        </Typography>
        {nextWaypoint ? (
          <Button
            component={Link}
            to={`/waypoints/${nextWaypoint.waypointId}`}
            state={originState(nextWaypoint.waypointId)}
            variant="contained"
            sx={{ alignSelf: 'flex-start', whiteSpace: 'normal' }}
          >
            Continue with {nextWaypoint.title}
          </Button>
        ) : waypoints.length > 0 ? (
          <Typography>All waypoints complete.</Typography>
        ) : null}
      </Stack>
      <Typography>{challenge.description}</Typography>
      <Stack direction="row" spacing={1}>
        <Button component="a" href="#statistics">
          Statistics
        </Button>
        {challenge.supportsActivityCategories && (
          <Button component="a" href="#award-definitions">
            Award explanations
          </Button>
        )}
      </Stack>
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

      <Stack spacing={2} aria-label="Member progress">
        <Typography variant="h5">Waypoints</Typography>
        {waypoints.length === 0 ? (
          <Typography color="text.secondary">No waypoints linked to this challenge.</Typography>
        ) : (
          waypoints.map((waypoint) => {
            const progress = waypointCompletionProgress(waypoint, data.activities)
            return (
              <Card key={waypoint.waypointId}>
                <CardContent>
                  <Stack spacing={1} sx={{ overflowWrap: 'anywhere' }}>
                    <Typography variant="h6">{waypoint.title}</Typography>
                    <Typography color="text.secondary">{waypoint.description}</Typography>
                    <Typography>Completion: {completionProgressLabel(waypoint, progress)}</Typography>
                    {challenge.supportsActivityCategories && (
                      <Typography>
                        Highest recorded award: {statusLabels[statusForWaypoint(data.activities, waypoint.waypointId)]}
                      </Typography>
                    )}
                    {waypoint.completion.mode === 'count' && (
                      <Typography>{progress.complete ? 'Done' : 'Not done'}</Typography>
                    )}
                    <Button
                      component={Link}
                      to={`/waypoints/${waypoint.waypointId}`}
                      state={originState(waypoint.waypointId)}
                    >
                      View waypoint
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            )
          })
        )}
      </Stack>
      <Stack spacing={2}>
        {hasMapFeatures && (
          <ChallengeRouteMap plannedRoute={displayedRoute} waypoints={waypoints} recordedTracks={recordedTracks} />
        )}
        {!readOnly && (
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            role="group"
            aria-label="GPX route actions"
            sx={{ alignItems: 'center', flexWrap: 'wrap' }}
          >
            {draftRoute !== null && (
              <Button component="label" variant="outlined" disabled={saving || parsing}>
                {displayedRoute ? 'Replace GPX route' : 'Attach GPX route'}
                <input
                  hidden
                  type="file"
                  accept=".gpx,application/gpx+xml,application/xml,text/xml"
                  disabled={saving || parsing}
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    void selectFile(file)
                  }}
                />
              </Button>
            )}
            {displayedRoute && (
              <Button color="error" disabled={saving || parsing} onClick={() => setDraftRoute(null)}>
                Remove route
              </Button>
            )}
            {draftRoute !== undefined && (
              <>
                <Button variant="contained" disabled={saving || parsing} onClick={() => void saveRoute()}>
                  Save route
                </Button>
                <Button
                  disabled={saving || parsing}
                  onClick={() => {
                    setDraftRoute(undefined)
                    setMessage(null)
                  }}
                >
                  Cancel
                </Button>
              </>
            )}
          </Stack>
        )}
      </Stack>
      <Stack id="award-definitions" spacing={2}>
        {challenge.supportsActivityCategories && <ChallengeAwardDefinitions challenges={[challenge]} />}
        {!readOnly && (
          <Stack spacing={2}>
            {!editingAwards ? (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Button
                  disabled={saving || parsing}
                  onClick={() => {
                    setAwardsEnabled(challenge.supportsActivityCategories)
                    setDescriptions(challenge.awardDescriptions ?? emptyAwardDescriptions)
                    setAwardErrors(false)
                    setEditingAwards(true)
                  }}
                >
                  Edit award settings
                </Button>
                <Button color="error" disabled={saving || parsing} onClick={() => void changeAwards('delete')}>
                  Delete challenge
                </Button>
              </Stack>
            ) : (
              <Stack
                component="form"
                noValidate
                spacing={2}
                onSubmit={(event) => {
                  event.preventDefault()
                  void changeAwards('save')
                }}
              >
                <ChallengeAwardFields
                  enabled={awardsEnabled}
                  descriptions={descriptions}
                  onEnabledChange={setAwardsEnabled}
                  onDescriptionsChange={setDescriptions}
                  disabled={saving || parsing}
                  showErrors={awardErrors}
                />
                <Stack direction="row" spacing={1}>
                  <Button type="submit" variant="contained" disabled={saving || parsing}>
                    Save award settings
                  </Button>
                  <Button disabled={saving || parsing} onClick={() => setEditingAwards(false)}>
                    Cancel award settings
                  </Button>
                </Stack>
              </Stack>
            )}
          </Stack>
        )}
      </Stack>
      <Stack id="statistics" spacing={2}>
        <Typography variant="h5">Statistics</Typography>
        <Typography>
          {challenge.title}: {countLabel(statistics.waypoints.length, 'waypoint')},{' '}
          {countLabel(statistics.activities.length, 'activity')}. {completedWaypointCount(waypoints, data.activities)}{' '}
          of {waypoints.length} Waypoints completed.
        </Typography>
        <AwardStatistics statistics={statistics} scopeLabel={challenge.title} challengeId={challengeId} />
      </Stack>
    </Stack>
  )
}
