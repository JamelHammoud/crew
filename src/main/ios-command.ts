import { execFile } from 'node:child_process'
import path from 'node:path'

export type CommandResult = { ok: boolean; stdout: string; stderr: string; code: number | null }

export const COMMAND_LIMIT = 16 * 1024 * 1024
export const DISCOVERY_TIMEOUT = 30_000

export function command(
  file: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv; timeout?: number } = {}
): Promise<CommandResult> {
  return new Promise(resolve => {
    execFile(
      file,
      args,
      {
        cwd: options.cwd,
        env: options.env,
        timeout: options.timeout ?? DISCOVERY_TIMEOUT,
        maxBuffer: COMMAND_LIMIT,
        encoding: 'utf8'
      },
      (error, stdout, stderr) => {
        const code =
          typeof (error as (NodeJS.ErrnoException & { code?: unknown }) | null)?.code === 'number'
            ? ((error as unknown as { code: number }).code ?? null)
            : error
              ? 1
              : 0
        resolve({ ok: !error, stdout: String(stdout), stderr: String(stderr), code })
      }
    )
  })
}

export function jsonFrom<T>(text: string): T | null {
  const objectAt = text.indexOf('{')
  const arrayAt = text.indexOf('[')
  const start = objectAt < 0 ? arrayAt : arrayAt < 0 ? objectAt : Math.min(objectAt, arrayAt)
  const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'))
  if (start < 0 || end < start) return null
  try {
    return JSON.parse(text.slice(start, end + 1)) as T
  } catch {
    return null
  }
}

export function developerDir(xcodePath?: string): string | undefined {
  return xcodePath ? path.join(xcodePath, 'Contents', 'Developer') : undefined
}

export function xcodeEnv(xcodePath?: string): NodeJS.ProcessEnv {
  const selected = developerDir(xcodePath)
  return selected ? { ...process.env, DEVELOPER_DIR: selected } : process.env
}

export function prettyCommand(file: string, args: string[]): string {
  return [file, ...args].map(value => (/\s/.test(value) ? JSON.stringify(value) : value)).join(' ')
}
