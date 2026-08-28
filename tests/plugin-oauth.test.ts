import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  authorizePlugin,
  connectPlugin,
  disconnectPlugin,
  pluginConnected,
  setPluginOauthPath
} from '../src/runner/pluginOauth'
import { installPlugin, offerOf, resolvePlugin, type CrewPlugin } from '../src/shared/plugins'

const bodyOf = (request: http.IncomingMessage): Promise<string> =>
  new Promise(resolve => {
    let body = ''
    request.on('data', chunk => {
      body += chunk
    })
    request.on('end', () => resolve(body))
  })

describe('plugin OAuth on the machine running the agent', () => {
  let server: http.Server | null = null
  let origin = ''
  let registrations = 0
  let authorizations = 0
  let bearerCalls = 0
  let requiredTools = true
  let browserAnswers: Promise<Response>[] = []
  let allowAnonymous = false
  let resourceScopes: string[] = []
  let authMethod = 'none'
  let registrationStatus = 201
  let rootMetadata = false
  let serverProtocol = '2025-06-18'
  let authorizedScope = ''

  beforeEach(async () => {
    registrations = 0
    authorizations = 0
    bearerCalls = 0
    requiredTools = true
    browserAnswers = []
    allowAnonymous = false
    resourceScopes = []
    authMethod = 'none'
    registrationStatus = 201
    rootMetadata = false
    serverProtocol = '2025-06-18'
    authorizedScope = ''
    server = http.createServer(async (request, response) => {
      const url = new URL(request.url ?? '/', origin)
      if (
        request.method === 'GET' &&
        url.pathname === (rootMetadata ? '/.well-known/oauth-protected-resource' : '/.well-known/oauth-protected-resource/mcp')
      ) {
        response.setHeader('content-type', 'application/json')
        response.end(
          JSON.stringify({ resource: `${origin}/mcp`, authorization_servers: [origin], scopes_supported: resourceScopes })
        )
        return
      }
      if (request.method === 'GET' && url.pathname === '/.well-known/oauth-authorization-server') {
        response.setHeader('content-type', 'application/json')
        response.end(
          JSON.stringify({
            authorization_endpoint: `${origin}/authorize`,
            token_endpoint: `${origin}/token`,
            registration_endpoint: `${origin}/register`,
            scopes_supported: ['openid', 'offline_access'],
            token_endpoint_auth_methods_supported: [authMethod]
          })
        )
        return
      }
      if (request.method === 'POST' && url.pathname === '/register') {
        registrations += 1
        const registration = JSON.parse(await bodyOf(request))
        expect(registration.token_endpoint_auth_method).toBe(authMethod)
        response.writeHead(registrationStatus, { 'content-type': 'application/json' })
        response.end(
          registrationStatus === 201
            ? JSON.stringify({ client_id: 'crew-client', ...(authMethod === 'none' ? {} : { client_secret: 'secret' }) })
            : JSON.stringify({ error: 'forbidden' })
        )
        return
      }
      if (request.method === 'GET' && url.pathname === '/authorize') {
        authorizations += 1
        authorizedScope = url.searchParams.get('scope') ?? ''
        const callback = new URL(url.searchParams.get('redirect_uri')!)
        callback.searchParams.set('code', 'crew-code')
        callback.searchParams.set('state', url.searchParams.get('state')!)
        response.writeHead(302, { location: callback.toString() }).end()
        return
      }
      if (request.method === 'POST' && url.pathname === '/token') {
        const form = new URLSearchParams(await bodyOf(request))
        expect(form.get('client_id')).toBe('crew-client')
        expect(form.get('client_secret')).toBe(authMethod === 'client_secret_post' ? 'secret' : null)
        expect(form.get('resource')).toBe(`${origin}/mcp`)
        response.setHeader('content-type', 'application/json')
        response.end(
          JSON.stringify({ access_token: 'raylight-token', refresh_token: 'raylight-refresh', expires_in: 3600 })
        )
        return
      }
      if (request.method === 'POST' && url.pathname === '/mcp') {
        if (!allowAnonymous && request.headers.authorization !== 'Bearer raylight-token') {
          response.writeHead(401).end()
          return
        }
        bearerCalls += 1
        const rpc = JSON.parse(await bodyOf(request))
        expect(request.headers['mcp-protocol-version']).toBe(
          rpc.method === 'initialize' ? '2025-06-18' : serverProtocol
        )
        if (rpc.method === 'initialize') {
          response.writeHead(200, { 'content-type': 'application/json', 'mcp-session-id': 'crew-session' })
          response.end(
            JSON.stringify({
              jsonrpc: '2.0',
              id: rpc.id,
              result: {
                protocolVersion: serverProtocol,
                capabilities: {},
                serverInfo: { name: 'Raylight', version: '1' }
              }
            })
          )
          return
        }
        if (rpc.method === 'notifications/initialized') {
          response.writeHead(202).end()
          return
        }
        if (rpc.method === 'tools/list') {
          const names = requiredTools ? ['get_editor_status', 'list_projects', 'render_video'] : ['render_video']
          response.setHeader('content-type', 'application/json')
          response.end(JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result: { tools: names.map(name => ({ name })) } }))
          return
        }
      }
      response.writeHead(404).end()
    })
    await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('test server did not open')
    origin = `http://127.0.0.1:${address.port}`
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'crew-plugin-oauth-'))
    setPluginOauthPath(path.join(folder, 'plugin-oauth.json'))
  })

  afterEach(async () => {
    const open = server
    server = null
    if (open) await new Promise<void>(resolve => open.close(() => resolve()))
  })

  const raylight = () => {
    const saved: CrewPlugin = {
      ...installPlugin(offerOf('raylight')!, '00000000-0000-4000-8000-000000000001'),
      id: 'raylight',
      by: 'Ali',
      ts: 1
    }
    return { ...resolvePlugin(saved), url: `${origin}/mcp` }
  }

  const open = async (url: string): Promise<void> => {
    browserAnswers.push(fetch(url))
  }

  const installed = (name: string, id: string) => {
    const saved: CrewPlugin = { ...installPlugin(offerOf(name)!, id), id: name, by: 'Ali', ts: 1 }
    return { ...resolvePlugin(saved), url: `${origin}/mcp` }
  }

  it('signs in once, verifies Raylight tools, and reuses the private token', async () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'crew-plugin-oauth-file-'))
    const credentials = path.join(folder, 'plugin-oauth.json')
    setPluginOauthPath(credentials)

    await expect(authorizePlugin(raylight(), { open })).resolves.toEqual({
      Authorization: 'Bearer raylight-token'
    })
    expect(registrations).toBe(1)
    expect(authorizations).toBe(1)
    expect(bearerCalls).toBe(3)
    expect(fs.statSync(credentials).mode & 0o777).toBe(0o600)
    await expect(browserAnswers[0].then(response => response.text())).resolves.toContain(
      'Raylight is connected to Crew'
    )

    setPluginOauthPath(credentials)
    await expect(authorizePlugin(raylight(), { open })).resolves.toEqual({
      Authorization: 'Bearer raylight-token'
    })
    expect(registrations).toBe(1)
    expect(authorizations).toBe(1)
    expect(bearerCalls).toBe(6)
    expect(pluginConnected(raylight())).toBe(true)
  })

  it('does not start an agent when Raylight lacks the tools Crew promises', async () => {
    requiredTools = false
    await expect(authorizePlugin(raylight(), { open })).rejects.toThrow(
      'Raylight is missing get_editor_status and list_projects.'
    )
    await expect(browserAnswers[0].then(response => response.status)).resolves.toBe(400)
  })

  it('uses the service name and only finishes the browser after Canva is usable', async () => {
    const canva = installed('canva', '00000000-0000-4000-8000-000000000002')
    await expect(connectPlugin(canva, { open })).resolves.toBeUndefined()
    await expect(browserAnswers[0].then(response => response.text())).resolves.toContain('Canva is connected to Crew')
    expect(pluginConnected(canva)).toBe(true)
    disconnectPlugin(canva)
    expect(pluginConnected(canva)).toBe(false)
  })

  it('verifies a plugin without a sign-in before keeping it connected', async () => {
    allowAnonymous = true
    const frontpages = installed('frontpages', '00000000-0000-4000-8000-000000000003')
    await expect(connectPlugin(frontpages)).resolves.toBeUndefined()
    expect(browserAnswers).toHaveLength(0)
    expect(pluginConnected(frontpages)).toBe(true)
  })

  it('uses root metadata, resource scopes, client secrets, and the negotiated MCP version', async () => {
    rootMetadata = true
    resourceScopes = ['mcp:connect']
    authMethod = 'client_secret_post'
    serverProtocol = '2024-11-05'
    const canva = installed('canva', '00000000-0000-4000-8000-000000000004')
    await expect(connectPlugin(canva, { open })).resolves.toBeUndefined()
    expect(authorizedScope).toBe('mcp:connect')
    expect(pluginConnected(canva)).toBe(true)
  })

  it('reports a rejected client registration without opening an approval page', async () => {
    registrationStatus = 403
    const canva = installed('canva', '00000000-0000-4000-8000-000000000005')
    await expect(connectPlugin(canva, { open })).rejects.toThrow('The plugin sign-in answered with 403.')
    expect(authorizations).toBe(0)
  })

  it('signs in to the remote Figma server with its protected resource scope', async () => {
    resourceScopes = ['mcp:connect']
    const figma = installed('figma', '00000000-0000-4000-8000-000000000006')
    await expect(connectPlugin(figma, { open })).resolves.toBeUndefined()
    expect(authorizedScope).toBe('mcp:connect')
    expect(pluginConnected(figma)).toBe(true)
    await expect(browserAnswers[0].then(response => response.text())).resolves.toContain('Figma is connected to Crew')
  })

  it('clears the old credential schema once', () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'crew-plugin-oauth-v1-'))
    const credentials = path.join(folder, 'plugin-oauth.json')
    fs.writeFileSync(
      credentials,
      JSON.stringify({
        version: 1,
        servers: {
          'https://api.raylight.app/mcp': {
            accessToken: 'old-token',
            clientId: 'old-client',
            tokenEndpoint: 'https://example.com/token',
            resource: 'https://api.raylight.app/mcp'
          }
        }
      })
    )
    setPluginOauthPath(credentials)
    expect(JSON.parse(fs.readFileSync(credentials, 'utf8'))).toEqual({ version: 2, connections: {} })
  })
})
