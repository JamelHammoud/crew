import sharp from 'sharp'

const B1 = `<path d="M5.4 6H7.8A2.2 2.2 0 0 1 12.2 6H14.6A2 2 0 0 1 16.6 8V14.2A2 2 0 0 1 14.6 16.2H5.4A2 2 0 0 1 3.4 14.2V12.6A2.2 2.2 0 0 0 3.4 8.2V8A2 2 0 0 1 5.4 6Z"/>`
const B2 = `<path d="M6 5.4V7.8A2.2 2.2 0 0 0 6 12.2V14.6A2 2 0 0 0 8 16.6H14.2A2 2 0 0 0 16.2 14.6V6.2A2 2 0 0 0 14.2 4.2H12.6A2.2 2.2 0 0 1 8.2 4.2H8A2 2 0 0 0 6 6.2Z"/>`
const B3 = `<path d="M5.4 6.6H8.4A2 2 0 0 1 12.4 6.6H14.6A2 2 0 0 1 16.6 8.6V13.6A2 2 0 0 1 14.6 15.6H5.4A2 2 0 0 1 3.4 13.6V12A2 2 0 0 0 3.4 8.2V8.6A2 2 0 0 1 5.4 6.6Z"/>`
const CANDS = [['B1 knob up, bite left', B1], ['B2 bite left, knob up right', B2], ['B3 shallower', B3]]

const W = 340, ROW = 40, PAD = 12
const H = PAD * 2 + CANDS.length * ROW
const body = CANDS.map(([label, art], i) => {
  const y = PAD + i * ROW
  return `<g transform="translate(0 ${y})">
    <g transform="translate(16 5) scale(0.9)" fill="none" stroke="#fff" stroke-width="1.67" stroke-linecap="round" stroke-linejoin="round" opacity="0.45">${art}</g>
    <g transform="translate(48 5) scale(0.9)" fill="none" stroke="#fff" stroke-width="1.67" stroke-linecap="round" stroke-linejoin="round">${art}</g>
    <g transform="translate(80 0) scale(1.6)" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.7">${art}</g>
    <text x="124" y="22" font-family="-apple-system,Helvetica" font-size="12" fill="#fff" fill-opacity="0.5">${label}</text>
  </g>`
}).join('')
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#222"/>${body}</svg>`
await sharp(Buffer.from(svg), { density: 288 }).png().toFile('/tmp/jig.png')
console.log('ok')
