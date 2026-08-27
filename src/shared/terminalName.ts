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

export const RAN_KEPT = 5

export type TerminalNaming = { title: string; running: string; ran: string[]; command: string | null }

// A shell standing at its prompt is still the terminal somebody opened to run
// something, so the last thing it ran is what it goes on being called until it
// runs the next one.
export function ranAfter(ran: string[], command: string): string[] {
  if (!command) return ran
  return [command, ...ran.filter(one => one !== command)].slice(0, RAN_KEPT)
}

export function terminalLabel(tab: TerminalNaming): string {
  const ran = tab.ran[0] ?? ''
  return tab.title || tab.running || ran || (tab.command ? commandName(tab.command) : '') || 'Terminal'
}

export function terminalDetail(tab: TerminalNaming): string {
  return tab.running || tab.ran[0] || tab.command || ''
}

// What the pill cannot show: everything else this terminal has run, newest
// first, with whatever it is called by already left out.
export function terminalEarlier(tab: TerminalNaming): string[] {
  const label = terminalLabel(tab)
  return tab.ran.filter(one => one !== label)
}
