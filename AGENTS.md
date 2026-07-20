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

- Dark mode. Background zinc-950, panels zinc-900, borders zinc-800.
- White is the single action color. Everything else is zinc grays.
- Mobbin-style: simple, generous spacing, minimal borders, system sans.
- No logo or branding beyond the word "crew". No gradients. No emoji in the UI.

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
