# Settings

Route: `/settings` — implemented in `src/pages/Settings.tsx`.

## Purpose

Manage the tracker's data (backup and restore) and explain the challenge rules and status
definitions.

## Supported actions

- Export all visit data as a versioned JSON backup (`national-trust-tracker.json`)
- Restore visit data from a previously exported JSON backup
- Clear all visit data, after confirming a warning dialog
- Read the qualifying-location rules and what each status means

## Data read

- All visit records from `useJourney().data`

## Data written

- On restore, the entire visit dataset is replaced via `useJourney().restore` and saved to local
  storage.
- On clear, the dataset is replaced with an empty one.

## Rules and data flow

1. Export wraps the current data in a `{ version, exportedAt, visits }` envelope, serialises it as
   formatted JSON and downloads it in the browser; nothing is sent anywhere.
2. Restore parses and validates the selected file with the Zod schemas in `src/services/storage.ts`,
   including the backup version, the visit shape, dates, statuses and known location ids.
3. Invalid files are rejected with an error message and the existing data is left untouched.
4. A successful restore **replaces** all existing data — it is not a merge.
5. Clearing data requires confirmation and cannot be undone without a backup.

## Future improvements

- Confirmation prompt before replacing data on restore
- Merge option instead of full replace
- Show when the last export was taken

See [../data.md](../data.md) for the data format and backup guidance.
