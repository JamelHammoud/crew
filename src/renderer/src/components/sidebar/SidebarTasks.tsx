import { badgeText } from '../../../../shared/presence'
import { CheckCircleGlyph } from '../../icons'
import { reviewCount } from '../../state/alerts'
import { useSidebar } from '../../state/sidebar'
import { useCrew } from '../../state/store'
import { tasksShowing, useTasks } from '../../state/tasks'
import { TAB_ICON } from '../navTabs'
import Pill from '../Pill'
import NavRow from './NavRow'

export default function SidebarTasks() {
  const waiting = useCrew(reviewCount)
  const open = useTasks(tasksShowing)
  const toggle = useTasks(s => s.toggle)
  const peek = useSidebar(s => s.peek)

  return (
    <NavRow
      icon={<CheckCircleGlyph className={TAB_ICON} />}
      label="Tasks"
      lit={open}
      expanded={open}
      after={waiting > 0 && <Pill solid>{badgeText(waiting)}</Pill>}
      onClick={() => {
        peek(false)
        toggle()
      }}
    />
  )
}
