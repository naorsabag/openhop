import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { FlowStep } from '../types'

export interface AnimationState {
  playing: boolean
  currentStepIndex: number
  totalSteps: number
  activeEdgeIds: Set<string>
  activeFromIds: Set<string>
  activeToIds: Set<string>
  activeStep: FlowStep | null
}

interface StepEdgeMapping {
  stepIndex: number
  edgeIds: string[]
  fromIds: string[]
  toIds: string[]
  step: FlowStep
}

const STEP_DURATION = 1500
const PIXEL_DURATION = 800

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
  })

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

    // Activate edges and nodes
    setState({
      playing: true,
      currentStepIndex: nextIdx,
      totalSteps: steps.length,
      activeEdgeIds: new Set(mapping.edgeIds),
      activeFromIds: new Set(mapping.fromIds),
      activeToIds: new Set(mapping.toIds),
      activeStep: mapping.step,
    })

    // After pixel animation duration, clear active state, then wait before next step
    timerRef.current = setTimeout(() => {
      if (!playingRef.current) return

      setState((prev) => ({
        ...prev,
        activeEdgeIds: new Set<string>(),
        activeFromIds: new Set<string>(),
        activeToIds: new Set<string>(),
        activeStep: null,
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
      setState((prev) => ({
        ...prev,
        playing: false,
        activeEdgeIds: new Set<string>(),
        activeFromIds: new Set<string>(),
        activeToIds: new Set<string>(),
        activeStep: null,
      }))
      stepIndexRef.current = -1
    }

    return clearTimers
  }, [playing, advanceStep, clearTimers])

  return state
}
