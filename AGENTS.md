# crew

Pool LLMs with friends. One person hosts a session, others join from a link, and everyone's local LLM CLIs become shared agents. Chat, docs, and a dashboard, synced through git.

## Commands

- `yarn dev` — run the app
- `yarn build` — build main, preload, and renderer
- `yarn start` — run the built app, wearing the icon it ships with
- `yarn preview` — the same run, wearing the blueprint
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
- Mono set on the same line as the sans comes out sitting high: the two faces carry their text at different heights, and a row centers boxes rather than baselines. `.mono-inline` in `styles.css` is the pixel that puts them back on one line, and it is what any mono beside sans wears.
- Radii: `rounded-card` (20px) for cards, `rounded-shell` (30px) for the composer. Buttons, tabs, and inputs are pills.
- Icons come from `@heroicons/react`. Never hand-roll SVG icons. Two files are the exception, and both draw through `glyph()` in `src/renderer/src/components/glyph.tsx`, on a 24 grid with a 1.5 round stroke, so they sit beside Heroicons without looking foreign: `src/renderer/src/design/glyphs.tsx` for the shapes the canvas needs, which Heroicons has no vocabulary for, and `src/renderer/src/components/toolGlyphs.tsx` for what an agent did. The one mark that moves, `ThinkingMark.tsx`, is drawn to the same grid and stroke from the numbers `toolGlyphs.tsx` holds. Nothing else draws an icon by hand.
- A divider inside a popover, a menu or a hover card runs edge to edge. It bleeds back through the padding the card holds its content in, rather than stopping short of both sides. `MenuDivider` does that for a menu, `CardRule` for a hover card.
- Popovers and menus use the `.glass` class: semi-transparent dark, backdrop blur and saturation, like Mobbin. Chrome that floats over the design canvas adds `.glass-strong`, because the artwork behind it can be any color and a white frame turns plain glass into pale grey.
- Reusable primitives in `src/renderer/src/components`: `Avatar`, `AvatarStack`, `AgentIcon`, `Pill`, `Spinner`, `Skeleton`, `InsetRing`, `Popover`/`MenuItem`, `Select`, `Tooltip`, `HoverCard`, `Composer`, `TopBar`, `DayDivider`. Use them before writing new ones. Never use the native `title` attribute, use `Tooltip`. When something should be a primitive and there is no primitive for it yet, write one rather than a one-off.
- `Skeleton` is what stands in for content that has not arrived. One shimmer, and every instance is pinned to the same start time the way `Spinner` is, so a stack of them breathes together instead of rippling. Its own class carries `position`, and a plain CSS rule beats a Tailwind utility whichever order they are written in, so a skeleton that has to float over something goes inside a positioned wrapper rather than being handed `absolute`. Handed it directly, it keeps `relative`, collapses to nothing, and reads as an empty box.
- A tooltip never shows while the popover it opens is open. Pass `disabled` to the `Tooltip` around any button that opens a `Popover`.
- Agents always render `AgentIcon` (a deterministic generated pet seeded by the agent id), never an initial `Avatar`. Humans keep `Avatar`.
- Small interactions matter: hover states on everything interactive, `animate-pop` for popovers, `animate-rise` for feed items, scale on press.
- Labels like "You" go in a `Pill`, never in parentheses.
- No logo or branding beyond the word "crew". No emoji in the UI. Gradients only as scrims where content scrolls under chrome.
- The app icon is three overlapping discs, the same stack of members the app draws everywhere else. All three are the same size, each cut out of the one behind it by a mask, so nothing shrinks a disc. The tile is glass like the system icons: a top-to-bottom gradient, a sheen over the top half, and a rim that catches light at the top and bottom. Black and white, and it flips with the theme picked in the app.
- The same three discs are the mark in the top left of the app, in place of the word "crew". `CrewMark` draws them at whatever `currentColor` is.
- A build run from source wears a blueprint: vivid blue paper, ruled and lightly grained, with the same three discs on it lit like glass. It is the one place in the project that is blue, so a dev window is never mistaken for the installed app sitting beside it in the dock. Both dev icons stand on the same paper, so only the mark flips with the theme, black in dark and white in light, the way the shipping pair flips.
- A disc is lit from the upper left and built in layers: a body that falls away to the far side, a shade drawn in all round the edge, a light rim on the top where the light arrives, a softer one on the bottom where the tile throws it back, a specular where the light lands, and a shadow cast into the gap behind. The two rims are the same ring gradient held to opposite halves by a mask, which is what makes a flat circle read as a bead. Every gradient is in bounding box units, so one set of them shades all three discs the same way. Keep it gentle: a black edge and a blown specular turn glass into a toy.
- `src/main/from-source.ts` decides which of the two a window wears, from where the app is loaded. Never `app.isPackaged` for this: that only asks whether the binary is still called Electron, and `yarn dev` renames it to Crew, so a run from source claims to be packaged and wears the shipping icon. The one way past it is `CREW_SHIPPING_ICON`, which `yarn start` sets, so the shipping icon can be seen without installing. Nothing else loosens the path check.
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
- A board named with `#` in a message wears `FrameGlyph`, the same mark the frame tool wears, and a doc keeps the page icon. One mark for a board wherever it appears, so the pill and the picker say the same thing the toolbar does.
- Hovering that pill shows the board itself, under its name, drawn once through `TldrawImage` in `BoardImage`. That path imports `tldraw/tldraw.css` of its own. The export builds a real editor, and the editor leaves its text measuring div behind in the box it was handed and never takes it back, so without the stylesheet nothing hides it and the last thing measured, the name of a frame, is painted over the artwork at full size. `styles.css` pins `.tl-text-measure` out of sight as well, so a missing import can never put it back on screen.
- That export is a blob the browser has to finish before there is anything to see, and `TldrawImage` draws nothing at all in the meantime, so `BoardImage` holds a `Skeleton` over the box until the picture has really loaded rather than until the module has.
- The left panel is layers when nothing is selected and the design panel when something is. The right panel is board chat. Boards already do what pages would, so there is no page switcher.
- The design panel follows Figma's layout, section by section: Position, Layout, Appearance, Typography, Fill, Stroke, Effects. Sections are divided by a hairline and titled in bold, groups of fields carry a small grey label above them, and every field holds its own label inside it. Match Figma when adding to it.
- Every number in the panel takes arrow keys and a drag, the way Figma does: up and down step by one, held shift steps by ten, and dragging sideways on the field's own icon or label scrubs it. The whole drag is one undo, because the gesture takes a mark on the way in and squashes to it on the way out. It all lives in `useNumberField` in `InspectorFields.tsx`, so a field gets it by being a `NumberInput` and nothing else has to know.
- An icon button at the right edge of a field row is pulled out past the padding, because its background is transparent and lining the box up leaves the icon sitting short of everything above it. `Trailing` does that, and it is what buys the fields the width they need to hold three digits.
- Typography is Figma's section: the family, then the style and size, then line height and letter spacing, then alignment across and down, with case and decoration behind the type settings button. `Typography.tsx` draws it and leaves out whatever the selection cannot do. Text placed on a board gets all of it, a label on one of tldraw's older shapes gets the three system faces.
- Text on a board is tldraw's own text shape, and it carries crew's whole type style in `meta`. Only the alignment stays in props, because tldraw shifts the shape itself when a centered line changes width and it reads the alignment from there. `TextUtil.tsx` hands that style to tldraw through `getCustomDisplayValues`, which both the painting and the measuring go through, so the box fits the family, size and weight that were picked rather than the four sizes tldraw ships. Letter spacing and case are not display values, so they go to the measurement as `otherStyles` and are painted from `textInkStyle`. Both sides read that one function, or the text is measured at one size and drawn at another.
- The size tldraw caches for a text shape is keyed on props alone, so a change that only touched `meta` would keep the old box. `DesignTextUtil` measures on its own instead, against the shape record, and measures again when a web font finishes loading. Never put a type field in `meta` and expect tldraw to notice.
- Fonts come from Google. `fonts.ts` holds the list, grouped by the kind of face, and asks for a family only when something is about to draw in it. It uses the older `css` endpoint rather than `css2`, because that one quietly returns the weights a family actually has instead of failing the whole request over one it does not, and a curated list cannot know that per family. The renderer's CSP has to name `fonts.googleapis.com` under `style-src` or none of it loads.
- A family arrives after the text is already on screen, so `fonts.ts` says so when one lands and `TextUtil.tsx` turns that into a signal the canvas is watching. Without it the first paint is measured in the fallback face and never corrected.
- There is one panel, and everything selected gets it: a shape, a frame, text, a drawing. A field that the selection cannot do is left out, and nothing else moves. `nodeView.ts` is the shape of what the panel can edit, and each kind of shape answers it: `designView` for crew's own nodes, `frameView` for a frame, `textType.ts` for text, `paletteView` for the rest of tldraw's shapes, which only carry a named color and a size, so it maps those onto the same color and weight fields and rounds back to the nearest one. Never write a second panel for a kind of shape.
- Everything drawn from the shape tool is a crew node, whatever its outline. `shape` on a node is rect, ellipse, triangle, diamond, pentagon, hexagon or star, the outlines live once in `nodeShape.ts`, and a rect and an ellipse paint in CSS while the rest are clipped with an SVG outline for their stroke. Only a rect takes a corner radius or auto layout.
- A fill, a stroke or an effect can be hidden without being deleted, so `visible` rides on each one and `nodeCss.ts` leaves the hidden ones out. Anything that reads those lists honors it.
- Color is picked in `ColorPicker.tsx`: a saturation square, hue and alpha from `react-colorful`, a hex field, the system eyedropper, and the crew swatches. The library's own sizes are built for a page, so `.design-picker` in `styles.css` resizes it for a popover.
- Shapes land on whole pixels. `wholePixels.ts` rounds x, y, width and height on anything a person draws, moves or resizes, so nothing ever reads 203.41. A resize rounds the far edge rather than the width, so the edge that is standing still keeps the number it already had instead of drifting a pixel when both halves round the same way. Shapes with no width and height of their own, a pencil stroke or a line, are only moved: rounding every point would flatten the curve.
- Corner handles and the size readout are crew's own overlay, drawn over the canvas in `SelectionOverlay.tsx` from page coordinates, not tldraw components.
- The board has its own cursors, drawn once in `cursors.tsx`: an arrow, a beam for text, an open hand and a fist for panning, a target for placing something, and a pencil for drawing. Both hands hold their thumb on the left, which the Heroicon does not, so the open one is turned over by its own placement while the fist is drawn that way already. Black art, a white keyline and a soft shadow, so they read on any artwork. Every one keeps a native cursor after it as a fallback. The arrow is the only shape drawn from a design file. The rest are built from a Heroicon or from plain boxes in the same language, and the white keyline is painted under the fill in one pass so a shape made of several boxes has no seams.
- tldraw picks a cursor by writing `--tl-cursor-<type>`, and it declares those variables on its own container, so setting them on anything further out is quietly ignored. `applyDesignCursors` puts them on the container itself when the editor mounts. The wrapper carries them too, for the chrome crew draws over the canvas.
- Every tool that places something asks for the same `cross` cursor, the pencil included, so a tool that wants its own art gets it by name: `applyToolCursor` writes that one variable again whenever the tool changes, and puts the target back for everything else.
- The art is drawn on the grid the arrow came in on and scaled down from there, and `aimed` works out the shift that lands the point it aims from, the tip of the arrow or the middle of everything else, on a whole pixel. That pixel is the hotspot, and `ARROW_TIP` is the same number the remote arrow is offset by, so a cursor is where it says it is on either machine. Never move the art without moving both.
- Everyone else's cursor is the same arrow in their own color, drawn by crew in `RemoteCursors` with a glass name tag, a pet for an agent and an avatar for a person. tldraw draws its own on the canvas, where a generated pet cannot go, so `CursorsDrawnByCrew` stands that overlay down. The presence record still goes into the store, because that is what marks what someone has selected.

## What an agent did

A step in a thread says what happened in plain words, wearing a mark of its own.

- Thinking has to be asked for. From Opus 4.7 on, a model keeps its reasoning to itself unless the request says otherwise: the blocks still arrive, signed, with an empty string where the words would be, so a run appears to think at length and say nothing. The interactive CLI asks for the summary and a headless one does not, and crew is headless, which is why the thread was silent for so long. `--thinking-display summarized` in `claude.ts` is the whole of the fix. Never drop it.
- A thinking block with nothing in it is not a step. `cli.ts` waits for the first word before it opens one, and closes only what it opened, so a model that is not showing its reasoning reads as working rather than as an empty card. That guard is also what leaves the complete block at the end of a message free to stand in, on a CLI that only sends it that way.
- Only Claude streams its reasoning as it is written. Codex is the other end: OpenAI encrypts the raw chain of thought and returns a short summary heading per stretch of work, which is the same thing its own app shows, so crew posts each one as it lands and that is the ceiling. Kimi and Grok hand back whole blocks at the end of a turn.
- `toolActions.ts` is the one table that turns a tool name into a mark and a phrase: "Reading" while it runs, "Read" once it is done, "Read files" when a run of them is folded up. Every CLI is read through it, so `Read`, `read_file`, `ReadFile` and `view_file` all land on the same line, and an mcp tool is named after the tool rather than the plumbing around it. A name nobody has heard of is set in words rather than shown raw.
- The marks are drawn in `toolGlyphs.tsx`, outlined on the same 24 grid as the design glyphs. They are sized by eye rather than by their box, so a page, a magnifier and a sparkle carry the same weight in a row. Nothing wears a container or a badge.
- A live step lights its mark white and pulses it. Only `RunStatus` spins, at the foot of the run, so a long thread is not a field of spinners.
- A thought is the one mark that moves on its own. `ThinkingMark.tsx` draws it on the same 24 grid as the rest: three filled dots with a wave travelling through them while the model is thinking, and when the thought lands they gather into the middle as a ring blooms out of them and the check strokes itself in, which leaves the mark standing as `DoneGlyph`, the same check in a circle used everywhere else. The word turns over with it, "Thinking" to "Thought". The dots, the radii and the check path live in `toolGlyphs.tsx`, so the still glyph and the moving one are the same drawing.
- The ring's growth is a CSS transition and the dots' exit is an animation, and it has to be that way round. A transition does not fire on the first render, so a thought that was finished before it was ever on screen is simply drawn done rather than landing again as the thread is scrolled. Taking an animation off an element drops its values where they stand instead of easing them, which is why what the wave holds cannot be handed to a transition: the landing is keyframed, and it starts on the value the wave rests at so there is no jump. Only a mark that was watched thinking wears `data-landing`, or every old row would land again on the way past.
- A thought is set in italic, and a blank line between two of them is a paragraph rather than an empty row: `StepRow` splits on it and spaces the paragraphs instead, so a long thought reads as prose rather than as blocks pushed apart.
- Three or more of the same tool in a row fold into one line that opens: a pair is not clutter and stays where it can be read. Every step in the group keeps its own row and its own diff.
- An edit opens into the file it touched: the path and the counts on a bar, then the diff, red where lines went and green where they arrived, with the words that actually changed picked out. `diffRows` and `codeLine.tsx` do that work for the browser panel too, so a diff reads the same wherever it is shown.
- A command opens into a terminal: what was run after a `$`, then what it printed under it on the same surface, each with a copy button of its own. Every CLI hands back the result of every tool, so `cli.ts` keeps it only for a command, because a file read or a search would pour the whole file into the log the crew syncs. The result arrives without the name it was called under, so the name the tool started with is what decides.
- What a command printed is cut down by `output.ts` before it is ever sent: the colors and cursor moves a terminal would have eaten are dropped, and a long run keeps its head and its tail and loses its middle, since a failure is at the end. The card scrolls inside its own height rather than counting off the lines it is not showing, because unlike a diff there is nowhere else to go and see the rest.
- What a step says it did is what it did, not the summary the model wrote of it. `detail.ts` reads `command` before `description`, so a shell step shows the command itself.
- The panel a step opens carries no rail or bracket. It is a card, or it is plain text, sitting under the row that opened it.

## Terminals

A terminal is one of the things the side panel can hold, beside a web page and a file. The New button asks which. It is the real thing: a pty running the login shell, started the way Terminal and Windows Terminal start it, in the project folder.

- `node-pty` opens the pty and xterm.js draws it. node-pty is built on N-API, so the binary in the package loads in Electron and in plain node alike and is never rebuilt for an Electron version. That is what lets the tests drive a real shell.
- The package hands over its `spawn-helper` without the execute bit, and without that every terminal fails to start with "posix_spawnp failed". `scripts/ensure-pty.mjs` puts it back on every install, and `asarUnpack` keeps node-pty out of the asar so the helper stays a file the system can run.
- Sessions live in `src/main/terminal.ts`, one `Terminals` per window, closed with the window and on quit. None of it is written down or shared. It is this machine's shell, not the crew's.
- A shell is only spoken for while it is the one standing under its name. React mounts a view twice while developing, so a tab is opened, closed, and opened again under the same name in one breath, and the first shell's exit lands after the second has taken the name. Striking the new one off on the old one's word leaves a terminal that prints but never listens, and prints "[Process completed]" before its own first prompt.
- The pty is named after the tab, so nothing has to be handed back before the terminal is wired up, and the first keystroke has somewhere to go.
- xterm measures itself against the box it is in, and a box with no size yet throws from deep inside it. The fit is left to a `ResizeObserver` rather than done at mount, which is also what tells the shell its new size when the panel is dragged wider.
- The palette is in `terminalTheme.ts` and follows the app theme. Red and green are the app's own danger and positive.
- Copy and paste on a Mac are the app menu's, and xterm answers the events they raise. Everywhere else it is Ctrl+Shift+C and Ctrl+Shift+V, because plain Ctrl+C has to reach the shell.
- A shell that ends says so and the tab stays open, the way Terminal does, so whatever it printed on the way out can still be read.
- One shell is always kept ready, so a tab opens on a prompt instead of a blinking cursor. A login shell reads the whole profile before it says anything, which is over three seconds cold on a machine that loads a version manager, and none of that wait belongs to the person who just asked for a terminal. `warm` starts the spare, `claim` hands it over, and every `open` starts the next one. Main decides when, in `warmTerminals`: once a window has loaded, and again whenever a session is started, joined or resumed, because that is when the folder a terminal would open in is known. The renderer is not told any of this and has nothing to call.
- A spare is only ever handed to a tab in the folder it was started in, and a shell that ended before anyone claimed it is passed over. Both fall back to starting a shell the old way, so a stale spare can never put a terminal in the wrong place.
- What the spare printed is held and replayed to the tab that takes it, through `replayable`. It is never replayed raw: zsh pads its prompt line out to the width it believes it has and then returns to the start of the line, so bytes drawn for an eighty column spare leave the end of line mark stranded on screen in a tab of another width. Only what follows the last carriage return of a line was ever meant to be read. Nothing here may assume the spare and the tab are the same size.
- The spare counts for nothing in `count()` and goes with `closeAll`, so a window that never opened a terminal still leaves no shell behind.

## Files

A file opened from a message that changed it opens on the change, showing the diff the way VS Code shows one. It is still a file you can type in.

- The lines that were taken out sit above the ones that replaced them, and the words that changed inside a line are tinted again over the line's own tint, the way VS Code marks what changed inside a line.
- A step only records the text an agent swapped, not where it landed. `baseline.ts` matches that text against the file on disk and reverses it, to get the file as it stood before. `diffRows.ts` diffs that against what is on screen, and does it again on every keystroke, so what you type is part of the diff from the moment you type it. VS Code waits 200ms, because its editor holds the document and draws the deleted lines beside it. Here they are text in the same box, so a keystroke has to land on the rows it was typed against and there is nothing to wait for.
- That box holds the deleted lines too, because it is the only way the text under the caret lines up with the rows drawn behind it. What is typed is mapped back onto the real file first with `toDoc`, and the caret is put back after with `toShown`. Never write the box's contents to disk. `docText` is the file and the rest is the diff.
- The caret never sits in a line that was taken out. It steps over the whole block, back or forward depending on which way it came, the way a cursor steps over a view zone in VS Code. Rubbing out at the head of a line under a block joins it to the line above, because that is the line above it in the file.
- Clicking dismisses nothing. It puts the caret where it landed and leaves the page where it was standing. Hide changes puts the diff away.

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
