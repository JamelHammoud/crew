;(function () {
  const PAPER = [0.949, 0.949, 0.949]

  const GRAIN = 0.068

  const BASE_WIDTH = 660

  const BASE = [0.612, 0.655, 0.969]

  const BLOOM = {
    x: -0.05,
    y: 0.515,
    radius: 0.94,
    strength: 1,
    wide: 0.045,
    shape: [1, 1.5],
    fade: 3,
    lift: 0.24
  }

  const LAYERS = [
    {
      color: [0.259, 0.796, 1.0],
      scale: 0.96,
      speed: 0.132,
      bias: 0.16,
      drift: [0.19, -0.08],
      flow: [-0.44, 1.38],
      weight: 1.0
    },
    {
      color: [0.753, 0.549, 0.984],
      scale: 0.8,
      speed: 0.104,
      bias: 0.04,
      drift: [0.12, 0.13],
      flow: [1.12, 1.24],
      weight: 1.0
    },
    {
      color: [1.0, 0.451, 0.588],
      scale: 1.18,
      speed: 0.158,
      bias: -0.12,
      drift: [0.16, 0.09],
      flow: [-1.33, 1.5],
      weight: 0.76
    },
    {
      color: [1.0, 0.808, 0.404],
      scale: 0.88,
      speed: 0.088,
      bias: -0.16,
      drift: [0.09, -0.15],
      flow: [0.36, 1.3],
      weight: 0.52
    }
  ]

  const VERTEX = `
attribute vec2 aSpot;
varying vec2 vUv;
void main() {
  vUv = aSpot * 0.5 + 0.5;
  gl_Position = vec4(aSpot, 0.0, 1.0);
}`

  const FRAGMENT = `
precision highp float;
varying vec2 vUv;
uniform vec2 uSize;
uniform float uTime;
uniform vec3 uBase;
uniform vec3 uColour[4];
uniform vec4 uWave[4];
uniform vec2 uDrift[4];
uniform vec2 uFlow[4];
uniform vec3 uPaper;
uniform vec4 uBloom;
uniform vec2 uShape;
uniform float uWide;
uniform float uFade;
uniform float uLift;
uniform float uGrain;
uniform float uGrainCell;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

vec2 flow(vec2 p, vec2 lie) {
  float c = cos(lie.x);
  float s = sin(lie.x);
  vec2 turned = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
  return vec2(turned.x / lie.y, turned.y * lie.y);
}

float band(vec2 p, vec4 wave, vec2 drift, vec2 lie, float seed, float t) {
  float clock = t * wave.y;
  vec2 q = flow(p, lie) * wave.x + drift * clock * 6.0;
  float broad = snoise(vec3(q, clock + seed * 13.7));
  float fine = snoise(vec3(q * 2.1 - 5.0, clock * 0.64 + seed * 5.3));
  return broad * 0.78 + fine * 0.34 + wave.z;
}

float grain(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  float ratio = uSize.x / uSize.y;
  vec2 p = vec2(vUv.x * ratio, vUv.y);
  vec3 colour = uBase;
  float relief = 0.0;
  vec2 nudge = vec2(0.0032 * ratio, 0.0032);

  for (int i = 0; i < 4; i++) {
    vec4 wave = uWave[i];
    vec2 drift = uDrift[i];
    vec2 lie = uFlow[i];
    float seed = float(i);
    float n = band(p, wave, drift, lie, seed, uTime);
    float a = smoothstep(-0.04, 0.46, n) * wave.w;
    colour = mix(colour, mix(uColour[i], vec3(1.0), uLift), a);
    float dx = band(p + vec2(nudge.x, 0.0), wave, drift, lie, seed, uTime)
             - band(p - vec2(nudge.x, 0.0), wave, drift, lie, seed, uTime);
    float dy = band(p + vec2(0.0, nudge.y), wave, drift, lie, seed, uTime)
             - band(p - vec2(0.0, nudge.y), wave, drift, lie, seed, uTime);
    relief += (dx * 0.7 - dy * 0.7) * a;
  }

  colour += vec3(0.07, 0.067, 0.062) * clamp(relief * 2.0, -1.0, 1.0);

  vec2 away = vec2((vUv.x - uBloom.x) * ratio / uShape.x, (vUv.y - uBloom.y) / uShape.y);
  float reach = length(away) / uBloom.z;
  float ragged = snoise(vec3(p * 1.9, uTime * 0.045)) * 0.058
               + snoise(vec3(p * 4.6 + 12.0, uTime * 0.07)) * 0.02;
  float edge = max(reach + ragged, 0.0);
  float glow = exp(-edge * edge * uFade) * uBloom.w;
  float wide = exp(-reach * reach * 0.42) * uWide;

  vec3 ground = mix(uPaper, vec3(1.0), clamp(glow * 0.5, 0.0, 1.0));
  vec3 lit = mix(ground, colour, clamp(glow + wide, 0.0, 1.0));
  lit += (grain(floor(vUv * uSize / uGrainCell)) - 0.5) * uGrain;
  gl_FragColor = vec4(clamp(lit, 0.0, 1.0), 1.0);
}`

  function compile(gl, kind, source) {
    const shader = gl.createShader(kind)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) || 'shader would not compile')
    }
    return shader
  }

  function build(canvas) {
    const gl = canvas.getContext('webgl', { antialias: false, preserveDrawingBuffer: true })
    if (!gl) throw new Error('no webgl')
    const program = gl.createProgram()
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX))
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT))
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || 'shader would not link')
    }
    gl.useProgram(program)

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const spot = gl.getAttribLocation(program, 'aSpot')
    gl.enableVertexAttribArray(spot)
    gl.vertexAttribPointer(spot, 2, gl.FLOAT, false, 0, 0)

    gl.uniform3fv(gl.getUniformLocation(program, 'uBase'), BASE)
    gl.uniform3fv(gl.getUniformLocation(program, 'uPaper'), PAPER)
    gl.uniform4f(gl.getUniformLocation(program, 'uBloom'), BLOOM.x, BLOOM.y, BLOOM.radius, BLOOM.strength)
    gl.uniform2fv(gl.getUniformLocation(program, 'uShape'), BLOOM.shape)
    gl.uniform1f(gl.getUniformLocation(program, 'uWide'), BLOOM.wide)
    gl.uniform1f(gl.getUniformLocation(program, 'uFade'), BLOOM.fade)
    gl.uniform1f(gl.getUniformLocation(program, 'uLift'), BLOOM.lift)
    gl.uniform1f(gl.getUniformLocation(program, 'uGrain'), GRAIN)
    gl.uniform1f(gl.getUniformLocation(program, 'uGrainCell'), Math.max(1, Math.round(canvas.width / BASE_WIDTH)))
    gl.uniform3fv(
      gl.getUniformLocation(program, 'uColour'),
      LAYERS.flatMap(layer => layer.color)
    )
    gl.uniform4fv(
      gl.getUniformLocation(program, 'uWave'),
      LAYERS.flatMap(layer => [layer.scale, layer.speed, layer.bias, layer.weight])
    )
    gl.uniform2fv(
      gl.getUniformLocation(program, 'uDrift'),
      LAYERS.flatMap(layer => layer.drift)
    )
    gl.uniform2fv(
      gl.getUniformLocation(program, 'uFlow'),
      LAYERS.flatMap(layer => layer.flow)
    )

    const size = gl.getUniformLocation(program, 'uSize')
    const clock = gl.getUniformLocation(program, 'uTime')

    return {
      draw(at) {
        gl.viewport(0, 0, canvas.width, canvas.height)
        gl.uniform2f(size, canvas.width, canvas.height)
        gl.uniform1f(clock, at)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
      }
    }
  }

  window.CrewMesh = {
    bloom: BLOOM,
    frame(canvas, at) {
      build(canvas).draw(at)
      return canvas
    },
    run(canvas, from) {
      const mesh = build(canvas)
      let start = null
      const tick = now => {
        if (start === null) start = now
        mesh.draw((from || 0) + (now - start) / 1000)
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }
  }
})()
