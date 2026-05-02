/**
 * Search and tree-building helpers for flow summaries. The server uses
 * these for the `GET /api/flows/search` endpoint and the CLI uses them
 * for `openhop list --tree` / `openhop list --search`.
 */

/** Minimal flow summary the server returns from `GET /api/flows`. */
export interface FlowSummary {
  id: string
  title: string
  description?: string | null
  path?: string | null
}

/** Levenshtein edit distance — small enough that we don't pull in a dep. */
export function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

export interface SearchResult<T extends FlowSummary> {
  flow: T
  score: number
  /** Which haystack field produced the best match. */
  matched: 'title' | 'path' | 'description' | 'id'
}

/**
 * Score one query against one haystack string. Higher = better.
 *
 * Ranking is layered so common cases dominate over fuzzy noise:
 *   - exact match              → 1000
 *   - prefix match             → 800 + (1 - relativeLength)*100
 *   - substring match          → 500 + position bonus
 *   - fuzzy (typo-tolerant)    → 100 - editDistance*10
 *
 * Returns 0 for "no relevant match" so callers can drop those.
 */
function scoreField(query: string, haystack: string): number {
  if (!haystack) return 0
  const q = query.toLowerCase()
  const h = haystack.toLowerCase()
  if (h === q) return 1000
  if (h.startsWith(q)) return 800 + Math.round((q.length / Math.max(h.length, 1)) * 100)
  const idx = h.indexOf(q)
  if (idx >= 0) return 500 + Math.max(0, 100 - idx)
  // Fuzzy bucket — only meaningful for short queries. Slide a |q|-sized
  // window across the haystack and take the best edit distance, so a
  // typo'd query ("oder" vs "order processing") still matches even when
  // the haystack is much longer than the query.
  if (q.length > 24 || q.length < 3) return 0
  // Tolerance ~1/3 of query length, with a floor of 2 so 4-char queries
  // still tolerate a single transposition ("slef" → "self" is dist 2).
  const tolerance = Math.max(2, Math.floor(q.length / 3))
  let minDist = Infinity
  if (h.length < q.length) {
    minDist = levenshtein(q, h)
  } else {
    for (let i = 0; i + q.length <= h.length && minDist > 0; i++) {
      const d = levenshtein(q, h.slice(i, i + q.length))
      if (d < minDist) minDist = d
    }
  }
  if (minDist > tolerance) return 0
  return Math.max(0, 100 - minDist * 10)
}

/**
 * Fuzzy / substring / prefix search across a list of flow summaries. Returns
 * results in descending score order. Empty query returns all flows in input
 * order with score 0 so callers can use this as a single code path.
 */
export function searchFlows<T extends FlowSummary>(flows: T[], query: string): SearchResult<T>[] {
  const trimmed = query.trim()
  if (!trimmed) {
    return flows.map((flow) => ({ flow, score: 0, matched: 'title' as const }))
  }
  const results: SearchResult<T>[] = []
  for (const flow of flows) {
    let best = 0
    let matched: SearchResult<T>['matched'] = 'title'
    const candidates: Array<{ field: SearchResult<T>['matched']; value: string }> = [
      { field: 'title', value: flow.title },
      { field: 'path', value: flow.path ?? '' },
      { field: 'description', value: flow.description ?? '' },
      { field: 'id', value: flow.id },
    ]
    for (const c of candidates) {
      const s = scoreField(trimmed, c.value)
      if (s > best) {
        best = s
        matched = c.field
      }
    }
    if (best > 0) results.push({ flow, score: best, matched })
  }
  results.sort((a, b) => b.score - a.score || a.flow.title.localeCompare(b.flow.title))
  return results
}

/**
 * One node in a path-based hierarchy. Folders are derived from `meta.path`
 * (slash-separated). Flows with no path land under a synthetic `(no path)`
 * folder so the tree always has a single root.
 */
export interface FlowTreeNode<T extends FlowSummary> {
  /** Folder segment name. Root node uses ''. */
  name: string
  /** Sub-folders, sorted by name. */
  folders: FlowTreeNode<T>[]
  /** Flows directly under this folder, sorted by title. */
  flows: T[]
}

const NO_PATH_FOLDER = '(no path)'

/**
 * Build a tree of flows grouped by their `meta.path` segments. Always
 * returns a single root node (with name '') — folders are nested under it.
 */
export function buildFlowTree<T extends FlowSummary>(flows: T[]): FlowTreeNode<T> {
  const root: FlowTreeNode<T> = { name: '', folders: [], flows: [] }
  for (const flow of flows) {
    const segments =
      flow.path && flow.path.length > 0
        ? flow.path.split('/').filter((s) => s.length > 0)
        : [NO_PATH_FOLDER]
    let cursor = root
    for (const segment of segments) {
      let next = cursor.folders.find((f) => f.name === segment)
      if (!next) {
        next = { name: segment, folders: [], flows: [] }
        cursor.folders.push(next)
      }
      cursor = next
    }
    cursor.flows.push(flow)
  }
  sortTree(root)
  return root
}

function sortTree<T extends FlowSummary>(node: FlowTreeNode<T>): void {
  node.folders.sort((a, b) => a.name.localeCompare(b.name))
  node.flows.sort((a, b) => a.title.localeCompare(b.title))
  for (const child of node.folders) sortTree(child)
}
