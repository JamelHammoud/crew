import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { claudeModels, refreshClaudeModels } from '../src/runner/providers/claude-models'
import { tmpDir } from './helpers/session'

describe('Claude model discovery', () => {
  it('reads aliases advertised by the installed CLI', async () => {
    const home = tmpDir('claude-help-home')
    const help = `Options:\n  --model <model>  Use an alias such as 'newest', 'quick' or a full model such as 'claude-new-1'.\n  --name <name>`
    expect(
      await refreshClaudeModels({
        command: process.execPath,
        args: ['-e', `process.stdout.write(${JSON.stringify(help)})`],
        home,
        timeoutMs: 2000
      })
    ).toBe(true)
    expect(claudeModels(home)).toEqual([
      { value: 'newest', label: 'newest' },
      { value: 'quick', label: 'quick' },
      { value: 'claude-new-1', label: 'claude-new-1' }
    ])
  })

  it('reads configured picker entries and skips disabled additions', () => {
    const home = tmpDir('claude-config-home')
    fs.mkdirSync(path.join(home, '.claude'), { recursive: true })
    fs.writeFileSync(
      path.join(home, '.claude', 'settings.json'),
      JSON.stringify({ modelPicker: [{ value: 'team/model', label: 'Team model' }], availableModels: ['allowed/model'] })
    )
    fs.writeFileSync(
      path.join(home, '.claude.json'),
      JSON.stringify({
        additionalModelOptionsCache: [
          { value: 'preview/model', label: 'Preview' },
          { value: 'later/model', label: 'Later', disabled: true }
        ]
      })
    )
    expect(claudeModels(home)).toEqual([
      { value: 'team/model', label: 'Team model' },
      { value: 'allowed/model', label: 'allowed/model' },
      { value: 'preview/model', label: 'Preview' }
    ])
  })
})
