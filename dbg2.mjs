import { spawn } from 'node:child_process'
import { mkdtemp, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import electron from 'electron'

const root = '/Users/jamel/Documents/Repositories/crew'
const dir = await mkdtemp(path.join(tmpdir(), 'dbg2-'))

const src = await readFile(root + '/src/renderer/src/components/music/coverArt.ts', 'utf8')
const full = src.match(/const FRAGMENT = `([\s\S]*?)`\n/)[1].replace('${MAX_PETALS}', '7')

const variants = {
  full1: full,
  skyOnly: full.replace(/void main\(\) \{[\s\S]*$/, 'void main() { gl_FragColor = vec4(uSky, 1.0); }\n'),

  noLoop: full.replace(/  for \(int i = 0; i < MAX; i\+\+\) \{[\s\S]*?\n  \}\n/, '\n'),
  loopTrivial: full.replace(
    /  for \(int i = 0; i < MAX; i\+\+\) \{[\s\S]*?\n  \}\n/,
    '  for (int i = 0; i < MAX; i++) { color = mix(color, uSkin[i].rgb, uSkin[i].w * 0.1); }\n'
  ),
  noPow: full.replace('pow(max(0.0, 1.0 - reach * reach), shape.z)', '(1.0 - reach * reach)'),
  noSign: full.replace('-sign(side) * dot(across, uSun)', 'dot(across, uSun)'),
  noGrain: full.replace('color += (hash(gl_FragCoord.xy * 0.41) - 0.5) * 0.018;', '')
}

await writeFile(path.join(dir, 'v.json'), JSON.stringify(variants))
await writeFile(
  path.join(dir, 'p.html'),
  `<!doctype html><html><body><script>
window.run = (variants) => {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const gl = c.getContext('webgl', { antialias: false, preserveDrawingBuffer: true });
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
  gl.viewport(0,0,64,64);
  const VS = 'attribute vec2 aSpot; varying vec2 vUv; void main(){ vUv = aSpot*0.5+0.5; gl_Position = vec4(aSpot,0.,1.); }';
  const out = {};
  for (const [name, source] of Object.entries(variants)) {
    const v = gl.createShader(gl.VERTEX_SHADER); gl.shaderSource(v, VS); gl.compileShader(v);
    const f = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(f, source); gl.compileShader(f);
    const okF = gl.getShaderParameter(f, gl.COMPILE_STATUS);
    if (!okF) { out[name] = { compile: gl.getShaderInfoLog(f).slice(0, 200) }; continue; }
    const p = gl.createProgram(); gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { out[name] = { link: gl.getProgramInfoLog(p).slice(0,200) }; continue; }
    gl.useProgram(p);
    const loc = gl.getAttribLocation(p, 'aSpot');
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const sky = gl.getUniformLocation(p, 'uSky'); if (sky) gl.uniform3f(sky, 0.2, 0.5, 0.9);
    const light = gl.getUniformLocation(p, 'uLight'); if (light) gl.uniform3f(light, 0.95, 0.97, 1.0);
    const skyTo = gl.getUniformLocation(p, 'uSkyTo'); if (skyTo) gl.uniform3f(skyTo, 0.6, 0.8, 1.0);
    const skyLie = gl.getUniformLocation(p, 'uSkyLie'); if (skyLie) gl.uniform2f(skyLie, 0.7, 0.7);
    const sun = gl.getUniformLocation(p, 'uSun'); if (sun) gl.uniform2f(sun, 0.7, -0.7);
    for (const [n, val] of [['uSeed', 12.5], ['uBloom', 0.3], ['uHaze', 0.05]]) {
      const l = gl.getUniformLocation(p, n); if (l) gl.uniform1f(l, val);
    }
    for (const n of ['uAt','uShape','uEdge','uSkin','uGlow']) {
      const l = gl.getUniformLocation(p, n + '[0]');
      if (!l) continue;
      const rows = [];
      for (let i = 0; i < 7; i++) {
        if (n === 'uAt') rows.push(0.5, 0.5, 0.7, 0.7);
        else if (n === 'uShape') rows.push(0.2, 1.2, 0.6, 0.2);
        else if (n === 'uEdge') rows.push(0.08, 2.0, 0.1, 0.5);
        else if (n === 'uSkin') rows.push(0.8, 0.4, 0.6, i < 3 ? 1 : 0);
        else rows.push(0.4, 0.2, 0, 0);
      }
      gl.uniform4fv(l, new Float32Array(rows));
    }
    while (gl.getError() !== 0) {}
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const err = gl.getError();
    const px = new Uint8Array(4); gl.readPixels(32, 32, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    out[name] = { err, px: [...px].join(',') };
  }
  return out;
}
</script></body></html>`
)
await writeFile(
  path.join(dir, 'main.mjs'),
  `import { app, BrowserWindow } from 'electron'
import { readFileSync } from 'node:fs'
import path from 'node:path'
app.whenReady().then(async () => {
  const w = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: true, contextIsolation: false } })
  w.webContents.on('console-message', (...a) => { console.log('CONSOLE ' + JSON.stringify(a.map(x => (x && x.message) || (typeof x === 'string' ? x : undefined)).filter(Boolean))) })
  await w.loadFile(path.join(import.meta.dirname, 'p.html'))
  const variants = JSON.parse(readFileSync(path.join(import.meta.dirname, 'v.json'), 'utf8'))
  const r = await w.webContents.executeJavaScript('window.run(' + JSON.stringify(variants) + ')')
  console.log('BISECT ' + JSON.stringify(r))
  app.exit(0)
}).catch(e => { console.log('BISECT_FAIL ' + (e && e.stack)); app.exit(1) })
`
)

const child = spawn(electron, [path.join(dir, 'main.mjs')], { stdio: ['ignore', 'pipe', 'pipe'] })
let text = ''
child.stdout.on('data', d => (text += d))
child.stderr.on('data', d => (text += d))
setTimeout(() => child.kill('SIGKILL'), 60_000)
child.on('exit', () => {
  console.log(text.split('\n').filter(l => l.startsWith('BISECT') || l.startsWith('CONSOLE')).join('\n') || text.slice(-1500))
})
