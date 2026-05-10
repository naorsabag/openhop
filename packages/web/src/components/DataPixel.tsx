import { useEffect, useRef, useState, useCallback } from 'react'
import { useViewport } from '@xyflow/react'
import type { FlowStep, FlowData } from '../types'
import { DataTooltip } from './DataTooltip'

// Use Vite's BASE_URL so the sprite resolves under the project base on
// the Pages deploy (`/openhop/sprites/...`) and at the root in dev (`/`).
const CARROT_SPRITE = `${import.meta.env.BASE_URL}sprites/carrot_pixels.svg`
const DEFAULT_PIXEL_COLOR = '#ff8a4a' // VARIANT_ACCENT[0] — sprite's original orange.

interface DataPixelProps {
  edgeId: string
  reverse?: boolean
  /** Source node's variant color from topology — drives the pixel
   *  drop-shadow when pixelColor isn't set. */
  sourceNodeColor?: string
  /** Per-pixel color override (palette cycling, or explicit data.color).
   *  Wins over sourceNodeColor. */
  pixelColor?: string
  /** Optional CSS hue-rotate applied to the carrot sprite so its body
   *  recolors to match pixelColor — without it, the orange sprite
   *  visually dominates the colored drop-shadow. */
  pixelFilter?: string
  step: FlowStep
  containerRef: React.RefObject<HTMLDivElement | null>
  isManual?: boolean
  onAnimationComplete?: () => void
  /** Fired when the user clicks the carrot. The pixel only knows its
   *  own data slice; the caller (FlowCanvas) layers in the (from, to)
   *  identity of the edgeFlow so the inspect panel can match the
   *  click to a specific (target, data) pair — required to disambiguate
   *  broadcast steps where multiple targets share one data object. */
  onPixelClick?: (focusData?: FlowData) => void
  delayMs?: number
  dataOverride?: FlowData
  /** When true, freeze the pixel mid-flight: each tick re-anchors the
   *  start time so `elapsed` doesn't advance, leaving the pixel rendered
   *  at its current position. On resume the pixel continues from there. */
  paused?: boolean
}

const PIXEL_SIZE = 28
const getSpeed = () => window.__flowSpeed ?? 1
const ANIMATION_DURATION_BASE = 1800

export function DataPixel({
  edgeId,
  reverse = false,
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
  paused = false,
}: DataPixelProps) {
  const pixelRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const startTimeRef = useRef<number>(0)
  const lastTickTimeRef = useRef<number>(0)
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const onCompleteRef = useRef(onAnimationComplete)
  useEffect(() => {
    onCompleteRef.current = onAnimationComplete
  }, [onAnimationComplete])
  // Reactive viewport from React Flow's store. Without this we were regex-
  // parsing `viewport.style.transform`, which fails when RF emits a `matrix(…)`
  // form — `scale` fell back to 1, so the carrot stayed at its base size and
  // drifted off the path on zoom. Using the store directly keeps the carrot
  // anchored and sized in sync with the rest of the canvas.
  const viewport = useViewport()
  const viewportRef = useRef(viewport)
  viewportRef.current = viewport
  const [hovered, setHovered] = useState(false)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  // pixelColor (palette cycling / data.color) > sourceNodeColor (variant
  // color from topology, keeps shadow in lockstep with sprite hue) > orange.
  const color = pixelColor ?? sourceNodeColor ?? DEFAULT_PIXEL_COLOR

  // Aria label only — the on-canvas label was removed; the inspect panel
  // shows the data instead (clicking the carrot opens it).
  const ariaDataLabel = dataOverride
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

    const totalLength = edgePath.getTotalLength()
    if (totalLength === 0) return

    const tick = (timestamp: number) => {
      // Always initialize startTimeRef on the first tick — without this,
      // a manual pixel fired while paused saw startTimeRef=0 and elapsed
      // computed to a huge timestamp, snapping the carrot to the edge end
      // (visually: a pixel hovering on the next node instead of starting
      // at the source).
      const wasPaused = pausedRef.current
      if (!startTimeRef.current) startTimeRef.current = timestamp + (delayMs ?? 0)
      // Pause: shift startTimeRef forward by however long this paused tick
      // covered, so `elapsed` stays constant. The position-update logic
      // below STILL runs each frame so the carrot can react to zoom changes
      // while paused (without this, zooming during pause left the carrot
      // glued to its pre-pause screen position + size).
      if (wasPaused && lastTickTimeRef.current > 0) {
        startTimeRef.current += timestamp - lastTickTimeRef.current
      }
      lastTickTimeRef.current = timestamp

      const elapsed = timestamp - startTimeRef.current
      const progress = Math.min(elapsed / (ANIMATION_DURATION_BASE / getSpeed()), 1)

      // Ease in-out cubic
      const eased =
        progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2

      const point = edgePath.getPointAtLength((reverse ? 1 - eased : eased) * totalLength)

      // Read the live viewport (x, y, zoom) from the React Flow store. This
      // replaces a regex-parse of `viewport.style.transform` which didn't
      // handle every transform format RF emits — when the regex missed, zoom
      // fell back to 1, the carrot stayed at base size and drifted off the
      // (zoomed) path. Reading from the store keeps everything in lockstep
      // with the rest of the canvas.
      const { x: tx, y: ty, zoom } = viewportRef.current
      const screenX = point.x * zoom + tx
      const screenY = point.y * zoom + ty
      const pixelSize = PIXEL_SIZE * zoom

      setPosition({ x: screenX, y: screenY })

      if (pixelRef.current) {
        pixelRef.current.style.width = `${pixelSize}px`
        pixelRef.current.style.height = `${pixelSize}px`
        pixelRef.current.style.transform = `translate(${screenX - pixelSize / 2}px, ${screenY - pixelSize / 2}px)`
        pixelRef.current.style.opacity = '1'
      }

      // Keep ticking while paused (so zoom updates land), and while still
      // animating. Only fire the completion callback when truly done AND not
      // paused — otherwise a paused-at-edge-end pixel would get destroyed.
      if (wasPaused || progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else if (onCompleteRef.current) {
        onCompleteRef.current()
      }
    }

    startTimeRef.current = 0
    lastTickTimeRef.current = 0
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

  // Pass the carrot's specific data slice. FlowCanvas adds the from/to
  // context; we don't pass `step` here because for parallel sub-steps
  // it'd be the sub-step (not the parent the inspect panel needs).
  //
  // For string-data steps we deliberately pass `undefined` instead of
  // synthesizing a `{ label: step.data }` object: the inspector
  // highlights via reference equality (`d === focus.data`), and a
  // freshly-constructed wrapper would never match the wrapper
  // normalizeData() builds on the inspector side. Passing undefined
  // makes the highlight fall back to from/to-only matching, which is
  // exactly what we want for string data (only one block per section).
  const emitPixelClick = () => {
    if (!onPixelClick) return
    const focusData =
      dataOverride ??
      (typeof step.data === 'string'
        ? undefined
        : Array.isArray(step.data)
          ? step.data[0]
          : step.data)
    onPixelClick(focusData)
  }

  return (
    <>
      <div
        ref={pixelRef}
        data-testid={isManual ? 'data-pixel-manual' : 'data-pixel'}
        aria-label={`Data: ${ariaDataLabel}`}
        role="button"
        tabIndex={0}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={emitPixelClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            emitPixelClick()
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
      {hovered && position && (
        <DataTooltip step={step} color={color} x={position.x} y={position.y} />
      )}
    </>
  )
}
