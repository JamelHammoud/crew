export type PluginAuthentication = 'keys' | 'none' | 'oauth'

export type PluginCatalogTransport =
  | { kind: 'http'; protocol: 'streamable-http'; url: string }
  | { kind: 'stdio'; packageId: string; packageName: string; version: string }

export type PluginLaunch =
  | { kind: 'none' }
  | {
      kind: 'browser'
      url: string
      reuse: 'plugin'
      routes: readonly { origin: string; paths: readonly string[] }[]
    }

export interface PluginCatalogEntry {
  id: string
  name: string
  label: string
  blurb: string
  group: string
  authentication: PluginAuthentication
  allowedOrigins: readonly string[]
  documentationUrl: string
  transport: PluginCatalogTransport
  launch: PluginLaunch
}

const none = { kind: 'none' } as const

export const PLUGIN_CATALOG: readonly PluginCatalogEntry[] = [
  {
    id: 'raylight',
    name: 'raylight',
    label: 'Raylight',
    blurb: 'Make and edit product videos',
    group: 'Video',
    authentication: 'oauth',
    allowedOrigins: ['https://api.raylight.app', 'https://www.raylight.app', 'https://raylight.app'],
    documentationUrl: 'https://www.raylight.app',
    transport: { kind: 'http', protocol: 'streamable-http', url: 'https://api.raylight.app/mcp' },
    launch: {
      kind: 'browser',
      url: 'https://www.raylight.app/projects',
      reuse: 'plugin',
      routes: [
        { origin: 'https://www.raylight.app', paths: ['/projects', '/editor/'] },
        { origin: 'https://raylight.app', paths: ['/projects', '/editor/'] }
      ]
    }
  },
  {
    id: 'figma',
    name: 'figma',
    label: 'Figma',
    blurb: 'Read whatever is open in the desktop app',
    group: 'Design',
    authentication: 'none',
    allowedOrigins: ['http://127.0.0.1:3845'],
    documentationUrl: 'https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Dev-Mode-MCP-Server',
    transport: { kind: 'http', protocol: 'streamable-http', url: 'http://127.0.0.1:3845/mcp' },
    launch: none
  },
  {
    id: 'canva',
    name: 'canva',
    label: 'Canva',
    blurb: 'Read a design, or start a new one',
    group: 'Design',
    authentication: 'oauth',
    allowedOrigins: ['https://mcp.canva.com'],
    documentationUrl: 'https://www.canva.dev/docs/connect/mcp-server/',
    transport: { kind: 'http', protocol: 'streamable-http', url: 'https://mcp.canva.com/mcp' },
    launch: none
  },
  {
    id: 'frontpages',
    name: 'frontpages',
    label: 'Frontpages',
    blurb: 'Landing pages worth looking at before you design one',
    group: 'Design',
    authentication: 'none',
    allowedOrigins: ['https://ecagaenecamdrvwcsuaz.supabase.co', 'https://frontpages.dev'],
    documentationUrl: 'https://frontpages.dev',
    transport: {
      kind: 'http',
      protocol: 'streamable-http',
      url: 'https://ecagaenecamdrvwcsuaz.supabase.co/functions/v1/mcp-server'
    },
    launch: {
      kind: 'browser',
      url: 'https://frontpages.dev',
      reuse: 'plugin',
      routes: [{ origin: 'https://frontpages.dev', paths: ['/'] }]
    }
  },
  {
    id: 'sentry',
    name: 'sentry',
    label: 'Sentry',
    blurb: 'The errors people are hitting',
    group: 'Code',
    authentication: 'oauth',
    allowedOrigins: ['https://mcp.sentry.dev'],
    documentationUrl: 'https://docs.sentry.io/product/sentry-mcp/',
    transport: { kind: 'http', protocol: 'streamable-http', url: 'https://mcp.sentry.dev/mcp' },
    launch: none
  },
  {
    id: 'context7',
    name: 'context7',
    label: 'Context7',
    blurb: 'The docs for a library, at the version you are on',
    group: 'Code',
    authentication: 'none',
    allowedOrigins: ['https://mcp.context7.com'],
    documentationUrl: 'https://context7.com/docs/overview',
    transport: { kind: 'http', protocol: 'streamable-http', url: 'https://mcp.context7.com/mcp' },
    launch: none
  },
  {
    id: 'playwright',
    name: 'playwright',
    label: 'Playwright',
    blurb: 'Open a page and click through it',
    group: 'Code',
    authentication: 'none',
    allowedOrigins: [],
    documentationUrl: 'https://github.com/microsoft/playwright-mcp',
    transport: {
      kind: 'stdio',
      packageId: 'playwright-mcp',
      packageName: '@playwright/mcp',
      version: '0.0.79'
    },
    launch: none
  },
  {
    id: 'chrome-devtools',
    name: 'chrome-devtools',
    label: 'Chrome DevTools',
    blurb: 'The console, the network and what made the page slow',
    group: 'Code',
    authentication: 'none',
    allowedOrigins: [],
    documentationUrl: 'https://github.com/ChromeDevTools/chrome-devtools-mcp',
    transport: {
      kind: 'stdio',
      packageId: 'chrome-devtools-mcp',
      packageName: 'chrome-devtools-mcp',
      version: '1.7.0'
    },
    launch: none
  },
  {
    id: 'deepwiki',
    name: 'deepwiki',
    label: 'DeepWiki',
    blurb: 'How a public repo on GitHub works',
    group: 'Code',
    authentication: 'none',
    allowedOrigins: ['https://mcp.deepwiki.com'],
    documentationUrl: 'https://docs.devin.ai/work-with-devin/deepwiki-mcp',
    transport: { kind: 'http', protocol: 'streamable-http', url: 'https://mcp.deepwiki.com/mcp' },
    launch: none
  },
  {
    id: 'vercel',
    name: 'vercel',
    label: 'Vercel',
    blurb: 'The deployments, and why one failed',
    group: 'Hosting',
    authentication: 'oauth',
    allowedOrigins: ['https://mcp.vercel.com'],
    documentationUrl: 'https://vercel.com/docs/mcp/vercel-mcp',
    transport: { kind: 'http', protocol: 'streamable-http', url: 'https://mcp.vercel.com' },
    launch: none
  },
  {
    id: 'netlify',
    name: 'netlify',
    label: 'Netlify',
    blurb: 'The sites, and what each one is set to',
    group: 'Hosting',
    authentication: 'oauth',
    allowedOrigins: ['https://netlify-mcp.netlify.app'],
    documentationUrl: 'https://docs.netlify.com/welcome/build-with-ai/netlify-mcp-server/',
    transport: { kind: 'http', protocol: 'streamable-http', url: 'https://netlify-mcp.netlify.app/mcp' },
    launch: none
  },
  {
    id: 'cloudflare',
    name: 'cloudflare',
    label: 'Cloudflare',
    blurb: 'Workers, DNS, R2 and the rest of the account',
    group: 'Hosting',
    authentication: 'oauth',
    allowedOrigins: ['https://mcp.cloudflare.com'],
    documentationUrl: 'https://developers.cloudflare.com/agents/model-context-protocol/mcp-servers-for-cloudflare/',
    transport: { kind: 'http', protocol: 'streamable-http', url: 'https://mcp.cloudflare.com/mcp' },
    launch: none
  },
  {
    id: 'supabase',
    name: 'supabase',
    label: 'Supabase',
    blurb: 'The database, and what is in it',
    group: 'Hosting',
    authentication: 'oauth',
    allowedOrigins: ['https://mcp.supabase.com'],
    documentationUrl: 'https://supabase.com/docs/guides/getting-started/mcp',
    transport: { kind: 'http', protocol: 'streamable-http', url: 'https://mcp.supabase.com/mcp' },
    launch: none
  },
  {
    id: 'linear',
    name: 'linear',
    label: 'Linear',
    blurb: 'The issues and what is on them',
    group: 'Work',
    authentication: 'oauth',
    allowedOrigins: ['https://mcp.linear.app'],
    documentationUrl: 'https://linear.app/docs/mcp',
    transport: { kind: 'http', protocol: 'streamable-http', url: 'https://mcp.linear.app/mcp' },
    launch: none
  },
  {
    id: 'notion',
    name: 'notion',
    label: 'Notion',
    blurb: 'Read and write the pages',
    group: 'Work',
    authentication: 'oauth',
    allowedOrigins: ['https://mcp.notion.com'],
    documentationUrl: 'https://developers.notion.com/docs/mcp',
    transport: { kind: 'http', protocol: 'streamable-http', url: 'https://mcp.notion.com/mcp' },
    launch: none
  },
  {
    id: 'atlassian',
    name: 'atlassian',
    label: 'Atlassian',
    blurb: 'The Jira tickets and the Confluence pages',
    group: 'Work',
    authentication: 'oauth',
    allowedOrigins: ['https://mcp.atlassian.com'],
    documentationUrl: 'https://support.atlassian.com/atlassian-rovo-mcp-server/',
    transport: { kind: 'http', protocol: 'streamable-http', url: 'https://mcp.atlassian.com/v1/mcp/authv2' },
    launch: none
  },
  {
    id: 'asana',
    name: 'asana',
    label: 'Asana',
    blurb: 'The tasks and who they are on',
    group: 'Work',
    authentication: 'oauth',
    allowedOrigins: ['https://mcp.asana.com'],
    documentationUrl: 'https://developers.asana.com/docs/using-asanas-mcp-server',
    transport: { kind: 'http', protocol: 'streamable-http', url: 'https://mcp.asana.com/mcp' },
    launch: none
  },
  {
    id: 'intercom',
    name: 'intercom',
    label: 'Intercom',
    blurb: 'What people asked support, and what was said back',
    group: 'Work',
    authentication: 'oauth',
    allowedOrigins: ['https://mcp.intercom.com'],
    documentationUrl: 'https://developers.intercom.com/docs/guides/mcp',
    transport: { kind: 'http', protocol: 'streamable-http', url: 'https://mcp.intercom.com/mcp' },
    launch: none
  },
  {
    id: 'airtable',
    name: 'airtable',
    label: 'Airtable',
    blurb: 'The bases, and the rows in them',
    group: 'Work',
    authentication: 'oauth',
    allowedOrigins: ['https://mcp.airtable.com'],
    documentationUrl: 'https://support.airtable.com/docs/airtable-mcp-server',
    transport: { kind: 'http', protocol: 'streamable-http', url: 'https://mcp.airtable.com/mcp' },
    launch: none
  },
  {
    id: 'stripe',
    name: 'stripe',
    label: 'Stripe',
    blurb: 'Payments, customers and what they were charged',
    group: 'Work',
    authentication: 'oauth',
    allowedOrigins: ['https://mcp.stripe.com'],
    documentationUrl: 'https://docs.stripe.com/mcp',
    transport: { kind: 'http', protocol: 'streamable-http', url: 'https://mcp.stripe.com' },
    launch: none
  }
]

const key = (value: string): string => value.trim().toLowerCase()
const aliases: Readonly<Record<string, string>> = { 'figma-desktop': 'figma' }

export const catalogPlugin = (value: string): PluginCatalogEntry | undefined => {
  const asked = key(value)
  const wanted = aliases[asked] ?? asked
  return PLUGIN_CATALOG.find(plugin => plugin.id === wanted || plugin.name === wanted)
}

export const catalogPluginForUrl = (raw: string): PluginCatalogEntry | undefined => {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return undefined
  }
  return PLUGIN_CATALOG.find(plugin => {
    if (plugin.launch.kind !== 'browser') return false
    return plugin.launch.routes.some(
      route =>
        url.origin === route.origin &&
        route.paths.some(path => (path.endsWith('/') ? url.pathname.startsWith(path) : url.pathname === path))
    )
  })
}

export const PLUGIN_GROUPS: readonly string[] = [...new Set(PLUGIN_CATALOG.map(plugin => plugin.group))]
