export const CREW = 'Crew'

// The place a chat with the model alone stands in. It belongs to this machine
// rather than to a crew, so it has no folder and no link to be named after.
export const PERSONAL_PLACE = 'personal'

export const PERSONAL_NAME = 'Personal Chat'

export const SHOWING_LIMIT = 48

const tidy = (text: string): string => text.replace(/\s+/g, ' ').trim()

function clip(text: string, limit: number): string {
  if (text.length <= limit) return text
  const cut = text.slice(0, limit)
  const space = cut.lastIndexOf(' ')
  return `${(space > limit / 2 ? cut.slice(0, space) : cut).trimEnd()}…`
}

// What a window is called in the dock, in the Window menu and in Mission
// Control. Every window used to say Crew, so a row of five of them was five
// rows of the same word and no way to tell which was which. The project comes
// first because it is what somebody is looking for, and what the window is
// standing on comes after it, cut short so the project is always readable.
export function windowName(place: string, showing: string): string {
  const where = tidy(place)
  const what = clip(tidy(showing), SHOWING_LIMIT)
  if (where && what) return `${where} | ${what}`
  return where || what || CREW
}
