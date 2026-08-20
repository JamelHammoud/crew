import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { authorizePlugin, setPluginOauthPath } from '../src/runner/pluginOauth'
import { offerOf, resolvePlugin, type CrewPlugin } from '../src/shared/plugins'

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

  beforeEach(async () => {
    registrations = 0
    authorizations = 0
    bearerCalls = 0
    requiredTools = true
    server = http.createServer(async (request, response) => {
      const url = new URL(request.url ?? '/', origin)
      if (request.method === 'GET' && url.pathname === '/.well-known/oauth-protected-resource/mcp') {
        response.setHeader('content-type', 'application/json')
        response.end(JSON.stringify({ resource: `${origin}/mcp`, authorization_servers: [origin] }))
        return
      }
      if (request.method === 'GET' && url.pathname === '/.well-known/oauth-authorization-server') {
        response.setHeader('content-type', 'application/json')
        response.end(
          JSON.stringify({
            authorization_endpoint: `${origin}/authorize`,
            token_endpoint: `${origin}/token`,
            registration_endpoint: `${origin}/register`,
            scopes_supported: ['openid', 'offline_access']
          })
        )
        return
      }
      if (request.method === 'POST' && url.pathname === '/register') {
        registrations += 1
        response.writeHead(201, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ client_id: 'crew-client' }))
        return
      }
      if (request.method === 'GET' && url.pathname === '/authorize') {
        authorizations += 1
        const callback = new URL(url.searchParams.get('redirect_uri')!)
        callback.searchParams.set('code', 'crew-code')
        callback.searchParams.set('state', url.searchParams.get('state')!)
        response.writeHead(302, { location: callback.toString() }).end()
        return
      }
      if (request.method === 'POST' && url.pathname === '/token') {
        const form = new URLSearchParams(await bodyOf(request))
        expect(form.get('client_id')).toBe('crew-client')
        expect(form.get('resource')).toBe(`${origin}/mcp`)
        response.setHeader('content-type', 'application/json')
        response.end(
          JSON.stringify({ access_token: 'raylight-token', refresh_token: 'raylight-refresh', expires_in: 3600 })
        )
        return
      }
      if (request.method === 'POST' && url.pathname === '/mcp') {
        if (request.headers.authorization !== 'Bearer raylight-token') {
          response.writeHead(401).end()
          return
        }
        bearerCalls += 1
        const rpc = JSON.parse(await bodyOf(request))
        if (rpc.method === 'initialize') {
          response.writeHead(200, { 'content-type': 'application/json', 'mcp-session-id': 'crew-session' })
          response.end(
            JSON.stringify({
              jsonrpc: '2.0',
              id: rpc.id,
              result: { protocolVersion: '2025-06-18', capabilities: {}, serverInfo: { name: 'Raylight', version: '1' } }
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
          response.end(
            JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result: { tools: names.map(name => ({ name })) } })
          )
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
    const saved: CrewPlugin = { ...offerOf('raylight')!, id: 'raylight', by: 'Ali', ts: 1 }
    return { ...resolvePlugin(saved), url: `${origin}/mcp` }
  }

  const open = async (url: string): Promise<void> => {
    const response = await fetch(url)
    expect(response.ok).toBe(true)
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

    setPluginOauthPath(credentials)
    await expect(authorizePlugin(raylight(), { open })).resolves.toEqual({
      Authorization: 'Bearer raylight-token'
    })
    expect(registrations).toBe(1)
    expect(authorizations).toBe(1)
    expect(bearerCalls).toBe(6)
  })

  it('does not start an agent when Raylight lacks the tools Crew promises', async () => {
    requiredTools = false
    await expect(authorizePlugin(raylight(), { open })).rejects.toThrow('Raylight is missing get_editor_status and list_projects.')
  })
})
