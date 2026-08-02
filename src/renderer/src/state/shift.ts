function hold(held: boolean): void {
  document.documentElement.toggleAttribute('data-shift', held)
}

export function watchShift(): () => void {
  const read = (event: KeyboardEvent) => hold(event.shiftKey)
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
