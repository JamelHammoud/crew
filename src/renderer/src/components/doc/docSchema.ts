import { BlockNoteSchema, createCodeBlockSpec, defaultBlockSpecs } from '@blocknote/core/blocks'
import { en } from '@blocknote/core/locales'
import { CODE_LANGUAGES, createCodeHighlighter } from './docCode'

export const docSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    codeBlock: createCodeBlockSpec({
      defaultLanguage: 'text',
      supportedLanguages: CODE_LANGUAGES,
      createHighlighter: createCodeHighlighter
    })
  }
})

export const docDictionary = {
  ...en,
  placeholders: {
    ...en.placeholders,
    emptyDocument: 'Write, or press / to add a block',
    default: 'Press / to add a block',
    heading: 'Heading',
    quote: 'Quote',
    bulletListItem: 'List',
    numberedListItem: 'List',
    checkListItem: 'To-do',
    toggleListItem: 'Toggle'
  }
}
