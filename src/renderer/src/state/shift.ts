// Held shift is an attribute on the root rather than state, because every
// message on screen draws a tray and a capital letter typed in the composer
// would otherwise redraw the whole thread twice.
function hold(held: boolean): void {
  document.documentElement.toggleAttribute('data-shift', held)
}

export function watchShift(): () => void {
  const read = (event: KeyboardEvent) => hold(event.shiftKey)
  // A window that loses focus mid-hold never hears the key come up, so it
  // would come back with shift still held by nobody.
  const drop = () => hold(false)
  window.addEventListener('keydown', read)
  window.addEventListener('keyup', read)
  window.addEventListener('blur', drop)
  return () => {
    window.removeEventListener('keydown', read)
    window.removeEventListener('keyup', read)
    window.removeEventListener('blur', drop)
    drop()
  }
}
