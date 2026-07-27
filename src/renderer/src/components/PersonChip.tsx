import Avatar from './Avatar'

// Somebody, said as one thing: their face and their name in a pill, small enough
// to stand inside a line of text. The name takes the foreground at an opacity
// rather than a solid grey, so it reads on glass as well as on a panel.
export default function PersonChip({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 h-6 pl-0.5 pr-2 max-w-full rounded-full bg-fg/[0.08] ${className}`}
    >
      <Avatar name={name} size="xs" />
      <span className="truncate text-xs font-medium text-fg/70">{name}</span>
    </span>
  )
}
