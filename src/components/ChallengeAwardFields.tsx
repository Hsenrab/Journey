import { Checkbox, FormControlLabel, Stack, TextField, Typography } from '@mui/material'
import { awardableStatuses, statusLabels, type AwardDescriptions, type Challenge } from '../domain/visit'

export const emptyAwardDescriptions: AwardDescriptions = { bronze: '', silver: '', gold: '' }

export function ChallengeAwardFields({
  enabled,
  descriptions,
  onEnabledChange,
  onDescriptionsChange,
  disabled,
  showErrors,
}: {
  enabled: boolean
  descriptions: AwardDescriptions
  onEnabledChange: (enabled: boolean) => void
  onDescriptionsChange: (descriptions: AwardDescriptions) => void
  disabled?: boolean
  showErrors?: boolean
}) {
  return (
    <Stack spacing={2}>
      <FormControlLabel
        control={
          <Checkbox checked={enabled} disabled={disabled} onChange={(event) => onEnabledChange(event.target.checked)} />
        }
        label="Use Bronze, Silver and Gold awards"
      />
      {enabled &&
        awardableStatuses.map((tier) => (
          <TextField
            key={tier}
            size="small"
            required
            multiline
            label={`${statusLabels[tier]} explanation`}
            value={descriptions[tier]}
            disabled={disabled}
            error={Boolean(showErrors && !descriptions[tier].trim())}
            helperText={
              showErrors && !descriptions[tier].trim()
                ? `${statusLabels[tier]} explanation is required.`
                : 'Describe what this visit level means for this Challenge.'
            }
            onChange={(event) => onDescriptionsChange({ ...descriptions, [tier]: event.target.value })}
          />
        ))}
    </Stack>
  )
}

export function ChallengeAwardDefinitions({ challenges }: { challenges: readonly Challenge[] }) {
  return (
    <Stack spacing={1}>
      {challenges.map((challenge) => {
        if (!challenge.awardDescriptions)
          throw new Error(`Challenge "${challenge.challengeId}" has no award explanations.`)
        const descriptions = challenge.awardDescriptions
        return (
          <Stack key={challenge.challengeId} spacing={1} sx={{ overflowWrap: 'anywhere' }}>
            <Typography sx={{ fontWeight: 'bold' }}>{challenge.title} award explanations</Typography>
            {awardableStatuses.map((tier) => (
              <Typography key={tier}>
                {statusLabels[tier]}: {descriptions[tier]}
              </Typography>
            ))}
          </Stack>
        )
      })}
    </Stack>
  )
}
