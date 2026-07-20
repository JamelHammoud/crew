import { it } from 'vitest'
import { startHost, TestUi } from './helpers/session'

it('debug pause', async () => {
  const host = await startHost(undefined, { heartbeatMs: 100 })
  const ui = await TestUi.connect(host.url, 'sam', host.code)
  console.log('connected, pausing')
  ui.pauseTransport()
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 200))
    console.log(
      `t=${(i + 1) * 200}ms readyState=${(ui as any).ws.readyState}`
    )
  }
  ui.close()
  await host.close()
}, 10000)
