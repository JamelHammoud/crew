import { protocol } from 'electron'

export const MAIL_SCHEME = 'crew-mail'

export interface MailAttachment {
  bytes: Uint8Array
  contentType: string
  filename?: string
}

export type MailAttachmentResolver = (id: string) => MailAttachment | null | Promise<MailAttachment | null>

const OPAQUE_ID = /^[A-Za-z0-9_-]{16,256}$/

export function mailAttachmentUrl(id: string): string {
  if (!OPAQUE_ID.test(id)) throw new TypeError('Invalid attachment id')
  return `${MAIL_SCHEME}://attachment/${id}`
}

export function attachmentIdFromUrl(value: string): string | null {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== `${MAIL_SCHEME}:` || url.hostname !== 'attachment') return null
  if (url.username || url.password || url.port || url.search || url.hash) return null
  const parts = url.pathname.split('/').filter(Boolean)
  if (parts.length !== 1) return null
  let id: string
  try {
    id = decodeURIComponent(parts[0])
  } catch {
    return null
  }
  return OPAQUE_ID.test(id) ? id : null
}

export function registerMailScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MAIL_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        corsEnabled: false
      }
    }
  ])
}

function attachmentHeaders(attachment: MailAttachment): Headers {
  const headers = new Headers({
    'Content-Type': attachment.contentType || 'application/octet-stream',
    'Cache-Control': 'private, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'"
  })
  if (attachment.filename) {
    const filename = attachment.filename.replace(/[\r\n"\\]/g, '_')
    headers.set('Content-Disposition', `inline; filename="${filename}"`)
  }
  return headers
}

export function mailAttachmentResponse(
  value: string,
  resolve: MailAttachmentResolver
): Promise<Response> {
  const id = attachmentIdFromUrl(value)
  if (!id) return Promise.resolve(new Response(null, { status: 400 }))
  return Promise.resolve(resolve(id)).then(
    attachment => {
      if (!attachment) return new Response(null, { status: 404 })
      return new Response(attachment.bytes as BodyInit, {
        status: 200,
        headers: attachmentHeaders(attachment)
      })
    },
    () => new Response(null, { status: 404 })
  )
}

export function serveMailScheme(resolve: MailAttachmentResolver): void {
  protocol.handle(MAIL_SCHEME, request => mailAttachmentResponse(request.url, resolve))
}

export function stopMailScheme(): void {
  protocol.unhandle(MAIL_SCHEME)
}
