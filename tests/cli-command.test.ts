import { describe, expect, it } from 'vitest'
import { commandInvocation, detachCliProcess } from '../src/runner/providers/cli'

describe('commandInvocation', () => {
  it('runs Windows npm command shims through their PowerShell companion', () => {
    const prompt = 'You are a coding agent.\nBuild a polished dashboard and reply when complete.'
    const invocation = commandInvocation(
      'C:\\Users\\Ali Hammoud\\AppData\\Roaming\\npm\\codex.cmd',
      ['exec', '--json', '-c', 'model_reasoning_effort="max"', prompt],
      'win32',
      () => true
    )

    expect(invocation.command).toMatch(/WindowsPowerShell[\\/]v1\.0[\\/]powershell\.exe$/i)
    expect(invocation.args).toEqual([
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      'C:\\Users\\Ali Hammoud\\AppData\\Roaming\\npm\\codex.ps1',
      'exec',
      '--json',
      '-c',
      'model_reasoning_effort="max"',
      prompt
    ])
  })

  it('leaves executable commands unchanged', () => {
    const invocation = commandInvocation('C:\\Users\\Ali Hammoud\\.local\\bin\\claude.exe', ['-p'], 'win32')

    expect(invocation).toEqual({ command: 'C:\\Users\\Ali Hammoud\\.local\\bin\\claude.exe', args: ['-p'] })
  })

  it('keeps Windows cli wrappers attached', () => {
    expect(detachCliProcess('win32')).toBe(false)
    expect(detachCliProcess('darwin')).toBe(true)
    expect(detachCliProcess('linux')).toBe(true)
  })
})
