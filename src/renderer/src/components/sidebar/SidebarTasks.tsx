import { CheckCircleGlyph } from '../../icons'
import { reviewCount } from '../../state/alerts'
import { useSidebar } from '../../state/sidebar'
import { useCrew } from '../../state/store'
import { tasksShowing, useTasks } from '../../state/tasks'
import Badge from '../Badge'
import { TAB_ICON } from '../navTabs'
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
      after={<Badge count={waiting} rim={false} />}
      onClick={() => {
        peek(false)
        toggle()
      }}
    />
  )
}
