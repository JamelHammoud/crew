import { describe, it } from 'vitest'
import { startHost, TestUi } from './helpers/session'

describe('dbg', () => {
  it('join', async () => {
    const host = await startHost()
    const ui = await TestUi.connect(host.url, 'jamel', host.code)
    ui.send({ type: 'huddle.join', peerId: 'p1', muted: false, camera: false })
    await new Promise(r => setTimeout(r, 500))
    console.log(ui.messages.map(m => m.type).join(','))
    ui.close()
    await host.close()
  })
})
