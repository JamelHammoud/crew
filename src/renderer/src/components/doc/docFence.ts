import { createExtension } from '@blocknote/core'

export const docFence = createExtension({
  key: 'crewDocFence',
  inputRules: [
    {
      find: /^```$/,
      replace: () => ({ type: 'codeBlock', props: {}, content: [] })
    }
  ]
})
