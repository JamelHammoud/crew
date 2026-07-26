import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import { CrewSession } from '../src/server/session'
import { startHost, TestUi, type TestHost } from './helpers/session'

type Added = Extract<SessionEvent, { kind: 'tool.added' }>
type Edited = Extract<SessionEvent, { kind: 'tool.edited' }>

describe('toolbox', () => {
  let host: TestHost
  let uis: TestUi[] = []

  beforeEach(async () => {
    host = await startHost()
  })

  afterEach(async () => {
    for (const ui of uis) ui.close()
    uis = []
    await host.close()
  })

  it('builds a tool, tells everyone, and keeps it in the snapshot', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    const pat = await TestUi.connect(host.url, 'pat', host.code)
    uis.push(sam, pat)

    sam.send({ type: 'tool.add', name: '  Figma  ', mark: 'globe', action: { kind: 'web', url: 'figma.com' } })
    const added = (await pat.waitForEvent(e => e.kind === 'tool.added')) as Added
    expect(added.name).toBe('Figma')
    expect(added.mark).toBe('globe')
    expect(added.action).toEqual({ kind: 'web', url: 'https://figma.com' })
    expect(added.byName).toBe('sam')

    pat.send({
      type: 'tool.edit',
      toolId: added.toolId,
      name: 'Dev server',
      mark: 'terminal',
      action: { kind: 'terminal', command: '  yarn dev  ' }
    })
    const edited = (await sam.waitForEvent(e => e.kind === 'tool.edited')) as Edited
    expect(edited.name).toBe('Dev server')
    expect(edited.action).toEqual({ kind: 'terminal', command: 'yarn dev' })

    // The toolbox rides in the snapshot the way todos do, so someone joining
    // late gets it even though its events never enter the trimmed window.
    const snapshot = host.session.snapshot()
    expect(snapshot.tools).toHaveLength(1)
    expect(snapshot.tools?.[0]).toMatchObject({
      name: 'Dev server',
      mark: 'terminal',
      action: { kind: 'terminal', command: 'yarn dev' },
      createdBy: 'sam'
    })
    expect(snapshot.events.some(e => e.kind.startsWith('tool.'))).toBe(false)

    sam.send({ type: 'tool.remove', toolId: added.toolId })
    await pat.waitForEvent(e => e.kind === 'tool.removed')
    expect(host.session.snapshot().tools).toHaveLength(0)
  })

  it('carries a file, an ask and a page opened outside, and an emoji for a mark', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)

    sam.send({ type: 'tool.add', name: 'Notes', mark: '🚀', action: { kind: 'file', path: '  docs/notes.md  ' } })
    const file = (await sam.waitForEvent(e => e.kind === 'tool.added' && e.name === 'Notes')) as Added
    expect(file.mark).toBe('🚀')
    expect(file.action).toEqual({ kind: 'file', path: 'docs/notes.md' })

    sam.send({
      type: 'tool.add',
      name: 'Tests',
      mark: 'chat',
      action: { kind: 'prompt', text: '  Run the tests  ', agentId: 'agent-1' }
    })
    const ask = (await sam.waitForEvent(e => e.kind === 'tool.added' && e.name === 'Tests')) as Added
    expect(ask.action).toEqual({ kind: 'prompt', text: 'Run the tests', agentId: 'agent-1' })

    sam.send({ type: 'tool.add', name: 'Docs', mark: 'globe', action: { kind: 'web', url: 'crew.dev', external: true } })
    const page = (await sam.waitForEvent(e => e.kind === 'tool.added' && e.name === 'Docs')) as Added
    expect(page.action).toEqual({ kind: 'web', url: 'https://crew.dev', external: true })
  })

  it('turns away a tool that could not be pressed', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)

    sam.send({ type: 'tool.add', name: '   ', mark: 'globe', action: { kind: 'web', url: 'figma.com' } })
    sam.send({ type: 'tool.add', name: 'Nowhere', mark: 'globe', action: { kind: 'web', url: '  ' } })
    sam.send({ type: 'tool.add', name: 'Nothing', mark: 'globe', action: { kind: 'file', path: ' ' } })
    sam.send({ type: 'tool.add', name: 'Silent', mark: 'globe', action: { kind: 'prompt', text: ' ' } })
    sam.send({ type: 'tool.edit', toolId: 'nope', name: 'Ghost', mark: 'star', action: { kind: 'terminal' } })
    sam.send({ type: 'tool.remove', toolId: 'nope' })
    await new Promise(r => setTimeout(r, 200))
    expect(sam.events.some(e => e.kind.startsWith('tool.'))).toBe(false)
    expect(host.session.snapshot().tools).toHaveLength(0)

    // A mark from a newer build, or a line of text where a mark goes, is not a
    // reason to lose the tool.
    sam.send({
      type: 'tool.add',
      name: 'Long name that runs past the end of its own tile',
      mark: 'hologram',
      action: { kind: 'terminal', command: '' }
    })
    const added = (await sam.waitForEvent(e => e.kind === 'tool.added')) as Added
    expect(added.mark).toBe('star')
    expect(added.name).toHaveLength(24)
    expect(added.action).toEqual({ kind: 'terminal' })
  })

  it('survives a restart', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)

    sam.send({ type: 'tool.add', name: 'Staging', mark: 'globe', action: { kind: 'web', url: 'crew.dev' } })
    sam.send({ type: 'tool.add', name: 'Tests', mark: 'terminal', action: { kind: 'terminal', command: 'yarn test' } })
    const gone = (await sam.waitForEvent(e => e.kind === 'tool.added' && e.name === 'Staging')) as Added
    await sam.waitForEvent(e => e.kind === 'tool.added' && e.name === 'Tests')
    sam.send({ type: 'tool.remove', toolId: gone.toolId })
    await sam.waitForEvent(e => e.kind === 'tool.removed')

    const revived = new CrewSession(host.store)
    const tools = revived.snapshot().tools ?? []
    expect(tools).toHaveLength(1)
    expect(tools[0]).toMatchObject({ name: 'Tests', action: { kind: 'terminal', command: 'yarn test' } })
  })
})
