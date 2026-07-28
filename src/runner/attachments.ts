import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Attachment } from '../shared/attachments'

export interface LocalAttachment {
  name: string
  path: string
}

const DOWNLOAD_TIMEOUT_MS = 30000

export class AttachmentCache {
  constructor(private repoPath: string) {}

  // A picture the agent has to read has to be a file somewhere. For an ordinary
  // message that is the folder beside the session, where it is already kept and
  // where it stays. A ghost thread has nothing beside the session, so its
  // pictures go outside the project altogether and are taken away with the run:
  // the folder the crew syncs never holds one, on any machine.
  async ensure(attachments: Attachment[], httpBase: string, ghostPromptId?: string): Promise<LocalAttachment[]> {
    const dir = ghostPromptId ? this.ghostDir(ghostPromptId) : path.join(this.repoPath, '.crew', 'attachments')
    const local: LocalAttachment[] = []
    for (const attachment of attachments) {
      const full = path.join(dir, attachment.file)
      if (!fs.existsSync(full)) {
        const data = await this.download(`${httpBase}/attachments/${attachment.file}`)
        if (!data) continue
        fs.mkdirSync(dir, { recursive: true })
        fs.writeFileSync(full, data)
      }
      local.push({ name: attachment.name, path: full })
    }
    return local
  }

  release(promptId: string): void {
    fs.rmSync(this.ghostDir(promptId), { recursive: true, force: true })
  }

  private ghostDir(promptId: string): string {
    return path.join(os.tmpdir(), `crew-${promptId}`)
  }

  private async download(url: string): Promise<Buffer | null> {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) })
      if (!res.ok) return null
      return Buffer.from(await res.arrayBuffer())
    } catch {
      return null
    }
  }
}

export function promptWithAttachments(text: string, attachments: LocalAttachment[]): string {
  if (attachments.length === 0) return text
  const list = attachments.map(a => `- ${a.path} (${a.name})`).join('\n')
  return [text, '', 'Images shared with this message, read them from disk:', list].join('\n')
}
