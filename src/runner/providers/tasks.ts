import type { StepTodo } from '../../shared/llm'
import { stepTodos } from './detail'
import type { ParsedActivity, TaskCall } from './types'

// Claude Code has no whole-list tool any more. A task is made, changed and read
// one call at a time, so nothing a CLI hands over carries the list, and these
// are the four calls it is written with, however a CLI spells them.
const TASK_TOOLS = new Set(['taskcreate', 'taskupdate', 'tasklist', 'taskget'])

const toolKey = (name: string): string => name.toLowerCase().replace(/[^a-z]/g, '')

const isTaskTool = (name: string): boolean => TASK_TOOLS.has(toolKey(name))

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

const idOf = (record: Record<string, unknown>): string => {
  const raw = record['taskId'] ?? record['task_id'] ?? record['id']
  return typeof raw === 'number' ? String(raw) : str(raw)
}

export function taskCall(name: string, input: unknown): TaskCall | undefined {
  const tool = toolKey(name)
  if (!TASK_TOOLS.has(tool)) return undefined
  const record = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
  return {
    kind: tool === 'taskcreate' ? 'create' : tool === 'taskupdate' ? 'change' : 'read',
    id: idOf(record),
    subject: str(record['subject']),
    description: str(record['description']),
    status: str(record['status']).toLowerCase()
  }
}

interface Task {
  id: string
  subject: string
  description: string
  status: string
}

export interface TaskLedger {
  todos(name: string, activity: ParsedActivity): StepTodo[] | undefined
}

// A create says no id at all, and the only place one is ever said is the line
// the tool hands back, so it is read out of that as loosely as it can be.
const NAMED = /task\s*#(\d+)/i

// The list itself, folded from those single calls, so a step for one of them
// still says what the whole of the work is. It belongs to the run rather than
// to the module: two agents on one machine are two lists.
export function taskLedger(): TaskLedger {
  const tasks: Task[] = []
  const made = new Map<string, Task>()
  let created = 0

  const add = (id: string, call: TaskCall): Task => {
    const task = { id, subject: call.subject, description: call.description, status: call.status || 'pending' }
    tasks.push(task)
    return task
  }

  const create = (activityId: string, call: TaskCall): void => {
    // A CLI can report the same call more than once, and a task made twice is a
    // row that never goes away. Until the result names it, a task answers to
    // the order it was made in, which is what the numbering follows anyway.
    if (made.has(activityId)) return
    made.set(activityId, add(String(++created), call))
  }

  const change = (call: TaskCall): void => {
    if (!call.id) return
    const task = tasks.find(entry => entry.id === call.id)
    if (call.status === 'deleted') {
      if (task) tasks.splice(tasks.indexOf(task), 1)
      return
    }
    // A list can outlive the run that wrote it, so a change naming a task this
    // has never seen is taken as the task rather than dropped.
    if (!task) {
      if (call.subject || call.description) add(call.id, call)
      return
    }
    if (call.subject) task.subject = call.subject
    if (call.description) task.description = call.description
    if (call.status) task.status = call.status
  }

  const bind = (activityId: string, output: string): void => {
    const task = made.get(activityId)
    const found = NAMED.exec(output)
    if (task && found) task.id = found[1]
  }

  return {
    todos(name, activity) {
      if (!isTaskTool(name)) return undefined
      if (activity.status === 'finished') bind(activity.id, activity.output ?? '')
      else if (activity.task?.kind === 'create') create(activity.id, activity.task)
      else if (activity.task?.kind === 'change') change(activity.task)
      // Read back out through the whole-list path, so a list folded from single
      // calls lands on the same limits and the same words for a state.
      return stepTodos({
        todos: tasks.map(task => ({ content: task.subject, description: task.description, status: task.status }))
      })
    }
  }
}
