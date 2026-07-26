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
// side panel holds, and an ask is a message in the chat.
export function opensPanel(action: ToolAction): boolean {
  if (action.kind === 'web') return !action.external
  return action.kind !== 'prompt'
}
