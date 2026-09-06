import { spawn } from 'node:child_process'
import type { AgentSettingOption } from '../../shared/llm'
import { commandInvocation } from './cli'
import { resolveCommand } from './path'

export interface AcpModel extends AgentSettingOption {
  efforts: AgentSettingOption[]
}

interface AcpRefreshOptions {
  provider: string
  command?: string
  args: string[]
  cwd?: string
  timeoutMs?: number
}

const catalogs = new Map<string, AcpModel[]>()

const text = (value: unknown): string => (typeof value === 'string' ? value : '')

const modelFrom = (value: any): AcpModel | null => {
  const id = text(value?.modelId) || text(value?.value) || text(value?.model) || text(value?.id)
  if (!id) return null
  const levels = Array.isArray(value?._meta?.reasoningEfforts) ? value._meta.reasoningEfforts : []
  const efforts = levels
    .map((level: any) => {
      const effort = text(level?.value) || text(level?.id)
      return effort ? { value: effort, label: text(level?.label) || effort } : null
    })
    .filter((effort: AgentSettingOption | null): effort is AgentSettingOption => effort !== null)
  return { value: id, label: text(value?.name) || text(value?.label) || id, efforts }
}

const listFrom = (value: any): AcpModel[] => {
  const config = Array.isArray(value?.configOptions)
    ? value.configOptions.find((option: any) => text(option?.id) === 'model' || text(option?.category) === 'model')
    : null
  const lists = [
    value?.models?.availableModels,
    value?._meta?.modelState?.availableModels,
    value?.modelState?.availableModels,
    value?.availableModels,
    config?.options
  ]
  for (const list of lists) {
    if (!Array.isArray(list)) continue
    const models = list.map(modelFrom).filter((model: AcpModel | null): model is AcpModel => model !== null)
    if (models.length) return models
  }
  return []
}

export const acpModels = (provider: string): AcpModel[] => catalogs.get(provider) ?? []

export function refreshAcpModels(options: AcpRefreshOptions): Promise<boolean> {
  const command = options.command ?? resolveCommand(options.provider) ?? options.provider
  const invocation = commandInvocation(command, options.args)
  return new Promise(resolve => {
    const child = spawn(invocation.command, invocation.args, {
      cwd: options.cwd ?? process.cwd(),
      stdio: ['pipe', 'pipe', 'ignore']
    })
    let buffer = ''
    let settled = false
    const done = (models: AcpModel[]) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (models.length) catalogs.set(options.provider, models)
      child.kill()
      resolve(models.length > 0)
    }
    const write = (message: unknown) => child.stdin.write(`${JSON.stringify(message)}\n`)
    const timer = setTimeout(() => done([]), options.timeoutMs ?? 5000)
    child.on('error', () => done([]))
    child.on('close', () => done([]))
    child.stdin.on('error', () => done([]))
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', chunk => {
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        let message: any
        try {
          message = JSON.parse(line)
        } catch {
          continue
        }
        const resultModels = listFrom(message?.result)
        const models = resultModels.length ? resultModels : listFrom(message?.params)
        if (models.length) {
          done(models)
          continue
        }
        if (message.id === 1 && message.result) {
          write({
            jsonrpc: '2.0',
            id: 2,
            method: 'session/new',
            params: { cwd: options.cwd ?? process.cwd(), mcpServers: [] }
          })
          continue
        }
        if (message.id === 2) done([])
      }
    })
    write({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: 1,
        clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false }
      }
    })
  })
}
