import { Alert } from '@mui/material'

export function LoadFailureAlert({ description, message }: { description: string; message: string }) {
  return (
    <Alert severity="error">
      {message} {description}
    </Alert>
  )
}
