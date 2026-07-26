import { HangupGlyph, MicGlyph, CameraGlyph } from '../src/renderer/src/icons/media'
import { DesktopGlyph } from '../src/renderer/src/icons'
import { DOC_BLOCKS } from '../src/renderer/src/components/doc/docBlocks'

const pill = (red: boolean) => ({
  width: 40,
  height: 40,
  borderRadius: 999,
  background: red ? 'rgb(255 90 90 / 0.15)' : 'rgb(255 255 255 / 0.08)',
  color: red ? '#ff6b6b' : '#ffffffb3',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
})

function Bar() {
  return (
    <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <span style={pill(false)}>
        <MicGlyph className="w-[18px] h-[18px]" />
      </span>
      <span style={pill(false)}>
        <CameraGlyph className="w-[18px] h-[18px]" />
      </span>
      <span style={pill(false)}>
        <DesktopGlyph className="w-[18px] h-[18px]" />
      </span>
      <span style={{ width: 1, height: 24, background: '#ffffff14', margin: '0 4px' }} />
      <span style={pill(true)}>
        <HangupGlyph className="w-[18px] h-[18px]" />
      </span>
      <span style={{ color: '#ffffff8c', display: 'flex', marginLeft: 14 }}>
        <HangupGlyph className="w-4 h-4" />
      </span>
      <HangupGlyph className="w-12 h-12" />
    </span>
  )
}

const GROUPS: [string, string[]][] = [
  ['TEXT', ['Paragraph', 'Heading 1', 'Heading 2', 'Heading 3', 'Quote']],
  ['LISTS', ['Bulleted list', 'Numbered list', 'To-do list']],
  ['BLOCKS', ['Code', 'Divider', 'Table', 'Image']]
]

function Menu() {
  const byType = new Map(DOC_BLOCKS.map(block => [block.title, block]))
  return (
    <div
      style={{
        width: 262,
        background: '#1a1a1de6',
        border: '1px solid #ffffff14',
        borderRadius: 16,
        padding: 6
      }}
    >
      {GROUPS.map(([section, types]) => (
        <div key={section}>
          <p
            style={{
              display: 'flex',
              height: 28,
              alignItems: 'center',
              padding: '0 8px',
              fontSize: 11,
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '.04em',
              color: '#ffffff73',
              margin: 0
            }}
          >
            {section}
          </p>
          {types.map(type => {
            const block = byType.get(type)
            if (!block) return <p key={type}>missing {type}</p>
            const M = block.mark
            return (
              <div
                key={type}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: 12,
                  fontSize: 14
                }}
              >
                <span style={{ color: '#ffffff8c', display: 'flex' }}>
                  <M className="w-4 h-4" />
                </span>
                <span style={{ flex: 1 }}>{block.title}</span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function Big() {
  const byType = new Map(DOC_BLOCKS.map(block => [block.title, block]))
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, width: 420 }}>
      {GROUPS.flatMap(([, types]) => types).map(type => {
        const M = byType.get(type)?.mark
        if (!M) return null
        return (
          <span key={type} style={{ color: '#fff', display: 'flex' }}>
            <M className="w-12 h-12" />
          </span>
        )
      })}
    </div>
  )
}

export default function Probe() {
  return (
    <div>
      <div className="row">
        <span className="cap">leave</span>
        <Bar />
      </div>
      <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start', marginTop: 24 }}>
        <Menu />
        <Big />
      </div>
    </div>
  )
}
