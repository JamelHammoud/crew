import { Runner, type RunnerOptions } from '../../src/runner'

// Nothing enrols agents on its own, so a test says which agents its runner
// brings: one per provider unless it asks for something else.
export function testRunner(opts: RunnerOptions): Runner {
  const agents =
    opts.agents ?? opts.providers.map(p => ({ instanceId: p.name, provider: p.name, name: p.label, settings: {} }))
  return new Runner({ ...opts, agents })
}
