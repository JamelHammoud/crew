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
- Reusable primitives in `src/renderer/src/components`: `Avatar`, `Pill`, `Spinner`, `Popover`/`MenuItem`, `Select`, `Composer`, `TopBar`. Use them before writing new ones.
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

## Rules for agents working here

- `src/server`, `src/runner`, and `src/shared` must never import electron. Tests import them directly.
- Run `yarn test` and `yarn tsc --noEmit` before considering a change done.
