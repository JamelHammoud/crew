import { authorizePlugin, setPluginOauthPath } from '../src/runner/pluginOauth'
import { offerOf, resolvePlugin, type CrewPlugin } from '../src/shared/plugins'

const oauthPath = process.argv[2]
if (!oauthPath) throw new Error('Pass Crew’s plugin OAuth file path.')

const offer = offerOf('raylight')
if (!offer) throw new Error('Raylight is not in Crew’s plugin catalog.')

const plugin: CrewPlugin = {
  ...offer,
  id: 'raylight-live-check',
  by: 'Crew',
  ts: Date.now()
}

setPluginOauthPath(oauthPath)
await authorizePlugin(resolvePlugin(plugin))
console.log('Raylight OAuth and required MCP tools verified.')
