export const GOAL_LIMIT = 4000

export function goalCondition(text: string): string {
  const said = text.trim()
  if (said.length <= GOAL_LIMIT) return said
  const cut = said.slice(0, GOAL_LIMIT)
  const space = cut.lastIndexOf(' ')
  return (space > GOAL_LIMIT / 2 ? cut.slice(0, space) : cut).trimEnd()
}

export function goalBrief(condition: string): string {
  return `Keep working until this is done, and do not stop before it is: ${condition}\n\nDecide what to do next yourself rather than stopping to ask.`
}
