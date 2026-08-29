export function collapsibleSidebarClass(collapsed: boolean, glass: boolean): string {
  const width = collapsed ? 'w-0' : 'w-[300px]'
  const surface = glass ? 'sidebar-pinned bg-ink-800' : 'bg-ink-900'
  const line = collapsed ? 'border-transparent' : glass ? 'border-[var(--glass-line)]' : 'border-ink-700'

  return `shrink-0 overflow-hidden border-r transition-[width] duration-200 ${width} ${surface} ${line}`
}

export function collapsibleSidebarSearchClass(glass: boolean): string {
  const surface = glass ? 'bg-fg/[0.06]' : 'bg-ink-700'
  return `h-10 rounded-full ${surface} flex items-center gap-2 px-3 transition-[background-color,box-shadow] duration-150 focus-within:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.10)] light:focus-within:shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)]`
}
