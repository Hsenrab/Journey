import { useId, type ReactNode } from 'react'
import { Card, CardActionArea, CardContent } from '@mui/material'
import { Link } from 'react-router-dom'

type ClickableCardProps = {
  ariaLabel?: string
  children: (titleId: string) => ReactNode
  to: string
}

export function ClickableCard({ ariaLabel, children, to }: ClickableCardProps) {
  const titleId = useId()
  return (
    <Card>
      <CardActionArea component={Link} to={to} aria-label={ariaLabel} aria-labelledby={ariaLabel ? undefined : titleId}>
        <CardContent>{children(titleId)}</CardContent>
      </CardActionArea>
    </Card>
  )
}
