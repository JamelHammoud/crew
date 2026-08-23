import { Crews } from '../../src/main/crews'

export function crewsAt(paths: { agents?: string; session?: string; projects?: string; personal?: string } = {}): Crews {
  const crews = new Crews()
  if (paths.agents) crews.setAgentsPath(paths.agents)
  if (paths.session) crews.setSessionPath(paths.session)
  if (paths.projects) crews.setProjectsPath(paths.projects)
  if (paths.personal) crews.setPersonalPath(paths.personal)
  return crews
}
