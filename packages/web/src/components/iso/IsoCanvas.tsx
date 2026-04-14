import { Application, extend } from '@pixi/react'
import { Container, Sprite, Text, Assets, Texture } from 'pixi.js'
import { useEffect, useRef, useState, useMemo } from 'react'
import type { Flow } from '../../types'
import { computeLayout } from '../../lib/iso-layout'
import { gridToScreen, TILE_WIDTH, TILE_HEIGHT } from '../../lib/iso-math'
import { NODE_SPRITES, TILE_SPRITES } from '../../lib/sprite-map'

extend({ Container, Sprite, Text })

interface IsoCanvasProps {
  flow: Flow
  playing: boolean
  onNodeClick?: (nodeId: string) => void
  onDrillDown?: (nodeId: string) => void
}

export function IsoCanvas({ flow, playing, onNodeClick, onDrillDown }: IsoCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [textures, setTextures] = useState<Record<string, Texture>>({})
  const [loaded, setLoaded] = useState(false)

  const layout = useMemo(() => computeLayout(flow), [flow])

  // Resize observer
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      if (width > 0 && height > 0) setDimensions({ width, height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Pre-load all sprite textures
  useEffect(() => {
    const allPaths: Record<string, string> = {}

    // Node sprites
    for (const [type, path] of Object.entries(NODE_SPRITES)) {
      allPaths[`node-${type}`] = path
    }
    // Tile sprites
    for (const [type, path] of Object.entries(TILE_SPRITES)) {
      allPaths[`tile-${type}`] = path
    }

    Assets.load(Object.values(allPaths)).then((loaded) => {
      const textureMap: Record<string, Texture> = {}
      const paths = Object.entries(allPaths)
      // Assets.load with array returns array of textures in same order
      if (Array.isArray(loaded)) {
        paths.forEach(([key, _], i) => {
          textureMap[key] = loaded[i]
        })
      } else {
        // Single texture or record
        for (const [key, path] of paths) {
          textureMap[key] = Assets.get(path)
        }
      }
      setTextures(textureMap)
      setLoaded(true)
    }).catch(err => {
      console.error('Failed to load sprites:', err)
      // Try loading one by one as fallback
      const textureMap: Record<string, Texture> = {}
      Promise.allSettled(
        Object.entries(allPaths).map(async ([key, path]) => {
          try {
            const tex = await Assets.load(path)
            textureMap[key] = tex
          } catch { /* skip failed */ }
        })
      ).then(() => {
        setTextures(textureMap)
        setLoaded(true)
      })
    })
  }, [])

  // Center the layout in the viewport
  const centerOffset = useMemo(() => {
    if (layout.nodes.length === 0) return { x: 0, y: 0 }
    const positions = layout.nodes.map(n => gridToScreen(n.gridX, n.gridY))
    const minX = Math.min(...positions.map(p => p.x))
    const maxX = Math.max(...positions.map(p => p.x))
    const minY = Math.min(...positions.map(p => p.y))
    const maxY = Math.max(...positions.map(p => p.y))
    return {
      x: dimensions.width / 2 - (minX + maxX) / 2,
      y: dimensions.height / 2 - (minY + maxY) / 2 - 32,
    }
  }, [layout, dimensions])

  void playing
  void onDrillDown

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
      aria-label="Isometric canvas"
    >
      <Application
        width={dimensions.width}
        height={dimensions.height}
        background="#2d5a1b"
        antialias={false}
        roundPixels={true}
      >
        <pixiContainer sortableChildren={true}>
          {/* Grass tiles under each node */}
          {loaded && layout.nodes.map(node => {
            const pos = gridToScreen(node.gridX, node.gridY)
            const tex = textures['tile-grass']
            if (!tex) return null
            return (
              <pixiSprite
                key={`tile-${node.id}`}
                texture={tex}
                x={pos.x + centerOffset.x}
                y={pos.y + centerOffset.y}
                anchor={{ x: 0.5, y: 0.5 }}
                zIndex={node.gridX + node.gridY}
              />
            )
          })}

          {/* Building sprites */}
          {loaded && layout.nodes.map(node => {
            const pos = gridToScreen(node.gridX, node.gridY)
            const texKey = `node-${node.nodeType}`
            const tex = textures[texKey] || textures['node-custom']
            if (!tex) return null
            return (
              <pixiSprite
                key={`building-${node.id}`}
                texture={tex}
                x={pos.x + centerOffset.x}
                y={pos.y + centerOffset.y - 40}
                anchor={{ x: 0.5, y: 0.5 }}
                zIndex={(node.gridX + node.gridY) * 10 + 1}
                eventMode="static"
                cursor="pointer"
                onPointerDown={() => onNodeClick?.(node.id)}
              />
            )
          })}

          {/* Labels */}
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
                  fontSize: 10,
                  fill: '#ffffff',
                  align: 'center',
                }}
              />
            )
          })}
        </pixiContainer>
      </Application>
    </div>
  )
}
