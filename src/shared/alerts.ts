export interface AgentAlert {
  title: string
  body: string
  threadId?: string
  // Whose it is, so the app can put a face on the row. A system banner carries
  // the words alone.
  agentId?: string
  from?: string
  stopped?: boolean
  // Where the way in leads. A question lives on the board and nowhere else, so
  // opening its thread alone would land you on a page that says nothing about it.
  board?: boolean
}
