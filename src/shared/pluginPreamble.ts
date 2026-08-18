import type { CrewPlugin } from './plugins'

export function pluginPreamble(
  apiBase: string,
  promptId: string,
  plugins: readonly CrewPlugin[],
  supportsMcp: boolean
): string {
  if (!supportsMcp || !plugins.some(plugin => plugin.name === 'raylight')) return ''
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
