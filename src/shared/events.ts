export type SessionEvent =
  | { id: string; ts: number; kind: 'message'; authorId: string; authorName: string; text: string; mentions: string[] }
  | { id: string; ts: number; kind: 'agent.start'; promptId: string; agentId: string; agentLabel: string; promptText: string; byName: string }
  | { id: string; ts: number; kind: 'agent.end'; promptId: string; agentId: string; agentLabel: string; ok: boolean; text?: string; error?: string }
  | { id: string; ts: number; kind: 'person.joined'; memberId: string; name: string }
  | { id: string; ts: number; kind: 'person.left'; memberId: string; name: string }
  | { id: string; ts: number; kind: 'agent.online'; agentId: string; label: string }
  | { id: string; ts: number; kind: 'agent.offline'; agentId: string; label: string }
  | { id: string; ts: number; kind: 'doc'; page: string; text: string; byName: string }

export const SYSTEM_AUTHOR_ID = 'crew'
export const SYSTEM_AUTHOR_NAME = 'crew'
