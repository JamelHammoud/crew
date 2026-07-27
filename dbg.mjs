import { spawn } from 'node:child_process'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { build } from 'esbuild'
import electron from 'electron'
const root='/Users/jamel/Documents/Repositories/crew'
const dir = await mkdtemp(path.join(tmpdir(), 'dbg-'))
await writeFile(path.join(root,'scripts/.dbg-entry.ts'), `
import { musicItems } from '../src/shared/music'
import { coverArt } from '../src/renderer/src/components/music/coverSeed'
import { coverFor } from '../src/renderer/src/components/music/coverArt'
window.D = { musicItems, coverArt, coverFor }
`)
await build({entryPoints:[path.join(root,'scripts/.dbg-entry.ts')],bundle:true,format:'iife',outfile:path.join(dir,'d.js'),logLevel:'error'})
await writeFile(path.join(dir,'d.html'), `<!doctype html><html><body><script src="d.js"></script><script>
window.probe = () => {
  const item = window.D.musicItems([])[0];
  const art = window.D.coverFor(item);
  let px = 'null';
  if (art) { const g = art.getContext('2d'); const d = g.getImageData(256,256,1,1).data; px = [d[0],d[1],d[2],d[3]].join(','); }
  const c = document.createElement('canvas'); c.width=64;c.height=64;
  const gl = c.getContext('webgl', {antialias:false, preserveDrawingBuffer:true});
  if (!gl) return {no:'no context'};
  // minimal draw: solid red triangle
  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, 'attribute vec2 a; void main(){ gl_Position = vec4(a,0.,1.); }'); gl.compileShader(vs);
  const fs2 = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs2, 'void main(){ gl_FragColor = vec4(1.,0.,0.,1.); }'); gl.compileShader(fs2);
  const pr = gl.createProgram(); gl.attachShader(pr,vs); gl.attachShader(pr,fs2); gl.linkProgram(pr); gl.useProgram(pr);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr,'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
  gl.viewport(0,0,64,64); gl.drawArrays(gl.TRIANGLES,0,3);
  const raw = new Uint8Array(4); gl.readPixels(32,32,1,1,gl.RGBA,gl.UNSIGNED_BYTE,raw);
  // now the real program
  const c2 = document.createElement('canvas'); c2.width=128; c2.height=128;
  const g2 = c2.getContext('webgl', {antialias:false, preserveDrawingBuffer:true});
  const v2 = g2.createShader(g2.VERTEX_SHADER);
  g2.shaderSource(v2, 'attribute vec2 aSpot; varying vec2 vUv; void main(){ vUv = aSpot*0.5+0.5; gl_Position = vec4(aSpot,0.,1.); }'); g2.compileShader(v2);
  const f3 = g2.createShader(g2.FRAGMENT_SHADER); g2.shaderSource(f3, window.VARIANT || window.FRAG); g2.compileShader(f3);
  const p3 = g2.createProgram(); g2.attachShader(p3,v2); g2.attachShader(p3,f3); g2.linkProgram(p3);
  const linked = g2.getProgramParameter(p3, g2.LINK_STATUS);
  const linkLog = g2.getProgramInfoLog(p3);
  g2.useProgram(p3);
  const b3 = g2.createBuffer(); g2.bindBuffer(g2.ARRAY_BUFFER,b3);
  g2.bufferData(g2.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), g2.STATIC_DRAW);
  const l3 = g2.getAttribLocation(p3,'aSpot'); g2.enableVertexAttribArray(l3); g2.vertexAttribPointer(l3,2,g2.FLOAT,false,0,0);
  g2.viewport(0,0,128,128);
  const A = window.D.coverArt(item);
  g2.uniform1f(g2.getUniformLocation(p3,'uSeed'), (A.seed%65536)/64);
  g2.uniform3f(g2.getUniformLocation(p3,'uSky'), ...A.sky);
  g2.uniform3f(g2.getUniformLocation(p3,'uSkyTo'), ...A.skyTo);
  g2.uniform2f(g2.getUniformLocation(p3,'uSkyLie'), ...A.skyLie);
  g2.uniform3f(g2.getUniformLocation(p3,'uLight'), ...A.light);
  g2.uniform2f(g2.getUniformLocation(p3,'uSun'), ...A.sun);
  g2.uniform1f(g2.getUniformLocation(p3,'uBloom'), A.bloom);
  g2.uniform1f(g2.getUniformLocation(p3,'uHaze'), A.haze);
  const rows = {uAt:[],uShape:[],uEdge:[],uSkin:[],uGlow:[]};
  for (let i=0;i<7;i++){ const q=A.petals[i];
    rows.uAt.push(...(q?[q.at[0],q.at[1],q.lie[0],q.lie[1]]:[0,0,1,0]));
    rows.uShape.push(...(q?[q.half,q.along,q.taper,q.bend]:[0,1,1,0]));
    rows.uEdge.push(...(q?[q.ruffle,q.grain,q.blur,q.rim]:[0,1,0.1,0]));
    rows.uSkin.push(...(q?[q.color[0],q.color[1],q.color[2],1]:[0,0,0,0]));
    rows.uGlow.push(...(q?[q.shine,q.halo,0,0]:[0,0,0,0])); }
  for (const k of Object.keys(rows)) g2.uniform4fv(g2.getUniformLocation(p3, k+'[0]'), new Float32Array(rows[k]));
  g2.validateProgram(p3);
  const valid = g2.getProgramParameter(p3, g2.VALIDATE_STATUS);
  const validLog = g2.getProgramInfoLog(p3);
  const errBefore = g2.getError();
  g2.drawArrays(g2.TRIANGLES,0,3);
  const errAfter = g2.getError();
  const raw2 = new Uint8Array(4); g2.readPixels(64,64,1,1,g2.RGBA,g2.UNSIGNED_BYTE,raw2);
  const flatc = document.createElement('canvas'); flatc.width=64; flatc.height=64;
  const f2 = flatc.getContext('2d'); f2.drawImage(c,0,0);
  const via = f2.getImageData(32,32,1,1).data;
  return { valid, validLog, linked, linkLog, errBefore, errAfter, realRead: [...raw2].join(','), minRead: [...raw].join(','), minCopy: [...via].join(','), art: !!art, px, err: gl.getError() };
  const src = window.FRAG;
  const sh = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(sh, src); gl.compileShader(sh);
  return { art: !!art, px, ok: gl.getShaderParameter(sh, gl.COMPILE_STATUS), log: gl.getShaderInfoLog(sh),
           maxFragVec: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
           renderer: gl.getParameter(gl.RENDERER) };
}
</script></body></html>`)
await writeFile(path.join(dir,'main.mjs'), `import { app, BrowserWindow } from 'electron'
import { readFileSync } from 'node:fs'
import path from 'node:path'
app.whenReady().then(async () => {
  const w = new BrowserWindow({show:false, webPreferences:{nodeIntegration:true,contextIsolation:false}})
  w.webContents.on('console-message', (e) => { const t = (e && e.message) || ''; if (t) console.log('CONSOLE ' + t) })
  await w.loadFile(path.join(import.meta.dirname,'d.html'))
  const frag = readFileSync(process.env.FRAG_FILE,'utf8')
  await w.webContents.executeJavaScript('window.FRAG = ' + JSON.stringify(frag))
  const full = readFileSync(process.env.FRAG_FILE,'utf8')
  const cuts = {
    full: full,
    noLoop: full.replace(/  for \(int i = 0; i < MAX; i\+\+\) \{[\s\S]*?\n  \}\n/, '\n'),
    noFbm: full.replace(/fbm\(([^;]*?)\)/g, '0.5'),
    skyOnly: full.replace(/void main\(\) \{[\s\S]*$/, 'void main() { gl_FragColor = vec4(uSky, 1.0); }\n')
  }
  const out = {}
  for (const [name, src] of Object.entries(cuts)) {
    await w.webContents.executeJavaScript('window.VARIANT = ' + JSON.stringify(src))
    const one = await w.webContents.executeJavaScript('window.probe()')
    out[name] = { err: one.errAfter, read: one.realRead, linked: one.linked }
  }
  console.log('PROBE ' + JSON.stringify(out))
  app.exit(0)
}).catch(e => { console.log('PROBE_FAIL '+e.stack); app.exit(1) })
`)
// extract FRAGMENT from coverArt.ts
const srcTxt = (await import('node:fs')).readFileSync(root+'/src/renderer/src/components/music/coverArt.ts','utf8')
const m = srcTxt.match(/const FRAGMENT = `([\s\S]*?)`\n/)
const frag = m[1].replace('${MAX_PETALS}','7')
await writeFile(path.join(dir,'frag.glsl'), frag)
const child = spawn(electron,[path.join(dir,'main.mjs')],{env:{...process.env,FRAG_FILE:path.join(dir,'frag.glsl')},stdio:['ignore','pipe','pipe']})
let t=''; child.stdout.on('data',d=>t+=d); child.stderr.on('data',d=>t+=d)
child.on('exit',()=>{ console.log(t.split('\n').filter(l=>l.startsWith('PROBE')).join('\n')) })
