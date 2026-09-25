import type { ReactNode } from 'react'
import { Card, CardActionArea, CardContent } from '@mui/material'
import { Link } from 'react-router-dom'

type ClickableCardProps = {
  children: ReactNode
  title: string
  to: string
}

export function ClickableCard({ children, title, to }: ClickableCardProps) {
  return (
    <Card>
      <CardActionArea component={Link} to={to} aria-label={title}>
        <CardContent>{children}</CardContent>
      </CardActionArea>
    </Card>
  )
}
