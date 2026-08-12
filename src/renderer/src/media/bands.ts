// How loud each band is, low on the left and high on the right. The bands are
// spaced by ear rather than by hertz: a fifth is a fifth wherever it sits, so an
// even share of the frequencies puts everything a voice or a tune does into the
// first two bars and leaves the rest of the row still.

export const BAND_BINS = 2048
export const BAND_LOW = 55
export const BAND_HIGH = 7000

export function bandsFrom(reading: Uint8Array, sampleRate: number, count: number, out: number[]): number[] {
  out.fill(0)
  const per = sampleRate / 2 / reading.length
  for (let bin = 1; bin < reading.length; bin++) {
    const hz = bin * per
    if (hz < BAND_LOW || hz > BAND_HIGH) continue
    const share = Math.log(hz / BAND_LOW) / Math.log(BAND_HIGH / BAND_LOW)
    const band = Math.min(count - 1, Math.floor(share * count))
    out[band] = Math.max(out[band], reading[bin] / 255)
  }
  return out
}

// How long a crest takes to cross the row.
export const WAVE_MS = 900

// A reading nothing is making. There is no voice left to hear while what somebody
// said is being read, and a row of bars sitting at its floor reads as a
// microphone that has stopped rather than as work still going on, so a crest
// travels through the row instead, low to high. It is what the thinking mark says
// with its three dots, said by a row of bars.
export function waveBands(at: number, count: number, out: number[]): number[] {
  for (let band = 0; band < count; band++) {
    // One turn of the wave spans the whole row, so there is always a crest
    // somewhere in it. Squared, because a plain cosine raises half the row
    // together, which reads as the row breathing rather than as a wave.
    const turn = at / WAVE_MS - band / count
    const crest = Math.cos((turn - Math.floor(turn)) * Math.PI * 2)
    out[band] = crest > 0 ? crest * crest : 0
  }
  return out
}

// A band reader hung on whatever is making the sound. The window it reads has to
// be wide: a narrow one measures in steps of a few hundred hertz, and the lowest
// band is fifty across, which leaves the bass bar empty.
//
// It keeps its own buffer because this runs every frame, and a new array sixty
// times a second is sixty things for the collector to come back for.
export class BandReader {
  private reading = new Uint8Array(0)

  read(analyser: AnalyserNode | null, count: number, out: number[]): number[] {
    if (!analyser) {
      out.fill(0)
      return out
    }
    if (this.reading.length !== analyser.frequencyBinCount) {
      this.reading = new Uint8Array(analyser.frequencyBinCount)
    }
    analyser.getByteFrequencyData(this.reading)
    return bandsFrom(this.reading, analyser.context.sampleRate, count, out)
  }
}
