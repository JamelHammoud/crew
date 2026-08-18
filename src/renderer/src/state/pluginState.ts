import { resolvePlugin, type PluginReference } from '../../../shared/plugins'
import { useBrowser } from './browser'

export function runPluginAction(plugin: PluginReference): void {
  const resolved = resolvePlugin(plugin)
  if (resolved.launch.kind === 'browser') {
    useBrowser.getState().openPlugin(resolved)
    return
  }
  if (resolved.documentationUrl) useBrowser.getState().openUrl(resolved.documentationUrl)
}
