import { useEffect, useRef, useState, useCallback } from 'react'
import type { FlowStep } from '../types'
import { DataTooltip } from './DataTooltip'

/** Node type colors — must match FlowNode.tsx NODE_STYLES */
const NODE_COLORS: Record<string, string> = {
  actor: '#4a9eff',
  endpoint: '#4a9eff',
  transform: '#b47aff',
  database: '#4aff7a',
  external: '#ff8a4a',
  cache: '#4affee',
  queue: '#4aeeff',
  service: '#888',
}

interface DataPixelProps {
  edgeId: string
  sourceNodeType: string
  sourceNodeColor?: string
  step: FlowStep
  containerRef: React.RefObject<HTMLDivElement | null>
}

const PIXEL_SIZE = 12
const ANIMATION_DURATION = 800

export function DataPixel({
  edgeId,
  sourceNodeType,
  sourceNodeColor,
  step,
  containerRef,
}: DataPixelProps) {
  const pixelRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const startTimeRef = useRef<number>(0)
  const [hovered, setHovered] = useState(false)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)

  // Determine pixel color from source node type
  const color =
    sourceNodeType === 'custom' && sourceNodeColor
      ? sourceNodeColor
      : NODE_COLORS[sourceNodeType] ?? '#888'

  const dataLabel =
    typeof step.data === 'string' ? step.data : step.data.label

  const animate = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    // Find the SVG path for this edge
    const edgePath = container.querySelector<SVGPathElement>(
      `[data-testid="rf__edge-${edgeId}"] path.react-flow__edge-path`,
    )
    if (!edgePath) return

    // Get the viewport transform from React Flow
    const viewport = container.querySelector<HTMLDivElement>('.react-flow__viewport')
    if (!viewport) return

    const totalLength = edgePath.getTotalLength()
    if (totalLength === 0) return

    const tick = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp

      const elapsed = timestamp - startTimeRef.current
      const progress = Math.min(elapsed / ANIMATION_DURATION, 1)

      // Ease in-out cubic
      const eased =
        progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2

      const point = edgePath.getPointAtLength(eased * totalLength)

      // Get the viewport transform to convert SVG coordinates to screen coordinates
      const viewportTransform = viewport.style.transform
      const match = viewportTransform.match(
        /translate\(([^,]+)px,\s*([^)]+)px\)\s*scale\(([^)]+)\)/,
      )

      let tx = 0
      let ty = 0
      let scale = 1
      if (match) {
        tx = parseFloat(match[1])
        ty = parseFloat(match[2])
        scale = parseFloat(match[3])
      }

      const screenX = point.x * scale + tx
      const screenY = point.y * scale + ty

      setPosition({ x: screenX, y: screenY })

      if (pixelRef.current) {
        pixelRef.current.style.transform = `translate(${screenX - PIXEL_SIZE / 2}px, ${screenY - PIXEL_SIZE / 2}px)`
        pixelRef.current.style.opacity = '1'
      }

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    startTimeRef.current = 0
    rafRef.current = requestAnimationFrame(tick)
  }, [edgeId, containerRef])

  useEffect(() => {
    animate()
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [animate])

  return (
    <>
      <div
        ref={pixelRef}
        data-testid="data-pixel"
        aria-label={`Data: ${dataLabel}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: PIXEL_SIZE,
          height: PIXEL_SIZE,
          borderRadius: 2,
          background: color,
          boxShadow: `0 0 8px ${color}, 0 0 4px ${color}`,
          opacity: 0,
          pointerEvents: 'auto',
          zIndex: 1000,
          cursor: 'pointer',
        }}
      />
      {hovered && position && (
        <DataTooltip
          step={step}
          color={color}
          x={position.x}
          y={position.y}
        />
      )}
    </>
  )
}
