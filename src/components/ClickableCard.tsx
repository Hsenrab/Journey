import type { ReactNode } from 'react'
import { Card, CardActionArea, CardContent } from '@mui/material'
import { Link } from 'react-router-dom'

type ClickableCardProps = {
  children: ReactNode
  titleId: string
  to: string
}

export function ClickableCard({ children, titleId, to }: ClickableCardProps) {
  return (
    <Card>
      <CardActionArea component={Link} to={to} aria-labelledby={titleId}>
        <CardContent>{children}</CardContent>
      </CardActionArea>
    </Card>
  )
}
