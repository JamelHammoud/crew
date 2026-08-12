import type { SettingReader } from './cli'
import type { Dialog, RunOptions } from './types'

const CLIENT = { name: 'crew', title: 'Crew', version: '1' }
const SANDBOX = 'danger-full-access'
const SANDBOX_POLICY = { type: 'dangerFullAccess' }
const APPROVAL = 'never'
const SUMMARY = 'detailed'

const APPROVALS = new Set([
  'item/commandExecution/requestApproval',
  'item/fileChange/requestApproval',
  'item/permissions/requestApproval',
  'applyPatchApproval',
  'execCommandApproval'
])

type Stage = 'init' | 'thread' | 'goal' | 'turn' | 'steer'

const str = (value: unknown): string => (typeof value === 'string' ? value : '')

const rpc = (body: Record<string, unknown>): string => JSON.stringify({ jsonrpc: '2.0', ...body })

const input = (text: string) => [{ type: 'text', text }]

export function codexDialog(prompt: string, cwd: string, get: SettingReader, options: RunOptions = {}): Dialog {
  const model = get('model')
  const effort = get('effort')
  const personality = get('personality')
  const pending = new Map<number, Stage>()
  let next = 0
  let threadId = ''
  let turnId = ''

  const ask = (stage: Stage, method: string, params: unknown): string => {
    const id = ++next
    pending.set(id, stage)
    return rpc({ id, method, params })
  }

  const startThread = () =>
    ask('thread', 'thread/start', {
      cwd,
      sandbox: SANDBOX,
      approvalPolicy: APPROVAL,
      ...(model ? { model } : {})
    })

  const startTurn = () =>
    ask('turn', 'turn/start', {
      threadId,
      input: input(prompt),
      sandboxPolicy: SANDBOX_POLICY,
      approvalPolicy: APPROVAL,
      summary: SUMMARY,
      ...(effort ? { effort } : {}),
      ...(personality ? { personality } : {})
    })

  const startGoal = () =>
    ask('goal', 'thread/goal/set', {
      threadId,
      objective: options.goal ?? prompt,
      status: 'active'
    })

  const served = (id: unknown, method: string): string[] =>
    APPROVALS.has(method)
      ? [rpc({ id, result: { decision: 'accept' } })]
      : [rpc({ id, error: { code: -32601, message: `Crew does not answer ${method}.` } })]

  const answered = (stage: Stage, result: any): string[] => {
    if (stage === 'init') return [rpc({ method: 'initialized', params: {} }), startThread()]
    if (stage === 'thread') {
      threadId = str(result?.thread?.id)
      return threadId ? [options.goal ? startGoal() : startTurn()] : []
    }
    if (stage === 'goal') return [startTurn()]
    if (stage === 'turn') turnId = str(result?.turn?.id) || turnId
    if (stage === 'steer') turnId = str(result?.turnId) || turnId
    return []
  }

  return {
    begin: () => [ask('init', 'initialize', { clientInfo: CLIENT })],
    answer: line => {
      let msg: any
      try {
        msg = JSON.parse(line)
      } catch {
        return []
      }
      if (typeof msg?.method === 'string') {
        if (msg.id !== undefined && msg.id !== null) return served(msg.id, msg.method)
        if (msg.method === 'turn/started') turnId = str(msg.params?.turn?.id) || turnId
        if (msg.method === 'turn/completed') turnId = ''
        return []
      }
      const stage = typeof msg?.id === 'number' ? pending.get(msg.id) : undefined
      if (!stage) return []
      pending.delete(msg.id)
      return msg.error ? [] : answered(stage, msg.result)
    },
    steer: text =>
      threadId && turnId ? ask('steer', 'turn/steer', { threadId, expectedTurnId: turnId, input: input(text) }) : null
  }
}
