export function collapsibleSidebarClass(collapsed: boolean, glass: boolean): string {
  const width = collapsed ? 'w-0' : 'w-[300px]'
  const surface = glass ? 'sidebar-pinned bg-ink-800' : 'bg-ink-900'
  const line = collapsed ? 'border-transparent' : glass ? 'border-[var(--glass-line)]' : 'border-ink-700'

  return `shrink-0 overflow-hidden border-r transition-[width] duration-200 ${width} ${surface} ${line}`
}
