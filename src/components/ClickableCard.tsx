import { useId, type MouseEventHandler, type ReactNode, type Ref } from 'react'
import { Card, CardActionArea, CardContent } from '@mui/material'
import { Link } from 'react-router-dom'

type ClickableCardProps = {
  ariaLabel?: string
  children: (titleId: string) => ReactNode
  to: string
  state?: unknown
  onClick?: MouseEventHandler<HTMLAnchorElement>
  anchorRef?: Ref<HTMLAnchorElement>
}

export function ClickableCard({ ariaLabel, children, to, state, onClick, anchorRef }: ClickableCardProps) {
  const titleId = useId()
  return (
    <Card>
      <CardActionArea
        component={Link}
        to={to}
        state={state}
        onClick={onClick}
        ref={anchorRef}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel ? undefined : titleId}
      >
        <CardContent>{children(titleId)}</CardContent>
      </CardActionArea>
    </Card>
  )
}
