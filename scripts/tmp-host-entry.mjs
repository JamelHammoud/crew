import { createCrewServer } from '../src/server/index'
import { CrewSession } from '../src/server/session'
import { Store } from '../src/server/store'

export async function startHost(repoPath) {
  const store = new Store(repoPath)
  const session = new CrewSession(store)
  const server = await createCrewServer(session, { port: 0, host: '127.0.0.1' })
  return { port: server.port(), code: session.code, close: () => server.close() }
}
