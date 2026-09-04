import { getSmoothStepPath, type EdgeProps } from '@xyflow/react'

const STROKE_WIDTH = 4
const CORNER_RADIUS = 12

/** Replace each orthogonal corner in an `M x y L x y L x y ...` path with a
 *  short quadratic curve so the turns look noticeably rounded. */
function roundCorners(d: string, radius: number): string {
  const pts: { x: number; y: number }[] = []
  const re = /([ML])\s*([-\d.]+)[ ,]\s*([-\d.]+)/g
  let m
  while ((m = re.exec(d)) !== null) {
    pts.push({ x: +m[2], y: +m[3] })
  }
  if (pts.length < 3) return d
  const cmds: string[] = [`M ${pts[0].x} ${pts[0].y}`]
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1]
    const curr = pts[i]
    const next = pts[i + 1]
    const dx1 = curr.x - prev.x,
      dy1 = curr.y - prev.y
    const dx2 = next.x - curr.x,
      dy2 = next.y - curr.y
    const len1 = Math.hypot(dx1, dy1)
    const len2 = Math.hypot(dx2, dy2)
    const r = Math.min(radius, len1 / 2, len2 / 2)
    if (r <= 0.5) {
      cmds.push(`L ${curr.x} ${curr.y}`)
      continue
    }
    const enter = { x: curr.x - (dx1 / len1) * r, y: curr.y - (dy1 / len1) * r }
    const exit = { x: curr.x + (dx2 / len2) * r, y: curr.y + (dy2 / len2) * r }
    cmds.push(`L ${enter.x} ${enter.y}`)
    cmds.push(`Q ${curr.x} ${curr.y} ${exit.x} ${exit.y}`)
  }
  const last = pts[pts.length - 1]
  cmds.push(`L ${last.x} ${last.y}`)
  return cmds.join(' ')
}

export function RoadEdge(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = props
  const d = data as
    { active?: boolean; hiddenRoad?: boolean; visible?: boolean; elkPath?: string } | undefined
  const active = !!d?.active
  const hiddenRoad = !!d?.hiddenRoad
  const visible = d?.visible ?? true

  const [fallbackPath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 0,
  })
  const path = roundCorners(d?.elkPath ?? fallbackPath, CORNER_RADIUS)

  if (hiddenRoad || !visible) return null

  const activeFilter = active ? 'brightness(1.25) saturate(1.2)' : undefined

  return (
    <path
      id={id}
      d={path}
      className="react-flow__edge-path"
      style={{
        stroke: 'var(--road-bright)',
        strokeWidth: STROKE_WIDTH,
        fill: 'none',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        filter: activeFilter,
      }}
    />
  )
}
