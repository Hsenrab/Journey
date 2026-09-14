import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'

type PageHeaderProps = {
  title: string
  children?: ReactNode
}

export function PageHeader({ title, children }: PageHeaderProps) {
  return (
    <Box
      data-testid="page-header"
      sx={{
        alignItems: { sm: 'center' },
        display: 'flex',
        flexWrap: 'wrap',
        gap: 1,
      }}
    >
      <Typography component="h1" variant="h5">
        {title}
      </Typography>
      {children && <Box sx={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 1 }}>{children}</Box>}
    </Box>
  )
}
