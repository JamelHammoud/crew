---
name: crew-copy
description: Write or fix the words in Crew. Use whenever a label, a line under a label, a button, an empty state, a placeholder, a toast, a menu row or a settings page is being written or reworked. Holds the test a line has to pass, the things never to say, and where each rule came from.
---

# Writing the words in Crew

The Writing section of `AGENTS.md` is the law. Everything below is either that
section restated with its reasoning shown, or guidance from outside that agrees
with it. Where an outside source and `AGENTS.md` disagree, `AGENTS.md` wins and
the outside source is wrong for this project.

The failure this skill exists to stop is copy that reads as though a machine
wrote it: a line under every heading whether or not there was anything to say, a
sentence that hands back the brief it was built from, and an explanation of why
the software is the way it is.

## The test

Every line has to pass all four. A line that fails any of them comes out.

1. **Does it say something the screen cannot say on its own?** If the label, the
   control, the icon or the surrounding page already says it, the line is a row
   of type spent on nothing. Polaris: "Only add content that's necessary for
   clarity" and "Let visuals and icons do the talking wherever you can."
2. **Is it about the person, or about the machine?** Yifrah's basic rule is
   "Don't talk about yourself or your product; talk about them." A line that
   names a platform, a model, a permission mechanism, a file, a process or a
   reason the code is shaped the way it is has failed.
3. **Would it survive being read out loud?** Polaris: "Read it out loud. Does it
   sound like something a human would say?" Mailchimp: "it's always more
   important to be clear than entertaining."
4. **Is every word in it earning its place?** GOV.UK: "put the important words
   first and drop any unnecessary words." NN/g measured it: concise copy tested
   58% more usable than the promotional baseline, objective copy 27% more, and
   all three treatments together 124% more.

## Never explain the machinery

This is the one that gets broken most, and it is the reason most Crew copy reads
as LLM output. A line that explains why something works the way it does is a
line written from the conversation that built the feature, not from what the
person is looking at.

GOV.UK states it as a design rule rather than a writing one: "If you find
yourself having to explain how the user interface works, that's a sign something
has gone wrong. Fix the interface." NN/g say the same about tooltips, which are
"highly contextual and specific and don't explain the bigger picture or entire
task flow", and about errors: "Avoid technical jargon and use language familiar
to your users instead."

Things that are machinery and never go in the app:

- **A platform limitation.** "macOS keeps Fn to itself, so no app is given it."
  Nobody is owed a reason a key is not on a list. The list is the answer.
- **What is being downloaded, cached, compiled or spawned.** "A small model comes
  down the first time." The person asked for dictation, not a build log.
- **Why a fallback exists.** "Use Control Command Space instead, which always
  works." The "which always works" is the engineer saying the other one
  sometimes does not, out loud, in the product.
- **How a rule is implemented.** "Marks and capitals, placed from how you said
  it." The second half is the algorithm.
- **A named internal concept.** Not the panel, not the mode, not the mechanism,
  not the model, not the hook, not the worker.

The line to write instead is the consequence for the person, or no line.

## A heading stands on its own

A line under a heading that says the heading again in longer words is the
commonest bad line in a settings page, and it is invisible to whoever wrote it
because it reads as thorough. NN/g's microcontent rule is that a headline has to
"work out of context", and GOV.UK give the shape of the failure exactly:
"there's usually no need to say 'This is the total cost'. Just say 'Total cost'."

Two more shapes of the same mistake:

- **Naming back what the person is already looking at.** A line under a list of
  keys that says these are the keys.
- **The flourish on the end.** "cursors and all", "and more", "in seconds",
  "which always works". Filler taught in one screen is filler ignored in every
  screen after it.

Start with nothing under the heading and add a line only when there is a fact
that has nowhere else to live. GOV.UK: "start with less. If you're creating a
form, start with some simple questions and only add help text if user research
shows that you need it." Polaris put it as a warning about components: "design
doesn't always dictate content (not every situation calls for subcopy, even if
the component has been designed to include it)." A `Row` in
`settings/parts.tsx` takes an optional `line` for exactly this reason. Leave it
off.

## Labels, switches and rows

Apple's Human Interface Guidelines give the rule for a switch, and it is the
rule for every switch on every Crew settings page:

> If the setting label isn't enough, add an explanation. Describe what it does
> when turned on, and people can infer the opposite.

So a switch never gets two lines, one for on and one for off, and never gets a
line at all when its label already carries it. "Stutters" under a section called
"Tidying" is finished. "Fillers" is not, because nobody agrees on what one is,
so it gets three examples and no sentence: "Um, uh, you know."

The rest of the label rules:

- **Front-load.** GOV.UK's inverted pyramid: the most important point first, in
  the page, the section, the paragraph and the sentence. Apple: put the most
  important information first.
- **A button is a verb.** Apple: "when labeling buttons and links, it's almost
  always best to use a verb." Polaris: "Start sentences with verbs so they feel
  like actionable instructions."
- **Be direct.** Polaris: "Be direct ('add apps' not 'you can add apps')."
- **No politeness furniture.** GOV.UK: "There's usually no need to say 'please'
  or 'please note'" and "There's usually no need to say thank you."
- **Labels live outside the field.** NN/g on placeholders: "the best solution is
  to have clear, visible labels that are placed outside empty form fields", and
  "Hints and instructions should also be persistent and placed outside of the
  field." Where a placeholder is the only thing there is room for, as in a
  two-column list, it has to read as a column heading and never as an
  instruction or an example value.

## When something has gone wrong

NN/g's error message guidelines are two halves and both are needed. The problem:
"Generic messages such as An error occurred lack context. Provide descriptions
of the exact problems." The way out: "Merely stating the problem is also not
enough; offer some potential remedies."

So a failure row is the state, plainly, and then the one thing to do about it.
It is never the reason. GOV.UK again: "do not say 'You have entered the wrong
password'. Say 'Wrong password'."

A toast is a moment and never a record, which is already in `AGENTS.md`. What
the sources add is why the temptation is wrong: NN/g found unsolicited help is
"often ignored by users because they get in the way: people want to use the
interface, not just read about it."

## Voice

Dropbox's writing team, per John Saito, hold three words: simple, straightforward
and human. Podmajersky's four are purposeful, concise, conversational and clear.
Mailchimp: "We strip all that away and value clarity above all" and "we avoid
distractions like fluffy metaphors and cheap plays to emotion."

Crew's own, from `AGENTS.md`, are stricter and they win:

- **No em dashes, ever, and no semicolons standing in for one.** Plain sentences.
- **Crew is capitalized wherever it is named.** It is a name, not a word.
- **UI copy is for everyone.** No engineering jargon.
- **No emoji in the UI.** No branding beyond the word Crew.
- **A label like "You" goes in a `Pill`, never in parentheses.**
- **Copy never echoes the request that produced it.** If a line could be read
  back as the feature request, rewrite it from what is on the screen.

Mailchimp's rule on jokes is the one to hold when a line starts feeling clever:
"don't go out of your way to make a joke, forced humor can be worse than none at
all." Crew has a voice and it is dry. It gets there by being exact, not by being
funny.

## Write the words first

Jason Fried: "Since copywriting is interface design, you can do an awful lot of
great design in a text editor." And: "Don't worry about where things will go, or
how they will fit. Worry about explaining it clearly and then build the rest of
the interface around that explanation."

If a screen cannot be written plainly, the screen is wrong and no amount of copy
will cover it. That is the same finding as GOV.UK's "fix the interface", arrived
at from the other end.

Intercom's six questions are the fastest way to unstick a line that will not
come: who is it for, when do they see it, what do they need to know, what must
they do now, how is it delivered, and what tone does the app speak in.

## Before and after

Real lines from this app.

| before | after | why |
| --- | --- | --- |
| "macOS keeps Fn to itself, so no app is given it." | nothing | A platform limitation. The list of keys is already the answer. |
| "A small model comes down the first time, and stays on this machine." | "Nothing you say leaves this machine." | The first half is machinery. The second half was the only fact worth a row of type, so it becomes the whole line. |
| "Use Control Command Space instead, which always works." | "Press Control Command Space instead." | Remedy kept, flourish cut. |
| "Crew needs it to see the key at all, and to put the words where you are typing." | "Dictation does nothing until it is on." | Two mechanisms became one consequence. The button beside it is the remedy. |
| "Marks and capitals, placed from how you said it." | nothing | The label is enough, and the rest was the algorithm. |
| "A word said twice on the way to the next one." | nothing | "Stutters" under "Tidying" says it. |
| "Um, uh, and a you know that is standing on its own." | "Um, uh, you know." | The examples were the useful part. "Standing on its own" was the rule's implementation. |
| "The first word lands whole, and your recording light is on the whole time." | "Your first word is never cut off, and your recording light stays on." | One benefit and one cost, both plain. A real trade said plainly is worth its row. |
| "The key is not being heard" | "Your key is not working" | Heard by what? Say it from where the person is standing. |

## Checking it

There is no script for this. Read the screen top to bottom with every optional
line covered up, and put back only the ones whose absence you notice. Then read
what is left out loud.

Three questions that catch most of what survives that:

- **Cover the line. Is anything lost?** If not, it was never doing anything.
- **Could this sentence be pasted into the feature request it came from?** Then
  it is the brief read aloud and it has to be rewritten from the screen.
- **Does it name a thing only somebody who built it would name?** A model, a
  hook, a worker, a permission, a platform, a panel, a mode. Take it out.

## Sources

- Nielsen Norman Group, [Concise, SCANNABLE, and Objective: How to Write for the Web](https://www.nngroup.com/articles/concise-scannable-and-objective-how-to-write-for-the-web/)
- Nielsen Norman Group, [Microcontent: How to Write Headlines, Page Titles, and Subject Lines](https://www.nngroup.com/articles/microcontent-how-to-write-headlines-page-titles-and-subject-lines/)
- Nielsen Norman Group, [Error-Message Guidelines](https://www.nngroup.com/articles/error-message-guidelines/)
- Nielsen Norman Group, [Help and Documentation (Usability Heuristic #10)](https://www.nngroup.com/articles/help-and-documentation/)
- Nielsen Norman Group, [Tooltip Guidelines](https://www.nngroup.com/articles/tooltip-guidelines/)
- Nielsen Norman Group, [Placeholders in Form Fields Are Harmful](https://www.nngroup.com/articles/form-design-placeholders/)
- GOV.UK Service Manual, [Writing for user interfaces](https://www.gov.uk/service-manual/design/writing-for-user-interfaces)
- GOV.UK, [Content principles: conventions and research background](https://www.gov.uk/government/publications/govuk-content-principles-conventions-and-research-background/govuk-content-principles-conventions-and-research-background)
- Apple, [Human Interface Guidelines: Writing](https://developer.apple.com/design/human-interface-guidelines/writing)
- Shopify Polaris, [Product content](https://polaris-react.shopify.com/content/product-content)
- Mailchimp, [Content Style Guide: Voice and Tone](https://styleguide.mailchimp.com/voice-and-tone/)
- Jason Fried, [Since copywriting is interface design, you can do an awful lot of great design in a text editor](https://signalvnoise.com/posts/3467-since-copywriting-is-interface-design-you)
- Kinneret Yifrah, *Microcopy: The Complete Guide*
- Torrey Podmajersky, *Strategic Writing for UX* (O'Reilly)
- John Saito, [on UX writing at Dropbox](https://www.intercom.com/blog/podcasts/dropbox-john-saito-ux-writing/)
- Intercom, [Writing an interface](https://www.intercom.com/blog/videos/writing-an-interface/)
