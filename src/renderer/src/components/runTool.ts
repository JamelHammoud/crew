import { fillSlots, slotsIn, STEP_LIMIT, type CrewTool, type ToolAction } from '../../../shared/toolbox'
import { agentToAsk, askPrompt } from '../design/askAgent'
import { useBrowser } from '../state/browser'
import { useMusic } from '../state/music'
import { useCrew } from '../state/store'

// A command written over several lines is several commands, so each line is
// handed to the shell the way it was typed.
const typed = (command: string): string => command.split('\n').join('\r')

// What one press really does. A chain is the tools it names, in the order it
// names them, and a tool it has already reached is passed over, so a pair that
// name each other is a short run rather than a locked window.
export function toolSteps(
  action: ToolAction,
  tools: readonly CrewTool[],
  reached: Set<string> = new Set()
): ToolAction[] {
  if (action.kind !== 'chain') return [action]
  const steps: ToolAction[] = []
  for (const toolId of action.toolIds) {
    if (reached.has(toolId)) continue
    reached.add(toolId)
    const step = tools.find(tool => tool.id === toolId)
    if (step) steps.push(...toolSteps(step.action, tools, reached))
    if (steps.length >= STEP_LIMIT) break
  }
  return steps.slice(0, STEP_LIMIT)
}

const steps = (action: ToolAction): ToolAction[] => toolSteps(action, useCrew.getState().tools)

// The blanks a tool asks for before it runs, gathered across a whole chain, so
// a run of tools built around one word is asked for that word once.
export function toolSlots(action: ToolAction): string[] {
  const asked: string[] = []
  for (const step of steps(action)) for (const slot of slotsIn(step)) if (!asked.includes(slot)) asked.push(slot)
  return asked
}

function runStep(action: ToolAction): void {
  if (action.kind === 'web') {
    if (action.external) void window.crew?.openExternal(action.url)
    else useBrowser.getState().openUrl(action.url)
  }
  if (action.kind === 'terminal')
    useBrowser.getState().addTerminal(action.command && typed(action.command), useCrew.getState().folder)
  if (action.kind === 'file') useBrowser.getState().openFile(action.path)
  if (action.kind === 'doc') useCrew.getState().openDoc(action.page)
  if (action.kind === 'board') useCrew.getState().openBoard(action.boardId)
  if (action.kind === 'copy') void navigator.clipboard?.writeText(action.text)
  if (action.kind === 'say') useCrew.getState().sendChat(action.text)
  if (action.kind === 'todo') useCrew.getState().addTodo(action.text, action.agentId)
  if (action.kind === 'note') {
    const { docs, updateDoc } = useCrew.getState()
    const doc = docs[action.page]
    if (!doc) return
    const written = doc.text.replace(/\s+$/, '')
    updateDoc(action.page, written ? `${written}\n\n${action.text}` : action.text)
  }
  if (action.kind === 'music') {
    const music = useMusic.getState()
    // A list plays from the top and carries the list with it, so Next walks the
    // rest of it rather than falling back into the shelf.
    const trackId = action.trackId ?? music.playlist(action.playlistId ?? null)?.trackIds[0]
    if (trackId) music.put(trackId, action.playlistId ?? null)
  }
  if (action.kind === 'post') useCrew.getState().postChat(action.text, action.agentId)
  if (action.kind === 'prompt') {
    const { agents, sendChat } = useCrew.getState()
    // The agent a tool was built to ask may be offline on the machine pressing
    // it, so whoever is here takes the work rather than nothing happening.
    const agent = agentToAsk(agents, action.agentId ?? null)
    if (!agent) return
    sendChat(askPrompt(agent.label, action.text, []), undefined, undefined, undefined, [agent.id])
  }
}

export function runTool(action: ToolAction, answers: Record<string, string> = {}): void {
  for (const step of steps(action)) runStep(fillSlots(step, answers))
}

// What the tile says instead of closing. Copying, saying something, putting a
// track on and writing a line down all leave you where you are, so the toolbox
// stays up and the tile says what happened rather than a panel closing over
// nothing.
const SAID: Partial<Record<ToolAction['kind'], string>> = {
  copy: 'Copied',
  say: 'Sent',
  post: 'Writing',
  todo: 'Added',
  note: 'Written',
  music: 'Playing'
}

export const saidAfter = (action: ToolAction): string | null => SAID[action.kind] ?? null
