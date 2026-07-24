export const REACTION_EMOJIS = ['🎉', '❤️', '👍', '😂', '👀', '🔥', '👏', '🤔'] as const

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number]

export function isReactionEmoji(value: string): value is ReactionEmoji {
  return (REACTION_EMOJIS as readonly string[]).includes(value)
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
