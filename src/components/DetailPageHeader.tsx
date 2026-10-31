import type { MouseEventHandler, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Breadcrumbs, Link as MuiLink, Stack } from '@mui/material'
import { PageHeader } from './PageHeader'

export type DetailBreadcrumb = {
  label: string
  to: string
  state?: unknown
  onClick?: MouseEventHandler<HTMLAnchorElement>
}

type DetailPageHeaderProps = {
  breadcrumbs: DetailBreadcrumb[]
  title: string
  children?: ReactNode
}

export function DetailPageHeader({ breadcrumbs, title, children }: DetailPageHeaderProps) {
  return (
    <Stack spacing={0.5}>
      <Breadcrumbs aria-label="Breadcrumb" data-testid="detail-breadcrumbs">
        {breadcrumbs.map((crumb) => (
          <MuiLink
            key={crumb.to}
            component={Link}
            to={crumb.to}
            state={crumb.state}
            onClick={crumb.onClick}
            color="inherit"
            underline="hover"
            variant="body2"
          >
            {crumb.label}
          </MuiLink>
        ))}
      </Breadcrumbs>
      <PageHeader title={title}>{children}</PageHeader>
    </Stack>
  )
}
