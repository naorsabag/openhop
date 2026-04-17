import { useMemo } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react'

const WIDTH = 22
const HALF = WIDTH / 2
const POINT_RE = /[ML]\s*([\d.-]+)[ ,]\s*([\d.-]+)/g

type Pivot = 'TL' | 'TR' | 'BL' | 'BR'
type Side = 'left' | 'right' | 'top' | 'bottom'
type SegEl = { kind: 'seg'; x: number; y: number; w: number; h: number; horiz: boolean }
type CornerEl = { kind: 'corner'; x: number; y: number; pivot: Pivot }
type RoadEl = SegEl | CornerEl
const MERGE_TOLERANCE = 0.5

const ROAD_BANDS = [
  { inner: 0, outer: 2, color: 'var(--road-bright)' },
  { inner: 2, outer: 5, color: 'var(--road-dark)' },
  { inner: 5, outer: 8, color: 'var(--road-mid)' },
  { inner: 8, outer: 14, color: 'var(--road-bright)' },
  { inner: 14, outer: 17, color: 'var(--road-mid)' },
  { inner: 17, outer: 20, color: 'var(--road-dark)' },
  { inner: 20, outer: 22, color: 'var(--road-bright)' },
] as const

const CORNER_ROTATION: Record<Pivot, number> = {
  TL: 0,
  TR: 90,
  BR: 180,
  BL: 270,
}

const PIVOT_FROM_SIDES: Record<string, Pivot> = {
  'left-bottom': 'BL', 'bottom-left': 'BL',
  'left-top': 'TL', 'top-left': 'TL',
  'right-bottom': 'BR', 'bottom-right': 'BR',
  'right-top': 'TR', 'top-right': 'TR',
}

function entrySide(dx: number, dy: number, horiz: boolean): Side {
  if (horiz) return dx > 0 ? 'left' : 'right'
  return dy > 0 ? 'top' : 'bottom'
}

function exitSide(dx: number, dy: number, horiz: boolean): Side {
  if (horiz) return dx > 0 ? 'right' : 'left'
  return dy > 0 ? 'bottom' : 'top'
}

function quarterBandPath(inner: number, outer: number): string {
  if (inner === 0) {
    return `M 0 0 L ${outer} 0 A ${outer} ${outer} 0 0 1 0 ${outer} Z`
  }

  return [
    `M ${outer} 0`,
    `A ${outer} ${outer} 0 0 1 0 ${outer}`,
    `L 0 ${inner}`,
    `A ${inner} ${inner} 0 0 0 ${inner} 0`,
    'Z',
  ].join(' ')
}

function mergeSegments(segs: SegEl[]): SegEl[] {
  const merged: SegEl[] = []

  for (const seg of segs) {
    const last = merged[merged.length - 1]
    if (!last || last.horiz !== seg.horiz) {
      merged.push({ ...seg })
      continue
    }

    if (seg.horiz) {
      const lastEnd = last.x + last.w
      const sameRow = Math.abs(last.y - seg.y) <= MERGE_TOLERANCE && Math.abs(last.h - seg.h) <= MERGE_TOLERANCE
      const touching = seg.x <= lastEnd + MERGE_TOLERANCE
      if (sameRow && touching) {
        last.w = Math.max(lastEnd, seg.x + seg.w) - last.x
        continue
      }
    } else {
      const lastEnd = last.y + last.h
      const sameCol = Math.abs(last.x - seg.x) <= MERGE_TOLERANCE && Math.abs(last.w - seg.w) <= MERGE_TOLERANCE
      const touching = seg.y <= lastEnd + MERGE_TOLERANCE
      if (sameCol && touching) {
        last.h = Math.max(lastEnd, seg.y + seg.h) - last.y
        continue
      }
    }

    merged.push({ ...seg })
  }

  return merged
}

function parsePath(d: string): RoadEl[] {
  POINT_RE.lastIndex = 0
  const pts: { x: number; y: number }[] = []
  let m: RegExpExecArray | null
  while ((m = POINT_RE.exec(d)) !== null) {
    pts.push({ x: +m[1], y: +m[2] })
  }

  const segs: SegEl[] = []

  // Straight segments, trimmed by HALF at internal perpendicular junctions
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    if (!dx && !dy) continue
    const horiz = Math.abs(dx) >= Math.abs(dy)

    let trimStart = 0
    let trimEnd = 0
    if (i > 0) {
      const prev = pts[i - 1]
      const prevHoriz = Math.abs(p1.x - prev.x) >= Math.abs(p1.y - prev.y)
      if (prevHoriz !== horiz) trimStart = HALF
    }
    if (i < pts.length - 2) {
      const next = pts[i + 2]
      const nextHoriz = Math.abs(next.x - p2.x) >= Math.abs(next.y - p2.y)
      if (nextHoriz !== horiz) trimEnd = HALF
    }

    if (horiz) {
      const sgn = Math.sign(dx)
      const sx = p1.x + trimStart * sgn
      const ex = p2.x - trimEnd * sgn
      const w = Math.max(0, Math.abs(ex - sx))
      if (w > 0) segs.push({ kind: 'seg', horiz: true, x: Math.min(sx, ex), y: p1.y - HALF, w, h: WIDTH })
    } else {
      const sgn = Math.sign(dy)
      const sy = p1.y + trimStart * sgn
      const ey = p2.y - trimEnd * sgn
      const h = Math.max(0, Math.abs(ey - sy))
      if (h > 0) segs.push({ kind: 'seg', horiz: false, x: p1.x - HALF, y: Math.min(sy, ey), w: WIDTH, h })
    }
  }

  const els: RoadEl[] = mergeSegments(segs)

  // Corner tiles at perpendicular junctions
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 = pts[i - 1]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const d1x = p1.x - p0.x
    const d1y = p1.y - p0.y
    const d2x = p2.x - p1.x
    const d2y = p2.y - p1.y
    const h1 = Math.abs(d1x) >= Math.abs(d1y)
    const h2 = Math.abs(d2x) >= Math.abs(d2y)
    if (h1 === h2) continue

    const entry = entrySide(d1x, d1y, h1)
    const exit = exitSide(d2x, d2y, h2)
    const pivot = PIVOT_FROM_SIDES[`${entry}-${exit}`]
    els.push({ kind: 'corner', x: p1.x - HALF, y: p1.y - HALF, pivot })
  }

  return els
}

const BASE_STYLE = { stroke: 'transparent', strokeWidth: 20 } as const

export function RoadEdge(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = props
  const d = data as { active?: boolean; hiddenRoad?: boolean; visible?: boolean } | undefined
  const active = !!d?.active
  const hiddenRoad = !!d?.hiddenRoad
  const visible = d?.visible ?? true

  const [path] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 0,
  })

  const elements = useMemo(() => (hiddenRoad || !visible ? [] : parsePath(path)), [path, hiddenRoad, visible])
  const activeCls = active ? ' conduit-road--active' : ''

  return (
    <>
      <BaseEdge id={id} path={path} style={BASE_STYLE} />
      {elements.length > 0 && (
        <EdgeLabelRenderer>
          {elements.map((e, i) => {
            if (e.kind === 'corner') {
              return (
                <div
                  key={i}
                  className={`conduit-corner${activeCls}`}
                  style={{
                    position: 'absolute',
                    left: e.x,
                    top: e.y,
                    width: WIDTH,
                    height: WIDTH,
                  } as React.CSSProperties}
                >
                  <svg
                    width={WIDTH}
                    height={WIDTH}
                    viewBox={`0 0 ${WIDTH} ${WIDTH}`}
                    aria-hidden="true"
                  >
                    <g transform={`rotate(${CORNER_ROTATION[e.pivot]} ${HALF} ${HALF})`}>
                      {ROAD_BANDS.map((band) => (
                        <path
                          key={`${band.inner}-${band.outer}`}
                          d={quarterBandPath(band.inner, band.outer)}
                          fill={band.color}
                        />
                      ))}
                    </g>
                  </svg>
                </div>
              )
            }
            return (
              <div
                key={i}
                className={`conduit-road${activeCls}`}
                style={{
                  position: 'absolute',
                  left: e.x,
                  top: e.y,
                  width: e.w,
                  height: e.h,
                  ...(e.horiz ? null : ({ '--rd': 'to right' } as React.CSSProperties)),
                }}
              />
            )
          })}
        </EdgeLabelRenderer>
      )}
    </>
  )
}
