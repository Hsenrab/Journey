import { Card, CardContent, Stack, Typography } from '@mui/material'

export default function Ideas() {
  return (
    <Stack spacing={3}>
      <Typography variant="h4">Ideas</Typography>
      <Card>
        <CardContent>
          <Typography>
            Save inspiration and research here. Ideas can be linked to waypoints, challenges, both, or neither.
          </Typography>
        </CardContent>
      </Card>
    </Stack>
  )
}
