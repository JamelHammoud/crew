let down = false

function hold(held: boolean): void {
  if (held === down) return
  down = held
  document.documentElement.toggleAttribute('data-shift', held)
}

export function watchShift(): () => void {
  const read = (event: KeyboardEvent | MouseEvent) => hold(event.shiftKey)
  const drop = () => hold(false)
  window.addEventListener('keydown', read, true)
  window.addEventListener('keyup', read, true)
  window.addEventListener('pointermove', read, true)
  window.addEventListener('blur', drop)
  return () => {
    window.removeEventListener('keydown', read, true)
    window.removeEventListener('keyup', read, true)
    window.removeEventListener('pointermove', read, true)
    window.removeEventListener('blur', drop)
    drop()
  }
}
