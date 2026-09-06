# Theme Switcher Completion Design

## Goal

Finish PR #221 as a reliable, persisted switch between the existing pixel-art presentation and a corporate presentation, including the in-progress Iconify work, while preserving unrelated local changes and leaving the final merge to the repository owner.

## Scope

The feature includes:

- The existing Pixel/Corporate header toggle in both application entry modes.
- Persisted theme selection through the existing node-theme provider.
- Theme-aware node variants, data-pixel rendering, and graph layout.
- Corporate node boxes with type-specific Iconify imagery.
- Explicit custom Iconify IDs and emoji overriding type defaults.
- Six aligned color/filter slots for each theme.

The following local work is excluded:

- `packages/web/src/hooks/useFlowPolling.ts`
- `.claude/`
- `docs/orion-slack-v1-flows.md`

## Component Boundaries

`node-themes.ts` remains the source of truth for theme IDs, labels, persistence, and six-slot palettes.

The React context value and `useNodeTheme` hook move into a non-component module. `NodeThemeContext.tsx` exports only `NodeThemeProvider`, satisfying `react-refresh/only-export-components` without weakening lint rules.

`iconify.ts` owns default node-type Iconify IDs, Iconify ID recognition, URL construction, and explicit-icon resolution. `CorporateBuilding.tsx` owns corporate presentation, including the textual type badge used as a fallback.

`FlowNode.tsx` selects the corporate or pixel renderer. Pixel nodes retain the existing external custom-icon overlay; corporate nodes render the resolved icon inside the node box.

## Rendering Behavior

Pixel mode keeps existing sprite rendering, hue filters, neon accents, carrot data pixels, and custom overlays.

Corporate mode uses flat accent colors, rectangular node boxes, round data pixels, and centered type icons. A badge is rendered beneath each network image so an Iconify load failure reveals meaningful text rather than an empty node. Explicit emoji render directly and do not make a network request.

The sixth pixel slot uses a distinct yellow accent with a matching hue filter. The sixth corporate slot uses a distinct muted violet accent. Filter and accent arrays remain the same length.

## Error Handling

Invalid or unknown stored theme values continue falling back to Pixel mode. Local-storage access remains guarded for private-mode and quota failures.

Malformed or unknown Iconify/type input falls back to the service icon. Failed CDN image loads hide only the image, exposing the underlying type badge. The feature adds no mandatory runtime package or bundled icon dependency.

## Testing

Focused tests verify:

- Pixel and corporate palettes each contain six aligned slots.
- The sixth same-type node receives the sixth color and the seventh wraps to the first.
- Corporate variants do not apply hue filters.
- Iconify URLs correctly handle monochrome recoloring and colorful icon sets.
- Explicit Iconify IDs override type defaults, while unknown types use the service icon.
- Corporate markup includes both the network image and badge fallback; emoji markup does not include an Iconify request.

Repository verification runs web tests, lint, formatting, typecheck, and build. GitHub checks must pass after the branch is rebased and pushed.

## Branch and Local-Work Safety

Only theme-related files and this design are committed. The unrelated tracked polling edit is stashed by explicit path immediately before rebasing and restored immediately afterward. Untracked `.claude/` and Orion documentation remain untouched.

The feature branch is rebased onto `origin/master` and updated with `--force-with-lease`, never an unconditional force push. PR #221 remains open after all checks pass; the repository owner performs the final merge.
