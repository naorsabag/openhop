import { useEffect, useRef, useState, useCallback } from 'react'
import type { FlowStep, FlowData } from '../types'
import { DataTooltip } from './DataTooltip'
const CARROT_SPRITE = '/sprites/carrot_pixels.svg'

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
  reverse?: boolean
  sourceNodeType: string
  /** Source node's variant color — drives the pixel drop-shadow when
   *  pixelColor is not set. */
  sourceNodeColor?: string
  /** Per-pixel override (multi-data palette cycling, or explicit
   *  data.color). Wins over sourceNodeColor and the type fallback. */
  pixelColor?: string
  /** Optional CSS filter applied to the carrot sprite itself (e.g.
   *  hue-rotate) so the visible carrot color matches its drop-shadow.
   *  Used for multi-data palette cycling. */
  pixelFilter?: string
  step: FlowStep
  containerRef: React.RefObject<HTMLDivElement | null>
  isManual?: boolean
  onAnimationComplete?: () => void
  onPixelClick?: (step: FlowStep, position: { x: number; y: number }) => void
  delayMs?: number
  dataOverride?: FlowData
}

const PIXEL_SIZE = 28
const getSpeed = () => window.__flowSpeed ?? 1
const ANIMATION_DURATION_BASE = 1800

export function DataPixel({
  edgeId,
  reverse = false,
  sourceNodeType,
  sourceNodeColor,
  pixelColor,
  pixelFilter,
  step,
  containerRef,
  isManual,
  onAnimationComplete,
  onPixelClick,
  delayMs,
  dataOverride,
}: DataPixelProps) {
  const pixelRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const startTimeRef = useRef<number>(0)
  const onCompleteRef = useRef(onAnimationComplete)
  useEffect(() => {
    onCompleteRef.current = onAnimationComplete
  }, [onAnimationComplete])
  const [hovered, setHovered] = useState(false)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  // Pixel drop-shadow color resolution order:
  //   1. explicit pixelColor (multi-data palette cycling, or data.color)
  //   2. sourceNodeColor (variant color computed from topology — keeps the
  //      shadow in lockstep with the sprite hue)
  //   3. legacy NODE_COLORS by type, kept as a fallback
  const color = pixelColor ?? sourceNodeColor ?? NODE_COLORS[sourceNodeType] ?? '#888'

  const dataLabel = dataOverride
    ? dataOverride.label
    : typeof step.data === 'string'
      ? step.data
      : Array.isArray(step.data)
        ? step.data.map((d) => d.label).join(', ')
        : (step.data?.label ?? '')

  const animate = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    // Find the SVG path for this edge
    const edgePath = container.querySelector<SVGPathElement>(
      `[data-testid="rf__edge-${edgeId}"] path.react-flow__edge-path`
    )
    if (!edgePath) return

    // Get the viewport transform from React Flow
    const viewport = container.querySelector<HTMLDivElement>('.react-flow__viewport')
    if (!viewport) return

    const totalLength = edgePath.getTotalLength()
    if (totalLength === 0) return

    const tick = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp + (delayMs ?? 0)

      const elapsed = timestamp - startTimeRef.current
      const progress = Math.min(elapsed / (ANIMATION_DURATION_BASE / getSpeed()), 1)

      // Ease in-out cubic
      const eased =
        progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2

      const point = edgePath.getPointAtLength((reverse ? 1 - eased : eased) * totalLength)

      // Get the viewport transform to convert SVG coordinates to screen coordinates
      const viewportTransform = viewport.style.transform
      const match = viewportTransform.match(
        /translate\(([^,]+)px,\s*([^)]+)px\)\s*scale\(([^)]+)\)/
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
      const scaledPixelSize = PIXEL_SIZE * scale
      const scaledLabelFontSize = 11 * scale

      setPosition({ x: screenX, y: screenY })

      if (pixelRef.current) {
        pixelRef.current.style.width = `${scaledPixelSize}px`
        pixelRef.current.style.height = `${scaledPixelSize}px`
        pixelRef.current.style.transform = `translate(${screenX - scaledPixelSize / 2}px, ${screenY - scaledPixelSize / 2}px)`
        pixelRef.current.style.opacity = '1'
      }
      if (labelRef.current) {
        labelRef.current.style.fontSize = `${scaledLabelFontSize}px`
        labelRef.current.style.transform = `translate(${screenX + scaledPixelSize / 2 + 4 * scale}px, ${screenY - 6 * scale}px)`
        labelRef.current.style.opacity = '1'
      }

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else if (onCompleteRef.current) {
        onCompleteRef.current()
      }
    }

    startTimeRef.current = 0
    rafRef.current = requestAnimationFrame(tick)
  }, [edgeId, reverse, containerRef, delayMs])

  useEffect(() => {
    animate()
    // Edge DOM may not be present yet when a node (e.g. a `create:` target)
    // is activated in the same render as the pixel spawn. Retry briefly.
    const retry = setTimeout(animate, 50)
    const retry2 = setTimeout(animate, 150)
    return () => {
      clearTimeout(retry)
      clearTimeout(retry2)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [animate])

  return (
    <>
      <div
        ref={pixelRef}
        data-testid={isManual ? 'data-pixel-manual' : 'data-pixel'}
        aria-label={`Data: ${dataLabel}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={(e) => {
          if (onPixelClick) {
            onPixelClick(step, { x: e.clientX, y: e.clientY })
          }
        }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: PIXEL_SIZE,
          height: PIXEL_SIZE,
          opacity: 0,
          pointerEvents: 'auto',
          zIndex: 1000,
          cursor: 'pointer',
        }}
      >
        <div
          className="data-pixel-sprite"
          style={{
            filter: `drop-shadow(0 0 6px ${color})`,
          }}
        >
          <img
            src={CARROT_SPRITE}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              imageRendering: 'pixelated',
              display: 'block',
              // Hue-rotate is applied directly to the <img> so the carrot's
              // own pixel colors shift (the wrapper's drop-shadow then reads
              // from the rotated alpha, keeping the glow in sync).
              filter: pixelFilter,
            }}
          />
        </div>
      </div>
      <div
        ref={labelRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          fontFamily: '"VT323", monospace',
          fontSize: 11,
          color: '#ccc',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          textShadow: '0 0 4px #000, 0 0 2px #000',
          opacity: 0,
          zIndex: 1000,
        }}
      >
        {dataLabel}
      </div>
      {hovered && position && (
        <DataTooltip step={step} color={color} x={position.x} y={position.y} />
      )}
    </>
  )
}
