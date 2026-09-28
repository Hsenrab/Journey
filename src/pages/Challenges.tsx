import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material'
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined'
import { ChallengeEditor } from '../components/ChallengeEditor'
import { ClickableCard } from '../components/ClickableCard'
import { EmptyState } from '../components/EmptyState'
import { LoadFailureAlert } from '../components/LoadFailureAlert'
import { LoadingNotice } from '../components/LoadingNotice'
import { PageHeader } from '../components/PageHeader'
import { ReadOnlyNotice } from '../components/ReadOnlyNotice'
import { challengeWaypoints, completedWaypointCount } from '../domain/visit'
import { useWaypoints } from '../features/journey/JourneyContext'
import { JourneyConflictError } from '../services/journeyApi'

export default function Challenges() {
  const { addChallenge, data, loadState, readOnly, reload } = useWaypoints()
  const [searchParams, setSearchParams] = useSearchParams()
  const showEditor = searchParams.get('mode') === 'add'
  const [message, setMessage] = useState<{ severity: 'success' | 'error'; text: string; conflict: boolean } | null>(
    null,
  )
  const setEditorOpen = (open: boolean) =>
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      if (open) next.set('mode', 'add')
      else next.delete('mode')
      return next
    })

  const reloadLatest = async () => {
    const result = await reload()
    if (result.status === 'failure') {
      setMessage({ severity: 'error', text: result.message, conflict: true })
      return
    }
    if (result.status === 'superseded') return
    setMessage(null)
    setEditorOpen(false)
  }

  const challenges = [...data.challenges].sort((a, b) => a.title.localeCompare(b.title))

  return (
    <Stack spacing={2}>
      <PageHeader title="Challenges">
        {!readOnly && !showEditor && (
          <Button
            variant="contained"
            onClick={() => {
              setMessage(null)
              setEditorOpen(true)
            }}
          >
            Add challenge
          </Button>
        )}
      </PageHeader>
      <ReadOnlyNotice />
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
        <ChallengeEditor
          submitLabel="Save challenge"
          onSubmit={async (draft) => {
            try {
              await addChallenge(draft)
              setMessage({ severity: 'success', text: 'Challenge saved.', conflict: false })
              setEditorOpen(false)
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
            setEditorOpen(false)
          }}
        />
      )}
      {loadState.status === 'failed' ? (
        <LoadFailureAlert
          message={loadState.message}
          description="This is a load failure, not an empty challenge dataset."
        />
      ) : loadState.status === 'loading' ? (
        <LoadingNotice message="Loading challenges…" />
      ) : challenges.length === 0 ? (
        <EmptyState icon={<InboxOutlinedIcon color="disabled" />} message="No challenges are available yet." />
      ) : (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}>
          {challenges.map((challenge) => {
            const waypoints = challengeWaypoints(challenge, data.waypoints)
            const complete = completedWaypointCount(waypoints, data.activities)
            return (
              <ClickableCard key={challenge.challengeId} to={`/challenges/${challenge.challengeId}`}>
                {(titleId) => (
                  <Stack spacing={1}>
                    <Typography id={titleId} variant="h6">
                      {challenge.title}
                    </Typography>
                    <Typography color="text.secondary">{challenge.description}</Typography>
                    <Typography>
                      {complete} of {waypoints.length} waypoints completed
                    </Typography>
                    {challenge.supportsActivityCategories && (
                      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                        <Chip label="Bronze, Silver and Gold categories" />
                      </Stack>
                    )}
                  </Stack>
                )}
              </ClickableCard>
            )
          })}
        </Box>
      )}
    </Stack>
  )
}
