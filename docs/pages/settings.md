# Settings

Route: `/settings` — implemented in `src/pages/Settings.tsx`.

## Purpose

Manage the active data mode (backup, restore, and clear), explain demo isolation and
fallbacks, and document the challenge rules and status definitions.

## Supported actions

- Read how the header **Data mode** selector swaps between Demo local, Demo Cosmos, and
  Production data
- Export the active data partition as a versioned JSON backup (`waypoints.json` or
  `waypoints-<mode>.json`)
- Restore the active writable data partition from a previously exported JSON backup
- Clear the active writable data partition, after confirming a warning dialog
- Read the qualifying-location rules and what each status means

## Data read

- The active Waypoints dataset from `useWaypoints().data`

## Data written

- On restore, the active writable dataset is replaced via `useWaypoints().restore`.
- On clear, the active writable dataset is reset and its activities, ideas, and photo
  references are emptied.

## Rules and data flow

1. The **Data mode** selector lives in the app header so it is available from every route.
   Demo local loads `src/data/demo.json` read-only, Demo Cosmos loads `/api/journey/demo`
   and allows temporary mutations, and Production data loads `/api/journey/production`.
   Switching modes reloads the selected dataset and does not write to the inactive modes.
2. Export wraps the active dataset in a `{ version, exportedAt, data }` envelope, serialises it as
   formatted JSON and downloads it in the browser; nothing is sent anywhere.
3. Restore parses and validates the selected file with the Zod schemas in `src/services/storage.ts`,
   including the backup version, the visit shape, dates, statuses and known location ids.
4. Invalid files are rejected with an error message and the existing active data is left untouched.
5. A successful restore **replaces** the active writable dataset — it is not a merge and
   does not change the inactive modes. Demo local and fallback data reject restore.
6. Clearing data requires confirmation and cannot be undone without a backup. It clears only the
   active writable partition.
7. If Demo Cosmos cannot load, the app shows read-only Demo local fallback data for the
   session. If Production cannot load, it shows an error and no demo data.

## Future improvements

- Confirmation prompt before replacing data on restore
- Merge option instead of full replace
- Show when the last export was taken

See [../data.md](../data.md) for the data format and backup guidance.
