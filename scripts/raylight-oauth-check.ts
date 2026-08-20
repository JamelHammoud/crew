import { authorizePlugin, setPluginOauthPath } from '../src/runner/pluginOauth'
import { offerOf, resolvePlugin, type CrewPlugin } from '../src/shared/plugins'

const oauthPath = process.argv[2]
if (!oauthPath) throw new Error('Pass Crew’s plugin OAuth file path.')

const offer = offerOf('raylight')
if (!offer) throw new Error('Raylight is not in Crew’s plugin catalog.')

const plugin: CrewPlugin = {
  ...offer,
  id: 'raylight-live-check',
  by: 'Crew',
  ts: Date.now()
}

setPluginOauthPath(oauthPath)
const headers = await authorizePlugin(resolvePlugin(plugin))

const mcpUrl = offer.url
if (!mcpUrl) throw new Error('Raylight has no MCP address.')

const bodyOf = async (response: Response): Promise<any> => {
  const body = await response.text()
  try {
    return JSON.parse(body)
  } catch {}
  for (const line of body.split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue
    try {
      return JSON.parse(line.slice(5).trim())
    } catch {}
  }
  throw new Error('Raylight returned an unreadable MCP response.')
}

let sessionId = ''
let id = 0
const rpc = async (method: string, params: Record<string, unknown> = {}): Promise<any> => {
  const response = await fetch(mcpUrl, {
    method: 'POST',
    headers: {
      ...headers,
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      ...(sessionId ? { 'mcp-session-id': sessionId } : {})
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params })
  })
  if (!response.ok) throw new Error(`Raylight ${method} answered with ${response.status}.`)
  sessionId = response.headers.get('mcp-session-id') ?? sessionId
  return bodyOf(response)
}

await rpc('initialize', {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'Crew live check', version: '1' }
})

const ready = await fetch(mcpUrl, {
  method: 'POST',
  headers: {
    ...headers,
    accept: 'application/json, text/event-stream',
    'content-type': 'application/json',
    ...(sessionId ? { 'mcp-session-id': sessionId } : {})
  },
  body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} })
})
if (!ready.ok) throw new Error(`Raylight initialization answered with ${ready.status}.`)

const call = async (name: string): Promise<any> => {
  const answer = await rpc('tools/call', { name, arguments: {} })
  if (answer.error) throw new Error(answer.error.message || `${name} failed.`)
  if (answer.result?.isError) throw new Error(`${name} returned an error.`)
  return answer.result
}

const editor = await call('get_editor_status')
const projects = await call('list_projects')

console.log('Raylight OAuth and required MCP tools verified.')
console.log(JSON.stringify({ editor, projects }, null, 2))
