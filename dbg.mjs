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
  await w.loadFile(path.join(import.meta.dirname,'d.html'))
  const frag = readFileSync(process.env.FRAG_FILE,'utf8')
  await w.webContents.executeJavaScript('window.FRAG = ' + JSON.stringify(frag))
  const r = await w.webContents.executeJavaScript('window.probe()')
  console.log('PROBE ' + JSON.stringify(r))
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
