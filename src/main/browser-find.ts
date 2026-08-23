import type { Input, WebContents } from 'electron'

const installed = new WeakSet<WebContents>()

export function browserFindShortcut(input: Input): boolean {
  return (
    input.type === 'keyDown' &&
    input.key.toLowerCase() === 'f' &&
    (input.meta || input.control) &&
    !input.alt &&
    !input.shift
  )
}

export function installBrowserFind(contents: WebContents): void {
  if (installed.has(contents)) return
  installed.add(contents)
  contents.on('before-input-event', (event, input) => {
    if (!browserFindShortcut(input)) return
    event.preventDefault()
    contents.hostWebContents.send('browser:find')
  })
}

export function installBrowserFindForHost(contents: WebContents | null | undefined, host: WebContents): boolean {
  if (!contents || contents.getType() !== 'webview' || contents.hostWebContents.id !== host.id) return false
  installBrowserFind(contents)
  return true
}
