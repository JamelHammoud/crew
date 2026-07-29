import type { CoverSubject } from '../../../../shared/art'
import { coverArt, MAX_PETALS, type CoverArt } from './coverSeed'

// The cover generator. It photographs the scene `coverSeed.ts` describes: a sky,
// a few petals standing at different distances in front of it, and a light off
// one side.
//
// Every petal is laid down whole, in its own color, blurred by its own distance,
// over whatever is already there. That is the one thing a stack of gradients
// cannot do, and it is the difference between a picture and a tint: a gradient
// has no inside and no edge, so the best a stack of them manages is soft blobs
// meeting softly, and everything that reads as a photograph here comes from a
// shape being in front of another one.
//
// It is a fragment shader because all of it is per pixel: which petal is in
// front here, how soft its edge is here, which way the light rakes across it
// here, and how far it bleeds into the sky beside it.

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

const int MAX = ${MAX_PETALS};

uniform float uSeed;
uniform vec3 uSky;
uniform vec3 uSkyTo;
uniform vec2 uSkyLie;
uniform vec3 uLight;
uniform vec2 uSun;
uniform float uBloom;
uniform float uHaze;

// A petal, packed four numbers at a time. Held one uniform per number it runs
// past what the smallest machine promises to give a fragment shader, and a cover
// that fails to compile on one machine is a grey box on that person's screen.
uniform vec4 uAt[MAX];    // where the spine passes, and the way it lies
uniform vec4 uShape[MAX]; // half width, how far it runs, how pointed, how bent
uniform vec4 uEdge[MAX];  // how ruffled, how finely, how blurred, how lit
uniform vec4 uSkin[MAX];  // its color, and whether it is in the picture at all
uniform vec4 uGlow[MAX];  // how the light rakes it, how far it bleeds, its own wobble

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

// Three octaves, and the last two are quiet. This only ever pushes an outline
// about or mottles a sky, and both of those are big slow things: the fine
// octaves that make good landscape noise would turn a petal into a doily.
float fbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.62;
  float total = 0.0;
  for (int i = 0; i < 3; i++) {
    sum += amp * vnoise(p);
    total += amp;
    p = TURN * p * 2.0;
    amp *= 0.45;
  }
  return sum / total;
}

void main() {
  vec2 p = vUv;

  // The three fields every outline in the picture is pushed about by, drawn
  // once, coarse to fine. They are up here rather than inside the loop below on
  // purpose: a graphics driver unrolls a loop that reads a uniform by its
  // counter, so a single noise call written inside it is really one per petal,
  // and on a Mac that is enough to take the shader compiler down with it. What
  // the loop gets is three numbers it can mix, which is the same variety for a
  // fraction of the work.
  float coarse = fbm(p * 1.2 + 4.0);
  float middle = fbm(p * 2.6 + 19.0);
  float fine = fbm(p * 5.4 + 33.0);

  // The sky. It runs from one color to another across the frame and is mottled
  // on top of that, because a straight ramp behind everything is the one thing
  // that says at a glance that a picture was made rather than taken.
  float run = clamp(dot(p - 0.5, uSkyLie) + 0.5, 0.0, 1.0);
  vec3 color = mix(uSky, uSkyTo, run);
  // Two scales of it, not one. A single field over the whole frame moves the sky
  // slowly from one side to the other and reads as another ramp; a coarse one
  // and a finer one crossing it are what give the quiet half of a cover
  // something to look at, which matters most on the pictures that hold three big
  // shapes and nothing else.
  color = mix(color, uSkyTo, coarse * 0.3);
  color = mix(color, uSky, middle * 0.16);

  float bleed = 0.0;

  for (int i = 0; i < MAX; i++) {
    vec4 skin = uSkin[i];
    vec4 at = uAt[i];
    vec4 shape = uShape[i];
    vec4 edge = uEdge[i];
    vec4 glow = uGlow[i];

    vec2 lie = at.zw;
    vec2 across = vec2(-lie.y, lie.x);
    vec2 rel = p - at.xy;
    // Along the spine and across it, with the spine curved by how far along it
    // we are. A petal that runs dead straight is a stripe.
    float along = dot(rel, lie);
    float side = dot(rel, across) + shape.w * along * along;

    // Fat in the middle and pointed at the ends, which is the whole outline of
    // a petal. Anything past the ends has no width at all and so is not there.
    float reach = clamp(abs(along) / max(shape.y, 0.001), 0.0, 1.0);
    // Its own wobble along its length, so two petals pushed about by the same
    // field are still two different outlines.
    float lobe = 1.0 + glow.w * sin(along * 5.3 + glow.z);
    float wide = shape.x * pow(max(0.0, 1.0 - reach * reach), shape.z) * lobe;
    // Coarse to fine, picked out of the three fields by how fine this one is.
    float pushed = mix(mix(coarse, middle, clamp(edge.y * 2.0, 0.0, 1.0)), fine, clamp(edge.y * 2.0 - 1.0, 0.0, 1.0));
    float field = wide + (pushed - 0.5) * edge.x - abs(side);

    // Its own blur, and nothing else's. This is the depth of field: the front
    // one comes up hard against the sky and the back ones have no edge left.
    float cover = smoothstep(-edge.z, edge.z, field) * skin.w;

    // How much petal there is at this pixel: deep through the middle, and thin
    // at the outline and at both tips, which is where the shape runs out.
    //
    // Measured against its own width rather than against its blur. A far petal
    // is a wide soft thing, and held to a scale the blur sets, the middle of one
    // never counts as thick at all: the whole shape goes half transparent and
    // what should be the softest object in the picture becomes the faintest.
    float thick = smoothstep(0.0, max(0.04, wide * 0.8), field);

    // A real petal is thin enough at its rim to be seen through, so it lets go
    // of what is behind it there instead of cutting it off. That is what takes
    // the hardness off a near edge without blurring it: the outline stays where
    // it is and stops being a wall. It is also what keeps the tips from ending
    // in a line, since a tip is thin the whole way.
    cover *= mix(0.6, 1.0, thick);

    // The face, which is the whole of why one of these reads as a leaf and not
    // as a band of paint. A petal is not one color: it is a curved surface, so
    // it turns away from the light at both flanks and falls off toward each
    // tip, and a normal drawn in the plane of the picture gives every part of
    // it its own angle to the light.
    float curve = clamp(side / max(wide, 0.02), -1.0, 1.0);
    float run = clamp(along / max(shape.y, 0.001), -1.0, 1.0);
    float lambert = dot(across * curve * 0.92 + lie * run * 0.55, uSun);

    // Lit toward the palette's own light, and shaded toward the sky rather than
    // toward an ink, because a leaf standing in its own shadow is still lit by
    // the sky above it. Both are hung off the petal's own color, so the middle
    // of it stays the color it was given.
    vec3 face = skin.rgb;
    face = mix(face, uLight, clamp(lambert, 0.0, 1.0) * (0.14 + glow.x));
    face = mix(face, uSky, clamp(-lambert, 0.0, 1.0) * 0.32);

    // And a little of the same field its outline is pushed about by, drawn
    // across its face, so the color moves inside the shape the way it does on a
    // real one. It costs nothing: it is the number the outline already used.
    face = mix(face, mix(face, uSky, 0.3), clamp((pushed - 0.42) * 0.7, 0.0, 0.34));

    // The lit edge, on the side of the outline that faces the light. It is the
    // palette's own light rather than white, so a highlight stays in the family
    // instead of bleaching a hole in the picture.
    //
    // And it never arrives whole. Let all the way through, the brightest part of
    // a rim is the light itself and nothing of the petal, which draws a pale
    // line around the shape: the one thing that tells the eye an outline is
    // there, on the covers that are meant to have no hard shapes in them at all.
    // Most of the petal's own color stays in it however hard the light is.
    float rim = cover * (1.0 - cover) * 4.0;
    float facing = max(0.0, -sign(side) * dot(across, uSun));
    face = mix(face, uLight, clamp(rim * facing * edge.w, 0.0, 0.4));

    color = mix(color, face, cover);

    // What it throws into whatever is beside it. A bright thing held this close
    // to a lens does not stop at its own outline.
    float wider = edge.z + 0.16;
    bleed += max(0.0, smoothstep(-wider, wider, field) - cover) * glow.y * skin.w;
  }

  color += uLight * clamp(bleed, 0.0, 0.9) * uBloom;
  color = mix(color, uLight, uHaze);

  // Back to the numbers a screen wants. Everything above is in linear light.
  color = pow(clamp(color, 0.0, 1.0), vec3(1.0 / 2.2));

  // Grain, last, so it is grain on the photograph rather than something the
  // photograph was built out of.
  color += (hash(gl_FragCoord.xy * 0.41) - 0.5) * 0.018;

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`

// One canvas and one context for every cover there will ever be. A context per
// cover runs a browser out of them at around sixteen, and the list holds more
// tracks than that.
const SIDE = 512

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

const PACKED = ['uAt', 'uShape', 'uEdge', 'uSkin', 'uGlow']
const PLAIN = ['uSeed', 'uSky', 'uSkyTo', 'uSkyLie', 'uLight', 'uSun', 'uBloom', 'uHaze']

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

  const spots: Record<string, WebGLUniformLocation | null> = {}
  for (const name of PLAIN) spots[name] = gl.getUniformLocation(program, name)
  for (const name of PACKED) spots[name] = gl.getUniformLocation(program, `${name}[0]`)
  return { canvas, gl, spots }
}

const rigged = (): Rig | null => {
  if (rig === undefined) rig = build()
  return rig
}

// The five packed rows, filled out to the length the shader always runs. A slot
// the picture does not use carries a zero where it says whether it is there,
// which is what takes it out: a shader cannot be handed a shorter loop.
const packed = (art: CoverArt): Record<string, Float32Array> => {
  const rows: Record<string, Float32Array> = {}
  for (const name of PACKED) rows[name] = new Float32Array(MAX_PETALS * 4)
  // An empty slot still runs, so it is filled with numbers that mean something
  // rather than left at nought. A petal no wider than nothing is invisible
  // either way, but one blurred by nothing asks the card to fade an edge from a
  // point to the same point, which has no answer: what comes back is not a
  // number, and it spreads through everything it is multiplied by afterwards.
  for (let i = 0; i < MAX_PETALS; i++) {
    rows.uShape.set([0, 1, 1, 0], i * 4)
    rows.uEdge.set([0, 0.5, 0.1, 0], i * 4)
  }
  art.petals.slice(0, MAX_PETALS).forEach((petal, i) => {
    rows.uAt.set([petal.at[0], petal.at[1], petal.lie[0], petal.lie[1]], i * 4)
    rows.uShape.set([petal.half, petal.along, petal.taper, petal.bend], i * 4)
    rows.uEdge.set([petal.ruffle, petal.fine, petal.blur, petal.rim], i * 4)
    rows.uSkin.set([petal.color[0], petal.color[1], petal.color[2], 1], i * 4)
    rows.uGlow.set([petal.shine, petal.halo, petal.phase, petal.lobe], i * 4)
  })
  return rows
}

const paint = (art: CoverArt): HTMLCanvasElement | null => {
  const held = rigged()
  if (!held) return null
  const { gl, spots } = held
  // The seed is a big number and a shader works in floats, so it is brought
  // down to something a float holds exactly rather than handed over whole.
  gl.uniform1f(spots.uSeed, (art.seed % 65536) / 64)
  gl.uniform3f(spots.uSky, art.sky[0], art.sky[1], art.sky[2])
  gl.uniform3f(spots.uSkyTo, art.skyTo[0], art.skyTo[1], art.skyTo[2])
  gl.uniform2f(spots.uSkyLie, art.skyLie[0], art.skyLie[1])
  gl.uniform3f(spots.uLight, art.light[0], art.light[1], art.light[2])
  gl.uniform2f(spots.uSun, art.sun[0], art.sun[1])
  gl.uniform1f(spots.uBloom, art.bloom)
  gl.uniform1f(spots.uHaze, art.haze)
  const rows = packed(art)
  for (const name of PACKED) gl.uniform4fv(spots[name], rows[name])
  gl.drawArrays(gl.TRIANGLES, 0, 3)
  return held.canvas
}

// A cover is drawn once and kept, because the same track stands in the list and
// at the top of the panel at the same time, and the list is redrawn every time
// anything about the room changes.
const kept = new Map<string, HTMLCanvasElement>()

export function coverFor(subject: CoverSubject): HTMLCanvasElement | null {
  const had = kept.get(subject.id)
  if (had) return had
  const drawn = paint(coverArt(subject))
  if (!drawn) return null
  const copy = document.createElement('canvas')
  copy.width = SIDE
  copy.height = SIDE
  const flat = copy.getContext('2d')
  if (!flat) return null
  flat.drawImage(drawn, 0, 0)
  kept.set(subject.id, copy)
  return copy
}

export function forgetCovers(): void {
  kept.clear()
}
