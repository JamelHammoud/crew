const WIDTH = 420
const HEIGHT = 595

export function pdfBytes(words: string[]): Uint8Array {
  const objects = ['', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
  const kids: string[] = []
  let at = 4

  words.forEach((line, i) => {
    const stream =
      `BT /F1 28 Tf 40 520 Td (${line}) Tj ET\n` +
      `BT /F1 14 Tf 40 470 Td (page ${i + 1} of ${words.length}) Tj ET\n` +
      `0 0 0 rg 40 60 120 40 re f\n`
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${WIDTH} ${HEIGHT}] ` +
        `/Resources << /Font << /F1 3 0 R >> >> /Contents ${at + 1} 0 R >>`
    )
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`)
    kids.push(`${at} 0 R`)
    at += 2
  })

  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${words.length} >>`

  let body = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((object, i) => {
    offsets.push(body.length)
    body += `${i + 1} 0 obj\n${object}\nendobj\n`
  })

  const size = objects.length + 1
  let table = `xref\n0 ${size}\n0000000000 65535 f \n`
  for (const offset of offsets) table += `${String(offset).padStart(10, '0')} 00000 n \n`
  const file = `${body}${table}trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${body.length}\n%%EOF\n`
  return new Uint8Array(Buffer.from(file, 'latin1'))
}
