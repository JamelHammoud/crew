// The iPhone app beside the chat. An agent never drives Xcode itself: it says
// once that the app should be on the screen, and from then on Crew watches the
// project and rebuilds on every save, so what an agent does is edit files and
// read what the last build said. That is a curl line in the preamble rather
// than a tool on any one CLI, the same way the board and the helpers are.

import { createHash } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'

export function iosWorkDir(folder: string): string {
  const key = createHash('sha256').update(path.resolve(folder)).digest('hex').slice(0, 12)
  return path.join(os.tmpdir(), 'crew-ios', key)
}

export function iosBuildLog(folder: string): string {
  return path.join(iosWorkDir(folder), 'build.txt')
}

export function iosPreamble(apiBase: string, promptId: string, folder: string): string {
  return [
    `## The iPhone app`,
    ``,
    `This project builds an app. Put it on the simulator beside the chat, and it opens for whoever is reading this thread:`,
    ``,
    `  curl -s -X POST ${apiBase}/ios -H 'content-type: application/json' -d '{"promptId":"${promptId}"}'`,
    ``,
    `Do that once, at the start, whenever the work is about how the app looks or behaves. From then on Crew watches this project: save a Swift file and it rebuilds, installs and launches on its own. Never run xcodebuild or simctl and never open Xcode, or two builds fight over the same folder.`,
    ``,
    `What the last build said, errors and all, is in one file:`,
    ``,
    `  cat ${iosBuildLog(folder)}`,
    ``,
    `Read it after a change to see whether the build went through, and keep going until it builds and the screen shows what was asked for.`
  ].join('\n')
}
