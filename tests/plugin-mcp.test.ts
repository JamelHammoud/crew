import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { WebSocketServer, type WebSocket } from 'ws'
import { closeMcp, machineKeys, openMcp } from '../src/runner/plugins'
import { claudeArgs } from '../src/runner/providers/claude'
import { codexArgs } from '../src/runner/providers/codex'
import { acpServers, kimiDialog } from '../src/runner/providers/kimi-acp'
import { grokProvider } from '../src/runner/providers/grok'
import { localProvider } from '../src/runner/providers/local'
import { claudeProvider } from '../src/runner/providers/claude'
import { codexProvider } from '../src/runner/providers/codex'
import { kimiProvider } from '../src/runner/providers/kimi'
import { makeCliProvider } from '../src/runner/providers/cli'
import type { McpRun, Provider, RunOptions, RunningPrompt } from '../src/runner/providers/types'
import type { CrewPlugin } from '../src/shared/plugins'
import { testRunner } from './helpers/runner'

const plugin = (one: Partial<CrewPlugin> & { name: string }): CrewPlugin => ({
  id: one.name,
  label: one.name,
  blurb: '',
  transport: 'http',
  by: 'Jamel',
  ts: 1,
  ...one
})

const FIGMA = plugin({ name: 'figma', transport: 'http', url: 'https://mcp.figma.com/mcp' })

const SLACK = plugin({
  name: 'slack',
  transport: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-slack'],
  keys: [{ name: 'SLACK_BOT_TOKEN', label: 'Bot token' }]
})

const reader = (settings: Record<string, string> = {}) => (key: string) => settings[key] ?? ''

const opened: McpRun[] = []

const open = (plugins: CrewPlugin[], how: 'file' | 'inline' | undefined, id: string): McpRun | null => {
  const run = openMcp(plugins, how, id)
  if (run) opened.push(run)
  return run
}

afterEach(() => {
  for (const run of opened.splice(0)) closeMcp(run)
})

describe('the config the crew plugins become', () => {
  it('writes the map every MCP client understands, outside the project', () => {
    const run = open([FIGMA], 'file', 'prompt-1')!
    expect(run.file.startsWith(tmpdir())).toBe(true)
    expect(JSON.parse(readFileSync(run.file, 'utf8'))).toEqual({
      mcpServers: { figma: { type: 'http', url: 'https://mcp.figma.com/mcp' } }
    })
  })

  it('leaves out a plugin whose keys this machine does not have', () => {
    const run = open([FIGMA, SLACK], 'file', 'prompt-2')!
    const written = JSON.parse(readFileSync(run.file, 'utf8'))
    expect(Object.keys(written.mcpServers)).toEqual(['figma'])
  })

  it('carries a plugin whose keys this machine does have, and only the keys it named', () => {
    const env = { SLACK_BOT_TOKEN: 'xoxb-real', HOME: '/Users/jamel', AWS_SECRET_ACCESS_KEY: 'never' }
    expect(machineKeys([SLACK], env)).toEqual({ SLACK_BOT_TOKEN: 'xoxb-real' })
    expect(machineKeys([FIGMA], env)).toEqual({})
  })

  it('reads a key named for one plugin ahead of the plain one', () => {
    const env = { 'slack:SLACK_BOT_TOKEN': 'xoxb-scoped', SLACK_BOT_TOKEN: 'xoxb-plain' }
    expect(machineKeys([SLACK], env)).toEqual({ 'slack:SLACK_BOT_TOKEN': 'xoxb-scoped' })
  })

  it('writes nothing at all when the crew has no plugins', () => {
    expect(openMcp([], 'file', 'prompt-3')).toBeNull()
  })

  it('writes nothing when every plugin was left out for want of a key', () => {
    expect(openMcp([SLACK], 'file', 'prompt-4')).toBeNull()
  })

  it('writes no file for a CLI that is handed its servers inline', () => {
    const run = open([FIGMA], 'inline', 'prompt-5')!
    expect(run.file).toBe('')
    expect(run.servers).toEqual({ figma: { type: 'http', url: 'https://mcp.figma.com/mcp' } })
  })

  it('hands nothing to a CLI that takes none', () => {
    expect(openMcp([FIGMA], undefined, 'prompt-6')).toBeNull()
  })

  it('keeps the file to itself', () => {
    const run = open([FIGMA], 'file', 'prompt-7')!
    expect(readFileSync(run.file, 'utf8')).toContain('figma')
  })

  it('takes the file away when the run ends', () => {
    const run = openMcp([FIGMA], 'file', 'prompt-8')!
    expect(existsSync(run.file)).toBe(true)
    closeMcp(run)
    expect(existsSync(run.file)).toBe(false)
  })
})

describe('what each CLI is really handed', () => {
  it('points claude at the config file it reads', () => {
    const run: RunOptions = { mcp: { servers: {}, file: '/tmp/crew-mcp-x.json' } }
    expect(claudeArgs('go', reader(), run)).toContain('--mcp-config')
    const args = claudeArgs('go', reader(), run)
    expect(args[args.indexOf('--mcp-config') + 1]).toBe('/tmp/crew-mcp-x.json')
  })

  it('says nothing to claude about mcp when the crew has no plugins', () => {
    expect(claudeArgs('go', reader())).not.toContain('--mcp-config')
    expect(claudeArgs('go', reader(), {})).not.toContain('--mcp-config')
  })

  it('writes codex its own config, as the toml its own mcp add writes', () => {
    const run: RunOptions = {
      mcp: {
        file: '',
        servers: {
          figma: { type: 'http', url: 'https://mcp.figma.com/mcp' },
          slack: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-slack'],
            env: { SLACK_BOT_TOKEN: 'xoxb-real' }
          }
        }
      }
    }
    expect(codexArgs('go', reader(), run)).toEqual([
      'app-server',
      '-c',
      'mcp_servers.figma={url="https://mcp.figma.com/mcp"}',
      '-c',
      'mcp_servers.slack={command="npx",args=["-y","@modelcontextprotocol/server-slack"],env={SLACK_BOT_TOKEN="xoxb-real"}}'
    ])
  })

  it('starts codex the way it always did when the crew has no plugins', () => {
    expect(codexArgs('go', reader())).toEqual(['app-server'])
    expect(codexArgs('go', reader(), {})).toEqual(['app-server'])
  })

  it('opens kimi on the servers, in the shape acp asks for', () => {
    expect(
      acpServers({
        figma: { type: 'http', url: 'https://mcp.figma.com/mcp' },
        slack: { command: 'npx', args: ['-y', '@mcp/slack'], env: { SLACK_BOT_TOKEN: 'xoxb-real' } }
      })
    ).toEqual([
      { name: 'figma', type: 'http', url: 'https://mcp.figma.com/mcp', headers: [] },
      {
        name: 'slack',
        command: 'npx',
        args: ['-y', '@mcp/slack'],
        env: [{ name: 'SLACK_BOT_TOKEN', value: 'xoxb-real' }]
      }
    ])
  })

  it('carries them on the session kimi opens', () => {
    const dialog = kimiDialog('go', '/repo', reader(), {
      mcp: { file: '', servers: { figma: { type: 'http', url: 'https://mcp.figma.com/mcp' } } }
    })
    dialog.begin()
    const sent = dialog.answer(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { protocolVersion: 1 } }))
    const session = JSON.parse(sent[0])
    expect(session.method).toBe('session/new')
    expect(session.params.mcpServers).toEqual([
      { name: 'figma', type: 'http', url: 'https://mcp.figma.com/mcp', headers: [] }
    ])
  })

  it('opens kimi on nothing when the crew has no plugins', () => {
    const dialog = kimiDialog('go', '/repo', reader())
    dialog.begin()
    const session = JSON.parse(dialog.answer(JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} }))[0])
    expect(session.params.mcpServers).toEqual([])
  })

  it('says which CLIs take them and which cannot', () => {
    expect(claudeProvider.mcp).toBe('file')
    expect(codexProvider.mcp).toBe('inline')
    expect(kimiProvider.mcp).toBe('inline')
    expect(grokProvider.mcp).toBeUndefined()
    expect(localProvider.mcp).toBeUndefined()
  })
})

describe('what the spawned command really gets', () => {
  const echo = (build: (run: RunOptions) => string[]): Provider =>
    makeCliProvider({
      name: 'echo',
      label: 'Echo',
      command: process.execPath,
      mcp: 'file',
      args: (_prompt, _get, run) => [
        '-e',
        'const a = process.argv.slice(1); const i = a.indexOf("--mcp-config");' +
          'process.stdout.write("ARGV " + JSON.stringify(a) + "\\n");' +
          'if (i >= 0) process.stdout.write("READ " + require("node:fs").readFileSync(a[i + 1], "utf8") + "\\n")',
        '--',
        ...build(run)
      ],
      parser: line => (line.startsWith('ARGV ') || line.startsWith('READ ') ? [{ text: line }] : [])
    })

  const run = async (provider: Provider, options: RunOptions) => {
    const said: string[] = []
    const started = provider.start('go', process.cwd(), { onStep: step => step.text && said.push(step.text) }, {}, options)
    await started.done
    return said.join('\n')
  }

  it('hands the real claude flags and a config the process can read', async () => {
    const mcp = open([FIGMA], 'file', 'spawned')!
    const said = await run(echo(options => claudeArgs('go', reader(), options)), { mcp })
    expect(said).toContain(`"--mcp-config","${mcp.file}"`)
    expect(said).toContain('READ {"mcpServers":{"figma":{"type":"http","url":"https://mcp.figma.com/mcp"}}}')
  }, 20000)

  it('hands the real codex overrides', async () => {
    const mcp = open([FIGMA], 'inline', 'spawned-codex')!
    const said = await run(echo(options => codexArgs('go', reader(), options)), { mcp })
    expect(said).toContain('mcp_servers.figma={url=\\"https://mcp.figma.com/mcp\\"}')
  }, 20000)

  it('hands no mcp flag at all when the crew has no plugins', async () => {
    const said = await run(echo(options => claudeArgs('go', reader(), options)), {})
    expect(said).not.toContain('--mcp-config')
    expect(said).not.toContain('READ ')
  }, 20000)
})

describe('a run that carries the crew plugins', () => {
  let host: WebSocketServer | null = null

  afterEach(async () => {
    const open = host
    host = null
    if (open) await new Promise<void>(resolve => open.close(() => resolve()))
  })

  interface Held {
    options: RunOptions
    finish: () => void
  }

  const holder = (how: 'file' | 'inline' | undefined, held: Held[]): Provider => ({
    name: 'holder',
    label: 'Holder',
    mcp: how,
    fields: () => [],
    detect: async () => true,
    start: (_prompt, _cwd, _hooks, _settings, options = {}): RunningPrompt => {
      let finish = () => {}
      const done = new Promise<{ text: string }>(resolve => {
        finish = () => resolve({ text: 'done' })
      })
      held.push({ options, finish })
      return { done, kill: () => finish() }
    }
  })

  const drive = async (how: 'file' | 'inline' | undefined, plugins: CrewPlugin[]) => {
    const held: Held[] = []
    const provider = holder(how, held)
    const standing = new WebSocketServer({ host: '127.0.0.1', port: 0 })
    host = standing
    await new Promise<void>(resolve => standing.once('listening', () => resolve()))
    const port = (standing.address() as { port: number }).port
    const ended: string[] = []
    const socket = new Promise<WebSocket>(resolve => host!.on('connection', ws => resolve(ws)))
    const runner = testRunner({
      name: 'Jamel',
      code: 'abc123',
      repoPath: mkdtempSync(join(tmpdir(), 'crew-mcp-run-')),
      providers: [provider]
    })
    runner.connect(`ws://127.0.0.1:${port}/abc123/ws`)
    const ws = await socket
    const hello = await new Promise<any>(resolve => ws.once('message', raw => resolve(JSON.parse(raw.toString()))))
    ws.on('message', raw => {
      const msg = JSON.parse(raw.toString())
      if (msg.type === 'agent.done' || msg.type === 'agent.error') ended.push(msg.promptId)
    })
    ws.send(JSON.stringify({ type: 'welcome' }))
    ws.send(
      JSON.stringify({
        type: 'prompt',
        promptId: 'run-1',
        agentId: hello.llms[0].id,
        threadId: 'thread-1',
        text: 'do the thing',
        settings: {},
        plugins
      })
    )
    while (held.length === 0) await new Promise(resolve => setTimeout(resolve, 10))
    return {
      held,
      done: async () => {
        held[0].finish()
        while (ended.length === 0) await new Promise(resolve => setTimeout(resolve, 10))
        runner.close()
      }
    }
  }

  it('writes the config before the run starts and takes it away when it ends', async () => {
    const { held, done } = await drive('file', [FIGMA])
    const file = held[0].options.mcp!.file
    expect(existsSync(file)).toBe(true)
    expect(JSON.parse(readFileSync(file, 'utf8')).mcpServers.figma.url).toBe('https://mcp.figma.com/mcp')
    await done()
    expect(existsSync(file)).toBe(false)
  }, 20000)

  it('hands a run with no plugins nothing, and writes no file', async () => {
    const { held, done } = await drive('file', [])
    expect(held[0].options.mcp).toBeUndefined()
    await done()
  }, 20000)

  it('hands a CLI that cannot take them nothing, plugins or not', async () => {
    const { held, done } = await drive(undefined, [FIGMA])
    expect(held[0].options.mcp).toBeUndefined()
    await done()
  }, 20000)
})
