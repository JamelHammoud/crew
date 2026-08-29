import { attachmentFileUrl } from '../../../shared/attachments'

const PREFIX = 'asset:'

export function designAssetSource(file: string): string {
  return `${PREFIX}${encodeURIComponent(file)}`
}

export function resolveDesignAssetSource(httpBase: string, source: string): string {
  if (!source.startsWith(PREFIX)) return source
  return attachmentFileUrl(httpBase, decodeURIComponent(source.slice(PREFIX.length)))
}
