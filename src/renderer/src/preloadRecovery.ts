type PreloadTarget = {
  addEventListener: (type: string, listener: EventListener) => void
  removeEventListener: (type: string, listener: EventListener) => void
  location: { reload: () => void }
}

export function recoverMissingPreload(target: PreloadTarget): () => void {
  const reload = (event: Event) => {
    event.preventDefault()
    target.location.reload()
  }

  target.addEventListener('vite:preloadError', reload)
  return () => target.removeEventListener('vite:preloadError', reload)
}
