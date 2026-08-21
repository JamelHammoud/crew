import { createHash, randomBytes } from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { spawn } from 'node:child_process'
import {
  currentPluginInstallation,
  pluginKey,
  resolvePlugin,
  type CrewPlugin,
  type PluginReference,
  type ResolvedPlugin
} from '../shared/plugins'

interface OAuthCredential {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  clientId: string
  clientSecret?: string
  tokenMethod?: OAuthTokenMethod
  tokenEndpoint: string
  resource: string
  scope?: string
}

interface OAuthStore {
  version: 2
  connections: Record<
    string,
    {
      catalogId: string
      url?: string
      credential?: OAuthCredential
    }
  >
}

interface ProtectedResourceMetadata {
  resource?: string
  authorization_servers?: string[]
  scopes_supported?: string[]
}

interface AuthorizationMetadata {
  authorization_endpoint?: string
  token_endpoint?: string
  registration_endpoint?: string
  scopes_supported?: string[]
  token_endpoint_auth_methods_supported?: string[]
}

interface RegisteredClient {
  client_id?: string
  client_secret?: string
  token_endpoint_auth_method?: string
}

interface TokenAnswer {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  scope?: string
}

interface AuthorizationCode {
  code: Promise<string>
  redirectUri: string
  succeed: () => void
  fail: () => void
  close: () => void
}

type OAuthTokenMethod = 'none' | 'client_secret_post' | 'client_secret_basic'
type ConnectedPlugin = ResolvedPlugin<PluginReference>

export interface PluginOauthDeps {
  fetcher?: typeof fetch
  now?: () => number
  open?: (url: string) => Promise<void>
  timeoutMs?: number
}

const FILE_MODE = 0o600
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000
const TOKEN_MARGIN_MS = 60 * 1000
const PROTOCOL_VERSION = '2025-06-18'
const REQUIRED_RAYLIGHT_TOOLS = ['get_editor_status', 'list_projects']

let file: string | null = null
let cache: OAuthStore | null = null
const authorizing = new Map<string, Promise<Record<string, string>>>()

class Unauthorized extends Error {}

export function setPluginOauthPath(at: string): void {
  file = at
  cache = null
  read()
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '')

const number = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

const writtenCredential = (value: unknown): OAuthCredential | null => {
  const saved = value as Partial<OAuthCredential> | null
  if (
    !saved ||
    !text(saved.accessToken) ||
    !text(saved.clientId) ||
    !text(saved.tokenEndpoint) ||
    !text(saved.resource)
  ) {
    return null
  }
  return {
    accessToken: saved.accessToken!,
    clientId: saved.clientId!,
    ...(text(saved.clientSecret) ? { clientSecret: saved.clientSecret } : {}),
    ...(saved.tokenMethod === 'none' ||
    saved.tokenMethod === 'client_secret_post' ||
    saved.tokenMethod === 'client_secret_basic'
      ? { tokenMethod: saved.tokenMethod }
      : {}),
    tokenEndpoint: saved.tokenEndpoint!,
    resource: saved.resource!,
    ...(text(saved.refreshToken) ? { refreshToken: saved.refreshToken } : {}),
    ...(number(saved.expiresAt) !== undefined ? { expiresAt: saved.expiresAt } : {}),
    ...(text(saved.scope) ? { scope: saved.scope } : {})
  }
}

const quarantine = (): void => {
  if (!file) return
  try {
    fs.renameSync(file, `${file}.corrupt-${Date.now()}`)
  } catch {}
}

const read = (): OAuthStore => {
  if (cache) return cache
  if (!file) return (cache = { version: 2, connections: {} })
  let parsed: unknown
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException)?.code !== 'ENOENT') quarantine()
    return (cache = { version: 2, connections: {} })
  }
  const body = parsed as Partial<OAuthStore> | null
  if ((parsed as { version?: number } | null)?.version === 1) {
    const fresh: OAuthStore = { version: 2, connections: {} }
    write(fresh)
    return fresh
  }
  if (body?.version !== 2 || !body.connections || typeof body.connections !== 'object') {
    quarantine()
    return (cache = { version: 2, connections: {} })
  }
  const connections: OAuthStore['connections'] = {}
  for (const [installationId, raw] of Object.entries(body.connections)) {
    if (!currentPluginInstallation({ installationId, installationVersion: 2 })) continue
    const said = raw as { catalogId?: unknown; url?: unknown; credential?: unknown } | null
    const catalogId = text(said?.catalogId)
    if (!catalogId) continue
    const credential = writtenCredential(said?.credential)
    connections[installationId] = {
      catalogId,
      ...(text(said?.url) ? { url: text(said?.url) } : {}),
      ...(credential ? { credential } : {})
    }
  }
  return (cache = { version: 2, connections })
}

const write = (store: OAuthStore): void => {
  cache = store
  if (!file) return
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const temporary = `${file}.tmp`
  fs.writeFileSync(temporary, JSON.stringify(store, null, 2), { mode: FILE_MODE })
  fs.chmodSync(temporary, FILE_MODE)
  fs.renameSync(temporary, file)
}

const remember = (plugin: ConnectedPlugin, credential?: OAuthCredential): void => {
  if (!currentPluginInstallation(plugin) || !plugin.catalogId) return
  const store = read()
  write({
    version: 2,
    connections: {
      ...store.connections,
      [plugin.installationId]: {
        catalogId: plugin.catalogId,
        ...(plugin.url ? { url: plugin.url } : {}),
        ...(credential ? { credential } : {})
      }
    }
  })
}

const savedConnection = (plugin: ConnectedPlugin): OAuthStore['connections'][string] | undefined => {
  if (!currentPluginInstallation(plugin) || !plugin.catalogId) return undefined
  const connection = read().connections[plugin.installationId]
  if (!connection || connection.catalogId !== plugin.catalogId || connection.url !== plugin.url) return undefined
  return connection
}

const metadataUrl = (resource: URL): string =>
  new URL(
    `/.well-known/oauth-protected-resource${resource.pathname === '/' ? '' : resource.pathname}`,
    resource.origin
  ).toString()

const authorizationMetadataUrl = (issuer: URL): string =>
  new URL(
    `/.well-known/oauth-authorization-server${issuer.pathname === '/' ? '' : issuer.pathname}`,
    issuer.origin
  ).toString()

const metadata = async <T>(url: string, fetcher: typeof fetch): Promise<T | null> => {
  try {
    const response = await fetcher(url, { headers: { accept: 'application/json' } })
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    return null
  }
}

const json = async <T>(response: Response, label: string): Promise<T> => {
  if (!response.ok) throw new Error(`${label} answered with ${response.status}.`)
  try {
    return (await response.json()) as T
  } catch {
    throw new Error(`${label} did not return JSON.`)
  }
}

const discover = async (
  url: string,
  fetcher: typeof fetch
): Promise<{ resource: string; scopes: string[]; authorization: AuthorizationMetadata }> => {
  const mcp = new URL(url)
  const protectedUrls = [...new Set([metadataUrl(mcp), new URL('/.well-known/oauth-protected-resource', mcp).toString()])]
  let protectedResource: ProtectedResourceMetadata | null = null
  for (const candidate of protectedUrls) {
    protectedResource = await metadata<ProtectedResourceMetadata>(candidate, fetcher)
    if (protectedResource?.authorization_servers?.length) break
  }
  const issuer = protectedResource?.authorization_servers?.[0] ?? mcp.origin
  const issuerUrl = new URL(issuer)
  const authorizationUrls = [
    ...new Set([
      authorizationMetadataUrl(issuerUrl),
      new URL('/.well-known/oauth-authorization-server', issuerUrl).toString()
    ])
  ]
  let authorization: AuthorizationMetadata | null = null
  for (const candidate of authorizationUrls) {
    authorization = await metadata<AuthorizationMetadata>(candidate, fetcher)
    if (authorization?.authorization_endpoint && authorization.token_endpoint) break
  }
  if (!authorization) throw new Error('The plugin did not say where to sign in.')
  if (!authorization.authorization_endpoint || !authorization.token_endpoint || !authorization.registration_endpoint) {
    throw new Error('The plugin account did not provide a complete sign-in.')
  }
  return {
    resource: protectedResource?.resource || url,
    scopes: protectedResource?.scopes_supported ?? authorization.scopes_supported ?? [],
    authorization
  }
}

const base64Url = (value: Buffer): string => value.toString('base64url')

const openExternal = async (url: string): Promise<void> => {
  const invocation =
    process.platform === 'darwin'
      ? { command: 'open', args: [url] }
      : process.platform === 'win32'
        ? { command: 'rundll32.exe', args: ['url.dll,FileProtocolHandler', url] }
        : { command: 'xdg-open', args: [url] }
  await new Promise<void>((resolve, reject) => {
    const child = spawn(invocation.command, invocation.args, { detached: true, stdio: 'ignore' })
    child.once('spawn', () => {
      child.unref()
      resolve()
    })
    child.once('error', reject)
  })
}

const callback = async (state: string, label: string, timeoutMs: number): Promise<AuthorizationCode> => {
  let resolveCode: (code: string) => void = () => {}
  let rejectCode: (cause: Error) => void = () => {}
  const code = new Promise<string>((resolve, reject) => {
    resolveCode = resolve
    rejectCode = reject
  })
  let timer: NodeJS.Timeout | null = null
  let settled = false
  let waiting: http.ServerResponse | null = null
  const finish = (ok: boolean): void => {
    if (!waiting) return
    waiting
      .writeHead(ok ? 200 : 400, { 'content-type': 'text/plain; charset=utf-8' })
      .end(
        ok
          ? `${label} is connected to Crew. You can return to Crew.`
          : `${label} did not connect to Crew. Return to Crew and try again.`
      )
    waiting = null
  }
  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    if (url.pathname !== '/callback') {
      response.writeHead(404).end()
      return
    }
    const error = url.searchParams.get('error')
    const returnedState = url.searchParams.get('state')
    const returnedCode = url.searchParams.get('code')
    if (error || returnedState !== state || !returnedCode) {
      response
        .writeHead(400, { 'content-type': 'text/plain; charset=utf-8' })
        .end(`${label} did not connect to Crew. Return to Crew and try again.`)
      if (!settled) rejectCode(new Error(error || 'The plugin sign-in could not be verified.'))
    } else {
      waiting = response
      if (!settled) resolveCode(returnedCode)
    }
    settled = true
    if (timer) clearTimeout(timer)
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') {
    server.close()
    throw new Error('Crew could not open the plugin sign-in.')
  }
  timer = setTimeout(() => {
    if (settled) return
    settled = true
    rejectCode(new Error(`The ${label} sign-in timed out. Try again when you are ready to sign in.`))
    server.close()
  }, timeoutMs)
  return {
    code,
    redirectUri: `http://127.0.0.1:${address.port}/callback`,
    succeed: () => finish(true),
    fail: () => finish(false),
    close: () => {
      if (timer) clearTimeout(timer)
      finish(false)
      server.close()
    }
  }
}

const tokenMethod = (authorization: AuthorizationMetadata): OAuthTokenMethod => {
  const methods = authorization.token_endpoint_auth_methods_supported ?? ['none']
  if (methods.includes('none')) return 'none'
  if (methods.includes('client_secret_post')) return 'client_secret_post'
  if (methods.includes('client_secret_basic')) return 'client_secret_basic'
  throw new Error('The plugin account does not support a sign-in Crew can use.')
}

const register = async (
  endpoint: string,
  redirectUri: string,
  method: OAuthTokenMethod,
  fetcher: typeof fetch
): Promise<RegisteredClient> =>
  json<RegisteredClient>(
    await fetcher(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        client_name: 'Crew',
        redirect_uris: [redirectUri],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: method,
        application_type: 'native'
      })
    }),
    'The plugin sign-in'
  )

const token = async (
  endpoint: string,
  values: Record<string, string>,
  fetcher: typeof fetch,
  method: OAuthTokenMethod = 'none',
  clientSecret?: string
): Promise<TokenAnswer> => {
  const body = { ...values }
  const headers: Record<string, string> = {
    'content-type': 'application/x-www-form-urlencoded',
    accept: 'application/json'
  }
  if (method === 'client_secret_post' && clientSecret) body.client_secret = clientSecret
  if (method === 'client_secret_basic' && clientSecret) {
    const clientId = body.client_id ?? ''
    delete body.client_id
    headers.authorization = `Basic ${Buffer.from(`${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`).toString('base64')}`
  }
  return json<TokenAnswer>(
    await fetcher(endpoint, { method: 'POST', headers, body: new URLSearchParams(body) }),
    'The plugin sign-in'
  )
}

const credentialFrom = (
  answer: TokenAnswer,
  clientId: string,
  clientSecret: string | undefined,
  tokenMethod: OAuthTokenMethod,
  tokenEndpoint: string,
  resource: string,
  now: number,
  previous?: OAuthCredential
): OAuthCredential => {
  if (!answer.access_token) throw new Error('The plugin sign-in returned no access token.')
  return {
    accessToken: answer.access_token,
    clientId,
    ...(clientSecret ? { clientSecret } : {}),
    ...(tokenMethod !== 'none' ? { tokenMethod } : {}),
    tokenEndpoint,
    resource,
    ...(answer.refresh_token || previous?.refreshToken
      ? { refreshToken: answer.refresh_token || previous?.refreshToken }
      : {}),
    ...(typeof answer.expires_in === 'number' ? { expiresAt: now + answer.expires_in * 1000 } : {}),
    ...(answer.scope || previous?.scope ? { scope: answer.scope || previous?.scope } : {})
  }
}

const refresh = async (saved: OAuthCredential, fetcher: typeof fetch, now: number): Promise<OAuthCredential | null> => {
  if (!saved.refreshToken) return null
  try {
    const answer = await token(
      saved.tokenEndpoint,
      {
        grant_type: 'refresh_token',
        refresh_token: saved.refreshToken,
        client_id: saved.clientId,
        resource: saved.resource,
        ...(saved.scope ? { scope: saved.scope } : {})
      },
      fetcher,
      saved.tokenMethod,
      saved.clientSecret
    )
    return credentialFrom(
      answer,
      saved.clientId,
      saved.clientSecret,
      saved.tokenMethod ?? 'none',
      saved.tokenEndpoint,
      saved.resource,
      now,
      saved
    )
  } catch {
    return null
  }
}

const signIn = async (
  plugin: ConnectedPlugin,
  deps: Required<Pick<PluginOauthDeps, 'fetcher' | 'now' | 'open' | 'timeoutMs'>>
): Promise<{ credential: OAuthCredential; listening: AuthorizationCode }> => {
  if (!plugin.url) throw new Error(`${plugin.label} has no MCP address.`)
  const { resource, scopes, authorization } = await discover(plugin.url, deps.fetcher)
  const state = base64Url(randomBytes(24))
  const verifier = base64Url(randomBytes(48))
  const challenge = base64Url(createHash('sha256').update(verifier).digest())
  const listening = await callback(state, plugin.label, deps.timeoutMs)
  try {
    const method = tokenMethod(authorization)
    const registered = await register(authorization.registration_endpoint!, listening.redirectUri, method, deps.fetcher)
    if (!registered.client_id) throw new Error('The plugin sign-in returned no client ID.')
    const clientSecret = text(registered.client_secret) || undefined
    if (method !== 'none' && !clientSecret) throw new Error('The plugin sign-in returned no client secret.')
    const supported = new Set(scopes)
    const identity = ['openid', 'profile', 'email', 'offline_access'].filter(one => supported.has(one))
    const scope = (protectedScope => (protectedScope.length ? protectedScope : identity))(
      scopes.filter(one => !['openid', 'profile', 'email', 'offline_access'].includes(one))
    ).join(' ')
    const authorize = new URL(authorization.authorization_endpoint!)
    authorize.searchParams.set('response_type', 'code')
    authorize.searchParams.set('client_id', registered.client_id)
    authorize.searchParams.set('redirect_uri', listening.redirectUri)
    authorize.searchParams.set('code_challenge', challenge)
    authorize.searchParams.set('code_challenge_method', 'S256')
    authorize.searchParams.set('state', state)
    authorize.searchParams.set('resource', resource)
    if (scope) authorize.searchParams.set('scope', scope)
    await deps.open(authorize.toString())
    const code = await listening.code
    const answer = await token(
      authorization.token_endpoint!,
      {
        grant_type: 'authorization_code',
        code,
        redirect_uri: listening.redirectUri,
        client_id: registered.client_id,
        code_verifier: verifier,
        resource
      },
      deps.fetcher,
      method,
      clientSecret
    )
    return {
      credential: credentialFrom(
        answer,
        registered.client_id,
        clientSecret,
        method,
        authorization.token_endpoint!,
        resource,
        deps.now()
      ),
      listening
    }
  } catch (cause) {
    listening.fail()
    listening.close()
    throw cause
  }
}

const rpc = async (
  url: string,
  authorization: string | undefined,
  body: Record<string, unknown>,
  fetcher: typeof fetch,
  sessionId?: string,
  protocolVersion = PROTOCOL_VERSION
): Promise<Response> =>
  fetcher(url, {
    method: 'POST',
    headers: {
      ...(authorization ? { authorization } : {}),
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      'mcp-protocol-version': protocolVersion,
      ...(sessionId ? { 'mcp-session-id': sessionId } : {})
    },
    body: JSON.stringify(body)
  })

const rpcBody = async (response: Response): Promise<any> => {
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
  throw new Error('The plugin returned an unreadable MCP response.')
}

const tools = async (url: string, accessToken: string | undefined, fetcher: typeof fetch): Promise<string[]> => {
  const authorization = accessToken ? `Bearer ${accessToken}` : undefined
  const initialized = await rpc(
    url,
    authorization,
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: 'Crew', version: '1' } }
    },
    fetcher
  )
  if (initialized.status === 401) throw new Unauthorized('The plugin sign-in has expired.')
  if (initialized.status === 403) throw new Unauthorized('The plugin sign-in needs approval.')
  if (!initialized.ok) throw new Error(`The plugin MCP answered with ${initialized.status}.`)
  const initializedBody = await rpcBody(initialized)
  if (initializedBody?.error) throw new Error(text(initializedBody.error.message) || 'The plugin could not start.')
  const protocolVersion = text(initializedBody?.result?.protocolVersion) || PROTOCOL_VERSION
  const sessionId = initialized.headers.get('mcp-session-id') ?? undefined
  const ready = await rpc(
    url,
    authorization,
    { jsonrpc: '2.0', method: 'notifications/initialized', params: {} },
    fetcher,
    sessionId,
    protocolVersion
  )
  if (ready.status === 401) throw new Unauthorized('The plugin sign-in has expired.')
  if (ready.status === 403) throw new Unauthorized('The plugin sign-in needs approval.')
  if (!ready.ok) throw new Error(`The plugin MCP answered with ${ready.status}.`)
  const listed = await rpc(
    url,
    authorization,
    { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
    fetcher,
    sessionId,
    protocolVersion
  )
  if (listed.status === 401) throw new Unauthorized('The plugin sign-in has expired.')
  if (listed.status === 403) throw new Unauthorized('The plugin sign-in needs approval.')
  if (!listed.ok) throw new Error(`The plugin MCP answered with ${listed.status}.`)
  const answer = await rpcBody(listed)
  if (answer?.error) throw new Error(text(answer.error.message) || 'The plugin could not list its tools.')
  const found = Array.isArray(answer?.result?.tools) ? answer.result.tools : []
  return found.map((one: any) => text(one?.name)).filter(Boolean)
}

const verifyTools = (plugin: ConnectedPlugin, names: string[]): void => {
  const required = plugin.name === 'raylight' ? REQUIRED_RAYLIGHT_TOOLS : []
  const missing = required.filter(name => !names.includes(name))
  if (missing.length) throw new Error(`${plugin.label} is missing ${missing.join(' and ')}.`)
}

const usableCredential = async (
  plugin: ConnectedPlugin,
  deps: Required<Pick<PluginOauthDeps, 'fetcher' | 'now' | 'open' | 'timeoutMs'>>,
  allowSignIn: boolean
): Promise<OAuthCredential> => {
  if (!plugin.url) throw new Error(`${plugin.label} has no MCP address.`)
  let saved = savedConnection(plugin)?.credential
  const now = deps.now()
  if (saved?.expiresAt && saved.expiresAt <= now + TOKEN_MARGIN_MS) {
    saved = (await refresh(saved, deps.fetcher, now)) ?? undefined
    if (saved) remember(plugin, saved)
  }
  if (saved) {
    try {
      const names = await tools(plugin.url, saved.accessToken, deps.fetcher)
      verifyTools(plugin, names)
      return saved
    } catch (cause) {
      if (!(cause instanceof Unauthorized)) throw cause
      const renewed = await refresh(saved, deps.fetcher, now)
      if (renewed) {
        remember(plugin, renewed)
        try {
          const names = await tools(plugin.url, renewed.accessToken, deps.fetcher)
          verifyTools(plugin, names)
          return renewed
        } catch (renewedCause) {
          if (!(renewedCause instanceof Unauthorized)) throw renewedCause
        }
      }
    }
  }
  if (!allowSignIn) throw new Error(`${plugin.label} is not connected on this computer. Connect it in Plugins.`)
  const connected = await signIn(plugin, deps)
  try {
    const names = await tools(plugin.url, connected.credential.accessToken, deps.fetcher)
    verifyTools(plugin, names)
    remember(plugin, connected.credential)
    connected.listening.succeed()
    return connected.credential
  } catch (cause) {
    connected.listening.fail()
    throw cause
  } finally {
    connected.listening.close()
  }
}

const oauthDeps = (
  deps: PluginOauthDeps
): Required<Pick<PluginOauthDeps, 'fetcher' | 'now' | 'open' | 'timeoutMs'>> => ({
  fetcher: deps.fetcher ?? fetch,
  now: deps.now ?? Date.now,
  open: deps.open ?? openExternal,
  timeoutMs: deps.timeoutMs ?? LOGIN_TIMEOUT_MS
})

const authorize = async (
  plugin: ConnectedPlugin,
  deps: PluginOauthDeps,
  allowSignIn: boolean
): Promise<Record<string, string>> => {
  if (plugin.authentication !== 'oauth' || plugin.transport !== 'http' || !plugin.url) return {}
  if (!currentPluginInstallation(plugin)) throw new Error(`${plugin.label} needs to be added again.`)
  const key = plugin.installationId
  const existing = authorizing.get(key)
  if (existing) return existing
  const ready = usableCredential(plugin, oauthDeps(deps), allowSignIn).then(credential => ({
    Authorization: `Bearer ${credential.accessToken}`
  }))
  authorizing.set(key, ready)
  try {
    return await ready
  } finally {
    authorizing.delete(key)
  }
}

export async function authorizePlugin(
  plugin: ConnectedPlugin,
  deps: PluginOauthDeps = {}
): Promise<Record<string, string>> {
  return authorize(plugin, deps, true)
}

export function pluginConnected(plugin: CrewPlugin | ConnectedPlugin): boolean {
  const resolved = 'trusted' in plugin ? plugin : resolvePlugin(plugin)
  if (!resolved.trusted || !currentPluginInstallation(resolved)) return false
  return Boolean(savedConnection(resolved))
}

export function pluginAvailable(plugin: CrewPlugin): boolean {
  const resolved = resolvePlugin(plugin)
  return resolved.trusted ? pluginConnected(resolved) : true
}

export async function connectPlugin(plugin: ConnectedPlugin, deps: PluginOauthDeps = {}): Promise<void> {
  if (!plugin.trusted || !plugin.catalogId || !currentPluginInstallation(plugin)) {
    throw new Error('That plugin cannot be connected.')
  }
  if (plugin.authentication === 'oauth') {
    await authorize(plugin, deps, true)
    return
  }
  if (plugin.transport === 'http') {
    if (!plugin.url) throw new Error(`${plugin.label} has no MCP address.`)
    try {
      const names = await tools(plugin.url, undefined, deps.fetcher ?? fetch)
      verifyTools(plugin, names)
    } catch (cause) {
      if (plugin.name === 'figma' && cause instanceof TypeError) {
        throw new Error('Open a Figma file in Dev Mode and turn on its MCP server, then try again.')
      }
      throw cause
    }
  }
  remember(plugin)
}

export function disconnectPlugin(plugin: ConnectedPlugin): void {
  if (!currentPluginInstallation(plugin)) return
  const store = read()
  if (!store.connections[plugin.installationId]) return
  const connections = { ...store.connections }
  delete connections[plugin.installationId]
  write({ version: 2, connections })
}

export async function authorizeAttachedPlugin(
  plugins: readonly CrewPlugin[],
  usePlugin?: string,
  deps: PluginOauthDeps = {}
): Promise<Record<string, Record<string, string>>> {
  const wanted = usePlugin ? pluginKey(usePlugin) : ''
  const chosen = wanted ? plugins.filter(plugin => pluginKey(plugin.name) === wanted) : plugins
  const headers: Record<string, Record<string, string>> = {}
  for (const saved of chosen) {
    const plugin = resolvePlugin(saved)
    const found = await authorize(plugin, deps, false)
    if (Object.keys(found).length) headers[plugin.name] = found
  }
  return headers
}
