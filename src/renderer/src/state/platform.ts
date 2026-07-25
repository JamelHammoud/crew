export function onMac(): boolean {
  return /Macintosh|Mac OS X/.test(globalThis.navigator?.userAgent ?? '')
}

export function applyPlatform(): void {
  document.documentElement.classList.toggle('mac', onMac())
}
