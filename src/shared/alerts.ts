export interface AgentAlert {
  title: string
  body: string
  threadId?: string
  // Whose it is, so the app can put a face on the row. A system banner carries
  // the words alone.
  agentId?: string
  from?: string
  // Something went wrong, which is the one thing here that wears the warning
  // mark. A run somebody ended is not one of them: they meant it.
  failed?: boolean
  // Where the way in leads. A question lives on the board and nowhere else, so
  // opening its thread alone would land you on a page that says nothing about it.
  board?: boolean
}
