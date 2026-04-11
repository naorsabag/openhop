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

// Speed can be overridden via window.__flowSpeed (for testing)
const getSpeed = () => (window as any).__flowSpeed ?? 1
const STEP_DURATION_BASE = 2500
const PIXEL_DURATION_BASE = 1800

export function useFlowAnimation(
  steps: FlowStep[],
  edgeStepMap: Map<string, number>,
  playing: boolean,
  onCycleComplete?: () => void,
  startFromStep?: number,
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
  const onCycleCompleteRef = useRef(onCycleComplete)
  onCycleCompleteRef.current = onCycleComplete

  const stepIndexRef = useRef(startFromStep !== undefined ? startFromStep - 1 : -1)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const playingRef = useRef(playing)
  playingRef.current = playing

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

    const rawNext = stepIndexRef.current + 1

    // Check if we've completed all steps
    if (rawNext >= steps.length) {
      if (onCycleCompleteRef.current) {
        // Fire cycle complete — caller decides what to do
        onCycleCompleteRef.current()
        return
      }
      // No callback — loop back to start
      nodeProgressRef.current = new Map()
    }

    const nextIdx = rawNext % steps.length
    stepIndexRef.current = nextIdx
    const mapping = mappingsRef.current[nextIdx]

    for (const nid of mapping.fromIds) {
      nodeProgressRef.current.set(nid, (nodeProgressRef.current.get(nid) ?? 0) + 1)
    }

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
      }, (STEP_DURATION_BASE - PIXEL_DURATION_BASE) / getSpeed())
    }, PIXEL_DURATION_BASE / getSpeed())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps.length])

  useEffect(() => {
    if (playing) {
      advanceStep()
    } else {
      clearTimers()
      setState((prev) => ({
        ...prev,
        playing: false,
        activeEdgeIds: new Set<string>(),
        activeFromIds: new Set<string>(),
        activeToIds: new Set<string>(),
        activeStep: null,
      }))
    }

    return clearTimers
  }, [playing, advanceStep, clearTimers])

  let manualPixelCounter = useRef(0)

  const fireManualPixel = useCallback((pixel: Omit<ManualPixel, 'id'>) => {
    const id = `manual-${++manualPixelCounter.current}`
    const manualPixel: ManualPixel = { ...pixel, id }

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
