import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import ChatListSkeleton from '../components/ChatListSkeleton'
import CommandChip from '../components/CommandChip'
import Composer, { COMPOSER_MAX } from '../components/Composer'
import CreateAgent from '../components/CreateAgent'
import DefaultAgentChip from '../components/DefaultAgentChip'
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
import { changedIn, NOTHING } from '../components/threadChanged'
import { sameRun, threadState, type ThreadItem } from '../components/thread'
import { isNewDay } from '../components/time'
import { useAutoResize } from '../components/useAutoResize'
import { useComposerRoom } from '../components/useComposerRoom'
import { useLoadOlder } from '../components/useLoadOlder'
import { useStickToBottom } from '../components/useStickToBottom'
import { useDefaultAgent } from '../state/defaultAgent'
import { CHAT_KEY, pendingCount, useCrew, type ThreadMeta } from '../state/store'
import { useVoice } from '../state/voice'
import { cleanCommands, commandsIn, commandTyped, type CommandName } from '../../../shared/commands'
import { aimOf } from '../../../shared/llm'
import { useMessagePlugin } from '../state/messagePlugin'

export default function Chat({
  personal = false,
  onStart,
  focusRequest = 0
}: {
  personal?: boolean
  onStart?: (threadId: string) => void
  focusRequest?: number
}) {
  const events = useCrew(s => s.events)
  const selfId = useCrew(s => s.selfId)
  const threads = useCrew(s => s.threads)
  const threadPrompts = useCrew(s => s.threadPrompts)
  const steps = useCrew(s => s.steps)
  const tokens = useCrew(s => s.tokens)
  const costs = useCrew(s => s.costs)
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
  const inputRef = useAutoResize(text, COMPOSER_MAX)
  useEffect(() => {
    if (personal && connection === 'online') inputRef.current?.focus({ preventScroll: true })
  }, [connection, inputRef, personal])
  useEffect(() => {
    if (focusRequest > 0) inputRef.current?.focus({ preventScroll: true })
  }, [focusRequest, inputRef])
  const mention = useMentionAutocomplete(text, write, inputRef, { commands: offered })
  const slash = useSlashCommands(text, write, takeCommand, inputRef, offered)
  const scrollRef = useRef<HTMLDivElement>(null)
  const place = useCrew(s => s.place)
  const aimed = useDefaultAgent(s => s.agentId)
  const { scrolledUp, atBottom, onScroll, jumpToBottom, follow } = useStickToBottom(scrollRef, `${place}/${CHAT_KEY}`)
  const moreHistory = useCrew(s => s.moreHistory)
  const loadingHistory = useCrew(s => s.loadingHistory)
  const loadHistory = useCrew(s => s.loadHistory)
  const reachBack = useLoadOlder(scrollRef, { more: moreHistory, loading: loadingHistory, load: loadHistory })
  const { ref: overlayRef, room } = useComposerRoom()

  const feed = useMemo<FeedEntry[]>(
    () => (personal ? [] : buildFeed(events, threads, agents, selfId)),
    [agents, events, personal, threads, selfId]
  )

  useLayoutEffect(() => {
    follow(feed.length > 0)
  }, [feed, steps, threadPrompts, room, follow])

  const cardIds = useMemo(() => feed.flatMap(entry => (entry.kind === 'card' ? [entry.thread.id] : [])), [feed])

  const resting = useMemo(() => {
    const ends = lastEnds(events)
    const held = new Map<string, ThreadStatus>()
    for (const entry of feed) {
      if (entry.kind !== 'card') continue
      held.set(entry.thread.id, { state: threadState(entry.thread, ends, false), added: 0, removed: 0 })
    }
    return held
  }, [events, feed])

  const startedAt = useMemo(() => runStarts(events), [events])

  // What every card in the feed has changed, counted in one pass. A step
  // landing replaces one run's own steps, so all but that run answer off the
  // cache rather than being counted again on every frame.
  const changed = useMemo(() => changedIn(cardIds, events, steps, threads), [cardIds, events, steps, threads])

  const threadStatus = (thread: ThreadMeta): ThreadStatus => {
    const counted = changed.get(thread.id) ?? NOTHING
    const promptId = threadPrompts[thread.id]
    if (!promptId) {
      const rest = resting.get(thread.id) ?? RESTING
      return { ...rest, ...counted }
    }
    return {
      state: 'working',
      step: (steps[promptId] ?? []).at(-1),
      startedAt: startedAt.get(promptId),
      tokens: tokens[promptId] ?? 0,
      cost: costs[promptId],
      ...counted
    }
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
    const startId = personal ? globalThis.crypto.randomUUID() : undefined
    const targets =
      aimOf(text, agents, aimed) ??
      (personal
        ? agents
            .filter(agent => agent.status !== 'offline')
            .slice(0, 1)
            .map(agent => agent.id)
        : undefined)
    sendChat(
      text,
      undefined,
      undefined,
      replyTo?.reactionTargetId,
      targets,
      commands,
      useMessagePlugin.getState().picked[CHAT_KEY],
      startId
    )
    if (startId && targets?.length) onStart?.(startId)
    useMessagePlugin.getState().taken(CHAT_KEY)
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
        <div
          className="max-w-[660px] mx-auto space-y-8"
          style={{ paddingTop: 'var(--page-rest)', paddingBottom: room }}
        >
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
                  <p className="text-base text-fg-muted text-center">
                    {personal ? 'What would you like to talk about?' : 'Say hi, or mention someone with @.'}
                  </p>
                )}
              </div>
            ))}
          {feed.map((entry, index) => {
            const before = index > 0 ? feed[index - 1] : undefined
            const linked = entry.kind === 'msg' && before?.kind === 'msg' && sameRun(before.item, entry.item)
            const card = entry.kind === 'card'
            return (
              <FeedRow
                key={entry.key}
                entry={entry}
                dayTs={isNewDay(before?.ts, entry.ts) ? entry.ts : undefined}
                linked={linked}
                planned={
                  card && entry.thread.mode === 'plan' && Boolean(entry.thread.plan) && !threadPrompts[entry.thread.id]
                }
                status={card ? threadStatus(entry.thread) : RESTING}
                onOpenThread={openThread}
                onReply={reply}
              />
            )
          })}
        </div>
      </div>

      <div ref={overlayRef} className="absolute inset-x-0 bottom-0 pointer-events-none">
        <div
          className={`h-14 bg-gradient-to-t from-ink-900 to-transparent transition-opacity duration-200 ${atBottom ? 'opacity-0' : 'opacity-100'}`}
        />
        <div className="bg-ink-900 px-6 pb-6">
          <div className="relative max-w-[660px] mx-auto pointer-events-auto">
            {scrolledUp && <JumpToBottom onClick={jumpToBottom} />}
            <Composer
              attachmentKey={CHAT_KEY}
              value={text}
              placeholder={personal ? 'Message' : ghost ? 'Send a message nobody else will see' : 'Ask Crew'}
              inputRef={inputRef}
              onChange={mention.onChange}
              onKeyDown={onKeyDown}
              onSend={send}
              huddle={!personal}
              defaultAgent
              commands={offered}
              onCommand={takeCommand}
              ghost={ghost}
              replyTo={replyTo ?? undefined}
              onCancelReply={() => setReplyTo(null)}
              chips={[
                // The standing one comes first, so a command arriving beside it
                // never moves it out from under the pointer.
                <DefaultAgentChip key="agent" inputRef={inputRef} />,
                ...commands.map(name => (
                  <CommandChip
                    key={name}
                    name={name}
                    onRemove={() => setChatCommands(commands.filter(held => held !== name))}
                  />
                ))
              ]}
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
