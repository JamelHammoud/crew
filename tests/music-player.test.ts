// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MUSIC_TUNES, tuneLength } from '../src/shared/music'
import { installFakeAudio } from './helpers/fake-audio'

const audio = installFakeAudio()

const { MusicPlayer } = await import('../src/renderer/src/media/music')
const { hzOf, stepsOf, strikesOf, tuneLevels } = await import('../src/renderer/src/media/tunes')
const { levelsAt } = await import('../src/renderer/src/media/levels')
const { SONGS } = await import('../src/renderer/src/media/songs')

const overworld = MUSIC_TUNES[0]

describe('the songs themselves', () => {
  it('gives every track a song to play', () => {
    for (const tune of MUSIC_TUNES) {
      expect(SONGS[tune.id], tune.name).toBeTruthy()
      expect(strikesOf(tune).length, tune.name).toBeGreaterThan(16)
    }
  })

  // A note nobody can spell comes back as nothing and is quietly dropped, so a
  // typo in a song is silence rather than a wrong note. Nothing else would ever
  // say so.
  it('spells every note it asks for', () => {
    for (const tune of MUSIC_TUNES) {
      for (const line of SONGS[tune.id]) {
        for (const token of stepsOf(line)) {
          if (token === '.' || token === '-') continue
          expect(hzOf(line, token), `${tune.name}: ${token}`).toBeGreaterThan(0)
        }
      }
    }
  })

  it('fills the whole loop and never runs past the end of it', () => {
    for (const tune of MUSIC_TUNES) {
      const length = tuneLength(tune)
      const notes = strikesOf(tune)
      for (const note of notes) {
        expect(note.at, tune.name).toBeGreaterThanOrEqual(0)
        expect(note.at, tune.name).toBeLessThan(length)
      }
      // A song that gives up halfway leaves a hole in the loop every pass.
      expect(Math.max(...notes.map(n => n.at)), tune.name).toBeGreaterThan(length * 0.7)
    }
  })

  it('keeps time and carries a tune, in every one of them', () => {
    for (const tune of MUSIC_TUNES) {
      const notes = strikesOf(tune)
      expect(notes.some(note => note.hz < 200), `${tune.name} has nothing low`).toBe(true)
      expect(notes.some(note => note.hz > 400), `${tune.name} has nothing high`).toBe(true)
    }
  })
})

describe('what the bars are drawn from', () => {
  it('rises where the music is loud and falls where it is quiet', () => {
    const levels = tuneLevels(overworld, 5)
    const notes = strikesOf(overworld)
    const loud = notes[0]
    const onTheNote = levelsAt(levels, loud.at + 0.01, new Array(5).fill(0))
    const empty = new Array(5).fill(0)
    expect(Math.max(...onTheNote)).toBeGreaterThan(0)

    // Somewhere with nothing landing near it reads quieter than a note does.
    const gaps = []
    for (let at = 0; at < tuneLength(overworld); at += 0.05) {
      if (notes.every(note => Math.abs(note.at - at) > 0.3)) gaps.push(at)
    }
    const quiet = Math.min(...gaps.map(at => Math.max(...levelsAt(levels, at, empty))))
    expect(quiet).toBeLessThan(Math.max(...onTheNote))
  })

  it('puts the low notes on the left and the high ones on the right', () => {
    const levels = tuneLevels(overworld, 5)
    const notes = strikesOf(overworld)
    const low = notes.filter(note => note.hz < 120)[0]
    const high = notes.filter(note => note.hz > 1000)[0]
    const atLow = levelsAt(levels, low.at + 0.01, new Array(5).fill(0))
    const atHigh = levelsAt(levels, high.at + 0.01, new Array(5).fill(0))
    expect(atLow.indexOf(Math.max(...atLow))).toBeLessThan(2)
    expect(atHigh.indexOf(Math.max(...atHigh))).toBeGreaterThan(2)
  })

  it('comes round with the loop', () => {
    const levels = tuneLevels(overworld, 5)
    const length = tuneLength(overworld)
    const here = levelsAt(levels, 1.5, new Array(5).fill(0))
    const round = levelsAt(levels, 1.5 + length, new Array(5).fill(0))
    expect(round).toEqual(here)
  })
})

describe('playing a track', () => {
  let player: InstanceType<typeof MusicPlayer>

  beforeEach(() => {
    vi.useFakeTimers()
    audio.clear()
    audio.currentTime = 100
    player = new MusicPlayer()
  })

  afterEach(() => {
    player.stop()
    vi.useRealTimers()
  })

  it('hands the notes over before they are due, and keeps topping them up', () => {
    player.play(overworld, 0)
    const first = audio.notes()
    expect(first.length).toBeGreaterThan(0)
    // Everything handed over is ahead of the clock and no further than the
    // player reaches, or a note lands late and the tune limps.
    for (const note of first) {
      expect(note.at).toBeGreaterThanOrEqual(audio.currentTime - 0.001)
      expect(note.at).toBeLessThan(audio.currentTime + 0.7)
    }

    audio.currentTime += 0.5
    vi.advanceTimersByTime(300)
    expect(audio.notes().length).toBeGreaterThan(first.length)
  })

  it('plays what the tune says, in the order it says it', () => {
    player.play(overworld, 0)
    const written = strikesOf(overworld)
      .filter(note => note.at < 0.6)
      .map(note => Math.round(note.at * 1000))
      .sort((a, b) => a - b)
    const played = audio
      .notes()
      .map(note => Math.round((note.at - 100) * 1000))
      .sort((a, b) => a - b)
    expect(played).toEqual(written)
  })

  it('lands in step with a crew that is already halfway through', () => {
    player.play(overworld, 6)
    expect(player.position()).toBeCloseTo(6, 3)
    audio.currentTime += 2
    expect(player.position()).toBeCloseTo(8, 3)
  })

  it('comes round to the top of the loop rather than running off the end', () => {
    const length = tuneLength(overworld)
    player.play(overworld, length - 0.2)
    expect(player.position()).toBeCloseTo(length - 0.2, 3)
    audio.currentTime += 0.4
    expect(player.position()).toBeCloseTo(0.2, 3)
    // The notes at the top of the next pass are already handed over.
    expect(audio.notes().some(note => note.at > 100 + 0.2)).toBe(true)
  })

  it('takes back what it had already handed over when it is stopped', () => {
    player.play(overworld, 0)
    const scheduled = audio.notes().length
    player.stop()
    expect(player.running()).toBe(false)
    for (const note of audio.notes()) expect(note.stopped).not.toBeNull()

    // Nothing more is handed over once it has been told to stop.
    audio.currentTime += 1
    vi.advanceTimersByTime(600)
    expect(audio.notes()).toHaveLength(scheduled)
  })

  it('turns down here without moving anyone else', () => {
    player.setVolume(0.3)
    player.play(overworld, 0)
    const master = audio.gains[0]
    expect(master.value).toBeCloseTo(0.3, 3)
    player.setVolume(2)
    expect(master.value).toBe(1)
    player.setVolume(-1)
    expect(master.value).toBe(0)
    // Where the loop is has nothing to do with how loud it is here.
    expect(player.position()).toBeCloseTo(0, 3)
  })

  it('reads the levels off the music rather than off a clock', () => {
    expect(player.levels(5)).toBe(null)
    player.play(overworld, 0)
    audio.heard = new Array(128).fill(0)
    expect(player.levels(5)?.every(level => level === 0)).toBe(true)

    // A loud bin lights the band it belongs to and leaves the rest alone.
    audio.heard = new Array(128).fill(0)
    audio.heard[2] = 255
    const levels = player.levels(5) ?? []
    expect(levels[0]).toBe(1)
    expect(levels.slice(1).every(level => level === 0)).toBe(true)
  })

  it('plays a track somebody added, from wherever the crew is in it', async () => {
    vi.stubGlobal('fetch', async () => ({ arrayBuffer: async () => new ArrayBuffer(8) }))
    await player.playFile('mine', 'http://host/music/mine.mp3', 12, 3)
    expect(player.running()).toBe(true)
    expect(player.trackId).toBe('mine')
    expect(player.position()).toBeCloseTo(3, 3)
    const source = audio.notes().at(-1)
    expect(source?.at).toBe(100)
    player.stop()
    expect(player.running()).toBe(false)
  })

  it('drops a file that lands after the crew has moved on', async () => {
    let release: ((value: unknown) => void) | null = null
    vi.stubGlobal('fetch', async () => {
      await new Promise(resolve => {
        release = resolve
      })
      return { arrayBuffer: async () => new ArrayBuffer(8) }
    })
    const loading = player.playFile('slow', 'http://host/music/slow.mp3', 12, 0)
    player.play(overworld, 0)
    const playing = audio.notes().length
    release?.(null)
    await loading
    expect(player.trackId).toBe(overworld.id)
    expect(audio.notes().length).toBe(playing)
  })
})
