import { execFile } from 'node:child_process'

export interface GitResult {
  code: number
  stdout: string
  stderr: string
}

const GIT_TIMEOUT_MS = 120000

export function runGit(args: string[], cwd: string): Promise<GitResult> {
  return new Promise(resolve => {
    execFile(
      'git',
      args,
      { cwd, timeout: GIT_TIMEOUT_MS, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } },
      (error, stdout, stderr) => {
        resolve({ code: error ? (error as { code?: number }).code ?? 1 : 0, stdout, stderr })
      }
    )
  })
}
