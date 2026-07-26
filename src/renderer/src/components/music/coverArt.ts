import type { MusicItem } from '../../../../shared/music'
import { coverArt, type CoverArt } from './coverSeed'

// The cover generator. A cover is a picture of a thing too close to the lens to
// be in focus: a field of noise pushed around until it folds into petals, smeared
// along one direction the way a blurred edge smears, lit where two of those folds
// cross, and read through the track's own colors.
//
// It is drawn rather than stacked out of gradients. A gradient has no direction
// to it and no edge inside it, so a stack of them can only ever be soft blobs
// meeting softly, which is a tint of a picture and not the picture. Everything
// that gives these their texture, the smear, the spine where two ribbons cross,
// the mixing done in linear light, is a thing a fragment shader does per pixel
// and CSS cannot do at all.

const VERTEX = `
attribute vec2 aSpot;
varying vec2 vUv;
void main() {
  vUv = aSpot * 0.5 + 0.5;
  gl_Position = vec4(aSpot, 0.0, 1.0);
}
`

const FRAGMENT = `
precision highp float;
varying vec2 vUv;

uniform float uSeed;
uniform vec3 uRamp[5];
uniform float uWarp;
uniform float uScale;
uniform vec2 uLie;
uniform float uSmear;
uniform float uSpine;
uniform float uLift;
uniform float uReach;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21) + uSeed);
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 cell = floor(p);
  vec2 part = fract(p);
  vec2 ease = part * part * (3.0 - 2.0 * part);
  float a = hash(cell);
  float b = hash(cell + vec2(1.0, 0.0));
  float c = hash(cell + vec2(0.0, 1.0));
  float d = hash(cell + vec2(1.0, 1.0));
  return mix(mix(a, b, ease.x), mix(c, d, ease.x), ease.y);
}

const mat2 TURN = mat2(0.8, 0.6, -0.6, 0.8);

float fbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    sum += amp * vnoise(p);
    p = TURN * p * 2.0;
    amp *= 0.5;
  }
  return sum;
}

// The field itself, pushed around by two rounds of noise. Once is a wobble.
// Twice is what folds a smooth field into shapes with lobes and creases, which
// is where anything petal shaped in here comes from.
float folded(vec2 p) {
  vec2 first = vec2(fbm(p), fbm(p + vec2(5.2, 1.3)));
  vec2 second = vec2(fbm(p + uWarp * first + vec2(1.7, 9.2)), fbm(p + uWarp * first + vec2(8.3, 2.8)));
  return fbm(p + uWarp * second);
}

// The same field read several times along one direction and averaged, which is
// what a smear is. It is done to the field rather than to the finished picture,
// so the colors stay their own colors: blurring the picture afterwards would
// average the colors too and give back the flat wash this is drawn to avoid.
float smeared(vec2 p) {
  float sum = 0.0;
  float total = 0.0;
  for (int i = 0; i < 13; i++) {
    float step = (float(i) - 6.0) / 6.0;
    float weight = exp(-step * step * 1.7);
    sum += folded(p + uLie * step * uSmear) * weight;
    total += weight;
  }
  return sum / total;
}

vec3 ramp(float t) {
  t = clamp(t, 0.0, 1.0) * 4.0;
  vec3 held = uRamp[0];
  held = mix(held, uRamp[1], smoothstep(0.0, 1.0, clamp(t, 0.0, 1.0)));
  held = mix(held, uRamp[2], smoothstep(0.0, 1.0, clamp(t - 1.0, 0.0, 1.0)));
  held = mix(held, uRamp[3], smoothstep(0.0, 1.0, clamp(t - 2.0, 0.0, 1.0)));
  held = mix(held, uRamp[4], smoothstep(0.0, 1.0, clamp(t - 3.0, 0.0, 1.0)));
  return held;
}

void main() {
  vec2 p = vUv * uScale;
  float here = smeared(p);

  // Across the smear rather than along it, because that is the only direction a
  // smeared edge still has an edge in. Where the field changes fastest across
  // the lie of the smear is where one petal passes in front of another, and a
  // lens leaves a bright line there.
  vec2 across = vec2(-uLie.y, uLie.x) * 0.012;
  float ahead = smeared(p + across);
  float behind = smeared(p - across);
  float crease = abs(ahead - behind) / 0.024;

  float level = clamp((here + uLift) * uReach, 0.0, 1.0);
  vec3 color = ramp(level);

  // The lit edge is the top of the ramp brought in, never white. White is what
  // turns a photograph into a highlight sticker, and it leaves the palette.
  color = mix(color, uRamp[4], clamp(crease * uSpine, 0.0, 1.0) * 0.55);

  // Light bleeding out of the bright parts into what is beside them, which is
  // what an out of focus lens does and what keeps these from reading as flat
  // regions of color with a soft join.
  float bloom = smoothstep(0.55, 1.0, level);
  color += uRamp[4] * bloom * 0.16;

  // Back to the numbers a screen wants. Everything above is in linear light.
  color = pow(clamp(color, 0.0, 1.0), vec3(1.0 / 2.2));

  // Grain, and it goes on last so it is grain on the picture rather than
  // something the picture was built out of.
  float grain = hash(gl_FragCoord.xy * 0.37) - 0.5;
  color += grain * 0.022;

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`

// One canvas and one context for every cover there will ever be. A context per
// cover runs a browser out of them at around sixteen, and the list holds more
// tracks than that.
const SIDE = 320

interface Rig {
  canvas: HTMLCanvasElement
  gl: WebGLRenderingContext
  spots: Record<string, WebGLUniformLocation | null>
}

let rig: Rig | null | undefined

const compile = (gl: WebGLRenderingContext, kind: number, source: string): WebGLShader | null => {
  const shader = gl.createShader(kind)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return null
  }
  return shader
}

const build = (): Rig | null => {
  const canvas = document.createElement('canvas')
  canvas.width = SIDE
  canvas.height = SIDE
  const gl = canvas.getContext('webgl', { antialias: false, preserveDrawingBuffer: true })
  if (!gl) return null
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX)
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT)
  if (!vertex || !fragment) return null
  const program = gl.createProgram()
  if (!program) return null
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null
  gl.useProgram(program)

  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const spot = gl.getAttribLocation(program, 'aSpot')
  gl.enableVertexAttribArray(spot)
  gl.vertexAttribPointer(spot, 2, gl.FLOAT, false, 0, 0)
  gl.viewport(0, 0, SIDE, SIDE)

  const named = ['uSeed', 'uWarp', 'uScale', 'uLie', 'uSmear', 'uSpine', 'uLift', 'uReach']
  const spots: Record<string, WebGLUniformLocation | null> = {}
  for (const name of named) spots[name] = gl.getUniformLocation(program, name)
  for (let i = 0; i < 5; i++) spots[`uRamp${i}`] = gl.getUniformLocation(program, `uRamp[${i}]`)
  return { canvas, gl, spots }
}

const rigged = (): Rig | null => {
  if (rig === undefined) rig = build()
  return rig
}

const paint = (art: CoverArt): HTMLCanvasElement | null => {
  const held = rigged()
  if (!held) return null
  const { gl, spots } = held
  // The seed is a big number and a shader works in floats, so it is brought
  // down to something a float holds exactly rather than handed over whole.
  gl.uniform1f(spots.uSeed, (art.seed % 65536) / 64)
  gl.uniform1f(spots.uWarp, art.warp)
  gl.uniform1f(spots.uScale, art.scale)
  gl.uniform2f(spots.uLie, art.lie[0], art.lie[1])
  gl.uniform1f(spots.uSmear, art.smear)
  gl.uniform1f(spots.uSpine, art.spine)
  gl.uniform1f(spots.uLift, art.lift)
  gl.uniform1f(spots.uReach, art.reach)
  for (let i = 0; i < 5; i++) {
    const color = art.ramp[Math.min(i, art.ramp.length - 1)]
    gl.uniform3f(spots[`uRamp${i}`], color[0], color[1], color[2])
  }
  gl.drawArrays(gl.TRIANGLES, 0, 3)
  return held.canvas
}

// A cover is drawn once and kept, because the same track stands in the list and
// at the top of the panel at the same time, and the list is redrawn every time
// anything about the room changes.
const kept = new Map<string, HTMLCanvasElement>()

export function coverFor(item: MusicItem): HTMLCanvasElement | null {
  const had = kept.get(item.id)
  if (had) return had
  const drawn = paint(coverArt(item))
  if (!drawn) return null
  const copy = document.createElement('canvas')
  copy.width = SIDE
  copy.height = SIDE
  const flat = copy.getContext('2d')
  if (!flat) return null
  flat.drawImage(drawn, 0, 0)
  kept.set(item.id, copy)
  return copy
}

export function forgetCovers(): void {
  kept.clear()
}
