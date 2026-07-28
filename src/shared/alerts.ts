export interface AgentAlert {
  title: string
  body: string
  threadId?: string
  // Whose it is, so the app can put a face on the row. A system banner carries
  // the words alone.
  agentId?: string
  from?: string
  stopped?: boolean
}
