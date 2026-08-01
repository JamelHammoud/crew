
import { createRoot } from 'react-dom/client'
import { createElement } from 'react'
import './shot.css'
import ReviewView from '/Users/jamel/Documents/Repositories/crew/src/renderer/src/components/review/ReviewView'
import { useCrew } from '/Users/jamel/Documents/Repositories/crew/src/renderer/src/state/store'
import { useReviewed } from '/Users/jamel/Documents/Repositories/crew/src/renderer/src/state/reviewed'

const hunks = [
  '@@ -12,6 +12,7 @@ export function threadState(thread, events) {',
  '   const promptId = threadPrompts[thread.id]',
  '   const working = threadWorking(thread.id, threadPrompts, queues)',
  '-  if (!working) return "ready"',
  '+  if (!working && thread.status === "open") return "ready"',
  '+  if (thread.parentThreadId) return "helper"',
  '   return "working"',
  ' }',
  '@@ -84,3 +85,3 @@ const byRecency = (a, b) =>',
  '   (lastMessageAt[b.thread.id] ?? 0) - (lastMessageAt[a.thread.id] ?? 0)',
  '-const inProgress = visible.filter(r => r.state === "working")',
  '+const inProgress = visible.filter(r => r.state === "working" && !r.thread.archived)',
].join('\n')

const changes = [
  { path: 'src/renderer/src/components/thread.ts', kind: 'modified', staged: true, added: 3, removed: 2, diff: hunks, binary: false, truncated: false },
  { path: 'src/shared/alerts.ts', kind: 'modified', staged: true, added: 12, removed: 1, diff: '@@ -1,3 +1,4 @@\n import type { AgentAlert } from "./alerts"\n+import { threadWorking } from "./thread"\n \n export interface ReviewState {', binary: false, truncated: false },
  { path: 'src/renderer/src/components/review/ReviewRow.tsx', kind: 'added', staged: false, added: 74, removed: 0, diff: '@@ -0,0 +1,3 @@\n+export default function ReviewRow() {\n+  return null\n+}', binary: false, truncated: false },
  { path: 'src/renderer/src/components/review/OldPanel.tsx', kind: 'deleted', staged: false, added: 0, removed: 61, diff: '@@ -1,3 +0,0 @@\n-export default function OldPanel() {\n-  return null\n-}', binary: false, truncated: false },
  { path: 'src/renderer/src/state/reviewed.ts', kind: 'modified', staged: false, added: 8, removed: 4, diff: '@@ -30,4 +30,4 @@ const KEY = "crew.reviewed"\n const PLACE_LIMIT = 20\n-const FILE_LIMIT = 200\n+const FILE_LIMIT = 400', binary: false, truncated: false },
  { path: 'tests/review-panel.test.ts', kind: 'modified', staged: false, added: 41, removed: 9, diff: '@@ -5,3 +5,3 @@\n import { describe, it } from "vitest"\n-const change = (path, staged) => ({ path })\n+const change = (path, staged, diff) => ({ path, diff })', binary: false, truncated: false },
  { path: 'package.json', kind: 'modified', staged: false, added: 1, removed: 1, diff: '@@ -14,3 +14,3 @@\n   "scripts": {\n-    "test": "vitest"\n+    "test": "vitest run"', binary: false, truncated: false },
]

window.crew = {
  repoWork: async () => ({
    status: { available: true, remote: true, branch: 'review-pass', changed: 7, ahead: 2, behind: 1, stashes: 1 },
    changes,
    stashes: [{ ref: 'stash@{0}', message: 'Half of the keyboard work', branch: 'review-pass' }],
  }),
  runRepo: async () => ({ ok: true, updated: true, message: 'Done', status: {} }),
}

useCrew.setState({ place: 'project:/demo' })
useReviewed.setState({
  read: { 'project:/demo': {} },
})

createRoot(document.getElementById('root')).render(createElement(ReviewView))

window.markRead = (key, digest) => useReviewed.getState().markRead('project:/demo', key, digest)
