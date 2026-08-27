export const CREW = 'Crew'

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

export function windowName(place: string, showing: string): string {
  const where = tidy(place)
  const what = clip(tidy(showing), SHOWING_LIMIT)
  if (where && what) return `${where} | ${what}`
  return where || what || CREW
}
