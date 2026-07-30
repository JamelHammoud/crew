// A page an agent put on the screen. It is the browser the app already has,
// asked for from the outside: the agent names an address or a file it has
// written, and the panel beside the chat opens on it for whoever is reading the
// thread. That is a curl line in the preamble rather than a tool on any one CLI,
// the same way the board and the helpers are, so every provider gets it at once.
//
// Nothing about it is state the host holds. The call is written down as one
// event on the thread, so the row stands there afterwards as the way back to
// the page and it replays for free.

export const PAGE_TITLE_LIMIT = 60

export const pageTitle = (raw: unknown): string =>
  typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, PAGE_TITLE_LIMIT) : ''

export function pagePreamble(apiBase: string, promptId: string): string {
  return [
    `## Showing a page`,
    ``,
    `You can put a page on the screen beside the chat, and it opens for whoever is reading this thread. It is how somebody looks at what you have made without going and finding it themselves.`,
    ``,
    `  curl -s -X POST ${apiBase}/page -H 'content-type: application/json' -d '{"promptId":"${promptId}","url":"/Users/you/site/index.html","title":"The signup page"}'`,
    ``,
    `The address is a file you have written, given as its full path, a server you have started here, like localhost:5173, or a site on the web. The title is your own line about what it is, and it is what the row in the thread reads as.`,
    ``,
    `Show a page when it is worth looking at rather than after every change, and say in your own words what to look at. The row stays in the thread, so it is the way back to it later. Keep the promptId exactly as it is above.`
  ].join('\n')
}
