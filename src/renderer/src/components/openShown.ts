import { filePathOf } from '../../../shared/urls'
import { useBrowser } from '../state/browser'
import { locatePaths, openable, targetFor } from './fileLinks'

export const shownPaths = (pages: string[]): string[] =>
  pages.map(filePathOf).filter((path): path is string => path !== null)

// Everything one call named, opened where the app can really read it: a file in
// the file view, so a stylesheet is lit and a picture is drawn, and an address
// in the browser. A file is placed first, because the same file arrives from
// another machine under that machine's own path, and one nobody here can follow
// is left alone rather than opened on nothing.
export async function openShown(pages: string[]): Promise<void> {
  const paths = shownPaths(pages)
  if (paths.length > 0) await locatePaths(paths)
  const browser = useBrowser.getState()
  // The first one named is the one to read, so they are opened from the back
  // and each arrival takes the front.
  for (const page of [...pages].reverse()) {
    const path = filePathOf(page)
    if (path === null) browser.showPage(page)
    else if (openable(path)) browser.openFile(targetFor(path))
  }
}
