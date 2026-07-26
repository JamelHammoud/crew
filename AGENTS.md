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
- Icons come from `@heroicons/react`. Never hand-roll SVG icons. The one exception is the design canvas, where Heroicons has no vocabulary for shapes: `src/renderer/src/design/glyphs.tsx` is the only place those are drawn, on the same 24 grid with the same 1.5 round stroke, so they sit beside Heroicons without looking foreign. It reaches for a Heroicon wherever one already fits, and nothing outside that file draws an icon by hand.
- Popovers and menus use the `.glass` class: semi-transparent dark, backdrop blur and saturation, like Mobbin. Chrome that floats over the design canvas adds `.glass-strong`, because the artwork behind it can be any color and a white frame turns plain glass into pale grey.
- Reusable primitives in `src/renderer/src/components`: `Avatar`, `AvatarStack`, `AgentIcon`, `Pill`, `Spinner`, `InsetRing`, `Popover`/`MenuItem`, `Select`, `Tooltip`, `HoverCard`, `Composer`, `TopBar`, `DayDivider`. Use them before writing new ones. Never use the native `title` attribute, use `Tooltip`.
- A tooltip never shows while the popover it opens is open. Pass `disabled` to the `Tooltip` around any button that opens a `Popover`.
- Agents always render `AgentIcon` (a deterministic generated pet seeded by the agent id), never an initial `Avatar`. Humans keep `Avatar`.
- Small interactions matter: hover states on everything interactive, `animate-pop` for popovers, `animate-rise` for feed items, scale on press.
- Labels like "You" go in a `Pill`, never in parentheses.
- No logo or branding beyond the word "crew". No emoji in the UI. Gradients only as scrims where content scrolls under chrome.
- The app icon is three overlapping discs, the same stack of members the app draws everywhere else. All three are the same size, each cut out of the one behind it by a mask, so nothing shrinks a disc. The tile is glass like the system icons: a top-to-bottom gradient, a sheen over the top half, and a rim that catches light at the top and bottom. Black and white, and it flips with the theme picked in the app.
- The same three discs are the mark in the top left of the app, in place of the word "crew". `CrewMark` draws them at whatever `currentColor` is.
- A build run from source wears a blueprint: vivid blue paper, ruled and lightly grained, with the same three discs on it lit like glass. It is the one place in the project that is blue, so a dev window is never mistaken for the installed app sitting beside it in the dock. Both dev icons stand on the same paper, so only the mark flips with the theme, black in dark and white in light, the way the shipping pair flips.
- A disc is lit from the upper left and built in layers: a body that falls away to the far side, a shade drawn in all round the edge, a light rim on the top where the light arrives, a softer one on the bottom where the tile throws it back, a specular where the light lands, and a shadow cast into the gap behind. The two rims are the same ring gradient held to opposite halves by a mask, which is what makes a flat circle read as a bead. Every gradient is in bounding box units, so one set of them shades all three discs the same way. Keep it gentle: a black edge and a blown specular turn glass into a toy.
- `src/main/from-source.ts` decides which of the two a window wears, from where the app is loaded. Never `app.isPackaged` for this: that only asks whether the binary is still called Electron, and `yarn dev` renames it to Crew, so a run from source claims to be packaged and wears the shipping icon.
- Each disc is cut only by the discs standing in front of it, one mask each. A single mask for the whole stack reopens the gaps, which is invisible on the filled icon and turns the blueprint outlines into crossing rings.
- `yarn icon` redraws all of it from `scripts/make-icon.mjs` into `resources/` (`icon.svg`, `icon-light.svg`, `icon-dev.svg`, `icon-dev-light.svg`, `crew-logo.svg`, `icon.icns`, `icon.png`), `src/main/icon-png.ts` and `src/renderer/src/components/crew-mark.ts`. That is the only place the geometry lives. Nothing there is edited by hand.

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
- Only one end of a pair ever offers, and peer ids decide which. The other end adds nothing of its own and takes the three slots the offer makes for it. Both ends offering is a collision, and the rollback that settles one does not give the local slots back: the browser makes a second set for the offer it accepted, so each side ends up holding three slots nothing is ever sent on. The call reaches connected, every packet arrives, and the room is silent. A slot added by hand is never used for a line that was offered, so the answering side must not make any.
- `yarn media-check` is the only thing that can see this. It runs the real connection code in two Electron windows and looks at what comes out the other end: three slots each, and sound and pictures arriving on the ones the app is listening to. A fake cannot stand in for it, and the fake passed the whole time this was broken.
- Glare is settled by comparing peer ids, the standard polite and impolite pair, and it is a guard rather than a path anything takes. Only the side that offers restarts a connection that failed.
- Signals are handled one at a time, in order, and an address that turns up before the description it belongs to is held rather than handed over. Two of them in flight together, or one offered early, is how a connection ends up with nowhere to send anything and sits there ringing forever. `tests/helpers/fake-rtc.ts` is strict about this so the mistake cannot come back.
- A handshake that goes quiet is said again, a few times, until it lands. Only that first exchange ever repeats. Once the two ends agree, nothing renegotiates.
- Joining never waits on a device. Someone with no microphone still gets into the call, muted, and is told what to fix.
- Tiles are widescreen everywhere, and a tile owns its own shape. Wrapping one in something that sets the shape from outside is how they ended up as slivers.
- Marks like the ring on whoever is talking are painted inside the box they mark, with `InsetRing`. Anything drawn around the outside is cropped the moment the box lands in a scroller or a card that clips, which is where the dock, the rail beside a shared screen, and the screen picker all put it.

## Design boards

A tldraw canvas per board, with crew's own chrome around it. Every tldraw panel is turned off in `DesignCanvas` and crew draws the header, the layer list, the inspector and the toolbar itself.

- The canvas draws straight. Sans type, solid strokes, straight lines, no hand drawn wobble. The values live once in `DESIGN_STYLE_DEFAULTS` and both sides read them: `applyDesignDefaults` for what people draw, `designops` for what agents create.
- Those defaults are applied again every time a board snapshot lands. tldraw drops the styles for the next shape whenever a document is loaded, so setting them once on mount lasts only until the board arrives, which is why text came out hand drawn.
- Nothing wears a text outline. tldraw halos labels in the canvas color to help them read over shapes, and it looks like a sticker, so `shapeUtils.ts` turns it off for text, geo and arrow shapes.
- A frame is white in both themes, whatever the canvas behind it is doing. `frameFill.ts` owns that, a frame carries its own color in `meta.background`, and the design panel changes it. The outline follows the fill, dark on light backgrounds and light on dark ones.
- The canvas palette never follows the app theme. Someone picked those colors on purpose, so the editor is pinned to one color mode and black stays black in both themes. Only the surfaces crew draws itself, the chrome and the canvas behind the artwork, flip with the theme.
- The left panel is layers when nothing is selected and the design panel when something is. The right panel is board chat. Boards already do what pages would, so there is no page switcher.
- The design panel follows Figma's layout, section by section: Position, Layout, Appearance, Fill, Stroke, Effects. Sections are divided by a hairline and titled in bold, groups of fields carry a small grey label above them, and every field holds its own label inside it. Match Figma when adding to it.
- There is one panel, and everything selected gets it: a shape, a frame, text, a drawing. A field that the selection cannot do is left out, and nothing else moves. `nodeView.ts` is the shape of what the panel can edit, and each kind of shape answers it: `designView` for crew's own nodes, `frameView` for a frame, `paletteView` for tldraw's own shapes, which only carry a named color and a size, so it maps those onto the same color and weight fields and rounds back to the nearest one. Never write a second panel for a kind of shape.
- Everything drawn from the shape tool is a crew node, whatever its outline. `shape` on a node is rect, ellipse, triangle, diamond, pentagon, hexagon or star, the outlines live once in `nodeShape.ts`, and a rect and an ellipse paint in CSS while the rest are clipped with an SVG outline for their stroke. Only a rect takes a corner radius or auto layout.
- A fill, a stroke or an effect can be hidden without being deleted, so `visible` rides on each one and `nodeCss.ts` leaves the hidden ones out. Anything that reads those lists honors it.
- Color is picked in `ColorPicker.tsx`: a saturation square, hue and alpha from `react-colorful`, a hex field, the system eyedropper, and the crew swatches. The library's own sizes are built for a page, so `.design-picker` in `styles.css` resizes it for a popover.
- Shapes land on whole pixels. `wholePixels.ts` rounds x and y on anything a person creates or moves, so nothing ever reads 203.41.
- Corner handles and the size readout are crew's own overlay, drawn over the canvas in `SelectionOverlay.tsx` from page coordinates, not tldraw components.

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
