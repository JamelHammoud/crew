export const CLAUDE_ACCOUNT_KEY = 'account'

export function claudeProfileId(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

export function claudeLoginCommand(name: string): string {
  const id = claudeProfileId(name)
  return id
    ? `CLAUDE_CONFIG_DIR="$HOME/.crew/claude/${id}" claude auth login --claudeai`
    : 'claude auth login --claudeai'
}
