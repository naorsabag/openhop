import { Application, extend } from '@pixi/react'
import { Container, Sprite, Graphics, Text } from 'pixi.js'
import { useEffect, useRef, useState, useMemo } from 'react'
import type { Flow } from '../../types'
import { computeLayout } from '../../lib/iso-layout'
import { gridToScreen, TILE_WIDTH, TILE_HEIGHT } from '../../lib/iso-math'
import { NODE_SPRITES, TILE_SPRITES } from '../../lib/sprite-map'

// Extend pixi-react with the PixiJS classes we need
extend({ Container, Sprite, Graphics, Text })

interface IsoCanvasProps {
  flow: Flow
  playing: boolean
  onNodeClick?: (nodeId: string) => void
  onDrillDown?: (nodeId: string) => void
}

export function IsoCanvas({ flow, playing, onNodeClick, onDrillDown }: IsoCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })

  // Compute isometric layout from flow
  const layout = useMemo(() => computeLayout(flow), [flow])

  // Resize observer
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setDimensions({ width, height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Compute the center offset so the layout is centered in the viewport
  const centerOffset = useMemo(() => {
    if (layout.nodes.length === 0) return { x: 0, y: 0 }
    const positions = layout.nodes.map(n => gridToScreen(n.gridX, n.gridY))
    const minX = Math.min(...positions.map(p => p.x))
    const maxX = Math.max(...positions.map(p => p.x))
    const minY = Math.min(...positions.map(p => p.y))
    const maxY = Math.max(...positions.map(p => p.y))
    const layoutCenterX = (minX + maxX) / 2
    const layoutCenterY = (minY + maxY) / 2
    return {
      x: dimensions.width / 2 - layoutCenterX,
      y: dimensions.height / 2 - layoutCenterY - 32, // offset up slightly for building height
    }
  }, [layout, dimensions])

  // Suppress unused variable warnings -- these will be used in later phases
  void playing
  void onDrillDown

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        imageRendering: 'pixelated',
      }}
      aria-label="Isometric canvas"
    >
      <Application
        width={dimensions.width}
        height={dimensions.height}
        background="#2d5a1b"
        antialias={false}
        roundPixels={true}
      >
        {/* Ground tiles -- render grass under each node position */}
        {layout.nodes.map(node => {
          const pos = gridToScreen(node.gridX, node.gridY)
          return (
            <pixiSprite
              key={`tile-${node.id}`}
              image={TILE_SPRITES.grass}
              x={pos.x + centerOffset.x}
              y={pos.y + centerOffset.y}
              anchor={{ x: 0.5, y: 0.5 }}
              width={TILE_WIDTH}
              height={TILE_HEIGHT}
              zIndex={node.gridX + node.gridY}
            />
          )
        })}

        {/* Building sprites at isometric positions */}
        {layout.nodes.map(node => {
          const pos = gridToScreen(node.gridX, node.gridY)
          const spritePath = NODE_SPRITES[node.nodeType] || NODE_SPRITES.custom
          return (
            <pixiSprite
              key={node.id}
              image={spritePath}
              x={pos.x + centerOffset.x}
              y={pos.y + centerOffset.y - TILE_HEIGHT / 2}
              anchor={{ x: 0.5, y: 0.5 }}
              zIndex={(node.gridX + node.gridY) * 10 + 1}
              eventMode="static"
              cursor="pointer"
              onPointerDown={() => onNodeClick?.(node.id)}
            />
          )
        })}

        {/* Node labels */}
        {layout.nodes.map(node => {
          const pos = gridToScreen(node.gridX, node.gridY)
          return (
            <pixiText
              key={`label-${node.id}`}
              text={node.label}
              x={pos.x + centerOffset.x}
              y={pos.y + centerOffset.y + 24}
              anchor={{ x: 0.5, y: 0 }}
              zIndex={(node.gridX + node.gridY) * 10 + 2}
              style={{
                fontFamily: '"Press Start 2P", monospace',
                fontSize: 8,
                fill: '#e0e0e0',
                align: 'center',
                dropShadow: {
                  alpha: 0.8,
                  color: '#000000',
                  blur: 2,
                  distance: 1,
                },
              }}
            />
          )
        })}
      </Application>
    </div>
  )
}
