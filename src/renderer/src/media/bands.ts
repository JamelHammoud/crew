// How loud each band is, low on the left and high on the right. The bands are
// spaced by ear rather than by hertz: a fifth is a fifth wherever it sits, so an
// even share of the frequencies puts everything a voice or a tune does into the
// first two bars and leaves the rest of the row still.

export const BAND_BINS = 2048
export const BAND_LOW = 55
export const BAND_HIGH = 7000

export function bandsFrom(
  reading: Uint8Array,
  sampleRate: number,
  count: number,
  out: number[]
): number[] {
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
