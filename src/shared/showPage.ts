// A file or a page an agent put on the screen. It is the browser and the file
// view the app already has, asked for from the outside: the agent names what to
// look at, and the panel beside the chat opens on it for whoever is reading the
// thread. That is a curl line in the preamble rather than a tool on any one CLI,
// the same way the board and the helpers are, so every provider gets it at once.
//
// Nothing about it is state the host holds. The call is written down as one
// event on the thread, so the row stands there afterwards as the way back to
// what was shown and it replays for free.

import { pageUrl } from './urls'

export const PAGE_TITLE_LIMIT = 60

// How many one call may open at once. A run showing the three files it changed
// is the whole point of a list, and a panel handed a dozen tabs is somewhere to
// tidy up rather than somewhere to look.
export const PAGE_LIMIT = 6

export const pageTitle = (raw: unknown): string =>
  typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, PAGE_TITLE_LIMIT) : ''

// One address or several. Every one of them has to be openable, so a call that
// names one bad address is refused whole: opening the rest would leave a model
// watching for a file that quietly never arrived.
export function pagesNamed(input: unknown): string[] | null {
  const raw = Array.isArray(input) ? input : [input]
  if (raw.length === 0 || raw.length > PAGE_LIMIT) return null
  const pages = raw.map(pageUrl)
  return pages.every((page): page is string => page !== null) ? pages : null
}

// What a row was written down with. A crew from before a call could name more
// than one wrote a single url, which is read here and never written again.
export const shownPages = (shown: { pages?: string[]; url?: string }): string[] =>
  shown.pages ?? (shown.url ? [shown.url] : [])

export function pagePreamble(apiBase: string, promptId: string): string {
  return [
    `## Showing a file or a page`,
    ``,
    `You can put a file or a page on the screen beside the chat, and it opens for whoever is reading this thread. It is how somebody looks at what you have made without going and finding it themselves.`,
    ``,
    `  curl -s -X POST ${apiBase}/page -H 'content-type: application/json' -d '{"promptId":"${promptId}","url":"/Users/you/site/index.html","title":"The signup page"}'`,
    ``,
    `Name several as a list and they all open, ${PAGE_LIMIT} at a time:`,
    ``,
    `  curl -s -X POST ${apiBase}/page -H 'content-type: application/json' -d '{"promptId":"${promptId}","url":["/Users/you/app/theme.css","/Users/you/app/Button.tsx"],"title":"Where the colors come from"}'`,
    ``,
    `Any file on this machine, given as its full path: what you wrote, what you read, a picture, a log. A page is a server you have started here, like localhost:5173, or a site on the web. The title is your own line about what you are showing, and it is what the row in the thread reads as.`,
    ``,
    `Show something when it is worth looking at rather than after every change, and say in your own words what to look at. The row stays in the thread, so it is the way back to it later. Keep the promptId exactly as it is above.`
  ].join('\n')
}
