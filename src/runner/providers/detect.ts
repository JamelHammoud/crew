import { claudeProvider } from './claude'
import { codexProvider } from './codex'
import { kimiProvider } from './kimi'
import type { Provider } from './types'

export const builtinProviders: Provider[] = [kimiProvider, claudeProvider, codexProvider]

export async function detectProviders(): Promise<Provider[]> {
  const found: Provider[] = []
  for (const provider of builtinProviders) {
    if (await provider.detect()) found.push(provider)
  }
  return found
}
