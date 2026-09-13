# UI guidelines

Concrete layout and spacing rules for React UI in `src/`. They build on MUI and the
shared theme in `src/app/theme.ts`; they do not introduce a new styling system,
directory, or component library.

## Spacing

- Use the theme spacing scale only: the numeric `sx` shorthand (`p`, `px`, `mt`, `gap`)
  or `theme.spacing()`. Values are multiples of `0.5`, for example `spacing={1.5}` or
  `sx={{ p: 2 }}`.
- Do not put arbitrary pixel or `rem` values in `sx` or styled components for margin,
  padding or gap. Fixed pixel values are allowed only for genuinely non-spacing
  dimensions, such as a map container height or an icon size.
- Within one view use at most two spacing steps for the same kind of gap: one between
  sections and one between controls inside a section.

## Layout primitives

- Compose layout with `Stack`, `Grid` and `Box`. Do not hand-roll
  `display: 'flex'` plus per-field `width` values when `Stack` or `Grid` expresses the
  same layout.
- Control bars and filter rows use one `Stack` (equal-width or intrinsic controls) or
  one `Grid` (explicit column spans), with a single `spacing`/`gap` for the whole row.
  Do not set spacing on individual children.
- Make rows responsive with responsive props, for example
  `direction={{ xs: 'column', sm: 'row' }}`, rather than media queries in `sx`.
- Do not set fixed widths on form controls in a row. Let `Grid` spans or
  `flex: 1`/`sx={{ minWidth: 0 }}` size them so controls in the same row align.

## Form fields

- Use `TextField` (including `select`) for text, number, date and select inputs, and
  keep `size="small"` and the same `variant` for every field in a view.
- Use the `label` prop so the floating label renders inside the field outline. Do not
  place a separate `Typography` or `InputLabel` above a field that already has a
  floating label, and do not mix both label patterns in one view.
- When a bare `Select`, `Autocomplete` or similar needs a label, wrap it in
  `FormControl` with `InputLabel` and pass the same `label` to the input so the outline
  notch matches the label.
- Put field help or validation text in `helperText`, not in a sibling `Typography`.

## Tabs, toggles and buttons

- Use `Tabs`/`Tab` for switching between views, and `ToggleButtonGroup`/`ToggleButton`
  for selecting filter values. Do not simulate either with rows of bordered or
  full-width `Button`s.
- Keep `Tabs` in their default style; do not add borders, background fills or
  full-width stretching beyond the `variant` (`scrollable`, `fullWidth`) props.
- Each button row has one primary (`variant="contained"`) action at most; the rest are
  `outlined` or `text`.

## Empty, loading and error states

- Render an empty state as a centred `Stack` with `spacing={1}` and `sx={{ py: 4 }}`
  containing an MUI icon (`color="disabled"`), a short `Typography` message and, when
  there is an obvious next step, one action button.
- Render loading with `CircularProgress` in the same centred block, not with a bare
  line of text.
- Render an expected failure with MUI `Alert` and the specific error message. Do not
  show an empty state when a request failed.

## Page structure

- Primary content of a page must be visible without scrolling on a 1280x800 viewport.
  Keep preceding controls to one compact row, or collapse secondary filters into an
  `Accordion` that starts closed.
- Wrap each page body in a single top-level `Stack` with one `spacing` value so
  sections share the same vertical rhythm.

## Reuse

- Before adding styling, check `src/components/` for a shared component to reuse or
  extend, and `src/app/theme.ts` for a palette, radius or component default that
  already covers the need.
- If the same styled block appears in two pages, move it to `src/components/` instead of
  copying `sx` objects.
- Use theme tokens (`primary.main`, `text.secondary`, `divider`, `shape.borderRadius`)
  instead of literal colours.

## Self-review checklist

Run this against every new or changed view before committing:

- [ ] All margin, padding and gap values come from the theme spacing scale.
- [ ] Controls in a row are aligned, and the row uses one `Stack`/`Grid` spacing value.
- [ ] Every field uses the same label pattern, size and variant, with no label
      overlapping or duplicated outside its input.
- [ ] Tabs and toggles use `Tabs`/`ToggleButtonGroup`, not stand-in buttons.
- [ ] Empty, loading and error states follow the patterns above.
- [ ] Nothing overlaps or overflows at `xs` and at 1280px wide.
- [ ] Primary page content is visible above the fold at 1280x800.
- [ ] No shared component in `src/components/` was duplicated instead of reused.
