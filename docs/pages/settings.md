# Settings

Route: `/settings` — implemented in `src/pages/Settings.tsx`.

## Purpose

Manage the tracker's data (backup and restore) and explain the challenge rules and status
definitions.

## Supported actions

- Export all visit data as a JSON file (`national-trust-tracker.json`)
- Restore visit data from a previously exported JSON file
- Read the qualifying-location rules and what each status means

## Data read

- All visit records from `useJourney().data`

## Data written

- On restore, the entire visit dataset is replaced via `useJourney().restore` and saved to local
  storage.

## Rules and data flow

1. Export serialises the current data as formatted JSON and downloads it in the browser; nothing is
   sent anywhere.
2. Restore parses and validates the selected file with the Zod schema in `src/services/storage.ts`.
3. Invalid files are rejected with an error message and the existing data is left untouched.
4. A successful restore **replaces** all existing data — it is not a merge.

## Future improvements

- Confirmation prompt before replacing data on restore
- Merge option instead of full replace
- Clear-all-data action
- Show when the last export was taken

See [../data.md](../data.md) for the data format and backup guidance.
