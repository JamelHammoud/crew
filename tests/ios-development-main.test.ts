import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { IosRunRequest } from '../src/shared/ios'
import { createIosProject, iosProjectPbx } from '../src/main/ios-project-template'
import { iosBuildArguments, iosProjectIn } from '../src/main/ios-development'

const request = (patch: Partial<IosRunRequest> = {}): IosRunRequest => ({
  action: 'build',
  projectPath: '/repo/App.xcodeproj',
  scheme: 'App',
  deviceId: 'DEVICE-1',
  runId: 'run-1',
  ...patch
})

describe('iOS project actions', () => {
  it('builds xcodebuild arguments without a shell', () => {
    expect(iosBuildArguments(request())).toEqual([
      '-project',
      '/repo/App.xcodeproj',
      '-scheme',
      'App',
      '-configuration',
      'Debug',
      '-destination',
      'id=DEVICE-1',
      'build'
    ])
    expect(iosBuildArguments(request({ action: 'clean', projectPath: '/repo/App.xcworkspace' }))).toContain('clean')
    expect(iosBuildArguments(request({ action: 'test' })).at(-1)).toBe('test')
  })

  it('only accepts project containers inside the Crew folder', () => {
    expect(iosProjectIn('/repo', '/repo/Apps/App.xcodeproj')).toBe(true)
    expect(iosProjectIn('/repo', '/repo/Apps/App.xcworkspace')).toBe(true)
    expect(iosProjectIn('/repo', '/other/App.xcodeproj')).toBe(false)
    expect(iosProjectIn('/repo', '/repo/App.txt')).toBe(false)
  })

  it('creates a SwiftUI app without replacing an existing folder', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'crew-ios-test-'))
    try {
      const made = await createIosProject(root, { name: 'Sample App', bundleId: 'com.example.sample' })
      expect(made.ok).toBe(true)
      if (!made.ok) return
      expect(await readFile(path.join(root, 'Sample App', 'Sample App', 'SampleAppApp.swift'), 'utf8')).toContain(
        'struct SampleAppApp: App'
      )
      expect(await readFile(path.join(made.projectPath, 'project.pbxproj'), 'utf8')).toContain(
        'PRODUCT_BUNDLE_IDENTIFIER = "com.example.sample"'
      )
      expect((await createIosProject(root, { name: 'Sample App', bundleId: 'com.example.sample' })).ok).toBe(false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('writes a project with one application target and shared build settings', () => {
    const pbx = iosProjectPbx('Sample', 'com.example.sample')
    expect(pbx).toContain('productType = "com.apple.product-type.application"')
    expect(pbx).toContain('SUPPORTED_PLATFORMS = "iphoneos iphonesimulator"')
    expect(pbx).toContain('Assets.xcassets')
  })
})
