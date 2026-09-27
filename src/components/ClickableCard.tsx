import { useId, type ReactNode } from 'react'
import { Card, CardActionArea, CardContent } from '@mui/material'
import { Link } from 'react-router-dom'

type ClickableCardProps = {
  children: (titleId: string) => ReactNode
  to: string
}

export function ClickableCard({ children, to }: ClickableCardProps) {
  const titleId = useId()
  return (
    <Card>
      <CardActionArea component={Link} to={to} aria-labelledby={titleId}>
        <CardContent>{children(titleId)}</CardContent>
      </CardActionArea>
    </Card>
  )
}
