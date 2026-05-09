import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  Panel,
  useReactFlow,
  type NodeTypes,
  type EdgeTypes,
  type Node,
  type Edge,
} from '@xyflow/react'
import type React from 'react'
import '@xyflow/react/dist/style.css'
import { useMemo, useRef, useCallback, useEffect } from 'react'
import { FlowNodeComponent, type FlowNodeData } from './nodes/FlowNode'
import { RoadEdge } from './edges/RoadEdge'
import { useFlowAnimation, type EdgeFlowRef, type StepEdgeMapping } from '../hooks/useFlowAnimation'
import { useFlowGraphLayout } from '../hooks/useFlowGraphLayout'
import { DataPixel } from './DataPixel'
import { buildFlowTopology } from '../lib/flow-layout'
import { resolvePixelStyle, type ResolvedStepPixel } from '../lib/pixel-palette'
import type { Flow, FlowStep, FlowData } from '../types'

/** One carrot to render for a step. `dataObj` is set only for multi-data
 *  steps (one item per data entry). Cycling is applied across the WHOLE
 *  step so multi-data + broadcast + parallel carrots share one global
 *  index — any 2+ carrots in a step render distinct hues. */
interface StepPixelPlan extends ResolvedStepPixel {
  edgeFlow: EdgeFlowRef
  edgeFlowIndex: number
  dataObj?: FlowData
  dataIndex?: number
  delayMs: number
}

function planStepPixels(edgeFlows: EdgeFlowRef[], fallbackStep?: FlowStep): StepPixelPlan[] {
  const totalPixels = edgeFlows.reduce((sum, ef) => {
    const data = (ef.step ?? fallbackStep)?.data
    return sum + (Array.isArray(data) ? data.length : 1)
  }, 0)
  const cycle = totalPixels >= 2
  const plans: StepPixelPlan[] = []
  let pixelIdx = 0
  edgeFlows.forEach((edgeFlow, edgeFlowIndex) => {
    const data = (edgeFlow.step ?? fallbackStep)?.data
    if (Array.isArray(data)) {
      data.forEach((dataObj, dataIndex) => {
        plans.push({
          edgeFlow,
          edgeFlowIndex,
          dataObj,
          dataIndex,
          delayMs: dataIndex * 280,
          ...resolvePixelStyle(cycle, pixelIdx++, dataObj.color),
        })
      })
    } else {
      const singleColor = data && typeof data === 'object' ? data.color : undefined
      plans.push({
        edgeFlow,
        edgeFlowIndex,
        delayMs: 0,
        ...resolvePixelStyle(cycle, pixelIdx++, singleColor),
      })
    }
  })
  return plans
}

const nodeTypes: NodeTypes = {
  flowNode: FlowNodeComponent,
}

const edgeTypes: EdgeTypes = {
  road: RoadEdge,
}

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)
const getTargets = (to: string | string[] | undefined) => (Array.isArray(to) ? to : to ? [to] : [])

interface FlowCanvasProps {
  flow: Flow
  playing: boolean
  /** Toggle play/pause from the on-canvas Play button. */
  onTogglePlay?: () => void
  /** Force playing to false. Called by Restart / Prev / Next so the
   *  parent's `playing` state matches the hook's internal "scrubbed"
   *  state — without this, the play button stays in Pause mode and
   *  the DataPixel keeps animating because `paused={!playing}` is
   *  driven by the parent prop. */
  onPause?: () => void
  onDrillDown?: (nodeId: string) => void
  onDrilldownStep?: (nodeId: string, atStepIndex: number) => void
  onCycleComplete?: () => void
  startFromStep?: number
  onStepChange?: (stepIndex: number) => void
  /** Open the inspect panel on a step. `focus` (when set) identifies
   *  the specific (from, to, data) triplet the user clicked, so the
   *  panel can highlight just that section — needed to disambiguate
   *  broadcast steps (one source, many targets, shared data object)
   *  and parallel steps (many sources/targets, distinct data). */
  onInspectStep?: (step: FlowStep, focus?: { from?: string; to?: string; data?: FlowData }) => void
}

/** Inner component that can use useReactFlow (needs ReactFlowProvider context) */
function FlowCanvasInner({
  flow,
  playing,
  onTogglePlay,
  onPause,
  onDrillDown,
  onDrilldownStep,
  onCycleComplete,
  startFromStep,
  onStepChange,
  onInspectStep,
}: FlowCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const flowSteps = useMemo(() => flow.flow.steps ?? [], [flow.flow.steps])

  const { nodes: baseNodes, edges: baseEdges } = useFlowGraphLayout(flow)
  const reactFlow = useReactFlow()

  // Re-fit the view whenever node positions change. ELK arrives asynchronously
  // after the initial fallback layout, so the built-in `fitView` prop's single
  // on-mount run lands on the fallback; this effect catches subsequent updates
  // (and drill-down flow swaps).
  const layoutKey = useMemo(
    () => baseNodes.map((n) => `${n.id}@${n.position.x},${n.position.y}`).join('|'),
    [baseNodes]
  )
  const fitToPane = useCallback(() => {
    if (baseNodes.length === 0) return
    const pane = document.querySelector('.react-flow') as HTMLElement | null
    if (!pane) return
    const paneW = pane.offsetWidth
    const paneH = pane.offsetHeight
    if (paneW === 0 || paneH === 0) return
    const xs = baseNodes.map((n) => n.position.x)
    const ys = baseNodes.map((n) => n.position.y)
    const w = baseNodes[0].width ?? 108
    const h = baseNodes[0].height ?? 160
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    const maxX = Math.max(...xs) + w
    const maxY = Math.max(...ys) + h
    const contentW = maxX - minX
    const contentH = maxY - minY
    const pad = 0.3
    const zoom = Math.min(paneW / (contentW * (1 + pad)), paneH / (contentH * (1 + pad)), 1.5)
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    const x = paneW / 2 - centerX * zoom
    const y = paneH / 2 - centerY * zoom
    reactFlow.setViewport({ x, y, zoom })
  }, [baseNodes, reactFlow])

  // Re-fit when node positions change (ELK arrives async after the initial
  // fallback layout, plus drill-down flow swaps).
  useEffect(() => {
    const t1 = setTimeout(fitToPane, 50)
    const t2 = setTimeout(fitToPane, 400)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [layoutKey, fitToPane])

  // Re-fit when the canvas pane resizes (e.g. user toggles sidebar /
  // inspector via the bookmark tabs). Without this, the diagram visibly
  // shifts left when the sidebar collapses because the viewport keeps the
  // same world coords against a now-wider canvas.
  useEffect(() => {
    const pane = document.querySelector('.react-flow') as HTMLElement | null
    if (!pane || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => fitToPane())
    observer.observe(pane)
    return () => observer.disconnect()
  }, [fitToPane])

  const pairEdgeMap = useMemo(() => {
    const map = new Map<string, Edge>()
    for (const edge of baseEdges) {
      map.set(pairKey(edge.source, edge.target), edge)
    }
    return map
  }, [baseEdges])

  const resolveEdgeFlow = useCallback(
    (fromId: string, toId: string, step: FlowStep): EdgeFlowRef | null => {
      const edge = pairEdgeMap.get(pairKey(fromId, toId))
      if (!edge) return null

      return {
        edgeId: edge.id,
        fromId,
        toId,
        reverse: edge.source !== fromId || edge.target !== toId,
        step,
      }
    },
    [pairEdgeMap]
  )

  const stepMappings = useMemo<StepEdgeMapping[]>(() => {
    return flowSteps.map((step, stepIndex) => {
      const edgeFlows: EdgeFlowRef[] = []
      const fromIds: string[] = []
      const toIds: string[] = []
      const parallel = 'parallel' in step ? step.parallel : undefined

      if (parallel) {
        for (const ps of parallel) {
          if (ps.from) fromIds.push(ps.from)
          if (ps.to) {
            const targets = getTargets(ps.to)
            toIds.push(...targets)
            for (const target of targets) {
              if (!ps.from) continue
              const edgeFlow = resolveEdgeFlow(ps.from, target, ps)
              if (edgeFlow) edgeFlows.push(edgeFlow)
            }
          }
        }
      } else {
        const from = 'from' in step ? step.from : undefined
        if (from) fromIds.push(from)
        // `create` steps travel from the creator to the newly-created node.
        // Treat `create: <id>` as a single target so a pixel fires.
        const createTarget =
          'create' in step && typeof step.create === 'string' ? step.create : undefined
        const targets: string[] = [
          ...('to' in step ? getTargets(step.to) : []),
          ...(createTarget ? [createTarget] : []),
        ]
        if (targets.length) {
          toIds.push(...targets)
          for (const target of targets) {
            if (!from) continue
            const edgeFlow = resolveEdgeFlow(from, target, step)
            if (edgeFlow) edgeFlows.push(edgeFlow)
          }
        }
      }

      return { stepIndex, edgeFlows, fromIds, toIds, step }
    })
  }, [flowSteps, resolveEdgeFlow])

  // Build a map from node id to type and shadow color for animated pixels.
  // The shadow color comes from the topology's variant assignment so it
  // stays in lockstep with the sprite filter cycle in flow-layout — same
  // sprite hue → same pixel shadow. Iterating topology.nodeSnapshots
  // (rather than just flow.flow.nodes) also covers dynamic nodes spawned
  // by `create:` steps so their pixels get a real variant color too.
  const nodeTypeMap = useMemo(() => {
    const topology = buildFlowTopology(flow)
    const explicitColors = new Map<string, string>()
    for (const n of flow.flow.nodes) {
      // A `custom`-typed node with an explicit hex color keeps that color
      // (it already drives the sprite tint via FlowNode).
      if (n.type === 'custom' && n.color) explicitColors.set(n.id, n.color)
    }
    const map = new Map<string, { type: string; color?: string }>()
    for (const [id, snapshot] of topology.nodeSnapshots) {
      map.set(id, {
        type: snapshot.nodeType,
        color: explicitColors.get(id) ?? topology.nodeVariants.get(id)?.color,
      })
    }
    return map
  }, [flow])

  const {
    fireManualPixel,
    removeManualPixel,
    setNodeStep,
    activateNode,
    deactivateNode,
    restart,
    goToStep,
    manualPixels,
    nodeProgress,
    activeNodes,
    destroyedNodes,
    ...animState
  } = useFlowAnimation(flowSteps, stepMappings, playing, onCycleComplete, startFromStep)

  // Helper: check if a node is currently alive (static nodes always are, dynamic nodes need to be in activeNodes and not destroyed)
  const isNodeAlive = useCallback(
    (nodeId: string) => {
      const node = baseNodes.find((n) => n.id === nodeId)
      const isDynamic = node?.data?.isDynamic ?? false
      if (!isDynamic) return true
      return activeNodes.has(nodeId) && !destroyedNodes.has(nodeId)
    },
    [baseNodes, activeNodes, destroyedNodes]
  )

  // Report step changes to parent
  const onStepChangeRef = useRef(onStepChange)
  useEffect(() => {
    onStepChangeRef.current = onStepChange
  }, [onStepChange])
  useEffect(() => {
    if (onStepChangeRef.current && animState.currentStepIndex >= 0) {
      onStepChangeRef.current(animState.currentStepIndex)
    }
  }, [animState.currentStepIndex])

  // Build a map: nodeId -> list of outgoing logical steps
  // A broadcast (to: [db, cache]) is ONE logical step with multiple edge flows.
  const nodeOutgoingSteps = useMemo(() => {
    const map = new Map<
      string,
      Array<{ stepIndex: number; step: FlowStep; edgeFlows: EdgeFlowRef[] }>
    >()
    const steps = flowSteps
    for (let si = 0; si < steps.length; si++) {
      const step = steps[si]
      const parallel = 'parallel' in step ? step.parallel : undefined
      const destroy = 'destroy' in step ? step.destroy : undefined
      const create = 'create' in step ? step.create : undefined
      const from = 'from' in step ? step.from : undefined

      if (parallel) {
        // Group sub-steps by their `from` node so a single parallel counts as
        // ONE outgoing event per source (even if it fires multiple edges).
        const bySource = new Map<string, { step: FlowStep; edgeFlows: EdgeFlowRef[] }>()
        for (const ps of parallel) {
          if (!ps.from) continue
          const targets = getTargets(ps.to)
          const grouped = bySource.get(ps.from) ?? { step: ps, edgeFlows: [] as EdgeFlowRef[] }
          for (const t of targets) {
            const edgeFlow = resolveEdgeFlow(ps.from, t, ps)
            if (edgeFlow) grouped.edgeFlows.push(edgeFlow)
          }
          bySource.set(ps.from, grouped)
        }
        for (const [fromId, { step: representativeStep, edgeFlows }] of bySource) {
          if (edgeFlows.length === 0) continue
          const entries = map.get(fromId) ?? []
          entries.push({ stepIndex: si, step: representativeStep, edgeFlows })
          map.set(fromId, entries)
        }
      } else if (destroy) {
        // Destroy step: outgoing action for the destroyed node (no edge, just triggers deactivation)
        const entries = map.get(destroy) ?? []
        entries.push({ stepIndex: si, step, edgeFlows: [] })
        map.set(destroy, entries)
      } else if (create && from) {
        // Create step: from → newly created node
        const entries = map.get(from) ?? []
        const edgeFlow = resolveEdgeFlow(from, create, step)
        if (edgeFlow) entries.push({ stepIndex: si, step, edgeFlows: [edgeFlow] })
        map.set(from, entries)
      } else if (from) {
        const entries = map.get(from) ?? []
        const targets = 'to' in step ? getTargets(step.to) : []
        const edgeFlows: EdgeFlowRef[] = []
        for (const t of targets) {
          const edgeFlow = resolveEdgeFlow(from, t, step)
          if (edgeFlow) edgeFlows.push(edgeFlow)
        }
        if (edgeFlows.length > 0) entries.push({ stepIndex: si, step, edgeFlows })
        map.set(from, entries)
      }
    }
    return map
  }, [flowSteps, resolveEdgeFlow])

  // Track which specific (nodeId, stepIndex) combos have a pixel in flight
  const activePixelSteps = useMemo(() => {
    const set = new Set<string>()
    for (const mp of manualPixels) {
      set.add(`${mp.sourceNodeId}:${mp.sourceStepIndex}`)
    }
    return set
  }, [manualPixels])

  // Auto-drilldown: when a step with drilldown:true is detected during
  // AUTOPLAY, capture the step index and drill down after the pixel
  // animation. Gated on `playing` so manual scrubbing past a drill-down
  // step doesn't queue an unintended drill (which used to leak: the
  // effect would schedule the timer on step N — a drill-down step —
  // and the next step's effect run would early-return without canceling
  // the pending timer, so 1500ms later the drill fired anyway).
  const drilldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastDrilldownStepRef = useRef<number>(-1)
  useEffect(() => {
    const cancelPending = () => {
      if (drilldownTimerRef.current) {
        clearTimeout(drilldownTimerRef.current)
        drilldownTimerRef.current = null
      }
    }
    if (!onDrilldownStep || !playing) {
      cancelPending()
      return
    }
    const step = animState.activeStep
    if (!step) return
    if (!('drilldown' in step) || !step.drilldown) return
    const targetId = Array.isArray(step.to)
      ? step.to[0]
      : typeof step.to === 'string'
        ? step.to
        : null
    if (!targetId) return
    if (lastDrilldownStepRef.current === animState.currentStepIndex) return
    lastDrilldownStepRef.current = animState.currentStepIndex

    cancelPending()

    // Capture the current step index NOW before the animation advances
    const capturedStepIndex = animState.currentStepIndex

    drilldownTimerRef.current = setTimeout(
      () => {
        // Pass both the target node and the step to resume from
        onDrilldownStep(targetId, capturedStepIndex)
        drilldownTimerRef.current = null
      },
      1500 / (window.__flowSpeed ?? 1)
    )
  }, [animState.activeStep, animState.currentStepIndex, onDrilldownStep, playing])

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      const outgoing = nodeOutgoingSteps.get(nodeId)
      if (!outgoing || outgoing.length === 0) return

      let currentProg = nodeProgress.get(nodeId) ?? 0

      // If past the last step, reset progress and fire first step
      if (currentProg >= outgoing.length) {
        setNodeStep(nodeId, 0)
        currentProg = 0
      }

      // Block only if THIS EXACT logical step is already animating
      const stepKey = `${nodeId}:${currentProg}`
      if (activePixelSteps.has(stepKey)) return

      const entry = outgoing[currentProg]
      const sourceInfo = nodeTypeMap.get(nodeId) ?? { type: 'service' }

      onInspectStep?.(entry.step)

      // Increment progress once for this logical step
      setNodeStep(nodeId, currentProg + 1)

      // If this is a create step, activate the new node
      if (entry.step.create) {
        activateNode(entry.step.create)
      }

      // If this is a destroy step, deactivate the node
      if (entry.step.destroy) {
        deactivateNode(entry.step.destroy)
        return // no pixel to fire
      }

      // Click-to-fire uses the same plan as autoplay so manual pixels get
      // the same multi-data expansion + palette cycling.
      for (const plan of planStepPixels(entry.edgeFlows, entry.step)) {
        fireManualPixel({
          edgeId: plan.edgeFlow.edgeId,
          reverse: plan.edgeFlow.reverse,
          step: plan.edgeFlow.step,
          inspectStep: entry.step,
          fromId: plan.edgeFlow.fromId,
          toId: plan.edgeFlow.toId,
          sourceNodeId: nodeId,
          sourceStepIndex: currentProg,
          sourceNodeColor: sourceInfo.color,
          pixelColor: plan.pixelColor,
          pixelFilter: plan.pixelFilter,
          dataOverride: plan.dataObj,
          delayMs: plan.delayMs || undefined,
        })
      }
    },
    [
      nodeOutgoingSteps,
      nodeProgress,
      nodeTypeMap,
      fireManualPixel,
      setNodeStep,
      activePixelSteps,
      activateNode,
      deactivateNode,
      onInspectStep,
    ]
  )

  const handleProgressBarClick = useCallback(
    (nodeId: string, targetStep: number) => {
      setNodeStep(nodeId, targetStep)
    },
    [setNodeStep]
  )

  // Wrap onDrillDown so clicking the drill-down glyph first zooms into the
  // selected node, then hands off to the parent which swaps in the sub-flow.
  const handleDrillDownWithZoom = useCallback(
    (nodeId: string) => {
      const node = baseNodes.find((n) => n.id === nodeId)
      if (!node) {
        onDrillDown?.(nodeId)
        return
      }
      const w = node.width ?? 108
      const h = node.height ?? 160
      const cx = node.position.x + w / 2
      const cy = node.position.y + h / 2
      reactFlow.setCenter(cx, cy, { zoom: 2.5, duration: 450 })
      window.setTimeout(() => onDrillDown?.(nodeId), 470)
    },
    [baseNodes, onDrillDown, reactFlow]
  )

  // Apply active sender/receiver flags to nodes, and visibility for dynamic nodes
  const nodes: Node<FlowNodeData>[] = useMemo(() => {
    return baseNodes.map((node) => {
      const isDynamic = node.data?.isDynamic ?? false
      const isAlive = !isDynamic || (activeNodes.has(node.id) && !destroyedNodes.has(node.id))

      return {
        ...node,
        style: {
          ...node.style,
          opacity: isAlive ? 1 : 0,
          transition: 'opacity 0.4s ease',
          pointerEvents: (isAlive ? 'auto' : 'none') as React.CSSProperties['pointerEvents'],
        },
        data: {
          ...node.data,
          isActiveSender: animState.activeFromIds.has(node.id),
          isActiveReceiver: animState.activeToIds.has(node.id),
          currentStep: nodeProgress.get(node.id) ?? 0,
          outgoingStepCount: nodeOutgoingSteps.get(node.id)?.length ?? 0,
          onNodeClick: handleNodeClick,
          onProgressBarClick: handleProgressBarClick,
          onDrillDown: handleDrillDownWithZoom,
        },
      }
    })
  }, [
    baseNodes,
    animState.activeFromIds,
    animState.activeToIds,
    nodeProgress,
    activeNodes,
    destroyedNodes,
    handleNodeClick,
    handleProgressBarClick,
    handleDrillDownWithZoom,
  ])

  const edges: Edge[] = useMemo(() => {
    return baseEdges
      .filter((edge) => isNodeAlive(edge.source) && isNodeAlive(edge.target))
      .map((edge) => {
        const sourceAlive = isNodeAlive(edge.source)
        const targetAlive = isNodeAlive(edge.target)
        const bothAlive = sourceAlive && targetAlive
        const isActive = animState.activeEdgeIds.has(edge.id)

        return {
          ...edge,
          interactionWidth: undefined,
          style: {
            ...edge.style,
            opacity: 1,
            pointerEvents: 'auto' as React.CSSProperties['pointerEvents'],
            transition: 'opacity 0.4s ease',
          },
          data: {
            ...edge.data,
            active: isActive,
            visible: bothAlive,
          },
        }
      })
  }, [baseEdges, animState.activeEdgeIds, isNodeAlive])

  // Collect active edges for pixel rendering
  const activeEdgeFlows = useMemo(() => {
    if (!animState.activeStep) return []
    return animState.activeEdgeFlows
  }, [animState.activeEdgeFlows, animState.activeStep])

  return (
    <div className="w-full h-full relative" ref={containerRef} aria-label="Flow canvas">
      {/* SVG filter defs — drawn once per canvas, referenced from index.css */}
      <svg
        aria-hidden="true"
        width="0"
        height="0"
        style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}
      >
        <defs>
          <filter id="road-outline" x="-15%" y="-15%" width="130%" height="130%">
            {/* outermost ring — widest dilation drawn first */}
            <feMorphology in="SourceAlpha" operator="dilate" radius="6" result="outermostMask" />
            <feFlood floodColor="#5AFEE6" result="outermostColor" />
            <feComposite
              in="outermostColor"
              in2="outermostMask"
              operator="in"
              result="outermostRing"
            />
            {/* middle ring */}
            <feMorphology in="SourceAlpha" operator="dilate" radius="4" result="middleMask" />
            <feFlood floodColor="#62827D" result="middleColor" />
            <feComposite in="middleColor" in2="middleMask" operator="in" result="middleRing" />
            {/* inner ring */}
            <feMorphology in="SourceAlpha" operator="dilate" radius="2" result="innerMask" />
            <feFlood floodColor="#75AAA2" result="innerColor" />
            <feComposite in="innerColor" in2="innerMask" operator="in" result="innerRing" />
            <feMerge>
              <feMergeNode in="outermostRing" />
              <feMergeNode in="middleRing" />
              <feMergeNode in="innerRing" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={(_event, node) => handleNodeClick(node.id)}
        nodesConnectable={false}
        edgesFocusable={false}
        nodesDraggable={false}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.1}
        maxZoom={6}
      >
        <Background variant={BackgroundVariant.Lines} gap={32} size={1} color="#1F3E2F" />
        <Controls
          showInteractive={false}
          style={{ background: '#0d2612', borderColor: '#1a4a22' }}
        />
        {/* Playback controls — right side, vertical column. Restart rewinds
            to step -1 with all progress cleared; Prev/Next snap the
            visualization to the adjacent step (without replaying cumulative
            create/destroy effects — press Play to advance from there). */}
        <Panel position="top-right">
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              padding: 6,
              background: '#0d2612',
              border: '1px solid #1a4a22',
              borderRadius: 4,
            }}
          >
            <PlaybackButton
              ariaLabel="Restart flow"
              onClick={() => {
                onPause?.()
                // Reset the "already drilled" memo so a re-traversal of any
                // drill-down step actually re-fires onDrilldownStep. Without
                // this, after Prev/Next over a drill-down step, autoplay
                // would silently skip the drill on the second pass.
                lastDrilldownStepRef.current = -1
                restart()
              }}
            >
              {'⏮'}
            </PlaybackButton>
            <PlaybackButton
              ariaLabel="Previous step"
              onClick={() => {
                onPause?.()
                lastDrilldownStepRef.current = -1
                goToStep((animState.currentStepIndex ?? 0) - 1)
              }}
              disabled={(animState.currentStepIndex ?? -1) <= 0}
            >
              {'⏪'}
            </PlaybackButton>
            <PlaybackButton ariaLabel={playing ? 'Pause flow' : 'Play flow'} onClick={onTogglePlay}>
              {playing ? '⏸' : '▶'}
            </PlaybackButton>
            <PlaybackButton
              ariaLabel="Next step"
              onClick={() => {
                onPause?.()
                lastDrilldownStepRef.current = -1
                goToStep((animState.currentStepIndex ?? -1) + 1)
              }}
              disabled={
                animState.currentStepIndex !== undefined &&
                animState.currentStepIndex >= flowSteps.length - 1
              }
            >
              {'⏩'}
            </PlaybackButton>
          </div>
        </Panel>
      </ReactFlow>

      {/* Data pixel overlay — automatic. planStepPixels handles the cycling
          rule: any step emitting 2+ carrots (multi-data, broadcast, or
          parallel) cycles the variant palette across the whole set so each
          one is distinct; single-carrot steps keep the source node's
          variant color via DataPixel's sourceNodeColor fallback. */}
      {animState.activeStep &&
        planStepPixels(activeEdgeFlows, animState.activeStep).map((plan) => {
          const { edgeFlow, edgeFlowIndex, dataObj, dataIndex } = plan
          const sourceInfo = nodeTypeMap.get(edgeFlow.fromId) ?? { type: 'service' }
          const edgeStep = edgeFlow.step ?? animState.activeStep!
          const key =
            `${edgeFlow.edgeId}-${edgeFlow.reverse ? 'r' : 'f'}-${edgeFlowIndex}` +
            (dataIndex !== undefined ? `-${dataIndex}` : '')
          return (
            <DataPixel
              key={key}
              edgeId={edgeFlow.edgeId}
              reverse={edgeFlow.reverse}
              sourceNodeColor={sourceInfo.color}
              pixelColor={plan.pixelColor}
              pixelFilter={plan.pixelFilter}
              step={edgeStep}
              containerRef={containerRef}
              onPixelClick={(focusData) =>
                onInspectStep?.(animState.activeStep!, {
                  from: edgeFlow.fromId,
                  to: edgeFlow.toId,
                  data: focusData,
                })
              }
              delayMs={plan.delayMs || undefined}
              dataOverride={dataObj}
              paused={!playing}
            />
          )
        })}

      {/* Data pixel overlay — manual (click-to-fire). These animate
          unconditionally — pause is for the autoplay loop only; a click
          should always play out its single step regardless of global state. */}
      {manualPixels.map((mp) => (
        <DataPixel
          key={mp.id}
          edgeId={mp.edgeId}
          reverse={mp.reverse}
          sourceNodeColor={mp.sourceNodeColor}
          pixelColor={mp.pixelColor}
          pixelFilter={mp.pixelFilter}
          dataOverride={mp.dataOverride}
          delayMs={mp.delayMs}
          step={mp.step}
          containerRef={containerRef}
          isManual
          onAnimationComplete={() => removeManualPixel(mp.id)}
          onPixelClick={(focusData) =>
            onInspectStep?.(mp.inspectStep, {
              from: mp.fromId,
              to: mp.toId,
              data: focusData,
            })
          }
        />
      ))}
    </div>
  )
}

function PlaybackButton({
  ariaLabel,
  onClick,
  disabled,
  children,
}: {
  ariaLabel: string
  onClick?: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 28,
        height: 28,
        background: '#0d2612',
        border: '1px solid #1a4a22',
        color: disabled ? '#3a5a42' : '#7fffaa',
        cursor: disabled ? 'default' : 'pointer',
        fontSize: 14,
        fontFamily: 'monospace',
        lineHeight: 1,
        padding: 0,
        borderRadius: 3,
      }}
    >
      {children}
    </button>
  )
}

export function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner key={JSON.stringify(props.flow.flow.nodes.map((n) => n.id))} {...props} />
    </ReactFlowProvider>
  )
}
