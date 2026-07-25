# crew

Pool LLMs with friends. One person hosts a session, others join from a link, and everyone's local LLM CLIs become shared agents. Chat, docs, and a dashboard, synced through git.

## Commands

- `yarn dev` — run the app
- `yarn build` — build main, preload, and renderer
- `yarn test` — integration tests (vitest)
- `yarn tsc --noEmit` — typecheck
- `yarn dist` — build a mac dmg

## Writing

- No em dashes, and no semicolons used in their place. Write plain sentences.
- Plain words. No over-selling, no narration. State things simply.
- UI copy is for everyone, not just engineers. Avoid engineering jargon.
- Copy never echoes the request that produced it. Placeholders and empty states describe what the user can do in general terms, never the specifics of what was asked for or how it was built.

## Code

- No code comments. Humans add comments when they want them.
- Small files. SOLID. DRY. Readable over clever.
- TypeScript everywhere. React and Tailwind in the renderer.
- Integration tests over unit tests. Every feature ships with coverage of its behavior. Tests live in `tests/` and boot real servers and runners on loopback.

## Design

- Dark mode. Tokens live in `src/renderer/src/styles.css` (Tailwind `@theme`): ink scale for surfaces (`ink-900` background, `ink-800` raised, `ink-700` borders and sunken bars), fg scale for text (`fg`, `fg-secondary`, `fg-muted`, `fg-faint`).
- White is the single action color. `positive` and `danger` appear only for status.
- Type ramp: xs 11, sm 13, base 14, lg 16. System sans. The word "crew" is set in mono.
- Radii: `rounded-card` (20px) for cards, `rounded-shell` (30px) for the composer. Buttons, tabs, and inputs are pills.
- Icons come from `@heroicons/react`. Never hand-roll SVG icons.
- Popovers and menus use the `.glass` class: semi-transparent dark, backdrop blur and saturation, like Mobbin.
- Reusable primitives in `src/renderer/src/components`: `Avatar`, `AgentIcon`, `Pill`, `Spinner`, `Popover`/`MenuItem`, `Select`, `Tooltip`, `HoverCard`, `Composer`, `TopBar`, `DayDivider`. Use them before writing new ones. Never use the native `title` attribute, use `Tooltip`.
- Agents always render `AgentIcon` (a deterministic generated pet seeded by the agent id), never an initial `Avatar`. Humans keep `Avatar`.
- Small interactions matter: hover states on everything interactive, `animate-pop` for popovers, `animate-rise` for feed items, scale on press.
- Labels like "You" go in a `Pill`, never in parentheses.
- No logo or branding beyond the word "crew". No emoji in the UI. Gradients only as scrims where content scrolls under chrome.
- The app icon is three overlapping discs, the same stack of members the app draws everywhere else. Black and white, and it flips with the theme picked in the app. `yarn icon` redraws it from `scripts/make-icon.mjs` into `resources/` and `src/main/icon-png.ts`. Nothing there is edited by hand.

## Layout

- `src/shared` — protocol and event types, git exec helper, no dependencies
- `src/server` — host: ws server, session state, `.crew/` persistence, git sync
- `src/runner` — agent runner: CLI provider adapters, executes prompts, streams back, auto-pulls the repo while joined
- `src/main` — Electron main and preload, wires server and runner to the app
- `src/renderer` — React app
- `tests` — integration suites

## Huddles

Voice, video and screen share, started from the user popover menu. The host relays the handshake and nothing else. The media itself goes machine to machine, everyone to everyone, so there is no server to run and no stream passing through the host.

- A call is never written down. It rides in the session snapshot and in `huddle.*` messages, never in the event log, so nothing about it is committed or replayed. `src/server/session.ts` holds it in memory, keyed by connection, because two windows on one folder are one member but two people in the call.
- Every connection has the same three slots, negotiated once at the start and in the same order: microphone, camera, screen. Turning a camera on swaps a track into a slot that already exists. Renegotiating mid-call is what makes calls drop, so nothing after the first offer does it.
- Glare is settled by comparing peer ids, the standard polite and impolite pair. Exactly one side of every pair gives way, and only the impolite side restarts a connection that failed.
- Signals are handled one at a time, in order, and an address that turns up before the description it belongs to is held rather than handed over. Two of them in flight together, or one offered early, is how a connection ends up with nowhere to send anything and sits there ringing forever. `tests/helpers/fake-rtc.ts` is strict about this so the mistake cannot come back.
- A handshake that goes quiet is said again, a few times, until it lands. Only that first exchange ever repeats. Once the two ends agree, nothing renegotiates.
- Joining never waits on a device. Someone with no microphone still gets into the call, muted, and is told what to fix.
- Tiles are widescreen everywhere, and a tile owns its own shape. Wrapping one in something that sets the shape from outside is how they ended up as slivers.

## Syncing

Every machine commits its whole working tree, integrates, and pushes on a loop, host and joiner alike. Agents on different machines write to the same branch at the same time, so `GitSync` in `src/server/git.ts` has three hard rules. Each one is here because work was destroyed without it.

- Never stash. Commit everything first, so nothing is sitting uncommitted when the sync integrates. Autostash stranded people's work in stashes nobody ever went back for.
- Never rebase on the automatic path. A rebase replays every local commit and rewrites the working tree once per commit, landing on top of files an agent is writing right now. Pull with `--no-rebase`. A merge leaves local commits alone and touches only what came in.
- Never revert. Taking back someone's edits defeats the point of pooling agents. When a conflict cannot resolve itself, back out of it, put the pending files back, and try again on the next pass.

Only `.crew/session.json` resolves itself, by keeping the local copy. Logs ending in `.jsonl` union merge through `.gitattributes`. Several windows can share one folder, so a lock file in `.git` keeps them off each other, and an interrupted merge or rebase is finished or backed out at the start of every pass.

## Rules for agents working here

- `src/server`, `src/runner`, and `src/shared` must never import electron. Tests import them directly.
- Run `yarn test` and `yarn tsc --noEmit` before considering a change done.
- People keep more than one crew window open on the same folder, and that is supported. Never kill or quit a running instance to get a quiet repo. Work with it running, and expect your edits to be committed under you while you work.
