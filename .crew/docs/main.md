---
title: "Docs"
---

## Queue

* [ ] We need a "Files" tab, this is the file explorer for the repo, that's synced across computers, searchable, and allows manual editing (Just like VS code)
* [ ] Spellcheck doesn't work in docs because a right-click is hijacked

## In progress

* [ ] crtl-f doesn't work in docs
* [ ] What if we turned repos into "join links", everybody is a host/joiner, the repo itself is the "chat room", opening crew in there auto joins you to that repo

## Blocked

* [ ] Every time you @ mention an agent, it has to re-build it's knowledge of the codebase (and takes a long time)

## Completed

* [x] A thread can get stuck on "Working" for hours, the stop button does nothing
* [x] Better at finding what CLIs are available on your computer
* [x] Ability to mention a different agent while in a thread
* [x] Add the ability to "archive" a thread (most likely the same right-click context menu as message deleting). Don't delete the info, just don't show it in chat. We'll come up with a place for them to be in a later project
* [x] Deleting messages
* [x] "Docs" should be like Google Docs, a much better editing experience, and you can create other pages
* [x] Auto-git sync
* [x] The chat textarea should auto-resize when typing in it
* [x] 1) You should be able to have lots of different threads open with the "same" agent (just type of agent) but actually spawning multiple versions. Right now when you start a new thread with an agent that's already working, it just says done and doesn't do anything or respond. 2) The progress in a chat shouldn't just keep ebing appended ot one message. It should be the agent sending multiple messages, seeing thinking in between and the tool calls in-between too (not all stacked at the bottom). The tool calls should only be for that one thread. This is like how Claude and Codex's apps actually work. The agent keeps sending follow up messages
* [x] We need much more feedback while an agent is working, like how long it's been thinking for, tokens down, etc., like Claude Code or Codex does, to make it seem faster and more responsive). I also want to see all the thinking I can (but maybe collapsable if it gets in the way)
* [x] Ok, now let's do a re-design of the app. I don't have views for all of it, so you'll have to extend it to redesign teh whole app. Define re-usable components and re-usable tokens for colors, etc. Build out the whole color pallete. Use Figma MCP to see: https://www.figma.com/design/TC9eAUDpOdSxPNUVRJPe77/Crew?node-id=1-7&t=nZ4gJnsu5QyLJKlh-4. https://www.figma.com/design/TC9eAUDpOdSxPNUVRJPe77/Crew?node-id=1-53&t=nZ4gJnsu5QyLJKlh-4. https://www.figma.com/design/TC9eAUDpOdSxPNUVRJPe77/Crew?node-id=1-180&t=nZ4gJnsu5QyLJKlh-4. Focus on the craft, make it beautiful, focus on small interactions, hover states, etc. Clicking the profile in the top right should open up a popover menu to "Leave" and if you're hte host" Invite Link". Use heroicons package for icons, NO MORE HAND-ROLLING ICONS! Make it beautiful, popovers should be like mobbin, semi-transparent dark background with a backdrop filter of saturation and blur.
* [x] People should be able to steer (i.e. send a message while an agent is working in a thread to get that message to it quickly and "steer" it to start including that too). Right now it just keeps having the message I sent on the bottom of what you keep doing, with no indication it was picked up for steering (I don't think it ever was). support it where you can, make it obvious in the UI if it's queued or steered
* [x] A steered message to Claude works, but in the UI it's still sticking at the bottom, even as the responses from Claude start to come in, they push the message downwards (which doesn't make sense, the message was sent earlier). The timestamp for the steered message is correct, but it's positioning in the thread chat makes it look like it was sent later than other messages
* [x] If you've already scrolled in a thread upwards, don't auto-scroll the user back down (there's a threshold, if the user is actively scrolling up to go read/find something). Keep the user where they scrolled and instead show a "Jump to bottom" centered button
