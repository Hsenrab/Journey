# Visual Design and Responsive UI Evidence

**Reviewed**: 2026-10-20
**Specification**: [Visual UI baseline](spec.md)

| Requirements   | Implementation or guidance reviewed                                                                  | Existing tests reviewed                                                                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-001, FR-002 | [Theme](../../src/app/theme.ts), [application theme boundary](../../src/app/App.tsx)                 | No dedicated theme or screenshot regression suite identified                                                                                                     |
| FR-003         | [Layout](../../src/components/Layout.tsx)                                                            | [Layout tests](../../src/components/Layout.test.tsx) exercise wide/small navigation, not full visual compliance                                                  |
| FR-004         | [Filter bar](../../src/components/FilterBar.tsx), [page header](../../src/components/PageHeader.tsx) | [Filter-bar tests](../../src/components/FilterBar.test.tsx), [header tests](../../src/components/PageHeader.test.tsx) verify structure, not rendered grid widths |
| FR-005         | [Waypoint list](../../src/pages/Locations.tsx)                                                       | [Waypoint list tests](../../src/pages/Locations.test.tsx) provide feature behaviour evidence, not above-the-fold certification                                   |
| FR-006         | [Global map-popup styles](../../src/styles/index.css), [style import](../../src/main.tsx)            | [Map evidence](../007-map-browsing/evidence.md) owns popup/selection behaviour; no screenshot acceptance claimed                                                 |
| FR-007         | [UI guidelines](../../docs/UI_GUIDELINES.md), the source above                                       | Guideline self-review is a design checklist, not an automatically passing test                                                                                   |

## Current Presentation

- All evidence is source-reviewed, not newly executed. The shared hosted page was
  not inspected for this baseline. No viewport, screenshot, contrast, keyboard,
  screen-reader, browser, or application-test acceptance was run.
- The theme uses primary `#2e5339`, secondary `#8a6d3b`, radius 8, heading weights
  700, heading sizes from 2.5rem to 1.1rem, and button labels with no forced case
  conversion. It does not define a user-selectable theme.
- Text fields default to full-width, small, outlined; buttons default to outlined;
  cards default to elevation 0 and outlined borders. Explicit component props
  override defaults. This is not evidence that every component follows all guidelines.
- Layout uses a fixed AppBar, a 240px permanent drawer on wider screens, and an
  `md`-limited main container. Below `sm` (600 CSS pixels), navigation is temporary.
  Toolbar spacers keep main content below the application bar.
- FilterBar allocates each control 12/12 columns at `xs`, 6/12 at `sm` (600px),
  and 4/12 at `md` (900px), using current default breakpoints. PageHeader wraps
  title/actions. Existing component tests inspect child structure and accessible
  text, not pixel positions at those widths.
- Waypoint primary filters use FilterBar; secondary area/category filters are in
  an Accordion without initial expansion. This is feature-specific evidence, not
  a requirement to retrofit every page.
- Global CSS resets body margin and supplies map-popup classes. Popup styling
  includes a viewport-constrained width, compact text/metadata, scrollable lists,
  and visible link-focus outlines. These classes use explicit CSS colours, font
  and dimensions; do not describe them as entirely inherited theme defaults.
- [UI guidelines](../../docs/UI_GUIDELINES.md) prescribe theme-scale spacing,
  consistent labels, standard tabs/toggles, compact page structure, and
  1280x800 above-the-fold visibility. Their existence does not prove every page
  conforms. For example, the shared loading notice is a horizontal status row;
  the guideline describes a centred loading block. No UI rewrite is performed.

## Gaps and Ownership

- No new user-visible defect was confirmed by this bounded source review.
  Guideline compliance and accessibility need separate visual acceptance rather
  than being inferred from component existence.
- Full responsive overflow/overlap, browser zoom, long content, contrast,
  screen-reader behaviour, and the deployed site's visual revision are unverified.
- [Navigation evidence](../010-navigation-interactions/evidence.md) owns the
  limited existing link/focus assertions; [Map evidence](../007-map-browsing/evidence.md)
  owns map controls. Neither is a whole-app accessibility audit.

The [requirements checklist](checklists/requirements.md) certifies document quality
only. Completion does not authorize UI changes or a new validation project.
