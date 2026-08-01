import type { AgentStep } from '../../../shared/llm'

export interface StepDelta {
  promptId: string
  step: AgentStep
}

export interface StepBuffer {
  push: (promptId: string, step: AgentStep) => void
  flush: () => void
  drop: () => void
}

const FALLBACK_MS = 16

export function makeStepBuffer(land: (deltas: StepDelta[]) => void): StepBuffer {
  let held: StepDelta[] = []
  let frame: number | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  const disarm = (): void => {
    if (frame !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame)
    if (timer !== null) clearTimeout(timer)
    frame = null
    timer = null
  }

  const flush = (): void => {
    disarm()
    if (held.length === 0) return
    const deltas = held
    held = []
    land(deltas)
  }

  return {
    push: (promptId, step) => {
      held.push({ promptId, step })
      if (timer !== null) return
      timer = setTimeout(flush, FALLBACK_MS)
      if (typeof requestAnimationFrame === 'function') frame = requestAnimationFrame(flush)
    },
    flush,
    drop: () => {
      disarm()
      held = []
    }
  }
}
