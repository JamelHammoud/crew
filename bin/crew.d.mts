export type CliRequest = {
  folder: string
  name?: string
  home?: 'folder' | 'private'
  share?: boolean
  link?: string
}

export type CliArgs =
  | { kind: 'help' }
  | { kind: 'version' }
  | { kind: 'error'; message: string }
  | { kind: 'open'; request: CliRequest }

export type CliLaunch = { command: string; args: string[] }

export const OPEN_FLAG: string
export const HELP: string

export function parseArgs(argv: string[], cwd: string): CliArgs
export function childEnv(env: Record<string, string | undefined>): Record<string, string | undefined>
export function openFlag(request: CliRequest): string
export function appLaunch(
  platform: string,
  env: Record<string, string | undefined>,
  homeDir: string,
  projectRoot: string,
  exists?: (target: string) => boolean
): CliLaunch | null
