import { claudeProvider } from './claude'
import { codexProvider } from './codex'
import { geminiProvider } from './gemini'
import { grokProvider } from './grok'
import { kimiProvider } from './kimi'
import { localProvider, serverProviders } from './local'
import type { Provider } from './types'

export const builtinProviders: Provider[] = [
  claudeProvider,
  codexProvider,
  geminiProvider,
  kimiProvider,
  grokProvider,
  localProvider
]

// The ones that ship, and then one for every server somebody has written down
// on this machine. A written one is read fresh each time, so a provider added a
// moment ago is in the list rather than in the next window.
export const allProviders = (): Provider[] => [...builtinProviders, ...serverProviders()]

export async function detectProviders(): Promise<Provider[]> {
  const found: Provider[] = []
  for (const provider of allProviders()) {
    if (await provider.detect()) found.push(provider)
  }
  return found
}
