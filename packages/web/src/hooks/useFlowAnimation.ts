import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { FlowStep } from '../types'

export interface ManualPixel {
  id: string
  edgeId: string
  step: FlowStep
  sourceNodeId: string
  sourceStepIndex: number
  sourceNodeType: string
  sourceNodeColor?: string
}

export interface AnimationState {
  playing: boolean
  currentStepIndex: number
  totalSteps: number
  activeEdgeIds: Set<string>
  activeFromIds: Set<string>
  activeToIds: Set<string>
  activeStep: FlowStep | null
  nodeProgress: Map<string, number>
  manualPixels: ManualPixel[]
}

interface StepEdgeMapping {
  stepIndex: number
  edgeIds: string[]
  fromIds: string[]
  toIds: string[]
  step: FlowStep
}

const STEP_DURATION = 2500
const PIXEL_DURATION = 1800

export function useFlowAnimation(
  steps: FlowStep[],
  edgeStepMap: Map<string, number>,
  playing: boolean,
) {
  const [state, setState] = useState<AnimationState>({
    playing: false,
    currentStepIndex: -1,
    totalSteps: steps.length,
    activeEdgeIds: new Set(),
    activeFromIds: new Set(),
    activeToIds: new Set(),
    activeStep: null,
    nodeProgress: new Map(),
    manualPixels: [],
  })

  const nodeProgressRef = useRef<Map<string, number>>(new Map())

  const stepIndexRef = useRef(-1)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const playingRef = useRef(playing)
  playingRef.current = playing

  // Build step-to-edge mapping (memoized)
  const stepMappings = useMemo<StepEdgeMapping[]>(() => {
    return steps.map((step, idx) => {
      const edgeIds: string[] = []
      const fromIds: string[] = []
      const toIds: string[] = []

      edgeStepMap.forEach((stepIdx, edgeId) => {
        if (stepIdx === idx) edgeIds.push(edgeId)
      })

      if (step.parallel) {
        for (const ps of step.parallel) {
          if (ps.from) fromIds.push(ps.from)
          if (ps.to) {
            const targets = Array.isArray(ps.to) ? ps.to : [ps.to]
            toIds.push(...targets)
          }
        }
      } else {
        if (step.from) fromIds.push(step.from)
        if (step.to) {
          const targets = Array.isArray(step.to) ? step.to : [step.to]
          toIds.push(...targets)
        }
      }

      return { stepIndex: idx, edgeIds, fromIds, toIds, step }
    })
  }, [steps, edgeStepMap])

  // Store mappings in ref so advanceStep never goes stale
  const mappingsRef = useRef(stepMappings)
  mappingsRef.current = stepMappings

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const advanceStep = useCallback(() => {
    if (steps.length === 0) return
    if (!playingRef.current) return

    const nextIdx = (stepIndexRef.current + 1) % steps.length
    stepIndexRef.current = nextIdx
    const mapping = mappingsRef.current[nextIdx]

    // Increment node progress for all involved nodes
    const allNodeIds = [...mapping.fromIds, ...mapping.toIds]
    for (const nid of allNodeIds) {
      nodeProgressRef.current.set(nid, (nodeProgressRef.current.get(nid) ?? 0) + 1)
    }

    // Activate edges and nodes
    setState((prev) => ({
      playing: true,
      currentStepIndex: nextIdx,
      totalSteps: steps.length,
      activeEdgeIds: new Set(mapping.edgeIds),
      activeFromIds: new Set(mapping.fromIds),
      activeToIds: new Set(mapping.toIds),
      activeStep: mapping.step,
      nodeProgress: new Map(nodeProgressRef.current),
      manualPixels: prev.manualPixels,
    }))

    // After pixel animation duration, clear active state, then wait before next step
    timerRef.current = setTimeout(() => {
      if (!playingRef.current) return

      setState((prev) => ({
        ...prev,
        activeEdgeIds: new Set<string>(),
        activeFromIds: new Set<string>(),
        activeToIds: new Set<string>(),
        activeStep: null,
        nodeProgress: new Map(nodeProgressRef.current),
      }))

      timerRef.current = setTimeout(() => {
        advanceStep()
      }, STEP_DURATION - PIXEL_DURATION)
    }, PIXEL_DURATION)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps.length])

  useEffect(() => {
    if (playing) {
      advanceStep()
    } else {
      clearTimers()
      nodeProgressRef.current = new Map()
      setState((prev) => ({
        ...prev,
        playing: false,
        activeEdgeIds: new Set<string>(),
        activeFromIds: new Set<string>(),
        activeToIds: new Set<string>(),
        activeStep: null,
        nodeProgress: new Map(),
      }))
      stepIndexRef.current = -1
    }

    return clearTimers
  }, [playing, advanceStep, clearTimers])

  let manualPixelCounter = useRef(0)

  const fireManualPixel = useCallback((pixel: Omit<ManualPixel, 'id'>) => {
    const id = `manual-${++manualPixelCounter.current}`
    const manualPixel: ManualPixel = { ...pixel, id }

    // Increment node progress for source node
    const sourceId = pixel.step.from
    if (sourceId) {
      nodeProgressRef.current.set(sourceId, (nodeProgressRef.current.get(sourceId) ?? 0) + 1)
    }

    setState((prev) => ({
      ...prev,
      manualPixels: [...prev.manualPixels, manualPixel],
      nodeProgress: new Map(nodeProgressRef.current),
    }))

    return id
  }, [])

  const removeManualPixel = useCallback((pixelId: string) => {
    setState((prev) => ({
      ...prev,
      manualPixels: prev.manualPixels.filter((p) => p.id !== pixelId),
    }))
  }, [])

  const setNodeStep = useCallback((nodeId: string, step: number) => {
    nodeProgressRef.current.set(nodeId, step)
    setState((prev) => ({
      ...prev,
      nodeProgress: new Map(nodeProgressRef.current),
    }))
  }, [])

  return { ...state, fireManualPixel, removeManualPixel, setNodeStep }
}
