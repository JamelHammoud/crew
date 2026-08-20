import { authorizePlugin, setPluginOauthPath } from '../src/runner/pluginOauth'
import { closeMcp, openMcp } from '../src/runner/plugins'
import { codexProvider } from '../src/runner/providers/codex'
import { offerOf, resolvePlugin, type CrewPlugin } from '../src/shared/plugins'
import type { RunStep } from '../src/shared/llm'

const oauthPath = process.argv[2]
if (!oauthPath) throw new Error('Pass Crew’s plugin OAuth file path.')

const offer = offerOf('raylight')
if (!offer) throw new Error('Raylight is not in Crew’s plugin catalog.')

const plugin: CrewPlugin = {
  ...offer,
  id: 'raylight-live-agent-check',
  by: 'Crew',
  ts: Date.now()
}

setPluginOauthPath(oauthPath)
const headers = await authorizePlugin(resolvePlugin(plugin))
const mcp = openMcp([plugin], codexProvider.mcp, 'raylight-live-agent-check', { raylight: headers })
if (!mcp) throw new Error('Crew did not hand Raylight to Codex.')

const steps: RunStep[] = []

try {
  const run = codexProvider.start(
    [
      'This is a read-only live verification of the Raylight plugin.',
      'Use only the Raylight MCP tools. Do not use shell, curl, browser, files, or web search.',
      'Call get_editor_status first.',
      'If the editor is disconnected, call list_projects next.',
      'Reply with a compact JSON object containing connected, projectCount, projectName, and mcpVerified set to true.',
      'You must make the tool calls and use their results.'
    ].join('\n'),
    process.cwd(),
    {
      onStep: step => {
        steps.push(step)
        if (step.name && step.status === 'finished') console.log(`Agent used ${step.name}`)
      },
      onTokens: () => {}
    },
    { model: 'gpt-5.6-sol', effort: 'high' },
    { mcp }
  )

  const result = await run.done
  const used = new Set(steps.map(step => step.name).filter((name): name is string => Boolean(name)))
  if (![...used].some(name => /raylight\.get_editor_status/i.test(name))) {
    throw new Error('Codex did not call Raylight get_editor_status.')
  }
  if (![...used].some(name => /raylight\.list_projects/i.test(name))) {
    throw new Error('Codex did not call Raylight list_projects after the disconnected status.')
  }
  console.log(`Agent answer: ${result.text.trim()}`)
  console.log('Raylight agent handoff verified.')
} finally {
  closeMcp(mcp)
}
