import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import ChatListSkeleton from '../components/ChatListSkeleton'
import CommandChip from '../components/CommandChip'
import Composer from '../components/Composer'
import CreateAgent from '../components/CreateAgent'
import { JumpToBottom } from '../components/OverComposer'
import TypingLine from '../components/TypingLine'
import { MentionMenu, useMentionAutocomplete } from '../components/MentionAutocomplete'
import { SlashMenu, useSlashCommands } from '../components/SlashCommands'
import Spinner from '../components/Spinner'
import FeedRow from '../components/feed/FeedRow'
import {
  buildFeed,
  lastEnds,
  RESTING,
  runStarts,
  type FeedEntry,
  type ThreadStatus
} from '../components/feed/feedItems'
import { describeStep, endPreview, lastEnd, sameRun, threadState, type ThreadItem } from '../components/thread'
import { formatCost, formatElapsed, formatTokens, isNewDay } from '../components/time'
import { useAutoResize } from '../components/useAutoResize'
import { useLoadOlder } from '../components/useLoadOlder'
import { useNow } from '../components/useNow'
import { useStickToBottom } from '../components/useStickToBottom'
import { usePrefs } from '../state/prefs'
import { CHAT_KEY, pendingCount, useCrew, type ThreadMeta } from '../state/store'
import { useVoice } from '../state/voice'
import { cleanCommands, commandsIn, commandTyped, type CommandName } from '../../../shared/commands'

export default function Chat() {
  const events = useCrew(s => s.events)
  const selfId = useCrew(s => s.selfId)
  const threads = useCrew(s => s.threads)
  const threadPrompts = useCrew(s => s.threadPrompts)
  const steps = useCrew(s => s.steps)
  const tokens = useCrew(s => s.tokens)
  const costs = useCrew(s => s.costs)
  const prefs = usePrefs()
  const sendChat = useCrew(s => s.sendChat)
  const openThread = useCrew(s => s.openThread)
  const text = useCrew(s => s.chatDraft)
  const setChatDraft = useCrew(s => s.setChatDraft)
  const commands = useCrew(s => s.chatCommands)
  const setChatCommands = useCrew(s => s.setChatCommands)
  const agents = useCrew(s => s.agents)
  const connection = useCrew(s => s.connection)
  const [replyTo, setReplyTo] = useState<ThreadItem | null>(null)

  // Voice is a mode rather than a mark on a message: a chip that made the agent
  // answer as though it were being spoken to, with nothing speaking and nothing
  // listening, is half of a thing. It opens the conversation instead.
  const takeCommand = (name: CommandName) => {
    if (name === 'voice') return void useVoice.getState().start()
    setChatCommands(cleanCommands([...commands, name]))
  }

  const offered = useMemo(() => commandsIn('chat'), [])

  // A command typed out and one picked from the menu land on the same chip,
  // because both paths into the draft come through here.
  const write = (value: string) => {
    const typed = commandTyped(value, offered)
    if (!typed) {
      setChatDraft(value)
      return
    }
    takeCommand(typed)
    setChatDraft('')
  }

  const ghost = commands.includes('ghost')
  const inputRef = useAutoResize(text)
  const mention = useMentionAutocomplete(text, write, inputRef)
  const slash = useSlashCommands(text, write, takeCommand, inputRef, offered)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { scrolledUp, atBottom, onScroll, jumpToBottom, follow } = useStickToBottom(scrollRef, CHAT_KEY)
  const moreHistory = useCrew(s => s.moreHistory)
  const loadingHistory = useCrew(s => s.loadingHistory)
  const loadHistory = useCrew(s => s.loadHistory)
  const reachBack = useLoadOlder(scrollRef, { more: moreHistory, loading: loadingHistory, load: loadHistory })
  const working = Object.keys(threadPrompts).length > 0
  const now = useNow(working)

  const feed = useMemo<FeedEntry[]>(
    () => buildFeed(events, threads, agents, selfId),
    [agents, events, threads, selfId]
  )

  useLayoutEffect(() => {
    follow(feed.length > 0)
  }, [feed, steps, threadPrompts, follow])

  const resting = useMemo(() => {
    const ends = lastEnds(events)
    const held = new Map<string, ThreadStatus>()
    for (const entry of feed) {
      if (entry.kind !== 'card') continue
      held.set(entry.thread.id, {
        state: threadState(entry.thread, ends, false),
        detail: endPreview(lastEnd(entry.thread.id, ends))
      })
    }
    return held
  }, [events, feed])

  const startedAt = useMemo(() => runStarts(events), [events])

  const threadStatus = (thread: ThreadMeta): ThreadStatus => {
    const promptId = threadPrompts[thread.id]
    if (!promptId) return resting.get(thread.id) ?? RESTING
    const started = startedAt.get(promptId)
    const parts = [describeStep((steps[promptId] ?? []).at(-1))]
    if (started !== undefined) parts.push(formatElapsed(now - started))
    const count = tokens[promptId] ?? 0
    if (prefs.tokens && count > 0) parts.push(`${formatTokens(count)} tokens`)
    const cost = costs[promptId]
    if (prefs.cost && cost !== undefined && cost > 0) parts.push(formatCost(cost))
    return { state: 'working', detail: parts.join(' · ') }
  }

  const reply = useCallback(
    (item: ThreadItem) => {
      setReplyTo(item)
      inputRef.current?.focus()
    },
    [inputRef]
  )

  const send = () => {
    if (!text.trim() && pendingCount(CHAT_KEY) === 0) return
    sendChat(text, undefined, undefined, replyTo?.reactionTargetId, undefined, commands)
    setReplyTo(null)
    mention.close()
    slash.close()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && replyTo) {
      e.preventDefault()
      setReplyTo(null)
      return
    }
    if (e.key === 'Backspace' && !text && commands.length > 0) {
      e.preventDefault()
      setChatCommands(commands.slice(0, -1))
      return
    }
    if (slash.onKeyDown(e)) return
    if (mention.onKeyDown(e)) return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="h-full relative">
      <div
        ref={scrollRef}
        onScroll={() => {
          onScroll()
          reachBack()
        }}
        className="h-full overflow-y-auto overflow-x-hidden px-6"
      >
        <div className="max-w-[660px] mx-auto pt-28 pb-48 space-y-8">
          {moreHistory && (
            <div className="h-6 flex items-center justify-center">
              {loadingHistory && <Spinner size={16} className="text-fg-faint" />}
            </div>
          )}
          {feed.length === 0 &&
            (connection !== 'online' ? (
              <ChatListSkeleton />
            ) : (
              <div className="mt-16 flex flex-col items-center gap-4">
                {agents.length === 0 ? (
                <CreateAgent compact />
                ) : (
                  <p className="text-base text-fg-muted text-center">Say hi, or mention someone with @.</p>
                )}
              </div>
            ))}
          {feed.map((entry, index) => {
            const tsOf = (e: Feed) => (e.kind === 'msg' ? e.item.ts : e.ts)
            const ts = tsOf(entry)
            const before = index > 0 ? feed[index - 1] : undefined
            const prev = before && tsOf(before)
            const linked = entry.kind === 'msg' && before?.kind === 'msg' && sameRun(before.item, entry.item)
            return (
              <Fragment key={entry.key}>
                {isNewDay(prev, ts) && <DayDivider ts={ts} />}
                {entry.kind === 'huddle' ? (
                  <HuddleCard record={entry.record} />
                ) : entry.kind === 'card' ? (
                  entry.thread.mode === 'plan' && entry.thread.plan && !threadPrompts[entry.thread.id] ? (
                    <PlanCard thread={entry.thread} ts={entry.ts} onOpen={() => openThread(entry.thread.id)} />
                  ) : (
                    <ThreadCard
                      thread={entry.thread}
                      ts={entry.ts}
                      onOpen={() => openThread(entry.thread.id)}
                      {...threadStatus(entry.thread)}
                    />
                  )
                ) : (
                  <ChatMessage
                    item={entry.item}
                    editable
                    linked={linked}
                    onReply={item => {
                      setReplyTo(item)
                      inputRef.current?.focus()
                    }}
                  />
                )}
              </Fragment>
            )
          })}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 pointer-events-none">
        <div
          className={`h-14 bg-gradient-to-t from-ink-900 to-transparent transition-opacity duration-200 ${atBottom ? 'opacity-0' : 'opacity-100'}`}
        />
        <div className="bg-ink-900 px-6 pb-6">
          <div className="relative max-w-[660px] mx-auto pointer-events-auto">
            {scrolledUp && <JumpToBottom onClick={jumpToBottom} />}
            <Composer
              attachmentKey={CHAT_KEY}
              value={text}
              placeholder={
                ghost ? 'Send a message nobody else will see' : 'Send a message, @ someone, or / for a command'
              }
              inputRef={inputRef}
              onChange={mention.onChange}
              onKeyDown={onKeyDown}
              onSend={send}
              huddle
              ghost={ghost}
              replyTo={replyTo ?? undefined}
              onCancelReply={() => setReplyTo(null)}
              chips={commands.map(name => (
                <CommandChip
                  key={name}
                  name={name}
                  onRemove={() => setChatCommands(commands.filter(held => held !== name))}
                />
              ))}
            >
              <MentionMenu
                matches={mention.matches}
                activeIndex={mention.activeIndex}
                onPick={mention.pick}
                onHover={mention.setActive}
              />
              <SlashMenu
                matches={slash.matches}
                activeIndex={slash.activeIndex}
                onPick={slash.pick}
                onHover={slash.setActive}
              />
            </Composer>
            <TypingLine />
          </div>
        </div>
      </div>
    </div>
  )
}
