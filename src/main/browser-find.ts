import type { Input, WebContents } from 'electron'

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
  contents.on('before-input-event', (event, input) => {
    if (!browserFindShortcut(input)) return
    event.preventDefault()
    contents.hostWebContents.send('browser:find')
  })
}
