export const TEXT_LIMIT = 2 * 1024 * 1024

export const MAX_LINES = 5000

export interface Words {
  text: string
  partial: boolean
}

export function readText(bytes: ArrayBuffer, limit = TEXT_LIMIT): Words {
  const partial = bytes.byteLength > limit
  const text = new TextDecoder().decode(partial ? bytes.slice(0, limit) : bytes)
  return { text: partial ? text.replace(/�+$/, '') : text, partial }
}
