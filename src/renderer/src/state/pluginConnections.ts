import { create } from 'zustand'
import {
  currentPluginInstallation,
  pluginConnectionInput,
  resolvePlugin,
  type PluginConnectionInput,
  type PluginConnectionResult,
  type PluginReference
} from '../../../shared/plugins'

interface PluginConnections {
  ids: string[]
}

let syncId = 0

export const usePluginConnections = create<PluginConnections>(() => ({ ids: [] }))

const connectionOf = (plugin: PluginReference): PluginConnectionInput | null => pluginConnectionInput(plugin)

export const locallyConnected = (plugin: PluginReference, ids = usePluginConnections.getState().ids): boolean => {
  const resolved = resolvePlugin(plugin)
  if (!resolved.trusted) return true
  if (!currentPluginInstallation(plugin)) return false
  if (!window.crew?.pluginStatus) return true
  return ids.includes(plugin.installationId)
}

export async function syncPluginConnections(plugins: readonly PluginReference[]): Promise<void> {
  const asked = ++syncId
  const trusted = plugins.flatMap(plugin => {
    const input = connectionOf(plugin)
    return input ? [{ plugin, input }] : []
  })
  if (!window.crew?.pluginStatus) {
    usePluginConnections.setState({ ids: trusted.map(one => one.input.installationId) })
    return
  }
  const status = await Promise.all(
    trusted.map(async one => ({
      id: one.input.installationId,
      connected: await window.crew.pluginStatus(one.input).catch(() => false)
    }))
  )
  if (asked !== syncId) return
  usePluginConnections.setState({ ids: status.filter(one => one.connected).map(one => one.id) })
}

export async function refreshPluginConnection(plugin: PluginReference): Promise<void> {
  const input = connectionOf(plugin)
  if (!input) return
  const connected = window.crew?.pluginStatus ? await window.crew.pluginStatus(input).catch(() => false) : true
  if (!connected) return
  usePluginConnections.setState(state => ({ ids: [...new Set([...state.ids, input.installationId])] }))
}

export function markPluginConnected(plugin: PluginReference): void {
  const input = connectionOf(plugin)
  if (!input) return
  usePluginConnections.setState(state => ({ ids: [...new Set([...state.ids, input.installationId])] }))
}

export async function connectPlugin(plugin: PluginReference): Promise<PluginConnectionResult> {
  const input = connectionOf(plugin)
  if (!input) return { ok: false, message: 'That plugin cannot be connected.' }
  const connect = window.crew?.connectPlugin
  if (!connect) return { ok: false, message: 'Crew needs to restart before it can connect plugins.' }
  const result = await connect(input).catch(cause => ({
    ok: false,
    message: cause instanceof Error ? cause.message : 'The plugin did not connect.'
  }))
  if (result.ok) markPluginConnected(plugin)
  return result
}

export function forgetPluginConnection(plugin: PluginReference): void {
  const input = connectionOf(plugin)
  if (!input) return
  usePluginConnections.setState(state => ({ ids: state.ids.filter(id => id !== input.installationId) }))
  void window.crew?.disconnectPlugin?.(input).catch(() => {})
}
