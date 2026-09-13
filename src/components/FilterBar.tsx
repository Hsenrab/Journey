import { Children, isValidElement, type ReactElement } from 'react'
import { Grid } from '@mui/material'

type FilterBarProps = {
  children: ReactElement | ReactElement[]
}

/** Responsive three-column grid for full-width filter controls. */
export function FilterBar({ children }: FilterBarProps) {
  return (
    <Grid container spacing={2}>
      {Children.toArray(children).flatMap((child) =>
        isValidElement(child) ? (
          <Grid key={child.key} size={{ xs: 12, sm: 6, md: 4 }}>
            {child}
          </Grid>
        ) : (
          []
        ),
      )}
    </Grid>
  )
}
