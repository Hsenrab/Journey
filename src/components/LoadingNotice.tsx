import { CircularProgress, Stack, Typography } from '@mui/material'

export function LoadingNotice({ message }: { message: string }) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <CircularProgress size={20} />
      <Typography color="text.secondary">{message}</Typography>
    </Stack>
  )
}
