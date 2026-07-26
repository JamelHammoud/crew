import type { HighlighterGeneric } from '@shikijs/types'
import { aliasesFor, LANGUAGE_NAMES, loadLanguage, shikiCore, THEME_NAMES } from '../highlight'

export const CODE_LANGUAGES: Record<string, { name: string; aliases?: string[] }> = {
  text: { name: 'Plain text', aliases: ['txt', 'plaintext', 'none'] },
  ...Object.fromEntries(
    Object.entries(LANGUAGE_NAMES).map(([lang, name]) => [lang, { name, aliases: aliasesFor(lang) }])
  )
}

export async function createCodeHighlighter(): Promise<HighlighterGeneric<string, string>> {
  const core = await shikiCore()
  return {
    getLoadedLanguages: () => core.getLoadedLanguages(),
    getLoadedThemes: () => core.getLoadedThemes(),
    loadLanguage: (lang: string) => loadLanguage(lang),
    codeToTokens: (code: string, options: { lang: string }) =>
      core.codeToTokens(code, { lang: options.lang, themes: THEME_NAMES, defaultColor: false })
  } as unknown as HighlighterGeneric<string, string>
}
