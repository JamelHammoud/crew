const KEY = 'crew.boot.seen'

export function bootSeen(): boolean {
  return import.meta.env.DEV && globalThis.sessionStorage?.getItem(KEY) === 'yes'
}

export function rememberBoot(): void {
  if (import.meta.env.DEV) globalThis.sessionStorage?.setItem(KEY, 'yes')
}
