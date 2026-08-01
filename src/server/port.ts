import net from 'node:net'

const PROBE_MS = 500

// A crew is reached at 127.0.0.1 and a port. The window connects there, the
// runner connects there, and every curl line an agent is handed is written from
// it. macOS lets a second listener take 127.0.0.1 on a port a first one is
// already holding as 0.0.0.0, and loopback goes to the narrower of the two, so
// a crew opened second quietly takes the address of the one opened first: its
// windows land on the wrong session, are told "Wrong session code", and
// reconnect forever. Whether somebody answers on loopback is the whole of what
// says a port is taken, whichever address they are really bound to.
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
