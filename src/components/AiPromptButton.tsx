import { useState } from 'react'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  TextField,
  Tooltip,
} from '@mui/material'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'

type Props = {
  label: string
  prompt: string
}

export function AiPromptButton({ label, prompt }: Props) {
  const [open, setOpen] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)

  return (
    <>
      <Tooltip title={`Copy an AI prompt for generating ${label} from source material`}>
        <IconButton aria-label={`${label} AI prompt`} size="small" onClick={() => setOpen(true)}>
          <InfoOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="sm"
        fullWidth
        aria-labelledby="ai-prompt-dialog-title"
      >
        <DialogTitle id="ai-prompt-dialog-title">{label} AI prompt</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Copy this prompt into an external AI tool (for example GitHub Copilot Chat or ChatGPT) along with source
            material describing the real place, activity, or idea (a website, notes, etc.). Paste the AI&apos;s JSON
            response into the Paste JSON input.
          </DialogContentText>
          <TextField
            label="AI prompt text"
            value={prompt}
            multiline
            minRows={12}
            fullWidth
            slotProps={{ htmlInput: { readOnly: true } }}
          />
          {copyError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {copyError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setCopyError(null)
              const clipboard = navigator.clipboard
              if (!clipboard?.writeText) {
                setCopyError('Clipboard is unavailable in this browser.')
                return
              }
              void clipboard.writeText(prompt).catch((error) => {
                const message = error instanceof Error ? error.message : String(error)
                setCopyError(`Could not copy prompt: ${message}`)
              })
            }}
          >
            Copy prompt
          </Button>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
