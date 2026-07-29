// A setting that is on or off. White is the app's one action color, so on is
// white and off is the foreground at the weight a border carries.
export default function Toggle({
  on,
  label,
  onChange
}: {
  on: boolean
  label: string
  onChange: (on: boolean) => void
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-[42px] shrink-0 rounded-full transition-colors duration-200 active:scale-95 ${
        on ? 'bg-fg' : 'bg-fg/15 hover:bg-fg/25'
      }`}
    >
      <span
        className={`absolute top-1 left-1 h-4 w-4 rounded-full transition-transform duration-200 ease-out ${
          on ? 'translate-x-[18px] bg-ink-900' : 'bg-fg/70'
        }`}
      />
    </button>
  )
}
