import { CloseGlyph } from '../../icons'
import { closeSettings, openSettings, useSettings, type SettingsTab } from '../../state/settings'
import { useCrew } from '../../state/store'
import Avatar from '../Avatar'
import Modal from '../Modal'
import Agents from './Agents'
import Appearance from './Appearance'
import People from './People'
import SoundAndVideo from './SoundAndVideo'
import You from './You'
import { GROUPS, SETTINGS_TABS, tabLabel } from './tabs'

const WIDTH = 940
const HEIGHT = 620

function Panel({ tab }: { tab: SettingsTab }) {
  if (tab === 'you') return <You onDone={closeSettings} />
  if (tab === 'appearance') return <Appearance />
  if (tab === 'sound') return <SoundAndVideo />
  if (tab === 'people') return <People />
  return <Agents />
}

// The settings, as a rail of pages and the one that is open. Everything that is
// yours alone and everything the crew shares stands in the same card, so the
// menu it was opened from is a way in rather than a place things live.
export default function Settings() {
  const tab = useSettings()
  const selfName = useCrew(s => s.selfName)

  return (
    <Modal open={tab !== null} onClose={closeSettings} title="Settings" width={WIDTH} flush>
      <div className="flex" style={{ height: HEIGHT, maxHeight: 'calc(100vh - 120px)' }}>
        <nav aria-label="Settings" className="w-[228px] shrink-0 border-r border-fg/[0.07] p-2.5 overflow-y-auto">
          {GROUPS.map(group => (
            <div key={group} className="pt-3 first:pt-1">
              <p className="px-2.5 pb-1 text-xs font-medium text-fg/40">{group}</p>
              {SETTINGS_TABS.filter(one => one.group === group).map(one => {
                const on = one.id === tab
                const Mark = one.mark
                const label = tabLabel(one, selfName)
                return (
                  <button
                    key={one.id}
                    onClick={() => openSettings(one.id)}
                    aria-label={label}
                    aria-current={on ? 'page' : undefined}
                    className={`w-full flex items-center gap-2.5 px-2.5 h-9 rounded-xl text-sm text-left transition-colors ${
                      on ? 'bg-fg/[0.08] text-fg font-medium' : 'text-fg/70 hover:text-fg hover:bg-fg/5'
                    }`}
                  >
                    {Mark ? <Mark className="w-[18px] h-[18px] shrink-0" /> : <Avatar name={selfName || '?'} px={18} />}
                    <span className="truncate">{label}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        {/* The pages stand beside each other rather than in front of each
            other, so nothing travels between them: one is simply the one that
            is up. Each keeps its own scroller, so a page comes back where it
            was left. */}
        <div className="relative flex-1 min-w-0">
          {tab && (
            <div key={tab} className="absolute inset-0 overflow-y-auto animate-fade">
              <Panel tab={tab} />
            </div>
          )}
          <button
            onClick={closeSettings}
            aria-label="Close settings"
            className="absolute top-3.5 right-3.5 z-10 w-8 h-8 rounded-full flex items-center justify-center text-fg/45 transition-colors hover:text-fg hover:bg-fg/[0.07] active:scale-95"
          >
            <CloseGlyph className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>
    </Modal>
  )
}
