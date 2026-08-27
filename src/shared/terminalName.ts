export const RUNNING_LIMIT = 200

const WRAPPERS = new Set(['node', 'bun', 'deno', 'python', 'python3', 'ruby', 'perl', 'php', 'osascript'])

const base = (path: string): string => path.split('/').pop() || path

export function commandName(args: string): string {
  const parts = args.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  let head = base(parts[0] ?? '')
  let rest = parts.slice(1)
  if (WRAPPERS.has(head) && (rest[0] ?? '').includes('/')) {
    head = base(rest[0] ?? '')
    rest = rest.slice(1)
  }
  return [head, ...rest].join(' ').slice(0, RUNNING_LIMIT)
}

export function foregroundOn(ps: string, tty: string, shellPid: number): string {
  const want = base(tty)
  if (!want) return ''
  for (const line of ps.split('\n')) {
    const row = line.match(/^\s*(\S+)\s+(\S+)\s+(\d+)\s+(.*)$/)
    if (!row) continue
    const [, on, stat, pid, args] = row
    if (base(on ?? '') !== want || !(stat ?? '').includes('+')) continue
    if (Number(pid) === shellPid) continue
    return commandName(args ?? '')
  }
  return ''
}

export type TerminalNaming = { title: string; running: string; ran: string; command: string | null }

export function terminalLabel(tab: TerminalNaming): string {
  return tab.title || tab.running || tab.ran || (tab.command ? commandName(tab.command) : '') || 'Terminal'
}

export function terminalDetail(tab: TerminalNaming): string {
  return tab.running || tab.ran || tab.command || ''
}
