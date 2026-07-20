import { execFile } from 'node:child_process'

export interface GitResult {
  code: number
  stdout: string
  stderr: string
}

export function runGit(args: string[], cwd: string): Promise<GitResult> {
  return new Promise(resolve => {
    execFile('git', args, { cwd }, (error, stdout, stderr) => {
      resolve({ code: error ? (error as { code?: number }).code ?? 1 : 0, stdout, stderr })
    })
  })
}
