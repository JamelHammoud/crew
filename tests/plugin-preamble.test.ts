import { describe, expect, it } from 'vitest'
import { pluginPreamble } from '../src/shared/pluginPreamble'
import { offerOf, type CrewPlugin } from '../src/shared/plugins'

const raylight = (): CrewPlugin => ({ ...offerOf('raylight')!, id: 'r', by: 'Jamel', ts: 1 })

describe('the instructions that travel with Raylight', () => {
  it('checks the live editor and shows the exact project beside the conversation', () => {
    const text = pluginPreamble('http://127.0.0.1:1234/prompt', 'prompt-1', [raylight()], true)
    expect(text).toContain('get_editor_status')
    expect(text).toContain('list_projects')
    expect(text).toContain('editUrl')
    expect(text).toContain('http://127.0.0.1:1234/prompt/page')
    expect(text).toContain('"promptId":"prompt-1"')
  })

  it('adds nothing when Raylight is not installed', () => {
    expect(pluginPreamble('http://local', 'prompt-1', [], true)).toBe('')
  })

  it('adds nothing for an agent that cannot use MCP', () => {
    expect(pluginPreamble('http://local', 'prompt-1', [raylight()], false)).toBe('')
  })
})
