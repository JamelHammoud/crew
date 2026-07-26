export interface BusyThread {
  id: string
  boardId?: string
  agentId?: string
  agentLabel?: string
}

export interface BusyAgent {
  id: string
  label: string
}

// The host only sends an agent's cursor while ops are landing, so a run that is
// thinking would drop off the board. The threads say who is still working.
export function busyAgents(
  boardId: string,
  threads: BusyThread[],
  running: Record<string, string>,
  labels: Record<string, string>
): BusyAgent[] {
  const found = new Map<string, string>()
  for (const thread of threads) {
    if (thread.boardId !== boardId || !thread.agentId || !running[thread.id]) continue
    found.set(thread.agentId, labels[thread.agentId] ?? thread.agentLabel ?? thread.agentId)
  }
  return [...found].map(([id, label]) => ({ id, label }))
}
