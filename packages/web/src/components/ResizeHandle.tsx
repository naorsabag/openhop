import { useCallback, useRef } from 'react'

export type ResizeOrientation = 'vertical' | 'horizontal'
/** Which direction increases `size` while dragging.
 *  - 'forward': pointer moves in the +axis direction (right / down) -> size grows.
 *  - 'inverse': pointer moves in the -axis direction (left / up)    -> size grows.
 *  Used because some handles sit on the leading edge (drag inward shrinks) and
 *  some on the trailing edge (drag outward grows). */
export type ResizeDirection = 'forward' | 'inverse'

interface ResizeHandleProps {
  orientation: ResizeOrientation
  size: number
  min: number
  max: number
  onSizeChange: (size: number) => void
  direction?: ResizeDirection
  className?: string
  style?: React.CSSProperties
  ariaLabel?: string
  testId?: string
}

export function ResizeHandle({
  orientation,
  size,
  min,
  max,
  onSizeChange,
  direction = 'forward',
  className,
  style,
  ariaLabel,
  testId,
}: ResizeHandleProps) {
  const dragState = useRef<{ startPos: number; startSize: number } | null>(null)

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      dragState.current = {
        startPos: orientation === 'vertical' ? e.clientX : e.clientY,
        startSize: size,
      }
      ;(e.target as Element).setPointerCapture(e.pointerId)
    },
    [orientation, size]
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragState.current) return
      const pos = orientation === 'vertical' ? e.clientX : e.clientY
      const delta = pos - dragState.current.startPos
      const next =
        direction === 'forward'
          ? dragState.current.startSize + delta
          : dragState.current.startSize - delta
      onSizeChange(Math.min(max, Math.max(min, next)))
    },
    [orientation, direction, min, max, onSizeChange]
  )

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragState.current = null
    ;(e.target as Element).releasePointerCapture(e.pointerId)
  }, [])

  const baseStyle: React.CSSProperties = {
    cursor: orientation === 'vertical' ? 'ew-resize' : 'ns-resize',
    background: 'transparent',
    flexShrink: 0,
    ...(orientation === 'vertical' ? { width: 6 } : { height: 6 }),
    ...style,
  }

  return (
    <div
      role="separator"
      aria-orientation={orientation}
      aria-label={ariaLabel}
      data-testid={testId}
      className={className}
      style={baseStyle}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  )
}
