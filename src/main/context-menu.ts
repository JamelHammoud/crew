import {
  BrowserWindow,
  clipboard,
  Menu,
  shell,
  type ContextMenuParams,
  type MenuItemConstructorOptions,
  type WebContents
} from 'electron'

function separator(items: MenuItemConstructorOptions[]): void {
  if (items.length > 0 && items.at(-1)?.type !== 'separator') items.push({ type: 'separator' })
}

export function contextMenuTemplate(
  contents: WebContents,
  params: ContextMenuParams,
  browser: boolean,
  inspectable: boolean
): MenuItemConstructorOptions[] {
  const items: MenuItemConstructorOptions[] = []
  const editable = params.isEditable
  const hasSelection = params.selectionText.trim().length > 0
  const misspelled = editable && params.misspelledWord.length > 0

  if (browser) {
    items.push(
      {
        label: 'Back',
        enabled: contents.navigationHistory.canGoBack(),
        click: () => contents.navigationHistory.goBack()
      },
      {
        label: 'Forward',
        enabled: contents.navigationHistory.canGoForward(),
        click: () => contents.navigationHistory.goForward()
      },
      { label: 'Reload', click: () => contents.reload() }
    )
  }

  if (params.linkURL.length > 0) {
    separator(items)
    if (/^https?:/i.test(params.linkURL)) {
      items.push({
        label: 'Open Link in New Tab',
        click: () => contents.hostWebContents.send('browser:open', params.linkURL)
      })
    }
    if (/^(https?|mailto):/i.test(params.linkURL)) {
      items.push({
        label: 'Open Link in Your Browser',
        click: () => void shell.openExternal(params.linkURL)
      })
    }
    items.push({ label: 'Copy Link', click: () => clipboard.writeText(params.linkURL) })
  }

  if (params.mediaType === 'image' && params.hasImageContents) {
    separator(items)
    items.push({ label: 'Copy Image', click: () => contents.copyImageAt(params.x, params.y) })
    if (params.srcURL.length > 0) {
      items.push({ label: 'Copy Image Address', click: () => clipboard.writeText(params.srcURL) })
    }
  }

  if (misspelled) {
    separator(items)
    for (const suggestion of params.dictionarySuggestions) {
      items.push({
        label: suggestion,
        click: () => contents.replaceMisspelling(suggestion)
      })
    }
    if (params.dictionarySuggestions.length === 0) {
      items.push({ label: 'No Spelling Suggestions', enabled: false })
    }
    items.push({
      label: 'Add to Dictionary',
      click: () => contents.session.addWordToSpellCheckerDictionary(params.misspelledWord)
    })
  }

  if (editable || hasSelection) {
    separator(items)
    if (editable) items.push({ label: 'Cut', enabled: hasSelection, click: () => contents.cut() })
    items.push({ label: 'Copy', enabled: hasSelection, click: () => contents.copy() })
    if (editable) {
      items.push(
        { label: 'Paste', click: () => contents.paste() },
        { type: 'separator' },
        { label: 'Select All', click: () => contents.selectAll() }
      )
    }
  }

  if (browser && inspectable) {
    separator(items)
    items.push({ label: 'Inspect', click: () => contents.inspectElement(params.x, params.y) })
  }

  return items
}

export function installContextMenu(contents: WebContents, browser: boolean, inspectable: boolean): void {
  contents.on('context-menu', (_event, params) => {
    const items = contextMenuTemplate(contents, params, browser, inspectable)
    if (items.length === 0) return
    const host = browser ? contents.hostWebContents : contents
    const win = BrowserWindow.fromWebContents(host)
    Menu.buildFromTemplate(items).popup(win ? { window: win } : undefined)
  })
}
