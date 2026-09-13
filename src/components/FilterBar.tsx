import { Children, type ReactNode } from 'react'
import { Grid } from '@mui/material'

type FilterBarProps = {
  children: ReactNode
}

/** Responsive three-column grid for full-width filter controls. */
export function FilterBar({ children }: FilterBarProps) {
  return (
    <Grid container spacing={2}>
      {Children.map(children, (child) => (
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>{child}</Grid>
      ))}
    </Grid>
  )
}
