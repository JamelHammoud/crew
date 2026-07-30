// The row that opens on a message before anybody has reached for the picker.
// These are what it holds until somebody says otherwise, and after that they are
// theirs: the set is kept where they sit and never sent, so what is on your row
// is nobody else's business and nobody else's setting.
export const QUICK_REACTIONS = ['🎉', '❤️', '👍', '😂'] as const

// Ten is where a row of one-tap reactions stops being one and starts being the
// picker with extra steps. None at all is a real answer too, and it leaves the
// tray as the way in.
export const MAX_QUICK_REACTIONS = 10

export type ReactionEmoji = string

const SINGLE_EMOJI = new RegExp('^\\p{RGI_Emoji}$', 'v')

export function isReactionEmoji(value: string): boolean {
  return value.length > 0 && value.length <= 32 && SINGLE_EMOJI.test(value)
}

const CUSTOM_REF = /^:[a-z0-9][a-z0-9_+-]*:$/

// What may stand on the row: an emoji off the sheet, or one of the crew's own
// written as `:name:`. The list is a set rather than a sequence of anything, so a
// repeat is dropped rather than drawn twice, and one longer than the cap is cut
// rather than refused whole.
export function cleanQuickReactions(value: unknown): string[] {
  if (!Array.isArray(value)) return [...QUICK_REACTIONS]
  const kept = value.filter(
    (item): item is string => typeof item === 'string' && (isReactionEmoji(item) || CUSTOM_REF.test(item))
  )
  return [...new Set(kept)].slice(0, MAX_QUICK_REACTIONS)
}

const CUSTOM_REF = /^:[a-z0-9][a-z0-9_+-]*:$/

export function messageReactionTarget(messageId: string): string {
  return `message:${messageId}`
}

export function agentStepReactionTarget(promptId: string, stepId: string): string {
  return `agent-step:${promptId}:${stepId}`
}

export function agentEndReactionTarget(promptId: string): string {
  return `agent-end:${promptId}`
}
