# Theme Switcher Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish PR #221 with a persisted Pixel/Corporate switch, resilient Iconify-backed corporate nodes, six-slot palettes, and green CI without including unrelated local work.

**Architecture:** Theme state remains centralized in the node-theme provider, but its context and hook move to a non-component module for React Refresh compatibility. Palette data stays in `node-themes.ts`; generic Iconify resolution stays in `iconify.ts`; corporate fallback presentation stays in `CorporateBuilding.tsx`.

**Tech Stack:** React 19, TypeScript 6, Vitest 4, Vite 8, ESLint, Docker Desktop with Node 22

## Global Constraints

- Preserve both application entry modes and persisted theme selection.
- Pixel mode retains sprites, hue filters, carrot pixels, and custom overlays.
- Corporate mode uses flat colors, rectangular nodes, round data pixels, and centered icons.
- Both palettes contain exactly six aligned filter/accent slots.
- Iconify remains CDN-backed with a textual type-badge fallback; add no icon package.
- Explicit valid Iconify IDs and emoji override type defaults.
- Do not stage or commit `packages/web/src/hooks/useFlowPolling.ts`, `.claude/`, or `docs/orion-slack-v1-flows.md`.
- Rebase onto `origin/master` and update PR #221 only with `--force-with-lease`.
- Do not merge PR #221; the repository owner performs the final merge.

---

### Task 1: Split theme context from the provider component

**Files:**

- Create: `packages/web/src/context/node-theme-context.ts`
- Modify: `packages/web/src/context/NodeThemeContext.tsx`
- Modify: `packages/web/src/components/ThemeToggle.tsx`
- Modify: `packages/web/src/components/DataPixel.tsx`
- Modify: `packages/web/src/components/FlowCanvas.tsx`
- Modify: `packages/web/src/components/nodes/FlowNode.tsx`
- Modify: `packages/web/src/hooks/useFlowGraphLayout.ts`

**Interfaces:**

- Produces: `NodeThemeContext`, `NodeThemeContextValue`, and `useNodeTheme()` from `context/node-theme-context.ts`.
- Preserves: `NodeThemeProvider` from `context/NodeThemeContext.tsx`.

- [ ] **Step 1: Prepare the supported Node toolchain**

Run:

```bash
"/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe" volume create openhop-theme-node-modules
"/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe" run --rm \
  -v "$(wslpath -w "$PWD"):/workspace" \
  -v openhop-theme-node-modules:/workspace/node_modules \
  -w /workspace node:22-bookworm npm ci --no-audit
```

Expected: npm installs successfully under Node 22 without changing tracked files.

- [ ] **Step 2: Confirm the existing React Refresh failure**

Run:

```bash
"/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe" run --rm \
  -v "$(wslpath -w "$PWD"):/workspace" \
  -v openhop-theme-node-modules:/workspace/node_modules \
  -w /workspace node:22-bookworm npm run lint -w @openhop/web
```

Expected: FAIL with `react-refresh/only-export-components` at `NodeThemeContext.tsx`.

- [ ] **Step 3: Create the non-component context module**

Create `packages/web/src/context/node-theme-context.ts`:

```ts
import { createContext, useContext } from "react"
import type { NodeThemeId } from "../lib/node-themes"

export interface NodeThemeContextValue {
  themeId: NodeThemeId
  setThemeId: (id: NodeThemeId) => void
}

export const NodeThemeContext = createContext<NodeThemeContextValue | null>(null)

export function useNodeTheme(): NodeThemeContextValue {
  const context = useContext(NodeThemeContext)
  if (!context) throw new Error("useNodeTheme must be used within NodeThemeProvider")
  return context
}
```

- [ ] **Step 4: Leave the TSX module component-only**

Replace `packages/web/src/context/NodeThemeContext.tsx` with:

```tsx
import { useCallback, useMemo, useState, type ReactNode } from "react"
import { loadStoredNodeTheme, storeNodeTheme, type NodeThemeId } from "../lib/node-themes"
import { NodeThemeContext } from "./node-theme-context"

export function NodeThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<NodeThemeId>(() => loadStoredNodeTheme())

  const setThemeId = useCallback((id: NodeThemeId) => {
    setThemeIdState(id)
    storeNodeTheme(id)
  }, [])

  const value = useMemo(() => ({ themeId, setThemeId }), [themeId, setThemeId])

  return <NodeThemeContext.Provider value={value}>{children}</NodeThemeContext.Provider>
}
```

- [ ] **Step 5: Update hook imports**

Use these imports in the five consumers:

```ts
// packages/web/src/components/ThemeToggle.tsx
import { useNodeTheme } from "../context/node-theme-context"

// packages/web/src/components/DataPixel.tsx
import { useNodeTheme } from "../context/node-theme-context"

// packages/web/src/components/FlowCanvas.tsx
import { useNodeTheme } from "../context/node-theme-context"

// packages/web/src/components/nodes/FlowNode.tsx
import { useNodeTheme } from "../../context/node-theme-context"

// packages/web/src/hooks/useFlowGraphLayout.ts
import { useNodeTheme } from "../context/node-theme-context"
```

- [ ] **Step 6: Verify the lint regression is fixed**

Run the Docker lint command from Step 2.

Expected: PASS with no React Refresh error.

### Task 2: Restore six-slot theme palettes

**Files:**

- Modify: `packages/web/__tests__/pixel-palette.test.ts`
- Modify: `packages/web/src/lib/node-themes.ts`

**Interfaces:**

- Consumes: `PIXEL_THEME_PALETTE`, `CORPORATE_THEME_PALETTE`, and `assignNodeVariants()`.
- Produces: six aligned filter/accent entries per theme with deterministic wraparound.

- [ ] **Step 1: Add failing six-slot tests**

Add these imports and tests to `packages/web/__tests__/pixel-palette.test.ts`:

```ts
import { CORPORATE_THEME_PALETTE, PIXEL_THEME_PALETTE } from "../src/lib/node-themes"

describe("theme palette shape", () => {
  it.each([
    { name: "pixel", palette: PIXEL_THEME_PALETTE },
    { name: "corporate", palette: CORPORATE_THEME_PALETTE },
  ])("$name has six aligned filter and accent slots", ({ palette }) => {
    expect(palette.variantFilters).toHaveLength(6)
    expect(palette.variantAccents).toHaveLength(6)
  })

  it("uses slot six before wrapping the seventh same-type node", () => {
    const variants = assignNodeVariants(
      Array.from({ length: 7 }, (_, index) => ({
        id: `service-${index}`,
        type: "service",
      }))
    )

    expect(variants.get("service-5")?.color).toBe(PIXEL_THEME_PALETTE.variantAccents[5])
    expect(variants.get("service-6")?.color).toBe(PIXEL_THEME_PALETTE.variantAccents[0])
  })
})
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run:

```bash
"/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe" run --rm \
  -v "$(wslpath -w "$PWD"):/workspace" \
  -v openhop-theme-node-modules:/workspace/node_modules \
  -w /workspace node:22-bookworm \
  npm test -w @openhop/web -- pixel-palette.test.ts
```

Expected: FAIL because both palettes currently contain five slots.

- [ ] **Step 3: Add the sixth aligned entries**

Update the palette definitions in `packages/web/src/lib/node-themes.ts`:

```ts
export const PIXEL_THEME_PALETTE: NodeThemePalette = {
  variantFilters: [
    undefined,
    "hue-rotate(210deg)",
    "hue-rotate(90deg)",
    "hue-rotate(140deg)",
    "hue-rotate(320deg)",
    "hue-rotate(45deg)",
  ],
  variantAccents: ["#ff8a4a", "#b47aff", "#4aff7a", "#4a9eff", "#ff6b6b", "#ffd84a"],
}

export const CORPORATE_THEME_PALETTE: NodeThemePalette = {
  variantFilters: [undefined, undefined, undefined, undefined, undefined, undefined],
  variantAccents: ["#2563eb", "#475569", "#0d9488", "#1d4ed8", "#64748b", "#7c3aed"],
}
```

- [ ] **Step 4: Run the focused test and confirm success**

Run the Docker test command from Step 2.

Expected: all `pixel-palette.test.ts` tests pass.

### Task 3: Complete resilient corporate icon rendering

**Files:**

- Modify: `packages/web/src/lib/iconify.ts`
- Modify: `packages/web/src/components/nodes/CorporateBuilding.tsx`
- Modify: `packages/web/src/components/nodes/FlowNode.tsx`
- Modify: `packages/web/__tests__/iconify.test.ts`
- Create: `packages/web/__tests__/corporate-building.test.ts`
- Modify: `packages/web/src/lib/node-themes.ts` to keep theme data only

**Interfaces:**

- Consumes: node type, optional custom `icon`, node label, and variant color.
- Produces: validated Iconify URLs, explicit emoji rendering, and a visible textual badge when network imagery fails.

- [ ] **Step 1: Extend Iconify tests with malformed-ID behavior**

Add `isIconifyId` to the imports and these assertions in `packages/web/__tests__/iconify.test.ts`:

```ts
import { NODE_TYPE_ICON, iconifySvgUrl, isIconifyId, resolveNodeTypeIcon } from "../src/lib/iconify"

describe("isIconifyId", () => {
  it("accepts one valid prefix/name separator only", () => {
    expect(isIconifyId("mdi:database")).toBe(true)
    expect(isIconifyId("logos:kubernetes")).toBe(true)
    expect(isIconifyId("mdi:database:extra")).toBe(false)
    expect(isIconifyId(":database")).toBe(false)
    expect(isIconifyId("mdi:")).toBe(false)
  })
})

describe("resolveNodeTypeIcon malformed input", () => {
  it("falls back to the node type icon", () => {
    expect(resolveNodeTypeIcon("database", "mdi:database:extra")).toBe(NODE_TYPE_ICON.database)
  })
})
```

- [ ] **Step 2: Add the failing corporate fallback tests**

Create `packages/web/__tests__/corporate-building.test.ts`:

```ts
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { CorporateBuilding } from "../src/components/nodes/CorporateBuilding"

describe("CorporateBuilding", () => {
  it("renders an Iconify image over a textual type fallback", () => {
    const markup = renderToStaticMarkup(
      createElement(CorporateBuilding, {
        color: "#2563eb",
        nodeType: "database",
        label: "Orders",
      })
    )

    expect(markup).toContain("api.iconify.design/mdi/database.svg")
    expect(markup).toContain(">DB</span>")
    expect(markup).toContain('alt="Orders"')
  })

  it("renders explicit emoji without an Iconify request", () => {
    const markup = renderToStaticMarkup(
      createElement(CorporateBuilding, {
        color: "#2563eb",
        nodeType: "custom",
        icon: "🚀",
        label: "Launch",
      })
    )

    expect(markup).toContain("🚀")
    expect(markup).not.toContain("api.iconify.design")
  })
})
```

- [ ] **Step 3: Run both focused tests and confirm failure**

Run:

```bash
"/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe" run --rm \
  -v "$(wslpath -w "$PWD"):/workspace" \
  -v openhop-theme-node-modules:/workspace/node_modules \
  -w /workspace node:22-bookworm \
  npm test -w @openhop/web -- iconify.test.ts corporate-building.test.ts
```

Expected: FAIL because malformed IDs pass the current loose check and corporate image markup lacks a badge fallback.

- [ ] **Step 4: Validate Iconify IDs strictly**

Replace `isIconifyId` in `packages/web/src/lib/iconify.ts`:

```ts
const ICONIFY_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:[-_][a-z0-9]+)*$/i

export function isIconifyId(icon: string | undefined): icon is string {
  return !!icon && ICONIFY_ID_PATTERN.test(icon)
}
```

Keep `resolveNodeTypeIcon` as:

```ts
export function resolveNodeTypeIcon(nodeType: string, customIcon?: string): string {
  if (customIcon && isIconifyId(customIcon)) return customIcon
  return NODE_TYPE_ICON[nodeType] ?? NODE_TYPE_ICON.service
}
```

- [ ] **Step 5: Add the corporate badge fallback**

Add the component-local badge map and helper in `CorporateBuilding.tsx`:

```ts
const CORPORATE_TYPE_BADGE: Record<string, string> = {
  actor: "USR",
  endpoint: "API",
  auth: "AUTH",
  database: "DB",
  external: "EXT",
  cache: "CACHE",
  queue: "QUEUE",
  service: "SVC",
  docker: "DKR",
  k8s: "K8S",
  scheduler: "CRON",
  ai_agent: "AI",
  browser: "WEB",
  transform: "XFORM",
  validation: "VALID",
  custom: "NODE",
}

function corporateTypeBadge(nodeType: string): string {
  const derived = nodeType
    .slice(0, 3)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
  return CORPORATE_TYPE_BADGE[nodeType] ?? (derived || "NODE")
}
```

Resolve presentation state near the top of the component:

```ts
const resolvedIcon = resolveNodeTypeIcon(nodeType, icon)
const showEmoji = Boolean(icon && !icon.includes(":"))
const badge = corporateTypeBadge(nodeType)
```

Replace the current icon branch with:

```tsx
{
  showEmoji ? (
    <span style={{ fontSize: ICON_SIZE - 8, lineHeight: 1 }} aria-hidden="true">
      {icon}
    </span>
  ) : (
    <>
      <span
        aria-hidden="true"
        style={{
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: 0.6,
          color,
          lineHeight: 1,
        }}
      >
        {badge}
      </span>
      <img
        src={iconifySvgUrl(resolvedIcon, color)}
        alt={label ?? nodeType}
        width={ICON_SIZE}
        height={ICON_SIZE}
        style={{
          position: "absolute",
          display: "block",
          objectFit: "contain",
          background: "#f8fafc",
        }}
        onError={(event) => {
          ;(event.currentTarget as HTMLElement).style.display = "none"
        }}
      />
    </>
  )
}
```

- [ ] **Step 6: Ignore malformed colon-delimited custom overlays in Pixel mode**

Use this branch in `FlowNode.tsx`:

```tsx
if (icon) {
  if (isIconifyId(icon)) {
    const url = iconifySvgUrl(icon, "white")
    customIconOverlay = (
      <img
        src={url}
        alt={label}
        style={{
          width: 40,
          height: 40,
          position: "absolute",
          top: -4,
          left: "calc(100% - 14px)",
          imageRendering: "auto",
        }}
        onError={(event) => {
          ;(event.currentTarget as HTMLElement).style.display = "none"
        }}
      />
    )
  } else if (!icon.includes(":")) {
    customIconOverlay = (
      <span
        style={{
          position: "absolute",
          top: -2,
          left: "calc(100% - 14px)",
          fontSize: 36,
          lineHeight: 1,
        }}
      >
        {icon}
      </span>
    )
  }
}
```

Render the overlay without whitespace lint noise:

```tsx
{
  !isCorporate && customIconOverlay
}
```

- [ ] **Step 7: Run focused and complete web tests**

Run the focused command from Step 3, then:

```bash
"/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe" run --rm \
  -v "$(wslpath -w "$PWD"):/workspace" \
  -v openhop-theme-node-modules:/workspace/node_modules \
  -w /workspace node:22-bookworm npm test -w @openhop/web
```

Expected: all Iconify, corporate-building, palette, and existing web tests pass.

- [ ] **Step 8: Commit only theme-related implementation**

Run:

```bash
git add \
  packages/web/__tests__/corporate-building.test.ts \
  packages/web/__tests__/iconify.test.ts \
  packages/web/__tests__/pixel-palette.test.ts \
  packages/web/src/components/DataPixel.tsx \
  packages/web/src/components/FlowCanvas.tsx \
  packages/web/src/components/ThemeToggle.tsx \
  packages/web/src/components/nodes/CorporateBuilding.tsx \
  packages/web/src/components/nodes/FlowNode.tsx \
  packages/web/src/context/NodeThemeContext.tsx \
  packages/web/src/context/node-theme-context.ts \
  packages/web/src/hooks/useFlowGraphLayout.ts \
  packages/web/src/lib/flow-layout.ts \
  packages/web/src/lib/iconify.ts \
  packages/web/src/lib/node-themes.ts \
  packages/web/src/lib/pixel-palette.ts
git commit -m "feat(web): complete corporate theme icons"
```

Expected: the commit excludes `useFlowPolling.ts`, `.claude/`, and the Orion document.

### Task 4: Verify, rebase, and update PR #221

**Files:**

- No additional source files.

**Interfaces:**

- Consumes: committed theme implementation from Tasks 1–3.
- Produces: an updated, green PR #221 based on current `master`, left open for owner merge.

- [ ] **Step 1: Verify the complete feature before rebasing**

Run:

```bash
"/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe" run --rm \
  -v "$(wslpath -w "$PWD"):/workspace" \
  -v openhop-theme-node-modules:/workspace/node_modules \
  -w /workspace node:22-bookworm sh -lc '
    npm test -w @openhop/web &&
    npm run lint -w @openhop/web &&
    npm run format:check &&
    npm run typecheck -w @openhop/web &&
    npm run build -w @openhop/web
  '
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 2: Confirm only unrelated local work remains**

Run:

```bash
git status --short
```

Expected:

```text
 M packages/web/src/hooks/useFlowPolling.ts
?? .claude/
?? docs/orion-slack-v1-flows.md
```

- [ ] **Step 3: Stash only the unrelated tracked polling edit**

Run:

```bash
git stash push -m preserve-local-flow-polling -- packages/web/src/hooks/useFlowPolling.ts
git stash list -1
```

Expected: the newest stash is named `preserve-local-flow-polling`; untracked `.claude/` and Orion documentation remain in place.

- [ ] **Step 4: Rebase onto current master**

Run:

```bash
git fetch origin
git rebase origin/master
```

Expected: the feature commits replay cleanly onto `origin/master`. If Git reports a conflict, stop without force-pushing and inspect the conflict before continuing.

- [ ] **Step 5: Restore the polling edit immediately**

Run:

```bash
git stash pop
git diff -- packages/web/src/hooks/useFlowPolling.ts
```

Expected: the polling retry diff is restored and remains uncommitted.

- [ ] **Step 6: Refresh dependencies and verify after rebase**

Run:

```bash
"/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe" run --rm \
  -v "$(wslpath -w "$PWD"):/workspace" \
  -v openhop-theme-node-modules:/workspace/node_modules \
  -w /workspace node:22-bookworm sh -lc '
    npm ci --no-audit &&
    npm test -w @openhop/web &&
    npm run lint -w @openhop/web &&
    npm run format:check &&
    npm run typecheck -w @openhop/web &&
    npm run build -w @openhop/web
  '
git diff --check
```

Expected: all commands exit 0; the unrelated polling edit remains uncommitted and is not part of any commit.

- [ ] **Step 7: Update the existing PR branch safely**

Run:

```bash
git push --force-with-lease origin feat/node-theme-switcher
gh pr checks 221 --watch --interval 10
```

Expected: PR #221 updates without overwriting unexpected remote work, and all GitHub checks pass.

- [ ] **Step 8: Verify PR scope and leave it open**

Run:

```bash
gh pr view 221 --json state,mergeStateStatus,statusCheckRollup,url,title \
  --jq '{state, mergeStateStatus, url, title, checks: [.statusCheckRollup[] | {name: (.name // .context), status, conclusion}]}'
git status --short
```

Expected: PR #221 is `OPEN`, checks are successful, and only the excluded local polling, `.claude/`, and Orion paths remain uncommitted.

- [ ] **Step 9: Remove the temporary Docker volume**

Run:

```bash
"/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe" volume rm openhop-theme-node-modules
```

Expected: the temporary dependency volume is deleted. Do not run `gh pr merge`.
