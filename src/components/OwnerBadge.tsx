import { Chip, Stack, Typography } from '@mui/material'
import type { JourneyRole } from '../services/principal'

type Props = {
  ownerId: string
  currentUserId?: string
  role?: JourneyRole
  canMutate: boolean
}

export function OwnerBadge({ ownerId, currentUserId, role, canMutate }: Props) {
  const ownerLabel = ownerId === currentUserId ? 'You' : ownerId
  const note =
    role === 'viewer'
      ? 'You can view and link to this entity, but cannot modify it.'
      : !canMutate && role === 'editor'
        ? 'You can only edit entities you created.'
        : null

  return (
    <Stack spacing={0.75}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="body2" color="text.secondary">
          Owner
        </Typography>
        <Chip label={ownerLabel} size="small" />
      </Stack>
      {note && (
        <Typography variant="body2" color="text.secondary">
          {note}
        </Typography>
      )}
    </Stack>
  )
}
