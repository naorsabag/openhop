import {
  BaseEdge,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react'

const STROKE_WIDTH = 10

export function RoadEdge(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = props
  const d = data as { active?: boolean; hiddenRoad?: boolean; visible?: boolean; elkPath?: string } | undefined
  const active = !!d?.active
  const hiddenRoad = !!d?.hiddenRoad
  const visible = d?.visible ?? true

  const [fallbackPath] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 0,
  })
  const path = d?.elkPath ?? fallbackPath

  if (hiddenRoad || !visible) return null

  const style: React.CSSProperties = {
    stroke: 'var(--road-bright)',
    strokeWidth: STROKE_WIDTH,
    fill: 'none',
    filter: active ? 'brightness(1.25) saturate(1.2)' : undefined,
  }

  return <BaseEdge id={id} path={path} style={style} />
}
