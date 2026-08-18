export type PluginTransport = 'stdio' | 'http'

export interface PluginKey {
  name: string
  label: string
}

export interface CrewPlugin {
  id: string
  name: string
  label: string
  blurb: string
  transport: PluginTransport
  url?: string
  appUrl?: string
  command?: string
  args?: string[]
  keys?: PluginKey[]
  by: string
  byAgentId?: string
  ts: number
}

export type PluginOffer = Omit<CrewPlugin, 'id' | 'by' | 'byAgentId' | 'ts'> & { group: string }

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

export function cleanPlugin(raw: unknown): Omit<CrewPlugin, 'id' | 'by' | 'ts'> | null {
  const said = raw as Partial<CrewPlugin> | null
  if (!said) return null
  const name = cleanPluginName(said.name)
  if (!name) return null
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
  secrets: Readonly<Record<string, string>> = {}
): Record<string, McpServer> {
  const out: Record<string, McpServer> = {}
  for (const plugin of plugins.slice(0, PLUGIN_LIMIT)) {
    const wanted = plugin.keys ?? []
    const env: Record<string, string> = {}
    for (const key of wanted) {
      const value = secrets[`${plugin.name}:${key.name}`] ?? secrets[key.name] ?? ''
      if (value) env[key.name] = value
    }
    if (wanted.some(key => !env[key.name])) continue
    if (plugin.transport === 'http') {
      if (plugin.url) out[plugin.name] = { type: 'http', url: plugin.url }
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

export const PLUGIN_OFFERS: readonly PluginOffer[] = [
  {
    group: 'Video',
    name: 'raylight',
    label: 'Raylight',
    blurb: 'Make and edit product videos',
    transport: 'http',
    url: 'https://api.raylight.app/mcp',
    appUrl: 'https://www.raylight.app/projects'
  },
  {
    group: 'Design',
    name: 'figma',
    label: 'Figma',
    blurb: 'Read a file, a frame or a component',
    transport: 'http',
    url: 'https://mcp.figma.com/mcp'
  },
  {
    group: 'Design',
    name: 'figma-desktop',
    label: 'Figma on this computer',
    blurb: 'Read whatever is open in the desktop app',
    transport: 'http',
    url: 'http://127.0.0.1:3845/mcp'
  },
  {
    group: 'Design',
    name: 'canva',
    label: 'Canva',
    blurb: 'Read a design, or start a new one',
    transport: 'http',
    url: 'https://mcp.canva.com/mcp'
  },
  {
    group: 'Code',
    name: 'github',
    label: 'GitHub',
    blurb: 'Issues, pull requests and what the checks said',
    transport: 'http',
    url: 'https://api.githubcopilot.com/mcp/'
  },
  {
    group: 'Code',
    name: 'sentry',
    label: 'Sentry',
    blurb: 'The errors people are hitting',
    transport: 'http',
    url: 'https://mcp.sentry.dev/mcp'
  },
  {
    group: 'Code',
    name: 'context7',
    label: 'Context7',
    blurb: 'The docs for a library, at the version you are on',
    transport: 'http',
    url: 'https://mcp.context7.com/mcp'
  },
  {
    group: 'Code',
    name: 'playwright',
    label: 'Playwright',
    blurb: 'Open a page and click through it',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@playwright/mcp@latest']
  },
  {
    group: 'Code',
    name: 'chrome-devtools',
    label: 'Chrome DevTools',
    blurb: 'The console, the network and what made the page slow',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', 'chrome-devtools-mcp@latest']
  },
  {
    group: 'Code',
    name: 'deepwiki',
    label: 'DeepWiki',
    blurb: 'How a public repo on GitHub works',
    transport: 'http',
    url: 'https://mcp.deepwiki.com/mcp'
  },
  {
    group: 'Hosting',
    name: 'vercel',
    label: 'Vercel',
    blurb: 'The deployments, and why one failed',
    transport: 'http',
    url: 'https://mcp.vercel.com'
  },
  {
    group: 'Hosting',
    name: 'netlify',
    label: 'Netlify',
    blurb: 'The sites, and what each one is set to',
    transport: 'http',
    url: 'https://netlify-mcp.netlify.app/mcp'
  },
  {
    group: 'Hosting',
    name: 'cloudflare',
    label: 'Cloudflare',
    blurb: 'Workers, DNS, R2 and the rest of the account',
    transport: 'http',
    url: 'https://mcp.cloudflare.com/mcp'
  },
  {
    group: 'Hosting',
    name: 'supabase',
    label: 'Supabase',
    blurb: 'The database, and what is in it',
    transport: 'http',
    url: 'https://mcp.supabase.com/mcp'
  },
  {
    group: 'Work',
    name: 'linear',
    label: 'Linear',
    blurb: 'The issues and what is on them',
    transport: 'http',
    url: 'https://mcp.linear.app/sse'
  },
  {
    group: 'Work',
    name: 'notion',
    label: 'Notion',
    blurb: 'Read and write the pages',
    transport: 'http',
    url: 'https://mcp.notion.com/mcp'
  },
  {
    group: 'Work',
    name: 'slack',
    label: 'Slack',
    blurb: 'Read a channel and say something in it',
    transport: 'http',
    url: 'https://mcp.slack.com/mcp'
  },
  {
    group: 'Work',
    name: 'atlassian',
    label: 'Atlassian',
    blurb: 'The Jira tickets and the Confluence pages',
    transport: 'http',
    url: 'https://mcp.atlassian.com/v1/mcp'
  },
  {
    group: 'Work',
    name: 'asana',
    label: 'Asana',
    blurb: 'The tasks and who they are on',
    transport: 'http',
    url: 'https://mcp.asana.com/mcp'
  },
  {
    group: 'Work',
    name: 'intercom',
    label: 'Intercom',
    blurb: 'What people asked support, and what was said back',
    transport: 'http',
    url: 'https://mcp.intercom.com/mcp'
  },
  {
    group: 'Work',
    name: 'airtable',
    label: 'Airtable',
    blurb: 'The bases, and the rows in them',
    transport: 'http',
    url: 'https://mcp.airtable.com/mcp'
  },
  {
    group: 'Work',
    name: 'stripe',
    label: 'Stripe',
    blurb: 'Payments, customers and what they were charged',
    transport: 'http',
    url: 'https://mcp.stripe.com'
  }
]

export const offerOf = (name: string): PluginOffer | undefined =>
  PLUGIN_OFFERS.find(one => one.name === pluginKey(name))

export const pluginTyped = (value: string, plugins: readonly CrewPlugin[]): CrewPlugin | null => {
  const match = /^\/(\S+)\s$/.exec(value)
  if (!match) return null
  const name = pluginKey(match[1])
  return plugins.find(plugin => pluginKey(plugin.name) === name && Boolean(plugin.appUrl)) ?? null
}

export const offerForAppUrl = (raw: string): PluginOffer | undefined => {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return undefined
  }
  return PLUGIN_OFFERS.find(offer => {
    if (!offer.appUrl) return false
    const app = new URL(offer.appUrl)
    return url.protocol === app.protocol && url.hostname === app.hostname
  })
}

export const PLUGIN_GROUPS: readonly string[] = [...new Set(PLUGIN_OFFERS.map(one => one.group))]
