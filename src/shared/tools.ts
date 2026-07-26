export const normalizeTool = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]/g, '')

export const SHELL_TOOLS = 'bash shell sh commandexecution localshell powershell run runcommand exec execute terminal'

const SHELL = new Set(SHELL_TOOLS.split(' '))

export const isShellTool = (name: string | undefined): boolean => SHELL.has(normalizeTool(name ?? ''))
