import type { ReactNode } from 'react'
import { Stack, Typography } from '@mui/material'

type EmptyStateProps = {
  icon: ReactNode
  message: string
  action?: ReactNode
}

export function EmptyState({ icon, message, action }: EmptyStateProps) {
  return (
    <Stack spacing={1} sx={{ py: 4, alignItems: 'center', textAlign: 'center' }}>
      {icon}
      <Typography color="text.secondary">{message}</Typography>
      {action}
    </Stack>
  )
}
