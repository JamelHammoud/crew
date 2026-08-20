import { pluginKey, resolvePlugin, type CrewPlugin } from './plugins'

// The plugin somebody put on this one message. It is the first thing said, so
// it stands in front of whatever else the crew has plugged in, and it names the
// plugin rather than describing it: the tools announce themselves to the model
// already, and a second account of them here would be wrong the day one moves.
function askedFor(plugin: CrewPlugin): string {
  const resolved = resolvePlugin(plugin)
  return [
    `## ${resolved.label}`,
    ``,
    `This message was sent with ${resolved.label} on it, so use its tools for the work rather than doing it another way. If they are not there, say so rather than carrying on without them.`
  ].join('\n')
}

function raylight(apiBase: string, promptId: string): string {
  return [
    `## Raylight`,
    ``,
    `Raylight works through the project open in its editor. Call get_editor_status before reading or changing a project.`,
    ``,
    `If no editor is connected, call list_projects and use the exact editUrl it returns. Put that editor beside the conversation with:`,
    ``,
    `  curl -s -X POST ${apiBase}/page -H 'content-type: application/json' -d '{"promptId":"${promptId}","url":"EDIT_URL","title":"Raylight"}'`,
    ``,
    `Wait until get_editor_status says the editor is connected before making changes. Use Raylight's render and frame review tools to check the result. When the work is ready to review, show the exact editUrl beside the conversation again. If a render returns a video or review URL, show that exact URL too. Never guess a Raylight project URL.`
  ].join('\n')
}

export function pluginPreamble(
  apiBase: string,
  promptId: string,
  plugins: readonly CrewPlugin[],
  supportsMcp: boolean,
  usePlugin?: string
): string {
  if (!supportsMcp) return ''
  const wanted = usePlugin ? pluginKey(usePlugin) : ''
  const asked = wanted ? plugins.find(plugin => pluginKey(plugin.name) === wanted) : undefined
  if (!asked) return ''
  return [
    askedFor(asked),
    pluginKey(asked.name) === 'raylight' ? raylight(apiBase, promptId) : ''
  ]
    .filter(Boolean)
    .join('\n\n')
}
