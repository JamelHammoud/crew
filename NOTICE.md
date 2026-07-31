# Notices

Crew is built on other people's work. This file lists what it uses, under what
license, and the attribution each one asks for.

Licenses were read from the `LICENSE` file in each installed package rather than
from the `license` field alone. Versions are the ones installed at the time of
writing.

The list below names the 33 direct dependencies. The full production closure is
395 packages, and all of them ship inside the built app: electron-builder
collects production `node_modules` on a walk of its own, so keeping them out of
the `files` list does not keep them out of the binary. Every notice here has to
travel with any binary built from this repository.

## Artwork and fonts

These carry a named attribution requirement. The line under each one is the
attribution, and it has to travel with the work.

### Twemoji

Crew draws every standard emoji from the Twemoji artwork, shipped inside the
`emoji-datasource-twitter` package as a sprite sheet.

The artwork and the code around it are licensed separately. The npm package is
MIT, and that MIT grant covers the data and the packaging. The artwork itself is
CC BY 4.0, which requires attribution.

> Twemoji
> Copyright (c) 2014-2021 Twitter, Inc and other contributors
> Copyright (c) 2022-present Jason Sofonia and Justine De Caires
> Artwork licensed under Creative Commons Attribution 4.0 International (CC BY 4.0)
> https://creativecommons.org/licenses/by/4.0/
> Code licensed under the MIT License
> https://opensource.org/licenses/MIT

The same attribution is carried inside the app, on the About page in the
settings, so it reaches somebody running Crew and not only somebody reading the
repository.

Source: `@discordapp/twemoji` declares `MIT AND CC-BY-4.0` and its README states
that graphics are licensed under CC BY 4.0. The `emoji-datasource` README states
that Twitter images are available under the Creative Commons Attribution 4.0
license.

### Fonts and profiles shipped with the PDF viewer

`pdfjs-dist` carries assets that are licensed apart from its own Apache-2.0
code, and they are built into the app.

| Asset | License | Copyright |
| --- | --- | --- |
| Liberation fonts (Arimo, Tinos, Cousine) | SIL Open Font License 1.1 | Digitized data copyright (c) 2010 Google Corporation. Copyright (c) 2012 Red Hat, Inc. |
| Foxit fonts | BSD 3-Clause | Copyright 2014 PDFium Authors |
| JBIG2 decoder | BSD 3-Clause | Copyright 2014 The PDFium Authors |
| OpenJPEG | BSD 2-Clause | Copyright (c) 2002-2014 Universite catholique de Louvain (UCL), Belgium, and Professor Benoit Macq |
| qcms | MIT | Copyright (C) 2009-2024 Mozilla Corporation. Copyright (C) 1998-2007 Marti Maria |
| ICC profiles | CC0 1.0 Universal | Public domain dedication |
| CMap tables | BSD 3-Clause | Copyright 1990-2009 Adobe Systems Incorporated |

The full texts ship beside them under `pdfjs/` in the built app.

## Runtime

Crew is an Electron application, so it distributes Chromium and Node.js along
with it.

| Name | Version | License |
| --- | --- | --- |
| Electron | 33.4.11 | MIT |

Electron bundles Chromium, whose own notices are in
`LICENSES.chromium.html` inside the Electron distribution. That file has to ship
with any binary built from this repository.

## Needs its own answer

### libvips, under the GNU Lesser General Public License

`@img/sharp-libvips-darwin-arm64` 1.2.4 is LGPL-3.0-or-later, and it reaches the
app as a required dependency rather than an optional one:

`@huggingface/transformers` 3.8.1 goes to `sharp` 0.34.5, which goes to
`@img/sharp-darwin-arm64`, which goes to `@img/sharp-libvips-darwin-arm64`.

It ships a 16MB `libvips-cpp` dynamic library that statically bundles eight
LGPLv3 libraries: libvips, glib, pango, librsvg, libheif, libexif, fribidi and
proxy-libintl. The package carries no LICENSE file at all, only a note in its
README, so the license text it has to convey is not currently shipped.

The LGPL also asks that somebody be able to replace the library with their own
build of it. The `@img` packages are not in `asarUnpack`, so the library is
packed inside `app.asar`, where it cannot be replaced.

Whether `sharp` is ever loaded at runtime is worth answering before deciding
what to do here. If nothing loads it, leaving it out of the build settles this
outright. If something does, the license text has to ship and the library has to
come out of the archive.

### tldraw

`tldraw` 5.2.5 and `@tldraw/assets` 5.2.5 declare `SEE LICENSE IN LICENSE.md`,
and that file points at the tldraw license rather than to an OSI approved one:

> This code is licensed under the [tldraw license](https://github.com/tldraw/tldraw/blob/main/LICENSE.md)

This is not an open source license and it is not covered by anything in this
file. It is being handled separately.

`@tldraw/assets` bundles the IBM Plex and Shantell Sans typefaces, both under
the SIL Open Font License 1.1. Their reserved font name and no standalone sale
terms apply. That is moot until the tldraw license itself is settled.

## Code

Everything below is used at runtime. Each license requires that its copyright
notice and permission notice travel with the software, so the full texts have to
be shipped with any binary built from this repository.

### MIT

| Name | Version |
| --- | --- |
| @emoji-mart/data | 1.2.1 |
| @heroicons/react | 2.2.0 |
| @mantine/core | 8.3.18 |
| @mantine/hooks | 8.3.18 |
| @xterm/addon-fit | 0.10.0 |
| @xterm/addon-web-links | 0.11.0 |
| @xterm/xterm | 5.5.0 |
| electron-updater | 6.8.9 |
| emoji-datasource-twitter | 15.1.2 |
| fflate | 0.8.3 |
| koffi | 3.1.2 |
| marked | 12.0.2 |
| node-pty | 1.1.0 |
| papaparse | 5.5.4 |
| react | 18.3.1 |
| react-colorful | 5.8.0 |
| react-dom | 18.3.1 |
| shiki | 4.3.1 |
| uiohook-napi | 1.5.5 |
| ws | 8.21.1 |
| zustand | 5.0.14 |

`emoji-datasource-twitter` is MIT for the data and the packaging only. The
artwork it carries is attributed above.

### MIT and CC BY 4.0

| Name | Version |
| --- | --- |
| @discordapp/twemoji | 16.0.1 |

Code under MIT, artwork under CC BY 4.0. Attributed above.

### Apache License 2.0

| Name | Version |
| --- | --- |
| @huggingface/transformers | 3.8.1 |
| kokoro-js | 1.2.1 |
| pdfjs-dist | 6.2.108 |
| xlsx | 0.18.5 |

Apache-2.0 asks that the license, any NOTICE file from the original work, and a
statement of changes travel with it.

### Mozilla Public License 2.0

| Name | Version |
| --- | --- |
| @blocknote/core | 0.51.4 |
| @blocknote/mantine | 0.51.4 |
| @blocknote/react | 0.51.4 |

MPL-2.0 is copyleft per file rather than across a whole program. Using these
packages unmodified does not reach the rest of Crew. Editing one of their files
means publishing that file's source under MPL-2.0.

### Mozilla Public License 2.0 or Apache License 2.0

| Name | Version |
| --- | --- |
| dompurify | 3.4.12 |

Dual licensed, so either one may be taken. Both texts ship in the package, as
`LICENSE` and `LICENSE-MPL`.

### BSD 2-Clause

| Name | Version |
| --- | --- |
| mammoth | 1.12.0 |
