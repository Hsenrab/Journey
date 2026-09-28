import { Alert, Typography } from '@mui/material'

export function LoadFailureAlert({ description, message }: { description: string; message: string }) {
  return (
    <Alert severity="error">
      <Typography>{message}</Typography>
      <Typography>{description}</Typography>
    </Alert>
  )
}
