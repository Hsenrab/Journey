import type { ReactNode } from 'react'
import { Stack, Typography } from '@mui/material'

type CardDetailRowProps = {
  children: ReactNode
  icon: ReactNode
}

export function CardDetailRow({ children, icon }: CardDetailRowProps) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', color: 'text.secondary' }}>
      {icon}
      <Typography variant="body2" color="text.secondary">
        {children}
      </Typography>
    </Stack>
  )
}
