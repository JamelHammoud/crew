import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { isAttachmentFile, isImageType, type Attachment } from '../shared/attachments'

export interface LocalAttachment {
  name: string
  path: string
  image: boolean
}

const DOWNLOAD_TIMEOUT_MS = 30000

export class AttachmentCache {
  constructor(private crewBase: string | null) {}

  // Anything the agent has to read has to be a file somewhere. For an ordinary
  // message that is the folder beside the session, where it is already kept and
  // where it stays. A crew kept on this machine keeps that folder beside the
  // app, so nothing is written into the project on the strength of a picture
  // somebody sent, and a machine with no crew of its own keeps them outside the
  // project for the same reason. A ghost thread has nothing beside the session,
  // so what it carries goes outside the project altogether and is taken away
  // with the run: the folder the crew syncs never holds one, on any machine.
  async ensure(attachments: Attachment[], httpBase: string, ghostPromptId?: string): Promise<LocalAttachment[]> {
    const dir = ghostPromptId ? this.ghostDir(ghostPromptId) : this.keptDir()
    const local: LocalAttachment[] = []
    for (const attachment of attachments) {
      // The name is the host's own uuid, so a message carrying anything else is
      // one that has been got at, and it is nothing this machine writes.
      if (!isAttachmentFile(attachment.file)) continue
      const full = path.join(dir, attachment.file)
      if (!fs.existsSync(full)) {
        const data = await this.download(`${httpBase}/attachments/${attachment.file}`)
        if (!data) continue
        fs.mkdirSync(dir, { recursive: true })
        fs.writeFileSync(full, data)
      }
      local.push({ name: attachment.name, path: full, image: isImageType(attachment.mime) })
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

const listOf = (attachments: LocalAttachment[]): string =>
  attachments.map(a => `- ${a.path} (${a.name})`).join('\n')

export function promptWithAttachments(text: string, attachments: LocalAttachment[]): string {
  if (attachments.length === 0) return text
  const images = attachments.filter(a => a.image)
  const files = attachments.filter(a => !a.image)
  return [
    text,
    ...(images.length > 0 ? ['', 'Images shared with this message, read them from disk:', listOf(images)] : []),
    ...(files.length > 0 ? ['', 'Files shared with this message, read them from disk:', listOf(files)] : [])
  ].join('\n')
}
