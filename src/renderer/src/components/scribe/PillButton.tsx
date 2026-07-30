// A round button on the pill or on the card it grows into. Both stand over
// somebody else's window, so the marks inside wear the bold weight rather than the
// one a mark carries inside the app: they are read at arm's length.
//
// Nothing on either is set in a solid grey. The pill is glass over whatever
// application happens to be behind it, so every one of these takes the foreground
// at an opacity and stands above the surface rather than beside it.
export default function PillButton({
  label,
  solid,
  onClick,
  children
}: {
  label: string
  solid?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      // The pill is dragged by anywhere on it, so a button says the press is its
      // own rather than the start of a move.
      onPointerDown={event => event.stopPropagation()}
      aria-label={label}
      className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center transition-all duration-150 active:scale-90 ${
        solid ? 'bg-fg text-ink-900 hover:bg-fg/90' : 'bg-fg/10 text-fg/70 hover:bg-fg/20 hover:text-fg'
      }`}
    >
      {children}
    </button>
  )
}
