import { protocol } from 'electron'
import { MEDIA_SCHEME, mediaResponse } from './media-file'

export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        corsEnabled: true
      }
    }
  ])
}

export function serveMediaScheme(): void {
  protocol.handle(MEDIA_SCHEME, request => mediaResponse(request.url, request.headers.get('Range')))
}
