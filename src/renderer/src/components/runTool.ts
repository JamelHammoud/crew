import type { ToolAction } from '../../../shared/toolbox'
import { agentToAsk, askPrompt } from '../design/askAgent'
import { useBrowser } from '../state/browser'
import { useCrew } from '../state/store'

// A command written over several lines is several commands, so each line is
// handed to the shell the way it was typed.
const typed = (command: string): string => command.split('\n').join('\r')

export function runTool(action: ToolAction): void {
  if (action.kind === 'web') {
    if (action.external) void window.crew?.openExternal(action.url)
    else useBrowser.getState().openUrl(action.url)
  }
  if (action.kind === 'terminal') useBrowser.getState().addTerminal(action.command && typed(action.command))
  if (action.kind === 'file') useBrowser.getState().openFile(action.path)
  if (action.kind === 'doc') useCrew.getState().openDoc(action.page)
  if (action.kind === 'board') useCrew.getState().openBoard(action.boardId)
  if (action.kind === 'copy') void navigator.clipboard?.writeText(action.text)
  if (action.kind === 'prompt') {
    const { agents, sendChat } = useCrew.getState()
    // The agent a tool was built to ask may be offline on the machine pressing
    // it, so whoever is here takes the work rather than nothing happening.
    const agent = agentToAsk(agents, action.agentId ?? null)
    if (!agent) return
    sendChat(askPrompt(agent.label, action.text, []), undefined, undefined, undefined, [agent.id])
  }
}

// Where pressing it leaves you: a page, a file and a terminal are all things the
// side panel holds. An ask is a message in the chat, and a doc and a board take
// you to their own tab, so all three are somewhere else already.
export function opensPanel(action: ToolAction): boolean {
  if (action.kind === 'web') return !action.external
  return action.kind === 'terminal' || action.kind === 'file'
}

// Copying leaves you where you are, so the toolbox stays up and the tile says
// what happened rather than a panel closing over nothing.
export const staysOpen = (action: ToolAction): boolean => action.kind === 'copy'
