import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ safeStorage: undefined }))

import { MailCredentialStore, type MailSafeStorage } from '../src/main/mail/credentials'
import { MailFileStore } from '../src/main/mail/files'

const directories: string[] = []

function stateDirectory(name = 'crew-mail-security-'): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), name))
  directories.push(directory)
  return directory
}

function encryptedStorage(available = true, backend: ReturnType<NonNullable<MailSafeStorage['getSelectedStorageBackend']>> = 'unknown'): MailSafeStorage {
  return {
    isEncryptionAvailable: () => available,
    getSelectedStorageBackend: () => backend,
    encryptString: value => Buffer.from([...Buffer.from(value, 'utf8')].map(byte => byte ^ 0xa5)),
    decryptString: value => Buffer.from([...value].map(byte => byte ^ 0xa5)).toString('utf8')
  }
}

afterEach(() => {
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true })
})

describe('mail credential storage', () => {
  it('encrypts credentials at rest in a private file', () => {
    const directory = stateDirectory()
    const store = new MailCredentialStore(directory, encryptedStorage())
    store.set('account', { username: 'me@example.com', password: 'plain-secret', accessToken: 'token-secret' })

    const bytes = fs.readFileSync(store.file)
    expect(bytes.toString('utf8')).not.toContain('plain-secret')
    expect(bytes.toString('utf8')).not.toContain('token-secret')
    expect(fs.statSync(store.file).mode & 0o777).toBe(0o600)
    expect(fs.statSync(directory).mode & 0o777).toBe(0o700)
    expect(new MailCredentialStore(directory, encryptedStorage()).get('account')).toEqual({
      username: 'me@example.com', password: 'plain-secret', accessToken: 'token-secret'
    })
    expect(store.delete('account')).toBe(true)
    expect(fs.existsSync(store.file)).toBe(false)
  })

  it('refuses unavailable or plaintext safe storage', () => {
    const unavailable = new MailCredentialStore(stateDirectory(), encryptedStorage(false))
    expect(() => unavailable.set('account', { password: 'secret' })).toThrow('Secure credential storage is unavailable')
    expect(fs.existsSync(unavailable.file)).toBe(false)

    const plaintext = new MailCredentialStore(stateDirectory(), encryptedStorage(true, 'basic_text'))
    expect(() => plaintext.set('account', { password: 'secret' })).toThrow('Secure credential storage is unavailable')
    expect(fs.existsSync(plaintext.file)).toBe(false)
  })

  it('does not replace an unreadable encrypted file', () => {
    const directory = stateDirectory()
    const store = new MailCredentialStore(directory, encryptedStorage())
    fs.writeFileSync(store.file, Buffer.from('damaged'), { mode: 0o600 })
    const before = fs.readFileSync(store.file)
    expect(() => store.set('account', { password: 'new-secret' })).toThrow('Mail credentials could not be decrypted')
    expect(fs.readFileSync(store.file)).toEqual(before)
  })
})

describe('mail attachment storage', () => {
  it('uses opaque private paths scoped by account', () => {
    const directory = stateDirectory()
    const files = new MailFileStore(directory)
    const storageKey = files.create('../../first@example.com', Buffer.from('attachment bytes'))
    const accountDirectory = createHash('sha256').update('../../first@example.com').digest('hex')
    const storedPath = files.pathFor('../../first@example.com', storageKey)

    expect(storageKey).toMatch(/^[0-9a-f]{32}$/)
    expect(path.relative(files.directory, storedPath)).toBe(path.join(accountDirectory, storageKey))
    expect(path.basename(storedPath)).not.toContain('attachment')
    expect(files.read('../../first@example.com', storageKey).toString()).toBe('attachment bytes')
    expect(fs.statSync(storedPath).mode & 0o777).toBe(0o600)
    expect(fs.statSync(path.dirname(storedPath)).mode & 0o777).toBe(0o700)
    expect(files.exists('another@example.com', storageKey)).toBe(false)
    expect(files.delete('../../first@example.com', storageKey)).toBe(true)
    expect(files.delete('../../first@example.com', storageKey)).toBe(false)
  })

  it('streams a selected file into private storage', async () => {
    const directory = stateDirectory()
    const sourceDirectory = stateDirectory('crew-mail-source-')
    const source = path.join(sourceDirectory, 'large.bin')
    const contents = Buffer.alloc(2 * 1024 * 1024, 37)
    fs.writeFileSync(source, contents)
    const files = new MailFileStore(directory)

    const stored = await files.createFromPath('account', source)

    expect(stored.size).toBe(contents.byteLength)
    expect(files.read('account', stored.storageKey)).toEqual(contents)
    expect(fs.statSync(files.pathFor('account', stored.storageKey)).mode & 0o777).toBe(0o600)
  })

  it('refuses streamed directories and symbolic links', async () => {
    const directory = stateDirectory()
    const sourceDirectory = stateDirectory('crew-mail-source-')
    const source = path.join(sourceDirectory, 'source.txt')
    const link = path.join(sourceDirectory, 'link.txt')
    fs.writeFileSync(source, 'private')
    fs.symlinkSync(source, link)
    const files = new MailFileStore(directory)

    await expect(files.createFromPath('account', sourceDirectory)).rejects.toThrow('Mail attachment source is not a file')
    await expect(files.createFromPath('account', link)).rejects.toThrow()
    expect(fs.existsSync(files.directory) ? fs.readdirSync(files.directory) : []).toEqual([])
  })

  it('rejects traversal, absolute paths, and symlink escapes', () => {
    const directory = stateDirectory()
    const outside = stateDirectory('crew-mail-outside-')
    const files = new MailFileStore(directory)
    expect(() => files.pathFor('account', '../secret')).toThrow(TypeError)
    expect(() => files.pathFor('account', '/tmp/secret')).toThrow(TypeError)

    fs.mkdirSync(files.directory, { mode: 0o700 })
    const accountDirectory = createHash('sha256').update('account').digest('hex')
    fs.symlinkSync(outside, path.join(files.directory, accountDirectory))
    expect(() => files.create('account', Buffer.from('secret'))).toThrow('Mail attachment storage directory is unsafe')
    expect(fs.readdirSync(outside)).toEqual([])
  })

  it('refuses a symlink in place of an attachment', () => {
    const directory = stateDirectory()
    const outside = stateDirectory('crew-mail-outside-file-')
    const files = new MailFileStore(directory)
    const storageKey = files.create('account', Buffer.from('safe'))
    const storedPath = files.pathFor('account', storageKey)
    const outsideFile = path.join(outside, 'secret')
    fs.writeFileSync(outsideFile, 'outside')
    fs.rmSync(storedPath)
    fs.symlinkSync(outsideFile, storedPath)

    expect(() => files.read('account', storageKey)).toThrow()
    expect(() => files.exists('account', storageKey)).toThrow('Mail attachment file is unsafe')
    expect(fs.readFileSync(outsideFile, 'utf8')).toBe('outside')
  })
})
