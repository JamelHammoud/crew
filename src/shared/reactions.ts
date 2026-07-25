export const QUICK_REACTIONS = ['🎉', '❤️', '👍', '😂'] as const

export type ReactionEmoji = string

const SINGLE_EMOJI = new RegExp('^\\p{RGI_Emoji}$', 'v')

export function isReactionEmoji(value: string): boolean {
  return value.length > 0 && value.length <= 32 && SINGLE_EMOJI.test(value)
}

export function messageReactionTarget(messageId: string): string {
  return `message:${messageId}`
}

export function agentStepReactionTarget(promptId: string, stepId: string): string {
  return `agent-step:${promptId}:${stepId}`
}

export function agentEndReactionTarget(promptId: string): string {
  return `agent-end:${promptId}`
}
