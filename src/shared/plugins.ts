import {
  catalogPlugin,
  catalogPluginForUrl,
  PLUGIN_CATALOG,
  PLUGIN_GROUPS,
  type PluginAuthentication,
  type PluginCatalogEntry,
  type PluginCatalogTransport,
  type PluginLaunch
} from './pluginCatalog'

export type PluginTransport = 'stdio' | 'http'

export interface PluginKey {
  name: string
  label: string
}

export interface CrewPlugin {
  id: string
  catalogId?: string
  name: string
  label?: string
  blurb?: string
  transport?: PluginTransport
  url?: string
  appUrl?: string
  command?: string
  args?: string[]
  keys?: PluginKey[]
  by: string
  byAgentId?: string
  ts: number
}

export interface PluginOffer {
  catalogId: string
  group: string
  name: string
  label: string
  blurb: string
  transport: PluginTransport
  url?: string
  appUrl?: string
  command?: string
  args?: string[]
  keys?: PluginKey[]
}

export type PluginReference = Pick<CrewPlugin, 'name'> &
  Partial<
    Pick<CrewPlugin, 'catalogId' | 'label' | 'blurb' | 'transport' | 'url' | 'appUrl' | 'command' | 'args' | 'keys'>
  >

export type ResolvedPlugin<T extends PluginReference = CrewPlugin> = T & {
  catalogId?: string
  label: string
  blurb: string
  transport: PluginTransport
  trusted: boolean
  authentication: PluginAuthentication
  allowedOrigins: readonly string[]
  documentationUrl?: string
  catalogTransport: PluginCatalogTransport | null
  launch: PluginLaunch
  packageId?: string
}

export type McpServer =
  | { type: 'http'; url: string; headers?: Record<string, string> }
  | { command: string; args?: string[]; env?: Record<string, string> }

export const PLUGIN_LIMIT = 24
export const PLUGIN_NAME_LIMIT = 40
export const PLUGIN_BLURB_LIMIT = 80
export const PLUGIN_ARG_LIMIT = 12

export const PLUGIN_FULL = `The crew has as many plugins as it can hold. Take one out before adding another.`

export const cleanPluginName = (raw: unknown): string =>
  typeof raw === 'string'
    ? raw
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, PLUGIN_NAME_LIMIT)
    : ''

const line = (raw: unknown, limit: number): string =>
  typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, limit) : ''

const args = (raw: unknown): string[] =>
  Array.isArray(raw)
    ? raw.filter((one): one is string => typeof one === 'string' && one.trim().length > 0).slice(0, PLUGIN_ARG_LIMIT)
    : []

const keys = (raw: unknown): PluginKey[] =>
  Array.isArray(raw)
    ? raw
        .map(one => ({
          name: cleanPluginName((one as PluginKey)?.name)
            .toUpperCase()
            .replace(/-/g, '_'),
          label: line((one as PluginKey)?.label, PLUGIN_NAME_LIMIT)
        }))
        .filter(one => one.name.length > 0)
        .slice(0, PLUGIN_ARG_LIMIT)
    : []

const address = (raw: unknown): string => {
  const said = line(raw, 400)
  if (!said) return ''
  try {
    const url = new URL(said)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : ''
  } catch {
    return ''
  }
}

const offerFromCatalog = (plugin: PluginCatalogEntry): PluginOffer => {
  const base = {
    catalogId: plugin.id,
    group: plugin.group,
    name: plugin.name,
    label: plugin.label,
    blurb: plugin.blurb,
    ...(plugin.launch.kind === 'browser' ? { appUrl: plugin.launch.url } : {})
  }
  if (plugin.transport.kind === 'http') {
    return { ...base, transport: 'http', url: plugin.transport.url }
  }
  return {
    ...base,
    transport: 'stdio',
    command: 'npx',
    args: ['-y', `${plugin.transport.packageName}@${plugin.transport.version}`]
  }
}

export const PLUGIN_OFFERS: readonly PluginOffer[] = PLUGIN_CATALOG.map(offerFromCatalog)

const originsOf = (plugin: PluginReference): string[] => {
  const values = [plugin.url, plugin.appUrl]
  const found = new Set<string>()
  for (const value of values) {
    if (!value) continue
    try {
      found.add(new URL(value).origin)
    } catch {}
  }
  return [...found]
}

export function resolvePlugin<T extends PluginReference>(plugin: T): ResolvedPlugin<T> {
  const catalog = catalogPlugin(plugin.catalogId ?? plugin.name)
  if (!catalog) {
    const appUrl = address(plugin.appUrl)
    const launch: PluginLaunch = appUrl
      ? {
          kind: 'browser',
          url: appUrl,
          reuse: 'plugin',
          routes: [{ origin: new URL(appUrl).origin, paths: ['/'] }]
        }
      : { kind: 'none' }
    return {
      ...plugin,
      label: plugin.label || plugin.name,
      blurb: plugin.blurb ?? '',
      transport: plugin.transport ?? (plugin.url ? 'http' : 'stdio'),
      trusted: false,
      authentication: plugin.keys?.length ? 'keys' : 'none',
      allowedOrigins: originsOf(plugin),
      catalogTransport: null,
      launch
    } as ResolvedPlugin<T>
  }
  const offer = offerFromCatalog(catalog)
  const { url: _url, appUrl: _appUrl, command: _command, args: _args, keys: _keys, ...saved } = plugin
  const { group: _group, ...canonical } = offer
  return {
    ...saved,
    ...canonical,
    trusted: true,
    authentication: catalog.authentication,
    allowedOrigins: catalog.allowedOrigins,
    documentationUrl: catalog.documentationUrl,
    catalogTransport: catalog.transport,
    launch: catalog.launch,
    ...(catalog.transport.kind === 'stdio' ? { packageId: catalog.transport.packageId } : {})
  } as ResolvedPlugin<T>
}

export const resolvePlugins = <T extends PluginReference>(plugins: readonly T[]): ResolvedPlugin<T>[] =>
  plugins.map(resolvePlugin)

export const pluginCanLaunch = (plugin: PluginReference): boolean => resolvePlugin(plugin).launch.kind === 'browser'

export const pluginOwnsUrl = (plugin: PluginReference, raw: string): boolean => {
  const launch = resolvePlugin(plugin).launch
  if (launch.kind !== 'browser') return false
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  return launch.routes.some(
    route =>
      route.origin === url.origin &&
      route.paths.some(path => (path.endsWith('/') ? url.pathname.startsWith(path) : url.pathname === path))
  )
}

export const pluginApprovalTarget = (plugin: PluginReference): string | null => {
  const resolved = resolvePlugin(plugin)
  if (resolved.trusted) return null
  if (resolved.transport === 'http' && resolved.url) {
    try {
      return `origin:${new URL(resolved.url).origin}`
    } catch {
      return null
    }
  }
  if (resolved.command) return `command:${JSON.stringify([resolved.command, ...(resolved.args ?? [])])}`
  return null
}

export const pluginApprovalFingerprint = async (plugin: PluginReference): Promise<string | null> => {
  const target = pluginApprovalTarget(plugin)
  if (!target) return null
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(target))
  return `sha256:${[...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')}`
}

export function cleanPlugin(raw: unknown): Omit<CrewPlugin, 'id' | 'by' | 'ts'> | null {
  const said = raw as Partial<CrewPlugin> | null
  if (!said) return null
  const name = cleanPluginName(said.name)
  if (!name) return null
  const catalog = catalogPlugin(said.catalogId ?? name)
  if (catalog) {
    return { catalogId: catalog.id, name: catalog.name }
  }
  const label = line(said.label, PLUGIN_NAME_LIMIT) || name
  const blurb = line(said.blurb, PLUGIN_BLURB_LIMIT)
  const held = keys(said.keys)
  const url = address(said.url)
  const appUrl = address(said.appUrl)
  if (url) {
    return {
      name,
      label,
      blurb,
      transport: 'http',
      url,
      ...(appUrl ? { appUrl } : {}),
      ...(held.length ? { keys: held } : {})
    }
  }
  const command = line(said.command, 200)
  if (!command) return null
  const rest = args(said.args)
  return {
    name,
    label,
    blurb,
    transport: 'stdio',
    command,
    ...(rest.length ? { args: rest } : {}),
    ...(appUrl ? { appUrl } : {}),
    ...(held.length ? { keys: held } : {})
  }
}

export const pluginKey = (name: string): string => cleanPluginName(name)

export function pluginFrom(label: string, where: string): Partial<CrewPlugin> {
  const said = where.trim()
  const name = cleanPluginName(label) || cleanPluginName(said.split(/[\s/]+/).pop() ?? '')
  if (/^https?:\/\//i.test(said)) return { name, label: label.trim(), url: said }
  const [command, ...args] = said.split(/\s+/)
  return { name, label: label.trim(), command, args }
}

export function mcpServersOf(
  plugins: readonly CrewPlugin[],
  secrets: Readonly<Record<string, string>> = {},
  headers: Readonly<Record<string, Record<string, string>>> = {}
): Record<string, McpServer> {
  const out: Record<string, McpServer> = {}
  for (const saved of plugins.slice(0, PLUGIN_LIMIT)) {
    const plugin = resolvePlugin(saved)
    const wanted = plugin.keys ?? []
    const env: Record<string, string> = {}
    for (const key of wanted) {
      const value = secrets[`${plugin.name}:${key.name}`] ?? secrets[key.name] ?? ''
      if (value) env[key.name] = value
    }
    if (wanted.some(key => !env[key.name])) continue
    if (plugin.transport === 'http') {
      const pluginHeaders = headers[plugin.name]
      if (plugin.url) {
        out[plugin.name] = {
          type: 'http',
          url: plugin.url,
          ...(pluginHeaders && Object.keys(pluginHeaders).length ? { headers: pluginHeaders } : {})
        }
      }
      continue
    }
    if (!plugin.command) continue
    out[plugin.name] = {
      command: plugin.command,
      ...(plugin.args?.length ? { args: plugin.args } : {}),
      ...(Object.keys(env).length ? { env } : {})
    }
  }
  return out
}

export const offerOf = (name: string): PluginOffer | undefined => {
  const plugin = catalogPlugin(name)
  return plugin ? offerFromCatalog(plugin) : undefined
}

export const pluginNamed = (value: string, plugins: readonly CrewPlugin[]): CrewPlugin | null => {
  const match = /^\/(\S+)\s*$/.exec(value)
  if (!match) return null
  const name = pluginKey(match[1])
  return plugins.find(plugin => pluginKey(plugin.name) === name) ?? null
}

export const pluginTyped = (value: string, plugins: readonly CrewPlugin[]): CrewPlugin | null =>
  /\s$/.test(value) ? pluginNamed(value, plugins) : null

export const pluginMenuInput = (value: string): boolean => /^\/plugin(?:\s.*)?$/i.test(value)

export const offerForAppUrl = (raw: string): PluginOffer | undefined => {
  const plugin = catalogPluginForUrl(raw)
  return plugin ? offerFromCatalog(plugin) : undefined
}

export { PLUGIN_CATALOG, PLUGIN_GROUPS }
export type { PluginAuthentication, PluginCatalogEntry, PluginCatalogTransport, PluginLaunch }
