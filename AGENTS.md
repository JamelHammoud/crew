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

## Layout

- `src/shared` — protocol and event types, git exec helper, no dependencies
- `src/server` — host: ws server, session state, `.crew/` persistence, git sync
- `src/runner` — agent runner: CLI provider adapters, executes prompts, streams back, auto-pulls the repo while joined
- `src/main` — Electron main and preload, wires server and runner to the app
- `src/renderer` — React app
- `tests` — integration suites

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
