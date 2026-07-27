// The controls the music panel is made of. The size comes from whoever uses
// one, since the button that plays a track and the one that skips it are not the
// same size.
export const roundButton =
  'shrink-0 rounded-full flex items-center justify-center text-fg-muted transition-all duration-150 hover:text-fg hover:bg-fg/[0.06] active:scale-95'

export const solidButton =
  'shrink-0 rounded-full flex items-center justify-center bg-fg text-ink-900 transition-all duration-150 hover:bg-fg/90 active:scale-95'

export const quietPill =
  'shrink-0 rounded-full flex items-center justify-center bg-fg/[0.08] text-fg text-xs font-medium transition-all duration-150 hover:bg-fg/[0.12] active:scale-95'

// What a row can do. The slot it stands in is held whether or not anything is
// showing in it, so the time beside it does not shuffle sideways under the
// pointer.
export const rowButton =
  'w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-fg-faint transition-all duration-150 hover:text-fg hover:bg-fg/10 active:scale-95'

export const quietRowButton = `${rowButton} opacity-0 group-hover:opacity-100 focus-visible:opacity-100`
