import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { DMG, DMG_WASH, HEADLINE, dmgArrow, dmgDefs } from './icon-dmg.mjs'
import { shootMesh } from './dmg-shoot.mjs'

export const LOOP = { scale: 2, fps: 8, seconds: 4, dpi: 144, colours: 256 }

export function overlaySvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${DMG.width}" height="${DMG.height}" viewBox="0 0 ${DMG.width} ${DMG.height}">
  <defs>
${dmgDefs()}
  </defs>
${DMG_WASH}
${dmgArrow()}
  ${HEADLINE}
</svg>
`
}

export async function drawDmgLoop(out, raster) {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' })
  } catch {
    throw new Error('the disk image background needs ffmpeg to be on PATH')
  }

  const width = DMG.width * LOOP.scale
  const height = DMG.height * LOOP.scale
  const count = Math.round(LOOP.fps * LOOP.seconds)
  const work = mkdtempSync(path.join(tmpdir(), 'crew-dmg-loop-'))

  try {
    const frames = path.join(work, 'f')
    mkdirSync(frames, { recursive: true })

    const chrome = path.join(work, 'overlay.png')
    raster(overlaySvg(), width, height, chrome)

    const shot = await shootMesh(
      Array.from({ length: count }, (unused, i) => ({
        at: DMG.at + i / LOOP.fps,
        width,
        height
      }))
    )
    shot.forEach((frame, i) => {
      writeFileSync(path.join(frames, `m${String(i).padStart(4, '0')}.png`), Buffer.from(frame.png, 'base64'))
    })

    execFileSync('ffmpeg', [
      '-y',
      '-framerate', String(LOOP.fps),
      '-i', path.join(frames, 'm%04d.png'),
      '-i', chrome,
      '-filter_complex',
      `[0][1]overlay=0:0[v];[v]split[a][b];` +
        `[b]reverse,trim=start_frame=1:end_frame=${count - 1}[r];` +
        `[a][r]concat=n=2:v=1:a=0[all];[all]split[c][d];` +
        `[c]palettegen=max_colors=${LOOP.colours}:stats_mode=full[p];` +
        `[d][p]paletteuse=dither=none:diff_mode=rectangle`,
      '-plays', '0',
      '-dpi', String(LOOP.dpi),
      '-f', 'apng',
      out
    ], { stdio: 'ignore' })

    return { frames: count * 2 - 2, width, height }
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}
