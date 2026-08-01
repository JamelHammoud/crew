import net from 'node:net'

const PROBE_MS = 500

export function loopbackAnswers(port: number): Promise<boolean> {
  return new Promise(done => {
    const socket = net.connect({ host: '127.0.0.1', port })
    const settle = (answered: boolean): void => {
      socket.destroy()
      done(answered)
    }
    socket.setTimeout(PROBE_MS, () => settle(false))
    socket.once('connect', () => settle(true))
    socket.once('error', () => settle(false))
  })
}

export async function portToAsk(preferred: number): Promise<number> {
  return (await loopbackAnswers(preferred)) ? 0 : preferred
}
