// src/server/index.ts
import fs from "node:fs";
import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";

// src/shared/attachments.ts
var IMAGE_TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp"
};
var MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
var MAX_ATTACHMENTS = 6;
var FILE_NAME = /^[a-z0-9-]+\.(png|jpg|gif|webp)$/;
function isImageType(mime) {
  return mime in IMAGE_TYPES;
}
function extensionFor(mime) {
  return IMAGE_TYPES[mime];
}
function mimeForFile(file) {
  const ext = file.split(".").pop();
  const found = Object.entries(IMAGE_TYPES).find(([, value]) => value === ext);
  return found ? found[0] : null;
}
function isAttachmentFile(file) {
  return FILE_NAME.test(file);
}

// src/shared/music.ts
var MUSIC_TUNES = [
  {
    id: "overworld",
    name: "Overworld",
    mood: "bouncy",
    bpm: 132,
    beats: 32,
    colors: ["#6fe9ff", "#a5dcff", "#7cf0a8", "#f4fdff", "#2f9dfa"]
  },
  {
    id: "arcade",
    name: "Arcade",
    mood: "busy",
    bpm: 150,
    beats: 32,
    colors: ["#ff7ac8", "#ffb0dc", "#8fd8ff", "#fff0fa", "#ff3fae"]
  },
  {
    id: "tide-pool",
    name: "Tide Pool",
    mood: "floating",
    bpm: 84,
    beats: 32,
    colors: ["#5fe6c8", "#7fecd0", "#ffcf8f", "#f4fffb", "#9fe9dd"]
  },
  {
    id: "night-bus",
    name: "Night Bus",
    mood: "mellow",
    bpm: 96,
    beats: 32,
    colors: ["#b98cff", "#ffb0e0", "#ffc98f", "#f6efff", "#8a7cf0"]
  },
  {
    id: "star-road",
    name: "Star Road",
    mood: "soaring",
    bpm: 120,
    beats: 32,
    colors: ["#9fc4ff", "#b0ccff", "#ffd166", "#f7faff", "#5b9bf5"]
  },
  {
    id: "hearth",
    name: "Hearth",
    mood: "cosy",
    bpm: 88,
    beats: 32,
    colors: ["#ffb15c", "#ffcb8f", "#9fcbe0", "#fff5e6", "#f59440"]
  },
  {
    id: "rain-check",
    name: "Rain Check",
    mood: "wistful",
    bpm: 76,
    beats: 32,
    colors: ["#a8d4ff", "#b0cdf0", "#f0aec4", "#f6faff", "#7fa8e0"]
  },
  {
    id: "sprint",
    name: "Sprint",
    mood: "hurried",
    bpm: 168,
    beats: 32,
    colors: ["#ffc23d", "#ffd47a", "#8fe0ff", "#fff6e0", "#ff5a2e"]
  },
  {
    id: "bubble-bath",
    name: "Bubble Bath",
    mood: "silly",
    bpm: 108,
    beats: 32,
    colors: ["#ff9ed8", "#ffb8e0", "#ffc48f", "#fff4fa", "#7fe8d0"]
  },
  {
    id: "deep-dive",
    name: "Deep Dive",
    mood: "murky",
    bpm: 92,
    beats: 32,
    colors: ["#4fe0d0", "#7ff0dc", "#8fe87f", "#eafffb", "#2a9fc4"]
  },
  {
    id: "sunrise",
    name: "Sunrise",
    mood: "hopeful",
    bpm: 104,
    beats: 32,
    colors: ["#ffcf5c", "#ffb8cd", "#ffa87f", "#fff8ea", "#4fa8f5"]
  },
  {
    id: "snowfield",
    name: "Snowfield",
    mood: "still",
    bpm: 72,
    beats: 32,
    colors: ["#b5d8f5", "#8fb5e0", "#ffcb94", "#fbfdff", "#a8cdf0"]
  },
  {
    id: "boss-fight",
    name: "Boss Fight",
    mood: "fierce",
    bpm: 160,
    beats: 32,
    colors: ["#ffb03d", "#ffb894", "#a8b0ff", "#fff2e6", "#f5462e"]
  },
  {
    id: "lobby",
    name: "Lobby",
    mood: "patient",
    bpm: 112,
    beats: 32,
    colors: ["#a8f05c", "#b0e87f", "#5fe8b0", "#f6ffea", "#6fc0f5"]
  },
  {
    id: "credits",
    name: "Credits",
    mood: "fond",
    bpm: 100,
    beats: 32,
    colors: ["#ff9ec4", "#ffbcd8", "#ffc98f", "#fff4f8", "#b08ce8"]
  }
];
var BY_LIMIT = 40;
var UPLOAD_NAME_LIMIT = 60;
var MAX_UPLOAD_BYTES = 24 * 1024 * 1024;
var MAX_UPLOADS = 40;
var MAX_UPLOAD_SECONDS = 60 * 60;
var UPLOAD_FILE = /^[a-z0-9-]+\.(mp3|m4a|ogg|wav|flac)$/;
var AUDIO_TYPES = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "m4a",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/flac": "flac"
};
function audioExtension(mime) {
  return AUDIO_TYPES[mime] ?? null;
}
function isUploadFile(file) {
  return UPLOAD_FILE.test(file);
}
function mimeForMusic(file) {
  const extension = file.split(".").pop() ?? "";
  const found = Object.entries(AUDIO_TYPES).find(([, value]) => value === extension);
  return found ? found[0] : "application/octet-stream";
}
function emptyMusic() {
  return { trackId: null, playing: false, at: 0, by: "" };
}
var SHELVES = [
  ["#ff8fa8", "#ffc09f", "#8fd4e8", "#fff2e8", "#f56b8a"],
  ["#8ce68f", "#a0e88f", "#ffd98f", "#f2fff4", "#7fd4f0"],
  ["#8fb8ff", "#b0c9f5", "#ffc9a8", "#f4f8ff", "#4f8ef5"],
  ["#c48fff", "#d4b0ff", "#9ff0d8", "#faf2ff", "#a87ae8"],
  ["#ffc85c", "#ffd07a", "#8fc4f0", "#fff8e6", "#f5943c"],
  ["#5fe0f0", "#94e0f5", "#ffbf9f", "#eefbff", "#3fa8e0"]
];
function paletteFor(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = hash * 31 + seed.charCodeAt(i) >>> 0;
  return SHELVES[hash % SHELVES.length];
}
function tuneLength(tune) {
  return tune.beats * 60 / tune.bpm;
}
var itemOf = (tune) => ({
  id: tune.id,
  name: tune.name,
  mood: tune.mood,
  seconds: tuneLength(tune),
  colors: tune.colors,
  bpm: tune.bpm
});
var UPLOAD_BPM = 100;
var uploadItem = (upload) => ({
  id: upload.id,
  name: upload.name,
  mood: "yours",
  seconds: upload.seconds,
  colors: paletteFor(upload.id),
  bpm: UPLOAD_BPM,
  file: upload.file,
  by: upload.by
});
var TUNE_ITEMS = MUSIC_TUNES.map(itemOf);
function itemFor(id, uploads = []) {
  const tune = MUSIC_TUNES.find((one) => one.id === id);
  if (tune) return itemOf(tune);
  const upload = uploads.find((one) => one.id === id);
  return upload ? uploadItem(upload) : null;
}
function wrapAt(at, seconds) {
  if (!Number.isFinite(at) || seconds <= 0) return 0;
  const round = at % seconds;
  return round < 0 ? round + seconds : round;
}
function cleanUploadName(name) {
  const trimmed = name.trim().replace(/\.[a-z0-9]{1,5}$/i, "").slice(0, UPLOAD_NAME_LIMIT);
  return trimmed || "Untitled";
}

// src/server/index.ts
var HEARTBEAT_MS = 2e4;
var MEDIA_HEADERS = {
  "cache-control": "public, max-age=31536000, immutable",
  "x-disabled-for-check": "yes"
};
function serveAttachment(session, file, res) {
  const full = session.attachmentPath(file);
  const mime = mimeForFile(file);
  if (!full || !mime) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { "content-type": mime, ...MEDIA_HEADERS });
  fs.createReadStream(full).on("error", () => res.end()).pipe(res);
}
function serveMusic(session, file, res) {
  const full = session.musicPath(file);
  if (!full) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { "content-type": mimeForMusic(file), ...MEDIA_HEADERS });
  fs.createReadStream(full).on("error", () => res.end()).pipe(res);
}
function receiveAttachment(session, req, res) {
  const mime = (req.headers["content-type"] ?? "").split(";")[0].trim();
  let name = "image";
  try {
    const header = req.headers["x-attachment-name"];
    if (typeof header === "string") name = decodeURIComponent(header);
  } catch {
    name = "image";
  }
  const chunks = [];
  let size = 0;
  req.on("data", (chunk) => {
    size += chunk.length;
    if (size <= MAX_ATTACHMENT_BYTES) chunks.push(chunk);
  });
  req.on("end", () => {
    if (size > MAX_ATTACHMENT_BYTES) {
      res.writeHead(413);
      res.end();
      return;
    }
    const saved = session.saveAttachment(mime, name, Buffer.concat(chunks));
    if (!saved) {
      res.writeHead(400);
      res.end();
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(saved));
  });
  req.on("error", () => {
    res.writeHead(400);
    res.end();
  });
}
var MAX_DESIGN_BODY = 4 * 1024 * 1024;
var MAX_DESIGN_OPS = 200;
var JSON_HEADERS = { "content-type": "application/json" };
function sendJson(res, status, body) {
  res.writeHead(status, JSON_HEADERS);
  res.end(JSON.stringify(body));
}
function receiveDesignOps(session, boardId, req, res) {
  const chunks = [];
  let size = 0;
  req.on("data", (chunk) => {
    size += chunk.length;
    if (size <= MAX_DESIGN_BODY) chunks.push(chunk);
  });
  req.on("end", () => {
    if (size > MAX_DESIGN_BODY) {
      sendJson(res, 413, { error: "Body too large" });
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      sendJson(res, 400, { error: 'Body must be JSON like {"agent":"...","ops":[...]}' });
      return;
    }
    const ops = Array.isArray(parsed.ops) ? parsed.ops : null;
    if (!ops || ops.length === 0) {
      sendJson(res, 400, { error: "ops must be a non-empty array" });
      return;
    }
    if (ops.length > MAX_DESIGN_OPS) {
      sendJson(res, 400, { error: `Send at most ${MAX_DESIGN_OPS} ops per batch` });
      return;
    }
    const agent = typeof parsed.agent === "string" && parsed.agent ? parsed.agent.slice(0, 120) : "agent";
    const results = session.runDesignOps(boardId, agent, ops);
    if (!results) {
      sendJson(res, 404, { error: "No board with that id" });
      return;
    }
    sendJson(res, 200, { results });
  });
  req.on("error", () => {
    res.writeHead(400);
    res.end();
  });
}
function createCrewServer(session, opts = {}) {
  const httpServer = http.createServer((req, res) => {
    if (req.url === "/") {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("crew");
      return;
    }
    if (req.method === "POST" && req.url === "/attachments") {
      receiveAttachment(session, req, res);
      return;
    }
    const attachment = /^\/attachments\/([^/?#]+)$/.exec(req.url ?? "");
    if (attachment) {
      serveAttachment(session, decodeURIComponent(attachment[1]), res);
      return;
    }
    const music = /^\/music\/([^/?#]+)$/.exec(req.url ?? "");
    if (music) {
      serveMusic(session, decodeURIComponent(music[1]), res);
      return;
    }
    const designOps = /^\/design\/([a-z0-9][a-z0-9-]*)\/ops$/.exec(req.url ?? "");
    if (req.method === "POST" && designOps) {
      receiveDesignOps(session, designOps[1], req, res);
      return;
    }
    const designRead = /^\/design\/([a-z0-9][a-z0-9-]*)$/.exec(req.url ?? "");
    if (req.method === "GET" && designRead) {
      const summary = session.designBoardSummary(designRead[1]);
      if (!summary) {
        sendJson(res, 404, { error: "No board with that id" });
        return;
      }
      sendJson(res, 200, summary);
      return;
    }
    res.writeHead(404);
    res.end();
  });
  const wss = new WebSocketServer({ noServer: true, autoPong: opts.autoPong ?? true });
  const clients = /* @__PURE__ */ new Set();
  httpServer.on("upgrade", (req, socket, head) => {
    if (!req.url?.startsWith("/ws")) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const live = ws;
      live.isAlive = true;
      ws.on("pong", () => {
        live.isAlive = true;
      });
      ws.on("ping", () => {
        live.isAlive = true;
      });
      ws.on("message", () => {
        live.isAlive = true;
      });
      ws.on("close", () => clients.delete(live));
      clients.add(live);
      session.attach(ws);
    });
  });
  const intervalMs = opts.heartbeatMs ?? HEARTBEAT_MS;
  let lastBeat = Date.now();
  const heartbeat = setInterval(() => {
    const now = Date.now();
    const stalled = now - lastBeat > intervalMs * 3;
    lastBeat = now;
    for (const ws of clients) {
      if (!ws.isAlive && !stalled) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      try {
        ws.ping();
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
      } catch {
        ws.terminate();
      }
    }
  }, opts.heartbeatMs ?? HEARTBEAT_MS);
  return new Promise((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(opts.port ?? 0, opts.host ?? "0.0.0.0", () => {
      const address = httpServer.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({
        session,
        port: () => port,
        close: () => new Promise((done) => {
          clearInterval(heartbeat);
          for (const ws of clients) ws.terminate();
          httpServer.close(() => done());
        })
      });
    });
  });
}

// src/server/session.ts
import { randomBytes as randomBytes2, randomUUID } from "node:crypto";

// src/shared/docs.ts
function pageCodeOf(page) {
  return splitPageCode(page.split("/").pop()).code;
}
function resolveDocRef(docs, ref) {
  if (docs[ref.page] !== void 0) return ref.page;
  const code = pageCodeOf(ref.page);
  if (!code) return null;
  return Object.keys(docs).find((page) => pageCodeOf(page) === code) ?? null;
}
var FRONTMATTER = /^---\n([\s\S]*?)\n---\n?/;
var CODED_SEGMENT = /^(.*)-(\d(?=[a-z0-9]*[a-z])[a-z0-9]{3})$/;
function fallbackTitle(page) {
  const words = splitPageCode(page.split("/").pop()).base.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
function pageCode() {
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
  let code = alphabet[Math.floor(Math.random() * 10)];
  for (let i = 0; i < 3; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return /[a-z]/.test(code) ? code : pageCode();
}
function splitPageCode(segment) {
  const match = CODED_SEGMENT.exec(segment);
  return match ? { base: match[1], code: match[2] } : { base: segment, code: null };
}
function parseDocFile(raw, page) {
  const match = FRONTMATTER.exec(raw);
  if (match) {
    const line = match[1].split("\n").find((l) => l.startsWith("title:"));
    if (line) {
      const value = line.slice("title:".length).trim();
      const title = value.startsWith('"') ? parseQuoted(value) : value;
      return { title, text: raw.slice(match[0].length).replace(/^\n/, "") };
    }
  }
  return { title: fallbackTitle(page), text: raw };
}
function serializeDocFile(doc) {
  return `---
title: ${JSON.stringify(doc.title)}
---

${doc.text}`;
}
function parseQuoted(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value.replace(/^"|"$/g, "");
  }
}

// src/shared/refs.ts
function crewRefs(docs, boards) {
  const taken = /* @__PURE__ */ new Set();
  const refs = [];
  const add = (kind, key, title) => {
    const name = title.trim();
    if (!name || taken.has(name.toLowerCase())) return;
    taken.add(name.toLowerCase());
    refs.push({ kind, key, title: name });
  };
  for (const [page, doc] of Object.entries(docs)) add("doc", page, doc.title);
  for (const board of boards) add("board", board.id, board.name);
  return refs;
}
function refsIn(text, refs) {
  let work = ` ${text.toLowerCase()} `;
  const found = [];
  const ordered = [...refs].sort((a, b) => b.title.length - a.title.length);
  for (const ref of ordered) {
    const needle = `#${ref.title.toLowerCase()}`;
    const at = work.indexOf(needle);
    if (at === -1) continue;
    if (/[\w-]/.test(work[at + needle.length])) continue;
    found.push(ref);
    work = work.slice(0, at) + " ".repeat(needle.length) + work.slice(at + needle.length);
  }
  return found;
}
function docMentionsOf(refs) {
  return refs.filter((ref) => ref.kind === "doc").map((ref) => ({ page: ref.key, title: ref.title }));
}
function boardMentionsOf(refs) {
  return refs.filter((ref) => ref.kind === "board").map((ref) => ({ id: ref.key, name: ref.title }));
}

// src/shared/events.ts
var SYSTEM_AUTHOR_ID = "crew";
var SYSTEM_AUTHOR_NAME = "crew";
var EPHEMERAL_KINDS = /* @__PURE__ */ new Set([
  "doc",
  "doc.titled",
  "doc.renamed",
  "doc.deleted",
  "message.edited",
  "person.joined",
  "person.left",
  "agent.online",
  "agent.offline",
  "agent.updated",
  // Todos ride in the snapshot as first-class state (like docs and queues), so
  // their events only matter live; keeping them out of the window also stops a
  // weeks-old pending todo from falling off the end of the trim.
  "todo.added",
  "todo.edited",
  "todo.removed",
  "todo.checked",
  "todo.started",
  // The toolbox rides in the snapshot for the same reason: a tool built weeks
  // ago is still a button, long after its event has fallen off the window.
  "tool.added",
  "tool.edited",
  "tool.removed",
  // A track somebody put on the shelf is the same: it stays on the shelf, and
  // the crew does not need to scroll past the moment it arrived.
  "music.added",
  "music.removed"
]);
function huddleRecordId(event) {
  if (event.kind === "huddle.started" || event.kind === "huddle.joined" || event.kind === "huddle.ended") {
    return event.huddleId;
  }
  return void 0;
}
function trimEvents(events, limit) {
  const lasting = events.filter((e) => !EPHEMERAL_KINDS.has(e.kind));
  let count = 0;
  let start = lasting.length;
  for (let i = lasting.length - 1; i >= 0; i--) {
    if (lasting[i].kind !== "agent.step") {
      if (count === limit) break;
      count++;
    }
    start = i;
  }
  const kept = lasting.slice(start);
  const prompts = new Set(kept.filter((e) => e.kind === "agent.start").map((e) => e.promptId));
  return kept.filter((e) => e.kind !== "agent.step" || prompts.has(e.promptId));
}

// src/shared/huddle.ts
var MAX_HUDDLE_PEERS = 12;
var MAX_SIGNAL_CHARS = 256 * 1024;
var PEER_ID_CHARS = 64;
function emptyRoom() {
  return { id: null, peers: [], startedAt: null };
}

// src/shared/plan.ts
var PLAN_TOKEN = /(?:^|\s)\/plan(?=\s|$)/i;
function readPlanCommand(text) {
  const match = PLAN_TOKEN.exec(text);
  if (!match) return { planning: false, text };
  const cut = text.slice(0, match.index) + text.slice(match.index + match[0].length);
  return { planning: true, text: cut.trim() };
}
var PLAN_INSTRUCTIONS = [
  "This thread is in plan mode. Read whatever you need to, then write the plan and stop there.",
  "Do not create, edit, or delete files, and do not run anything that changes the project.",
  "Reply with the plan itself: what you would change, file by file, in the order you would do it.",
  "Someone reads it next and presses Implement plan when they want the work done."
].join(" ");
var IMPLEMENT_PROMPT = "Implement the plan.";

// src/shared/llm.ts
function resolveSettings(fields, settings) {
  const out = {};
  for (const field of fields) {
    const chosen = settings[field.key];
    const valid = field.options.some((option) => option.value === chosen);
    out[field.key] = valid ? chosen : field.default;
  }
  return out;
}
function agentId(ownerName, instanceId) {
  return `${ownerName.trim().toLowerCase()}/${instanceId}`;
}
function mentionsIn(text, agents) {
  let work = ` ${text.toLowerCase()} `;
  const ids = [];
  const ordered = [...agents].sort((a, b) => b.label.length - a.label.length);
  for (const agent of ordered) {
    if (agent.status === "offline") continue;
    const needle = `@${agent.label.toLowerCase()}`;
    const at = work.indexOf(needle);
    if (at === -1) continue;
    if (/[\w-]/.test(work[at + needle.length])) continue;
    ids.push(agent.id);
    work = work.slice(0, at) + " ".repeat(needle.length) + work.slice(at + needle.length);
  }
  return ids;
}
function agentMentionRefsIn(text, agents) {
  const here = agents.map((agent) => ({ ...agent, status: "idle" }));
  const labels = new Map(agents.map((agent) => [agent.id, agent.label]));
  return mentionsIn(text, here).map((id) => ({ id, label: labels.get(id) }));
}

// src/shared/people.ts
function memberMentionRefsIn(text, members) {
  let work = ` ${text.toLowerCase()} `;
  const refs = [];
  const ordered = [...members].sort((a, b) => b.name.length - a.name.length);
  for (const member of ordered) {
    const needle = `@${member.name.toLowerCase()}`;
    const at = work.indexOf(needle);
    if (at === -1) continue;
    if (/[\w-]/.test(work[at + needle.length])) continue;
    refs.push({ id: member.id, name: member.name });
    work = work.slice(0, at) + " ".repeat(needle.length) + work.slice(at + needle.length);
  }
  return refs;
}

// src/shared/urls.ts
function normalizeUrl(input) {
  const trimmed = input.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/\s/.test(trimmed) || !trimmed.includes(".")) {
    return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
  }
  return `https://${trimmed}`;
}

// src/shared/toolbox.ts
var TOOL_MARKS = [
  "globe",
  "window",
  "link",
  "search",
  "terminal",
  "prompt",
  "folder",
  "file",
  "doc",
  "clipboard",
  "checklist",
  "archive",
  "photo",
  "film",
  "music",
  "speaker",
  "desktop",
  "cloud",
  "signal",
  "chat",
  "people",
  "star",
  "clock",
  "eye"
];
var DEFAULT_MARK = "star";
var NAME_LIMIT = 24;
var COMMAND_LIMIT = 500;
var PATH_LIMIT = 500;
var PROMPT_LIMIT = 2e3;
var COPY_LIMIT = 2e3;
var KEY_LIMIT = 200;
var MARK_LIMIT = 16;
var EMOJI = /^\p{Extended_Pictographic}[\p{Extended_Pictographic}\u200d\ufe0f\u{1f3fb}-\u{1f3ff}]*$/u;
var KEYCAP = /^[0-9#*]\ufe0f?\u{20e3}$/u;
function cleanMark(mark) {
  if (TOOL_MARKS.includes(mark)) return mark;
  if (typeof mark !== "string" || mark.length > MARK_LIMIT) return DEFAULT_MARK;
  return EMOJI.test(mark) || KEYCAP.test(mark) ? mark : DEFAULT_MARK;
}
function cleanTool(name, mark, action) {
  const cleanName = name.trim().slice(0, NAME_LIMIT);
  if (!cleanName) return null;
  const built = (clean) => ({ name: cleanName, mark: cleanMark(mark), action: clean });
  if (action?.kind === "web") {
    const url = action.url?.trim();
    if (!url) return null;
    const open = { kind: "web", url: normalizeUrl(url) };
    return built(action.external ? { ...open, external: true } : open);
  }
  if (action?.kind === "terminal") {
    const command = action.command?.trim().slice(0, COMMAND_LIMIT);
    return built({ kind: "terminal", command: command || void 0 });
  }
  if (action?.kind === "file") {
    const path2 = action.path?.trim().slice(0, PATH_LIMIT);
    if (!path2) return null;
    return built({ kind: "file", path: path2 });
  }
  if (action?.kind === "doc") {
    const page = action.page?.trim().slice(0, KEY_LIMIT);
    if (!page) return null;
    return built({ kind: "doc", page });
  }
  if (action?.kind === "board") {
    const boardId = action.boardId?.trim().slice(0, KEY_LIMIT);
    if (!boardId) return null;
    return built({ kind: "board", boardId });
  }
  if (action?.kind === "copy") {
    const text = action.text?.slice(0, COPY_LIMIT);
    if (!text?.trim()) return null;
    return built({ kind: "copy", text });
  }
  if (action?.kind === "prompt") {
    const text = action.text?.trim().slice(0, PROMPT_LIMIT);
    if (!text) return null;
    const ask = { kind: "prompt", text };
    return built(action.agentId ? { ...ask, agentId: action.agentId } : ask);
  }
  return null;
}

// src/shared/reactions.ts
var SINGLE_EMOJI = new RegExp("^\\p{RGI_Emoji}$", "v");
function isReactionEmoji(value) {
  return value.length > 0 && value.length <= 32 && SINGLE_EMOJI.test(value);
}
function messageReactionTarget(messageId) {
  return `message:${messageId}`;
}
function agentStepReactionTarget(promptId, stepId) {
  return `agent-step:${promptId}:${stepId}`;
}
function agentEndReactionTarget(promptId) {
  return `agent-end:${promptId}`;
}

// src/shared/design.ts
var DESIGN_COLORS = [
  "black",
  "grey",
  "light-violet",
  "violet",
  "blue",
  "light-blue",
  "yellow",
  "orange",
  "green",
  "light-green",
  "light-red",
  "red",
  "white"
];
var DESIGN_COLOR_CHOICES = DESIGN_COLORS.filter(
  (color) => color !== "violet" && color !== "light-violet"
);
var CREW_SWATCHES = [
  { name: "Sunken", hex: "#0d0d0d" },
  { name: "Background", hex: "#141414" },
  { name: "Raised", hex: "#222222" },
  { name: "Border", hex: "#272727" },
  { name: "Hairline", hex: "#ffffff14" },
  { name: "White", hex: "#ffffff" },
  { name: "Secondary", hex: "#b3b3b3" },
  { name: "Muted", hex: "#707070" },
  { name: "Faint", hex: "#4a4a4a" },
  { name: "Positive", hex: "#4ade80" },
  { name: "Danger", hex: "#f87171" }
];
var DESIGN_STYLE_DEFAULTS = { font: "sans", dash: "solid", spline: "line" };
var BOARD_ID = /^[a-z0-9][a-z0-9-]*$/;
function richTextOf(text) {
  const content = text.split("\n").map((line) => {
    if (!line) return { type: "paragraph" };
    return { type: "paragraph", content: [{ type: "text", text: line }] };
  });
  return { type: "doc", content };
}
function plainTextOf(richText) {
  const doc = richText;
  if (!doc?.content) return "";
  return doc.content.map((p) => (p.content ?? []).map((s) => s.text ?? "").join("")).join("\n");
}
function resolveBoardRef(boards, ref) {
  if (boards.some((board) => board.id === ref.id)) return ref.id;
  const name = ref.name.toLowerCase();
  return boards.find((board) => board.name.toLowerCase() === name)?.id ?? null;
}
var DESIGN_NODE_GUIDE = [
  `## Designing real interfaces`,
  ``,
  `The shape kinds above are sketching tools. When you are asked to design an interface, a screen, a component, or anything that should look finished, use nodes instead. A node is a box with real design properties: any hex color, gradients, corner radius, borders, shadows, blur, typography, and auto layout.`,
  ``,
  `  {"op":"node","x":0,"y":0,"w":360,"h":220,"name":"Card",`,
  `   "radius":20,`,
  `   "fills":[{"type":"solid","color":"#141414","opacity":1}],`,
  `   "strokes":[{"color":"#ffffff14","weight":1,"align":"inside","style":"solid"}],`,
  `   "effects":[{"type":"shadow","x":0,"y":8,"blur":24,"spread":-4,"color":"#00000059"}],`,
  `   "layout":{"direction":"column","gap":12,"padding":[20,20,20,20],"align":"start","justify":"start"}}`,
  ``,
  `  {"op":"node","x":20,"y":20,"w":280,"name":"Title","text":"Weekly revenue",`,
  `   "fills":[],`,
  `   "type":{"family":"sans","size":20,"weight":600,"lineHeight":1.3,"color":"#ffffff"}}`,
  ``,
  `  {"op":"set","id":"shape:abc","radius":[20,20,0,0],"fills":[{"type":"linear","angle":160,"stops":[{"color":"#1e293b","at":0},{"color":"#0f172a","at":1}],"opacity":1}]}`,
  ``,
  `Shapes: rect, ellipse, triangle, diamond, pentagon, hexagon, star. A node is a rect unless you say otherwise, and only a rect takes a corner radius or auto layout.`,
  `Paints: solid, linear, radial. Fills are a stack, first paint is on top.`,
  `Effects: shadow, inner-shadow, layer-blur, background-blur.`,
  `Radius takes one number or four: [topLeft, topRight, bottomRight, bottomLeft].`,
  `Layout direction row or column turns a node into an auto layout container: children flow with gap and padding instead of being placed by hand. Use it for anything stacked or in a row.`,
  `Colors are 6 or 8 digit hex. The 8th and 7th digits are alpha, so #ffffff14 is a faint white line.`,
  `Set "clip":true to hide anything overflowing, which is how you mask an image to a rounded corner.`,
  ``,
  `## Taste rules`,
  ``,
  `Follow these unless you are asked for something else. They are the difference between a wireframe and a design.`,
  ``,
  `1. Space on a scale of 4. Use 4, 8, 12, 16, 20, 24, 32, 48, 64. Never invent 13 or 27.`,
  `2. Pick one type ramp and stay in it. For example 32/600 display, 20/600 title, 14/400 body, 12/500 label, 11/500 caption. Body text is never bold. Long text sits at lineHeight 1.5, headings at 1.2.`,
  `3. Build depth with value, not with borders. Layer a slightly lighter surface on a darker one. Use one hairline border at most, around #ffffff14 on dark and #00000014 on light.`,
  `4. Use crew's palette. Surfaces ${CREW_SWATCHES.slice(0, 4).map((s) => s.hex).join(", ")}. Text #ffffff, #b3b3b3, #707070, #4a4a4a. Hairlines #ffffff14. White is the only action color, so a primary button is a white fill with #141414 text. #4ade80 and #f87171 are status only. No purple, no pink, no invented hue.`,
  `5. Body text needs real contrast against its background. Secondary text is dimmer, never smaller than 12.`,
  `6. Corner radius is consistent across a screen. Nested radius is smaller than its parent, roughly parent radius minus the padding.`,
  `7. Shadows are soft, low opacity, and pushed down. y is positive, blur is large, spread is negative or zero. No hard black shadows.`,
  `8. A background blur needs something behind it. Put a gradient or an image under a blurred panel or it reads as flat grey.`,
  `9. Align to a grid. Things that belong together share an edge.`,
  `10. Give every node a name that says what it is, like "Nav" or "Price row", not "Rectangle 4".`,
  ``,
  `## How to work`,
  ``,
  `Start with the outermost frame and its background, then lay in the major regions, then the content inside them, then the detail. Read the board back after each stage so you are placing things against real positions rather than guesses. Do not draw a grey box and call it done.`
].join("\n");

// src/server/designops.ts
import { randomBytes } from "node:crypto";

// src/shared/designNode.ts
var NODE_SHAPES = ["rect", "ellipse", "triangle", "diamond", "pentagon", "hexagon", "star"];
var NO_LAYOUT = {
  direction: "none",
  gap: 0,
  padding: [0, 0, 0, 0],
  align: "start",
  justify: "start",
  wrap: false,
  sizeW: "fixed",
  sizeH: "fixed"
};
var BASE_TYPE = {
  family: "sans",
  size: 14,
  weight: 400,
  lineHeight: 1.5,
  spacing: 0,
  align: "left",
  vertical: "top",
  color: "#ffffff",
  transform: "none",
  decoration: "none",
  italic: false
};
function solid(color) {
  return { type: "solid", color, opacity: 1, visible: true };
}
function corner(value) {
  return [value, value, value, value];
}
function nodeDefaults() {
  return {
    w: 200,
    h: 120,
    name: "Frame",
    shape: "rect",
    radius: corner(0),
    fills: [solid("#222222")],
    strokes: [],
    effects: [],
    layout: { ...NO_LAYOUT },
    text: "",
    type: { ...BASE_TYPE },
    clip: false,
    mask: false,
    blend: "normal",
    component: "",
    instanceOf: ""
  };
}
function cleanNodeShape(value) {
  return NODE_SHAPES.includes(value) ? value : null;
}
var HEX = /^#[0-9a-fA-F]{6}$|^#[0-9a-fA-F]{8}$/;
function isHex(value) {
  return typeof value === "string" && HEX.test(value);
}
function clamp(value, low, high, fallback) {
  return typeof value === "number" && isFinite(value) ? Math.min(high, Math.max(low, value)) : fallback;
}
function cleanStops(value) {
  if (!Array.isArray(value)) return [];
  const stops = value.filter((stop) => isHex(stop?.color)).map((stop) => ({ color: stop.color, at: clamp(stop.at, 0, 1, 0) }));
  return stops.length >= 2 ? stops : [];
}
function cleanPaint(value) {
  const paint = value;
  if (!paint || typeof paint !== "object") return null;
  const opacity = clamp(paint.opacity, 0, 1, 1);
  const visible = paint.visible !== false;
  if (paint.type === "solid") {
    return isHex(paint.color) ? { type: "solid", color: paint.color, opacity, visible } : null;
  }
  if (paint.type === "linear") {
    const stops = cleanStops(paint.stops);
    if (stops.length === 0) return null;
    return { type: "linear", angle: clamp(paint.angle, -360, 360, 180), stops, opacity, visible };
  }
  if (paint.type === "radial") {
    const stops = cleanStops(paint.stops);
    return stops.length === 0 ? null : { type: "radial", stops, opacity, visible };
  }
  return null;
}
function cleanStroke(value) {
  const stroke = value;
  if (!stroke || typeof stroke !== "object" || !isHex(stroke.color)) return null;
  return {
    color: stroke.color,
    weight: clamp(stroke.weight, 0, 200, 1),
    align: stroke.align === "center" || stroke.align === "outside" ? stroke.align : "inside",
    style: stroke.style === "dashed" || stroke.style === "dotted" ? stroke.style : "solid",
    visible: stroke.visible !== false
  };
}
function cleanEffect(value) {
  const effect = value;
  if (!effect || typeof effect !== "object") return null;
  const visible = effect.visible !== false;
  if (effect.type === "layer-blur" || effect.type === "background-blur") {
    return { type: effect.type, blur: clamp(effect.blur, 0, 200, 8), visible };
  }
  if (effect.type === "shadow" || effect.type === "inner-shadow") {
    const shadow = effect;
    return {
      type: effect.type,
      x: clamp(shadow.x, -400, 400, 0),
      y: clamp(shadow.y, -400, 400, 4),
      blur: clamp(shadow.blur, 0, 400, 12),
      spread: clamp(shadow.spread, -400, 400, 0),
      color: isHex(shadow.color) ? shadow.color : "#00000040",
      visible
    };
  }
  return null;
}
function cleanCorner(value) {
  if (typeof value === "number" && isFinite(value)) return corner(Math.max(0, value));
  if (!Array.isArray(value) || value.length !== 4) return null;
  return value.map((part) => clamp(part, 0, 9999, 0));
}
function cleanLayout(value) {
  const layout = value;
  if (!layout || typeof layout !== "object") return null;
  const direction = layout.direction;
  const padding = Array.isArray(layout.padding) ? layout.padding.map((part) => clamp(part, 0, 9999, 0)) : typeof layout.padding === "number" ? corner(layout.padding) : NO_LAYOUT.padding;
  const sizing = (value2, fallback) => value2 === "hug" || value2 === "fill" || value2 === "fixed" ? value2 : fallback;
  return {
    direction: direction === "row" || direction === "column" ? direction : "none",
    gap: clamp(layout.gap, 0, 9999, 0),
    padding: padding.length === 4 ? padding : NO_LAYOUT.padding,
    align: layout.align === "center" || layout.align === "end" ? layout.align : "start",
    justify: layout.justify === "center" || layout.justify === "end" || layout.justify === "between" ? layout.justify : "start",
    wrap: layout.wrap === true,
    sizeW: sizing(layout.sizeW, "fixed"),
    sizeH: sizing(layout.sizeH, "fixed")
  };
}
function cleanType(value) {
  const type = value;
  if (!type || typeof type !== "object") return null;
  return {
    family: typeof type.family === "string" && type.family ? type.family : BASE_TYPE.family,
    size: clamp(type.size, 1, 800, BASE_TYPE.size),
    weight: clamp(type.weight, 100, 900, BASE_TYPE.weight),
    lineHeight: clamp(type.lineHeight, 0.5, 4, BASE_TYPE.lineHeight),
    spacing: clamp(type.spacing, -20, 100, BASE_TYPE.spacing),
    align: type.align === "center" || type.align === "right" ? type.align : "left",
    vertical: type.vertical === "middle" || type.vertical === "bottom" ? type.vertical : "top",
    color: isHex(type.color) ? type.color : BASE_TYPE.color,
    transform: type.transform === "upper" || type.transform === "lower" ? type.transform : "none",
    decoration: type.decoration === "underline" || type.decoration === "strike" ? type.decoration : "none",
    italic: type.italic === true
  };
}

// src/server/nodeops.ts
function list(value, clean) {
  if (!Array.isArray(value)) return null;
  const out = [];
  for (const item of value) {
    const cleaned = clean(item);
    if (cleaned) out.push(cleaned);
  }
  return out;
}
function nodePropsFrom(input, base = nodeDefaults()) {
  const next = {
    ...base,
    radius: [...base.radius],
    fills: [...base.fills],
    strokes: [...base.strokes],
    effects: [...base.effects],
    layout: { ...base.layout },
    type: { ...base.type }
  };
  if (typeof input.w === "number" && input.w > 0) next.w = input.w;
  if (typeof input.h === "number" && input.h > 0) next.h = input.h;
  if (typeof input.name === "string") next.name = input.name;
  if (typeof input.text === "string") next.text = input.text;
  if (typeof input.blend === "string") next.blend = input.blend;
  if (typeof input.clip === "boolean") next.clip = input.clip;
  if (typeof input.mask === "boolean") next.mask = input.mask;
  const shape = cleanNodeShape(input.shape);
  if (shape) next.shape = shape;
  const radius = cleanCorner(input.radius);
  if (radius) next.radius = radius;
  const fills = list(input.fills, cleanPaint);
  if (fills) next.fills = fills;
  const strokes = list(input.strokes, cleanStroke);
  if (strokes) next.strokes = strokes;
  const effects = list(input.effects, cleanEffect);
  if (effects) next.effects = effects;
  const layout = cleanLayout(input.layout);
  if (layout) next.layout = layout;
  const type = cleanType(input.type);
  if (type) next.type = type;
  return next;
}
function nodeErrors(input) {
  if (input.shape !== void 0 && !cleanNodeShape(input.shape)) {
    return "shape must be rect, ellipse, triangle, diamond, pentagon, hexagon or star";
  }
  if (input.fills !== void 0 && !Array.isArray(input.fills)) return "fills must be an array of paints";
  if (input.strokes !== void 0 && !Array.isArray(input.strokes)) return "strokes must be an array";
  if (input.effects !== void 0 && !Array.isArray(input.effects)) return "effects must be an array";
  if (Array.isArray(input.radius) && input.radius.length !== 4) return "radius must be a number or four numbers";
  return null;
}

// src/server/designops.ts
var GEO_KINDS = /* @__PURE__ */ new Set([
  "rectangle",
  "ellipse",
  "triangle",
  "diamond",
  "star",
  "cloud",
  "hexagon",
  "oval",
  "x-box",
  "check-box"
]);
var FILLS = /* @__PURE__ */ new Set(["none", "semi", "solid", "pattern"]);
var COLORS = new Set(DESIGN_COLORS);
var INDEX_DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
function newShapeId() {
  return `shape:${randomBytes(8).toString("hex")}`;
}
function indexAbove(top) {
  if (!top) return "a1";
  const last = top[top.length - 1];
  const at = INDEX_DIGITS.indexOf(last);
  if (at === -1 || last === "z") return `${top}1`;
  return top.slice(0, -1) + INDEX_DIGITS[at + 1];
}
function pageIdOf(document) {
  for (const [id] of Object.entries(document.store)) {
    if (id.startsWith("page:")) return id;
  }
  return null;
}
function topIndexOn(document, parentId) {
  let top = null;
  for (const record of Object.values(document.store)) {
    const shape = record;
    if (shape.typeName !== "shape" || shape.parentId !== parentId) continue;
    if (typeof shape.index === "string" && (top === null || shape.index > top)) top = shape.index;
  }
  return top;
}
function baseProps(color, fill, text) {
  return {
    dash: DESIGN_STYLE_DEFAULTS.dash,
    url: "",
    growY: 0,
    scale: 1,
    labelColor: "black",
    color,
    fill,
    size: "m",
    font: DESIGN_STYLE_DEFAULTS.font,
    align: "middle",
    verticalAlign: "middle",
    richText: richTextOf(text)
  };
}
function propsFor(kind, op) {
  const color = op.color && COLORS.has(op.color) ? op.color : "black";
  const fill = op.fill && FILLS.has(op.fill) ? op.fill : "none";
  const text = op.text ?? "";
  const w = op.w && op.w > 0 ? op.w : 200;
  const h = op.h && op.h > 0 ? op.h : kind === "frame" ? 200 : 120;
  if (GEO_KINDS.has(kind)) return { ...baseProps(color, fill, text), geo: kind, w, h };
  switch (kind) {
    case "text":
      return {
        color,
        size: "m",
        font: DESIGN_STYLE_DEFAULTS.font,
        textAlign: "start",
        w: op.w && op.w > 0 ? op.w : 300,
        richText: richTextOf(text),
        scale: 1,
        autoSize: op.w === void 0
      };
    case "note":
      return {
        color: op.color && COLORS.has(op.color) ? op.color : "yellow",
        labelColor: "black",
        size: "m",
        font: DESIGN_STYLE_DEFAULTS.font,
        fontSizeAdjustment: null,
        align: "middle",
        verticalAlign: "middle",
        growY: 0,
        url: "",
        richText: richTextOf(text),
        scale: 1,
        textLastEditedBy: null
      };
    case "frame":
      return { w, h, name: op.name ?? op.text ?? "Frame", color: "black" };
    case "arrow":
      return {
        kind: "arc",
        labelColor: "black",
        color,
        fill,
        dash: DESIGN_STYLE_DEFAULTS.dash,
        size: "m",
        arrowheadStart: "none",
        arrowheadEnd: "arrow",
        font: DESIGN_STYLE_DEFAULTS.font,
        start: { x: 0, y: 0 },
        end: { x: (op.endX ?? op.x + 200) - op.x, y: (op.endY ?? op.y) - op.y },
        bend: 0,
        richText: richTextOf(text),
        labelPosition: 0.5,
        scale: 1,
        elbowMidPoint: 0.5
      };
    case "line":
      return {
        color,
        dash: DESIGN_STYLE_DEFAULTS.dash,
        size: "m",
        spline: DESIGN_STYLE_DEFAULTS.spline,
        points: {
          a1: { id: "a1", index: "a1", x: 0, y: 0 },
          a2: { id: "a2", index: "a2", x: (op.endX ?? op.x + 200) - op.x, y: (op.endY ?? op.y) - op.y }
        },
        scale: 1
      };
    default:
      return {};
  }
}
var SHAPE_TYPE = {
  text: "text",
  note: "note",
  frame: "frame",
  arrow: "arrow",
  line: "line"
};
function typeFor(kind) {
  if (GEO_KINDS.has(kind)) return "geo";
  return SHAPE_TYPE[kind] ?? null;
}
function shapeAt(document, id) {
  const record = document.store[id];
  return record && record.typeName === "shape" ? record : null;
}
function childrenOf(document, id) {
  const out = [];
  for (const [recordId, record] of Object.entries(document.store)) {
    const shape = record;
    if (shape.typeName === "shape" && shape.parentId === id) {
      out.push(recordId, ...childrenOf(document, recordId));
    }
  }
  return out;
}
function applyCreate(document, op, applied) {
  const type = typeFor(op.kind);
  if (!type) {
    applied.results.push({ error: `Unknown shape kind: ${String(op.kind)}` });
    return;
  }
  if (typeof op.x !== "number" || typeof op.y !== "number" || !isFinite(op.x) || !isFinite(op.y)) {
    applied.results.push({ error: "x and y must be numbers" });
    return;
  }
  const parentId = op.parent && shapeAt(document, op.parent)?.type === "frame" ? op.parent : pageIdOf(document);
  if (!parentId) {
    applied.results.push({ error: "Board has no page yet. Open it in the app first." });
    return;
  }
  const record = {
    id: newShapeId(),
    typeName: "shape",
    type,
    x: op.x,
    y: op.y,
    rotation: 0,
    index: indexAbove(topIndexOn(document, parentId)),
    parentId,
    isLocked: false,
    opacity: 1,
    meta: {},
    props: propsFor(op.kind, op)
  };
  document.store[record.id] = record;
  applied.put.push(record);
  applied.results.push({ id: record.id });
  applied.cursors.push({ x: op.x, y: op.y });
}
function applyUpdate(document, op, applied) {
  const shape = shapeAt(document, op.id);
  if (!shape) {
    applied.results.push({ error: `No shape ${op.id}` });
    return;
  }
  const next = { ...shape, props: { ...shape.props } };
  if (typeof op.x === "number" && isFinite(op.x)) next.x = op.x;
  if (typeof op.y === "number" && isFinite(op.y)) next.y = op.y;
  if (typeof op.w === "number" && op.w > 0 && "w" in next.props) next.props.w = op.w;
  if (typeof op.h === "number" && op.h > 0 && "h" in next.props) next.props.h = op.h;
  if (typeof op.text === "string" && "richText" in next.props) next.props.richText = richTextOf(op.text);
  if (op.color && COLORS.has(op.color) && "color" in next.props) next.props.color = op.color;
  if (op.fill && FILLS.has(op.fill) && "fill" in next.props) next.props.fill = op.fill;
  if (typeof op.name === "string" && shape.type === "frame") next.props.name = op.name;
  document.store[op.id] = next;
  applied.put.push(next);
  applied.results.push({ id: op.id });
  applied.cursors.push({ x: next.x, y: next.y });
}
function applyNode(document, op, applied) {
  if (typeof op.x !== "number" || typeof op.y !== "number" || !isFinite(op.x) || !isFinite(op.y)) {
    applied.results.push({ error: "x and y must be numbers" });
    return;
  }
  const invalid = nodeErrors(op);
  if (invalid) {
    applied.results.push({ error: invalid });
    return;
  }
  const parent = op.parent ? shapeAt(document, op.parent) : null;
  const parentId = parent && (parent.type === "frame" || parent.type === "design-node") ? op.parent : pageIdOf(document);
  if (!parentId) {
    applied.results.push({ error: "Board has no page yet. Open it in the app first." });
    return;
  }
  const record = {
    id: newShapeId(),
    typeName: "shape",
    type: "design-node",
    x: op.x,
    y: op.y,
    rotation: 0,
    index: indexAbove(topIndexOn(document, parentId)),
    parentId,
    isLocked: false,
    opacity: 1,
    meta: {},
    props: nodePropsFrom(op)
  };
  document.store[record.id] = record;
  applied.put.push(record);
  applied.results.push({ id: record.id });
  applied.cursors.push({ x: op.x, y: op.y });
}
function applySet(document, op, applied) {
  const shape = shapeAt(document, op.id);
  if (!shape) {
    applied.results.push({ error: `No shape ${op.id}` });
    return;
  }
  if (shape.type !== "design-node") {
    applied.results.push({ error: `${op.id} is not a design node. Use "update" for older shapes.` });
    return;
  }
  const invalid = nodeErrors(op);
  if (invalid) {
    applied.results.push({ error: invalid });
    return;
  }
  const next = {
    ...shape,
    props: nodePropsFrom(op, shape.props)
  };
  if (typeof op.x === "number" && isFinite(op.x)) next.x = op.x;
  if (typeof op.y === "number" && isFinite(op.y)) next.y = op.y;
  document.store[op.id] = next;
  applied.put.push(next);
  applied.results.push({ id: op.id });
  applied.cursors.push({ x: next.x, y: next.y });
}
function applyDelete(document, op, applied) {
  const shape = shapeAt(document, op.id);
  if (!shape) {
    applied.results.push({ error: `No shape ${op.id}` });
    return;
  }
  applied.cursors.push({ x: shape.x, y: shape.y });
  for (const id of [op.id, ...childrenOf(document, op.id)]) {
    delete document.store[id];
    applied.remove.push(id);
  }
  applied.results.push({ id: op.id });
}
function applyDesignOps(document, ops) {
  const applied = { put: [], remove: [], results: [], cursors: [] };
  for (const op of ops) {
    if (!op || typeof op !== "object") {
      applied.results.push({ error: "Not an op" });
      continue;
    }
    if (op.op === "create") applyCreate(document, op, applied);
    else if (op.op === "node") applyNode(document, op, applied);
    else if (op.op === "set") applySet(document, op, applied);
    else if (op.op === "update") applyUpdate(document, op, applied);
    else if (op.op === "delete") applyDelete(document, op, applied);
    else if (op.op === "point" && typeof op.x === "number" && typeof op.y === "number") {
      applied.results.push({});
      applied.cursors.push({ x: op.x, y: op.y });
    } else applied.results.push({ error: `Unknown op: ${String(op.op)}` });
  }
  return applied;
}
function boardSummary(id, name, document) {
  const shapes = [];
  if (document) {
    for (const record of Object.values(document.store)) {
      const shape = record;
      if (shape.typeName !== "shape") continue;
      const props = shape.props ?? {};
      const parent = shape.parentId?.startsWith("shape:") ? shape.parentId : void 0;
      if (shape.type === "design-node") {
        shapes.push({ id: shape.id, kind: "node", x: shape.x, y: shape.y, parentId: parent, ...props });
        continue;
      }
      shapes.push({
        id: shape.id,
        kind: shape.type === "geo" ? props.geo : shape.type,
        x: shape.x,
        y: shape.y,
        w: props.w,
        h: props.h,
        text: shape.type === "frame" ? props.name : "richText" in props ? plainTextOf(props.richText) : void 0,
        color: props.color,
        fill: props.fill,
        parentId: parent
      });
    }
  }
  return { id, name, shapes };
}

// src/server/session.ts
var THREAD_STATUSES = /* @__PURE__ */ new Set(["open", "done", "archived"]);
var SNAPSHOT_EVENT_LIMIT = 500;
var CONTEXT_EVENT_LIMIT = 20;
var MAX_DOC_PROMPT_CHARS = 8e3;
var TITLE_LIMIT = 80;
var LABEL_LIMIT = 40;
var CANCEL_REPORT_TIMEOUT_MS = 15e3;
var RESUME_GRACE_MS = 6e4;
var STEP_FLUSH_MS = 80;
var DESIGN_SAVE_MS = 500;
var DESIGN_CURSOR_STEP_MS = 140;
var DESIGN_CURSOR_STEPS_MAX = 25;
var CrewSession = class {
  constructor(store, opts = {}) {
    this.store = store;
    this.cancelTimeoutMs = opts.cancelTimeoutMs ?? CANCEL_REPORT_TIMEOUT_MS;
    this.resumeGraceMs = opts.resumeGraceMs ?? RESUME_GRACE_MS;
    this.stepFlushMs = opts.stepFlushMs ?? STEP_FLUSH_MS;
    const persisted = store.loadSession();
    this.code = persisted?.code ?? randomBytes2(3).toString("hex");
    this.createdAt = persisted?.createdAt ?? Date.now();
    for (const m of persisted?.members ?? []) {
      this.members.set(m.name.toLowerCase(), { id: m.id, name: m.name, connections: /* @__PURE__ */ new Set() });
    }
    for (const id of persisted?.removedAgents ?? []) this.removedAgents.add(id);
    for (const a of persisted?.agents ?? []) {
      if (this.removedAgents.has(a.id)) continue;
      this.agents.set(a.id, {
        ...a,
        settings: a.settings ?? {},
        fields: a.fields ?? [],
        runner: null,
        running: /* @__PURE__ */ new Set(),
        runs: /* @__PURE__ */ new Map(),
        dropTimer: null
      });
    }
    const loaded = store.loadEvents();
    const deleted = new Set(loaded.filter((e) => e.kind === "message.deleted").map((e) => e.messageId));
    const deletedTargets = new Set([...deleted].map(messageReactionTarget));
    const deletedHuddles = new Set(loaded.filter((e) => e.kind === "huddle.deleted").map((e) => e.huddleId));
    const inDeletedHuddle = (event) => {
      const huddleId = huddleRecordId(event);
      return huddleId !== void 0 && deletedHuddles.has(huddleId);
    };
    const edits = /* @__PURE__ */ new Map();
    for (const event of loaded) {
      if (event.kind === "message.edited") edits.set(event.messageId, event);
    }
    this.events = loaded.filter(
      (e) => e.kind !== "message.deleted" && e.kind !== "message.edited" && e.kind !== "huddle.deleted" && !(e.kind === "message" && deleted.has(e.id)) && !(e.kind === "message.reaction" && deletedTargets.has(e.targetId)) && !inDeletedHuddle(e)
    ).map((e) => {
      if (e.kind !== "message") return e;
      const edit = edits.get(e.id);
      if (!edit) return e;
      return {
        ...e,
        text: edit.text,
        mentionRefs: edit.mentionRefs ?? e.mentionRefs,
        docMentions: edit.docMentions ?? e.docMentions
      };
    });
    for (const event of this.events) {
      if (event.kind === "thread.started") {
        this.threads.set(event.threadId, {
          id: event.threadId,
          agentId: event.agentId,
          agentLabel: event.agentLabel,
          title: event.title,
          createdBy: event.byName,
          status: "open",
          mode: event.mode ?? "build",
          queue: [],
          running: null,
          boardId: event.boardId
        });
      }
      if (event.kind === "thread.plan") {
        const thread = this.threads.get(event.threadId);
        if (thread) thread.plan = event.text;
      }
      if (event.kind === "thread.implement") {
        const thread = this.threads.get(event.threadId);
        if (thread) thread.mode = "build";
      }
      if (event.kind === "thread.archived") {
        const thread = this.threads.get(event.threadId);
        if (thread) thread.status = "archived";
      }
      if (event.kind === "thread.status") {
        const thread = this.threads.get(event.threadId);
        if (thread) thread.status = event.status;
      }
      if (event.kind === "todo.added") {
        this.todos.set(event.todoId, {
          id: event.todoId,
          text: event.text,
          agentId: event.agentId,
          createdBy: event.byName,
          ts: event.ts,
          checked: false
        });
      }
      if (event.kind === "todo.edited") {
        const todo = this.todos.get(event.todoId);
        if (todo) {
          todo.text = event.text;
          todo.agentId = event.agentId;
        }
      }
      if (event.kind === "todo.checked") {
        const todo = this.todos.get(event.todoId);
        if (todo) {
          todo.checked = event.checked;
          todo.checkedTs = event.checked ? event.ts : void 0;
        }
      }
      if (event.kind === "todo.removed" || event.kind === "todo.started") {
        this.todos.delete(event.todoId);
      }
      if (event.kind === "tool.added") {
        this.tools.set(event.toolId, {
          id: event.toolId,
          name: event.name,
          mark: event.mark,
          action: event.action,
          createdBy: event.byName,
          ts: event.ts
        });
      }
      if (event.kind === "tool.edited") {
        const tool = this.tools.get(event.toolId);
        if (tool) {
          tool.name = event.name;
          tool.mark = event.mark;
          tool.action = event.action;
        }
      }
      if (event.kind === "tool.removed") {
        this.tools.delete(event.toolId);
      }
      if (event.kind === "music.added" && this.store.musicPath(event.file)) {
        this.uploads.set(event.trackId, {
          id: event.trackId,
          name: event.name,
          file: event.file,
          seconds: event.seconds,
          by: event.byName,
          ts: event.ts
        });
      }
      if (event.kind === "music.removed") {
        this.uploads.delete(event.trackId);
      }
      if (event.kind === "thread.agent") {
        const thread = this.threads.get(event.threadId);
        if (thread) {
          thread.agentId = event.agentId;
          thread.agentLabel = event.agentLabel;
        }
      }
    }
    const finished = /* @__PURE__ */ new Set();
    for (const event of this.events) {
      if (event.kind === "huddle.ended") finished.add(event.huddleId);
    }
    const lastTs = this.events.at(-1)?.ts ?? Date.now();
    for (const event of [...this.events]) {
      if (event.kind !== "huddle.started" || finished.has(event.huddleId)) continue;
      const close = {
        id: randomUUID(),
        ts: Math.max(event.ts, lastTs),
        kind: "huddle.ended",
        huddleId: event.huddleId,
        ms: Math.max(0, lastTs - event.ts)
      };
      this.events.push(close);
      store.appendEvent(close);
    }
    const ended = /* @__PURE__ */ new Set();
    for (const event of this.events) {
      if (event.kind === "agent.end") ended.add(event.promptId);
    }
    for (const event of [...this.events]) {
      if (event.kind !== "agent.start" || ended.has(event.promptId)) continue;
      const close = {
        id: randomUUID(),
        ts: Date.now(),
        kind: "agent.end",
        promptId: event.promptId,
        agentId: event.agentId,
        agentLabel: event.agentLabel,
        threadId: event.threadId,
        ok: false,
        error: "Interrupted by a restart"
      };
      this.events.push(close);
      store.appendEvent(close);
    }
    for (const [page, doc] of Object.entries(store.loadDocs())) this.docs.set(page, doc);
    for (const [id, design] of Object.entries(store.loadDesigns())) {
      this.designs.set(id, { id, name: design.name, document: design.document, presence: /* @__PURE__ */ new Map(), saveTimer: null });
    }
    for (const [page, title] of Object.entries(store.loadTitles())) {
      this.docTitles.set(page, title);
      const doc = this.docs.get(page);
      if (doc) this.docs.set(page, { title, text: doc.text });
    }
    this.assignPageCodes();
    this.persistMeta();
  }
  code;
  createdAt;
  members = /* @__PURE__ */ new Map();
  agents = /* @__PURE__ */ new Map();
  threads = /* @__PURE__ */ new Map();
  todos = /* @__PURE__ */ new Map();
  tools = /* @__PURE__ */ new Map();
  events = [];
  docs = /* @__PURE__ */ new Map();
  designs = /* @__PURE__ */ new Map();
  designCursorTimers = /* @__PURE__ */ new Map();
  // One huddle per session, keyed by the connection in it: two windows on the
  // same folder are the same member but two separate people in the call.
  huddle = /* @__PURE__ */ new Map();
  huddleStartedAt = null;
  huddleId = null;
  // Everyone the log already names for this call, so coming back to it after a
  // dropped window does not say they joined twice.
  huddleNamed = /* @__PURE__ */ new Set();
  // What is playing, and the moment it was last set, so the position can be
  // worked out for whoever asks. Held in memory the way a call is.
  music = null;
  // The shelf the crew filled itself. Unlike what is playing, this is written
  // down: a track somebody added is still there tomorrow.
  uploads = /* @__PURE__ */ new Map();
  docTitles = /* @__PURE__ */ new Map();
  docRenames = /* @__PURE__ */ new Map();
  meta = /* @__PURE__ */ new Map();
  removedAgents = /* @__PURE__ */ new Set();
  prompts = /* @__PURE__ */ new Map();
  steers = /* @__PURE__ */ new Map();
  emittedMessages = /* @__PURE__ */ new Set();
  cancelTimeoutMs;
  resumeGraceMs;
  stepFlushMs;
  stepFlushes = /* @__PURE__ */ new Map();
  onSyncNeeded = null;
  attach(ws) {
    let greeted = false;
    ws.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (!greeted) {
        if (msg.type !== "hello" || msg.code !== this.code) {
          this.send(ws, { type: "error", message: "Wrong session code" });
          ws.close();
          return;
        }
        greeted = true;
        this.handleHello(ws, msg);
        return;
      }
      this.handleMessage(ws, msg);
    });
    ws.on("close", (code) => this.detach(ws, code));
  }
  snapshot() {
    return {
      code: this.code,
      members: [...this.members.values()].map((m) => ({
        id: m.id,
        name: m.name,
        connected: m.connections.size > 0
      })),
      agents: [...this.agents.values()].map((agent) => this.pooled(agent)),
      events: trimEvents(this.events, SNAPSHOT_EVENT_LIMIT),
      docs: Object.fromEntries(this.docs),
      queues: Object.fromEntries(
        [...this.threads.values()].filter((thread) => thread.queue.length > 0).map((thread) => [thread.id, this.queueItems(thread)])
      ),
      todos: [...this.todos.values()],
      tools: [...this.tools.values()],
      boards: this.boardList(),
      huddle: this.huddleRoom(),
      music: this.musicRoom(),
      musicUploads: [...this.uploads.values()]
    };
  }
  handleHello(ws, msg) {
    const member = this.memberFor(msg.name);
    const wasOffline = member.connections.size === 0;
    member.connections.add(ws);
    this.meta.set(ws, { role: msg.role, memberKey: member.name.toLowerCase(), agentIds: [] });
    this.send(ws, { type: "welcome", selfId: member.id, snapshot: this.snapshot() });
    if (msg.role === "runner") {
      for (const llm of msg.llms) this.registerAgent(ws, member, llm);
      this.reconcileRuns(this.meta.get(ws)?.agentIds ?? [], new Set(msg.running ?? []));
    }
    if (wasOffline) {
      this.emit({ id: randomUUID(), ts: Date.now(), kind: "person.joined", memberId: member.id, name: member.name });
    }
    this.persistMeta();
  }
  handleMessage(ws, msg) {
    const meta = this.meta.get(ws);
    if (!meta) return;
    const member = this.members.get(meta.memberKey);
    if (!member) return;
    switch (msg.type) {
      case "chat.send":
        if (meta.role === "ui") {
          this.handleChat(member, msg.text, msg.mentions, msg.threadId, msg.attachments, msg.boardId, msg.replyTo);
        }
        break;
      case "chat.delete":
        if (meta.role === "ui") this.handleDeleteMessage(member, msg.messageId);
        break;
      case "chat.edit":
        if (meta.role === "ui") this.handleEditMessage(member, msg.messageId, msg.text);
        break;
      case "chat.react":
        if (meta.role === "ui") this.handleReaction(member, msg.targetId, msg.emoji);
        break;
      case "thread.archive":
        if (meta.role === "ui") this.handleThreadStatus(member, msg.threadId, "archived");
        break;
      case "thread.status":
        if (meta.role === "ui") this.handleThreadStatus(member, msg.threadId, msg.status);
        break;
      case "plan.implement":
        if (meta.role === "ui") this.handlePlanImplement(member, msg.threadId);
        break;
      case "todo.add":
        if (meta.role === "ui") this.handleTodoAdd(member, msg.text, msg.agentId);
        break;
      case "todo.edit":
        if (meta.role === "ui") this.handleTodoEdit(member, msg.todoId, msg.text, msg.agentId);
        break;
      case "todo.remove":
        if (meta.role === "ui") this.handleTodoRemove(member, msg.todoId);
        break;
      case "todo.check":
        if (meta.role === "ui") this.handleTodoCheck(member, msg.todoId, msg.checked);
        break;
      case "todo.do":
        if (meta.role === "ui") this.handleTodoDo(member, msg.todoId, msg.agentId);
        break;
      case "tool.add":
        if (meta.role === "ui") this.handleToolAdd(member, msg.name, msg.mark, msg.action);
        break;
      case "tool.edit":
        if (meta.role === "ui") this.handleToolEdit(member, msg.toolId, msg.name, msg.mark, msg.action);
        break;
      case "tool.remove":
        if (meta.role === "ui") this.handleToolRemove(member, msg.toolId);
        break;
      case "doc.update":
        if (meta.role === "ui") this.handleDoc(member, msg.page, msg.text, msg.title);
        break;
      case "doc.retitle":
        if (meta.role === "ui") this.handleDocRetitle(member, msg.page, msg.title);
        break;
      case "doc.title":
        if (meta.role === "ui") this.handleDocTitle(member, msg.page, msg.title);
        break;
      case "doc.rename":
        if (meta.role === "ui") this.handleDocRename(member, msg.from, msg.to, msg.title);
        break;
      case "doc.delete":
        if (meta.role === "ui") this.handleDocDelete(member, msg.page);
        break;
      case "design.create":
        if (meta.role === "ui") this.handleDesignCreate(msg.boardId, msg.name);
        break;
      case "design.rename":
        if (meta.role === "ui") this.handleDesignRename(msg.boardId, msg.name);
        break;
      case "design.delete":
        if (meta.role === "ui") this.handleDesignDelete(msg.boardId);
        break;
      case "design.open":
        if (meta.role === "ui") this.handleDesignOpen(ws, msg.boardId);
        break;
      case "design.peek":
        if (meta.role === "ui") this.handleDesignPeek(ws, msg.boardId);
        break;
      case "design.init":
        if (meta.role === "ui") this.handleDesignInit(msg.boardId, msg.document);
        break;
      case "design.apply":
        if (meta.role === "ui") this.handleDesignApply(ws, msg.boardId, msg.put, msg.remove);
        break;
      case "design.presence":
        if (meta.role === "ui") {
          this.handleDesignPresence(ws, member, msg.boardId, msg.cursor, msg.selection, msg.pageId);
        }
        break;
      case "huddle.join":
        if (meta.role === "ui") this.handleHuddleJoin(ws, member, msg.peerId, msg.muted, msg.camera);
        break;
      case "huddle.leave":
        if (meta.role === "ui") this.handleHuddleLeave(ws);
        break;
      case "huddle.update":
        if (meta.role === "ui") this.handleHuddleUpdate(ws, msg);
        break;
      case "huddle.signal":
        if (meta.role === "ui") this.handleHuddleSignal(ws, msg.to, msg.signal);
        break;
      case "huddle.delete":
        if (meta.role === "ui") this.handleDeleteHuddle(member, msg.huddleId);
        break;
      case "music.set":
        if (meta.role === "ui") this.handleMusicSet(member, msg.trackId, msg.playing, msg.at);
        break;
      case "music.off":
        if (meta.role === "ui") this.handleMusicOff();
        break;
      case "music.add":
        if (meta.role === "ui") this.handleMusicAdd(member, msg.name, msg.mime, msg.seconds, msg.data);
        break;
      case "music.remove":
        if (meta.role === "ui") this.handleMusicRemove(member, msg.trackId);
        break;
      case "queue.edit":
        if (meta.role === "ui") this.handleQueueEdit(member, msg.promptId, msg.text);
        break;
      case "queue.remove":
        if (meta.role === "ui") this.handleQueueRemove(member, msg.promptId);
        break;
      case "prompt.cancel":
        if (meta.role === "ui") this.handleCancel(msg.promptId);
        break;
      case "agent.settings":
        if (meta.role === "ui") this.handleSettings(msg.agentId, msg.settings);
        break;
      case "agent.rename":
        if (meta.role === "ui") this.handleRename(member, msg.agentId, msg.label);
        break;
      case "agent.avatar":
        if (meta.role === "ui") this.handleAvatar(member, msg.agentId, msg.image);
        break;
      case "agent.remove":
        if (meta.role === "ui") this.handleRemove(msg.agentId);
        break;
      case "agent.register":
        if (meta.role === "runner") this.registerAgent(ws, member, msg.llm);
        break;
      case "agent.deregister":
        if (meta.role === "runner") this.deregisterAgent(msg.agentId);
        break;
      case "agent.step":
        if (this.promptGone(ws, meta, msg.promptId)) break;
        this.handleStep(meta, msg.promptId, msg.step);
        break;
      case "agent.usage":
        if (meta.role === "runner") this.handleUsage(meta, msg.agentId, msg.usage);
        break;
      case "agent.tokens":
        if (this.promptGone(ws, meta, msg.promptId)) break;
        this.handleTokens(meta, msg.promptId, msg.tokens);
        break;
      case "agent.steered":
        this.handleSteered(meta, msg.promptId, msg.ok);
        break;
      case "agent.done":
        this.handleDone(meta, msg.promptId, msg.text);
        break;
      case "agent.error":
        this.handleError(meta, msg.promptId, msg.message);
        break;
    }
  }
  handleChat(member, text, mentions, threadId, incoming, boardId, replyTargetId) {
    const command = threadId ? { planning: false, text: text.trim() } : readPlanCommand(text.trim());
    const trimmed = command.text;
    const attachments = this.saveAttachments(incoming);
    if (!trimmed && attachments.length === 0) return;
    const replyTo = this.replyReference(replyTargetId);
    if (threadId) {
      const thread = this.threads.get(threadId);
      if (!thread) return;
      if (thread.status !== "open") this.handleThreadStatus(member, threadId, "open");
      const targets = [...new Set(mentions)].filter((id) => this.agents.has(id));
      if (targets.length === 0) targets.push(thread.agentId);
      const messageId = randomUUID();
      if (!targets.includes(thread.agentId)) this.switchThreadAgent(thread, targets[0], member);
      for (const id of targets) {
        const agent = this.agents.get(id);
        if (!agent) continue;
        this.enqueuePrompt(agent, member, trimmed, threadId, attachments, { messageId, mentions: targets, replyTo });
      }
      return;
    }
    const ids = [...new Set(mentions)].filter((id) => this.agents.has(id));
    const mode = command.planning ? "plan" : "build";
    if (ids.length === 0) {
      const solo = command.planning ? this.soloAgent() : null;
      if (solo) {
        this.startThread(member, solo, trimmed, attachments, { boardId, mode, replyTo });
        return;
      }
      if (command.planning) {
        this.systemMessage("Mention an agent with @ to say who should write the plan.");
        return;
      }
      this.emit({
        id: randomUUID(),
        ts: Date.now(),
        kind: "message",
        authorId: member.id,
        authorName: member.name,
        text: trimmed,
        mentions,
        mentionRefs: this.agentRefs(mentions, trimmed),
        memberMentionRefs: this.memberRefs(trimmed),
        ...this.refsOf(trimmed),
        attachments,
        replyTo
      });
      return;
    }
    for (const id of ids) {
      this.startThread(member, this.agents.get(id), trimmed, attachments, { boardId, mode, mentions: ids, replyTo });
    }
  }
  soloAgent() {
    const here = [...this.agents.values()].filter((agent) => agent.runner);
    return here.length === 1 ? here[0] : null;
  }
  switchThreadAgent(thread, id, member) {
    const agent = this.agents.get(id);
    if (!agent) return;
    thread.agentId = id;
    thread.agentLabel = agent.label;
    this.emit({
      id: randomUUID(),
      ts: Date.now(),
      kind: "thread.agent",
      threadId: thread.id,
      agentId: id,
      agentLabel: agent.label,
      byName: member.name
    });
  }
  startThread(member, agent, text, attachments, opts = {}) {
    const threadId = randomUUID();
    const boardId = opts.boardId;
    const thread = {
      id: threadId,
      agentId: agent.id,
      agentLabel: agent.label,
      title: this.titleFrom(text || attachments.map((a) => a.name).join(", ")),
      createdBy: member.name,
      status: "open",
      mode: opts.mode ?? "build",
      queue: [],
      running: null,
      boardId: boardId && this.designs.has(boardId) ? boardId : void 0
    };
    this.threads.set(threadId, thread);
    this.emit({
      id: randomUUID(),
      ts: Date.now(),
      kind: "thread.started",
      threadId,
      agentId: agent.id,
      agentLabel: agent.label,
      title: thread.title,
      titleRefs: this.agentRefs(opts.mentions ?? [agent.id], thread.title),
      byName: member.name,
      boardId: thread.boardId,
      mode: thread.mode === "plan" ? "plan" : void 0
    });
    this.enqueuePrompt(agent, member, text, threadId, attachments, {
      messageId: randomUUID(),
      mentions: [agent.id],
      replyTo: opts.replyTo
    });
    return threadId;
  }
  handleTodoAdd(member, text, agentId2) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const todo = {
      id: randomUUID(),
      text: trimmed,
      agentId: agentId2,
      createdBy: member.name,
      ts: Date.now(),
      checked: false
    };
    this.todos.set(todo.id, todo);
    this.emit({
      id: randomUUID(),
      ts: todo.ts,
      kind: "todo.added",
      todoId: todo.id,
      text: todo.text,
      agentId: agentId2,
      byName: member.name
    });
  }
  handleTodoEdit(member, todoId, text, agentId2) {
    const todo = this.todos.get(todoId);
    const trimmed = text.trim();
    if (!todo || !trimmed) return;
    if (todo.text === trimmed && todo.agentId === agentId2) return;
    todo.text = trimmed;
    todo.agentId = agentId2;
    this.emit({ id: randomUUID(), ts: Date.now(), kind: "todo.edited", todoId, text: trimmed, agentId: agentId2, byName: member.name });
  }
  handleTodoRemove(member, todoId) {
    if (!this.todos.delete(todoId)) return;
    this.emit({ id: randomUUID(), ts: Date.now(), kind: "todo.removed", todoId, byName: member.name });
  }
  handleTodoCheck(member, todoId, checked) {
    const todo = this.todos.get(todoId);
    if (!todo || todo.checked === checked) return;
    const ts = Date.now();
    todo.checked = checked;
    todo.checkedTs = checked ? ts : void 0;
    this.emit({ id: randomUUID(), ts, kind: "todo.checked", todoId, checked, byName: member.name });
  }
  handleToolAdd(member, name, mark, action) {
    const clean = cleanTool(name, mark, action);
    if (!clean) return;
    const tool = {
      id: randomUUID(),
      name: clean.name,
      mark: clean.mark,
      action: clean.action,
      createdBy: member.name,
      ts: Date.now()
    };
    this.tools.set(tool.id, tool);
    this.emit({
      id: randomUUID(),
      ts: tool.ts,
      kind: "tool.added",
      toolId: tool.id,
      name: tool.name,
      mark: tool.mark,
      action: tool.action,
      byName: member.name
    });
  }
  handleToolEdit(member, toolId, name, mark, action) {
    const tool = this.tools.get(toolId);
    const clean = cleanTool(name, mark, action);
    if (!tool || !clean) return;
    tool.name = clean.name;
    tool.mark = clean.mark;
    tool.action = clean.action;
    this.emit({
      id: randomUUID(),
      ts: Date.now(),
      kind: "tool.edited",
      toolId,
      name: clean.name,
      mark: clean.mark,
      action: clean.action,
      byName: member.name
    });
  }
  handleToolRemove(member, toolId) {
    if (!this.tools.delete(toolId)) return;
    this.emit({ id: randomUUID(), ts: Date.now(), kind: "tool.removed", toolId, byName: member.name });
  }
  // 'Do' is the moment a todo becomes real work: a thread starts with the
  // todo's text as its first prompt, and the todo itself is gone.
  handleTodoDo(member, todoId, agentId2) {
    const todo = this.todos.get(todoId);
    if (!todo || todo.checked) return;
    const agent = this.agents.get(agentId2 ?? todo.agentId ?? "");
    if (!agent) return;
    this.todos.delete(todoId);
    const threadId = this.startThread(member, agent, todo.text, []);
    this.emit({ id: randomUUID(), ts: Date.now(), kind: "todo.started", todoId, threadId, byName: member.name });
  }
  // Two prompts can share one message when it mentioned several agents, so
  // emission is tracked by message, not by queue entry.
  emitThreadMessage(entry) {
    if (this.emittedMessages.has(entry.messageId)) return;
    this.emittedMessages.add(entry.messageId);
    this.emit({
      id: entry.messageId,
      ts: Date.now(),
      kind: "message",
      authorId: entry.authorId,
      authorName: entry.byName,
      text: entry.text,
      mentions: entry.mentions,
      mentionRefs: this.agentRefs(entry.mentions, entry.text),
      memberMentionRefs: this.memberRefs(entry.text),
      docMentions: entry.docMentions,
      boardMentions: entry.boardMentions,
      threadId: entry.threadId,
      attachments: entry.attachments,
      replyTo: entry.replyTo
    });
  }
  refsOf(text) {
    const refs = this.crewRefsIn(text);
    return { docMentions: docMentionsOf(refs), boardMentions: boardMentionsOf(refs) };
  }
  crewRefsIn(text) {
    return refsIn(text, crewRefs(Object.fromEntries(this.docs), this.boardList()));
  }
  memberRefs(text) {
    return memberMentionRefsIn(
      text,
      [...this.members.values()].map((member) => ({ id: member.id, name: member.name }))
    );
  }
  // Pairs the agents a piece of text pointed at with the names they carried
  // when it was written, so the text can be read back under their names today.
  // Every name written in it counts, not only the agents it was routed to: one
  // that was away still gets its mention brought along when it is renamed.
  agentRefs(ids, text = "") {
    const refs = /* @__PURE__ */ new Map();
    const written = agentMentionRefsIn(text, [...this.agents.values()].map((agent) => this.pooled(agent)));
    for (const ref of written) refs.set(ref.id, ref);
    for (const id of ids) {
      const agent = this.agents.get(id);
      if (agent) refs.set(agent.id, { id: agent.id, label: agent.label });
    }
    return [...refs.values()];
  }
  handleDeleteMessage(member, messageId) {
    const index = this.events.findIndex((e) => e.kind === "message" && e.id === messageId);
    if (index === -1) return;
    const event = this.events[index];
    if (event.kind !== "message" || event.authorId !== member.id) return;
    this.events.splice(index, 1);
    const targetId = messageReactionTarget(messageId);
    this.events = this.events.filter((e) => e.kind !== "message.reaction" || e.targetId !== targetId);
    const tombstone = { id: randomUUID(), ts: Date.now(), kind: "message.deleted", messageId };
    this.store.appendEvent(tombstone);
    this.broadcast({ type: "event", event: tombstone });
    this.onSyncNeeded?.();
  }
  // Whoever started a call can take its block out of the chat, and only once the
  // call is over: while it is going the block is the way in, so removing it
  // would take the way in off everyone else's screen mid-call.
  handleDeleteHuddle(member, huddleId) {
    if (this.huddleId === huddleId) return;
    const started = this.events.find((e) => e.kind === "huddle.started" && e.huddleId === huddleId);
    if (!started || started.kind !== "huddle.started" || started.byId !== member.id) return;
    this.events = this.events.filter((e) => huddleRecordId(e) !== huddleId);
    const tombstone = { id: randomUUID(), ts: Date.now(), kind: "huddle.deleted", huddleId };
    this.store.appendEvent(tombstone);
    this.broadcast({ type: "event", event: tombstone });
    this.onSyncNeeded?.();
  }
  handleEditMessage(member, messageId, text) {
    const event = this.events.find((e) => e.kind === "message" && e.id === messageId);
    if (!event || event.kind !== "message") return;
    if (event.authorId !== member.id || event.threadId) return;
    const trimmed = text.trim();
    if (!trimmed || trimmed === event.text) return;
    const { docMentions, boardMentions } = this.refsOf(trimmed);
    const mentionRefs = this.agentRefs([], trimmed);
    const memberMentionRefs = this.memberRefs(trimmed);
    event.text = trimmed;
    event.docMentions = docMentions;
    event.boardMentions = boardMentions;
    event.mentionRefs = mentionRefs;
    event.memberMentionRefs = memberMentionRefs;
    this.emit({
      id: randomUUID(),
      ts: Date.now(),
      kind: "message.edited",
      messageId,
      text: trimmed,
      mentionRefs,
      memberMentionRefs,
      docMentions,
      boardMentions
    });
  }
  handleReaction(member, targetId, emoji) {
    if (!isReactionEmoji(emoji)) return;
    const target = this.reactionTarget(targetId);
    if (!target) return;
    let previous;
    for (let i = this.events.length - 1; i >= 0; i--) {
      const event = this.events[i];
      if (event.kind === "message.reaction" && event.targetId === targetId && event.memberId === member.id && event.emoji === emoji) {
        previous = event;
        break;
      }
    }
    this.emit({
      id: randomUUID(),
      ts: Date.now(),
      kind: "message.reaction",
      targetId,
      targetAuthorId: target.authorId,
      targetAuthorName: target.authorName,
      memberId: member.id,
      memberName: member.name,
      emoji,
      active: !previous?.active,
      threadId: target.threadId
    });
  }
  reactionTarget(targetId) {
    for (let i = this.events.length - 1; i >= 0; i--) {
      const event = this.events[i];
      if (event.kind === "message" && messageReactionTarget(event.id) === targetId) {
        return {
          authorId: event.authorId,
          authorName: event.authorName,
          text: event.text,
          threadId: event.threadId
        };
      }
      if (event.kind === "agent.step" && event.step.kind === "text" && agentStepReactionTarget(event.promptId, event.step.id) === targetId) {
        return {
          authorId: event.agentId,
          authorName: event.agentLabel,
          text: event.step.text ?? "",
          threadId: event.threadId
        };
      }
      if (event.kind === "agent.end" && agentEndReactionTarget(event.promptId) === targetId) {
        return {
          authorId: event.agentId,
          authorName: event.agentLabel,
          text: event.ok ? event.text ?? "" : event.error ?? "",
          threadId: event.threadId
        };
      }
    }
    for (const agent of this.agents.values()) {
      for (const [promptId, run] of agent.runs) {
        for (const entry of run.steps.values()) {
          if (entry.step.kind !== "text" || agentStepReactionTarget(promptId, entry.step.id) !== targetId) {
            continue;
          }
          return {
            authorId: agent.id,
            authorName: agent.label,
            text: entry.step.text ?? "",
            threadId: this.prompts.get(promptId)?.threadId ?? run.entry?.threadId
          };
        }
      }
    }
    return null;
  }
  // A target id already names one message, so where it was said is not part of
  // finding it. Asking for the thread to match as well dropped the quote in
  // silence whenever a reply crossed from a live run into the log.
  replyReference(targetId) {
    if (!targetId) return void 0;
    const target = this.reactionTarget(targetId);
    if (!target) return void 0;
    return {
      targetId,
      authorId: target.authorId,
      authorName: target.authorName,
      text: target.text.replace(/\s+/g, " ").trim().slice(0, 280)
    };
  }
  // Implementing is the moment the thread stops planning: the plan stays on it
  // as the brief, and the agent gets a turn to build it.
  handlePlanImplement(member, threadId) {
    const thread = this.threads.get(threadId);
    if (!thread || thread.mode !== "plan" || !thread.plan) return;
    const agent = this.agents.get(thread.agentId);
    if (!agent) return;
    thread.mode = "build";
    this.emit({ id: randomUUID(), ts: Date.now(), kind: "thread.implement", threadId, byName: member.name });
    if (thread.status !== "open") this.handleThreadStatus(member, threadId, "open");
    this.enqueuePrompt(agent, member, IMPLEMENT_PROMPT, threadId, []);
  }
  handleThreadStatus(member, threadId, status) {
    const thread = this.threads.get(threadId);
    if (!thread || !THREAD_STATUSES.has(status) || thread.status === status) return;
    thread.status = status;
    this.emit({ id: randomUUID(), ts: Date.now(), kind: "thread.status", threadId, status, byName: member.name });
  }
  saveAttachments(incoming) {
    const saved = [];
    for (const item of (incoming ?? []).slice(0, MAX_ATTACHMENTS)) {
      const one = this.saveAttachment(item.mime, item.name, Buffer.from(item.data, "base64"));
      if (one) saved.push(one);
    }
    return saved;
  }
  saveAttachment(mime, name, data) {
    if (!isImageType(mime)) return null;
    if (data.length === 0 || data.length > MAX_ATTACHMENT_BYTES) return null;
    const id = randomUUID();
    const file = `${id}.${extensionFor(mime)}`;
    try {
      this.store.saveAttachment(file, data);
    } catch {
      return null;
    }
    return { id, name: this.safeName(name), mime, size: data.length, file };
  }
  safeName(name) {
    const flat = name.replace(/[\r\n]+/g, " ").trim();
    return flat.slice(0, 120) || "image";
  }
  attachmentPath(file) {
    return this.store.attachmentPath(file);
  }
  assignPageCodes() {
    const taken = new Set([...this.docs.keys()].map(pageCodeOf));
    const pending = [...this.docs.keys()].filter((page) => page !== "main" && !pageCodeOf(page)).sort((a, b) => b.split("/").length - a.split("/").length);
    let titlesChanged = false;
    for (const from of pending) {
      let code = pageCode();
      while (taken.has(code)) code = pageCode();
      taken.add(code);
      const to = `${from}-${code}`;
      try {
        this.store.renameDoc(from, to);
      } catch {
        continue;
      }
      for (const [page, doc] of [...this.docs.entries()]) {
        if (page !== from && !page.startsWith(`${from}/`)) continue;
        this.docs.delete(page);
        this.docs.set(to + page.slice(from.length), doc);
      }
      for (const [page, title] of [...this.docTitles.entries()]) {
        if (page !== from && !page.startsWith(`${from}/`)) continue;
        this.docTitles.delete(page);
        this.docTitles.set(to + page.slice(from.length), title);
        titlesChanged = true;
      }
    }
    if (titlesChanged) this.store.saveTitles(Object.fromEntries(this.docTitles));
  }
  followRenames(page) {
    for (let hops = 0; hops < 5; hops++) {
      if (this.docs.has(page)) return page;
      const hit = [...this.docRenames.entries()].find(
        ([from, move]) => Date.now() - move.ts <= 1e4 && (page === from || page.startsWith(`${from}/`))
      );
      if (!hit) return page;
      page = hit[1].to + page.slice(hit[0].length);
    }
    return page;
  }
  handleDoc(member, page, text, title) {
    page = this.followRenames(page);
    const doc = { title: title ?? this.docs.get(page)?.title ?? fallbackTitle(page), text };
    try {
      this.store.saveDoc(page, doc);
    } catch {
      return;
    }
    this.docs.set(page, doc);
    if (title !== void 0 && this.docTitles.delete(page)) {
      this.store.saveTitles(Object.fromEntries(this.docTitles));
    }
    this.emit(
      { id: randomUUID(), ts: Date.now(), kind: "doc", page, text, title: doc.title, byName: member.name },
      { persist: false }
    );
    this.onSyncNeeded?.();
  }
  handleDocRetitle(member, page, title) {
    page = this.followRenames(page);
    const existing = this.docs.get(page);
    if (!existing || existing.title === title) return;
    const doc = { title, text: existing.text };
    try {
      this.store.saveDoc(page, doc);
    } catch {
      return;
    }
    this.docs.set(page, doc);
    if (this.docTitles.delete(page)) this.store.saveTitles(Object.fromEntries(this.docTitles));
    this.emit(
      { id: randomUUID(), ts: Date.now(), kind: "doc", page, text: doc.text, title, byName: member.name },
      { persist: false }
    );
    this.onSyncNeeded?.();
  }
  handleDocTitle(member, page, title) {
    page = this.followRenames(page);
    const existing = this.docs.get(page);
    if (!existing) return;
    const clean = title.replace(/\s+/g, " ").trim().slice(0, TITLE_LIMIT);
    const doc = { title: clean || fallbackTitle(page), text: existing.text };
    try {
      this.store.saveDoc(page, doc);
    } catch {
      return;
    }
    this.docs.set(page, doc);
    if (clean) this.docTitles.set(page, clean);
    else this.docTitles.delete(page);
    this.store.saveTitles(Object.fromEntries(this.docTitles));
    this.emit(
      { id: randomUUID(), ts: Date.now(), kind: "doc.titled", page, title: clean, byName: member.name },
      { persist: false }
    );
    this.onSyncNeeded?.();
  }
  handleDocDelete(member, page) {
    if (page === "main" || !this.docs.has(page)) return;
    try {
      this.store.deleteDoc(page);
    } catch {
      return;
    }
    for (const key of [...this.docs.keys()]) {
      if (key === page || key.startsWith(`${page}/`)) this.docs.delete(key);
    }
    let titlesChanged = false;
    for (const key of [...this.docTitles.keys()]) {
      if (key === page || key.startsWith(`${page}/`)) {
        this.docTitles.delete(key);
        titlesChanged = true;
      }
    }
    if (titlesChanged) this.store.saveTitles(Object.fromEntries(this.docTitles));
    this.emit(
      { id: randomUUID(), ts: Date.now(), kind: "doc.deleted", page, byName: member.name },
      { persist: false }
    );
    this.onSyncNeeded?.();
  }
  boardList() {
    return [...this.designs.values()].map((board) => ({ id: board.id, name: board.name })).sort((a, b) => a.name.localeCompare(b.name));
  }
  broadcastBoards() {
    this.broadcast({ type: "design.boards", boards: this.boardList() });
  }
  handleDesignCreate(boardId, name) {
    if (!BOARD_ID.test(boardId) || this.designs.has(boardId)) return;
    const clean = this.titleFrom(name) || "Untitled";
    try {
      this.store.saveDesign(boardId, { name: clean, document: null });
    } catch {
      return;
    }
    this.designs.set(boardId, { id: boardId, name: clean, document: null, presence: /* @__PURE__ */ new Map(), saveTimer: null });
    this.broadcastBoards();
    this.onSyncNeeded?.();
  }
  handleDesignRename(boardId, name) {
    const board = this.designs.get(boardId);
    const clean = this.titleFrom(name);
    if (!board || !clean || board.name === clean) return;
    board.name = clean;
    this.scheduleDesignSave(board);
    this.broadcastBoards();
  }
  handleDesignDelete(boardId) {
    const board = this.designs.get(boardId);
    if (!board) return;
    if (board.saveTimer) clearTimeout(board.saveTimer);
    this.designs.delete(boardId);
    try {
      this.store.deleteDesign(boardId);
    } catch {
    }
    this.broadcastBoards();
    this.onSyncNeeded?.();
  }
  handleDesignOpen(ws, boardId) {
    const board = this.designs.get(boardId);
    if (!board) return;
    this.send(ws, {
      type: "design.snapshot",
      boardId,
      name: board.name,
      document: board.document,
      presence: [...board.presence.values()]
    });
  }
  handleDesignPeek(ws, boardId) {
    const board = this.designs.get(boardId);
    if (!board) return;
    this.send(ws, { type: "design.preview", boardId, document: board.document });
  }
  // The first person to open a fresh board sends the starting document, so the
  // server never has to know how to build one. Everyone else loads it from the
  // snapshot broadcast here.
  handleDesignInit(boardId, document) {
    const board = this.designs.get(boardId);
    if (!board || board.document !== null) return;
    if (!document || typeof document !== "object") return;
    if (typeof document.store !== "object" || document.store === null || Array.isArray(document.store)) return;
    board.document = { store: { ...document.store }, schema: document.schema ?? null };
    this.scheduleDesignSave(board);
    this.broadcast({
      type: "design.snapshot",
      boardId,
      name: board.name,
      document: board.document,
      presence: [...board.presence.values()]
    });
  }
  handleDesignApply(ws, boardId, put, remove) {
    const board = this.designs.get(boardId);
    if (!board?.document) return;
    const putRecords = (Array.isArray(put) ? put : []).filter(
      (record) => typeof record === "object" && record !== null && typeof record.id === "string"
    );
    const removeIds = (Array.isArray(remove) ? remove : []).filter((id) => typeof id === "string");
    if (putRecords.length === 0 && removeIds.length === 0) return;
    for (const record of putRecords) board.document.store[record.id] = record;
    for (const id of removeIds) delete board.document.store[id];
    this.scheduleDesignSave(board);
    this.broadcastExcept(ws, { type: "design.changes", boardId, put: putRecords, remove: removeIds });
  }
  handleDesignPresence(ws, member, boardId, cursor, selection, pageId) {
    const board = this.designs.get(boardId);
    if (!board) return;
    const valid = cursor !== null && typeof cursor === "object" && typeof cursor.x === "number" && typeof cursor.y === "number" && isFinite(cursor.x) && isFinite(cursor.y);
    const presence = {
      userId: member.id,
      name: member.name,
      kind: "human",
      cursor: valid ? { x: cursor.x, y: cursor.y } : null,
      selection: (Array.isArray(selection) ? selection : []).filter((id) => typeof id === "string").slice(0, 100),
      pageId: typeof pageId === "string" ? pageId : null,
      ts: Date.now()
    };
    if (presence.pageId === null) board.presence.delete(member.id);
    else board.presence.set(member.id, presence);
    this.broadcastExcept(ws, { type: "design.presence", boardId, presence });
  }
  dropDesignPresence(member) {
    const stillHere = [...this.meta.values()].some(
      (m) => m.role === "ui" && m.memberKey === member.name.toLowerCase()
    );
    if (stillHere) return;
    for (const board of this.designs.values()) {
      if (!board.presence.delete(member.id)) continue;
      this.broadcast({
        type: "design.presence",
        boardId: board.id,
        presence: {
          userId: member.id,
          name: member.name,
          kind: "human",
          cursor: null,
          selection: [],
          pageId: null,
          ts: Date.now()
        }
      });
    }
  }
  huddleRoom() {
    if (this.huddle.size === 0) return emptyRoom();
    return {
      id: this.huddleId,
      peers: [...this.huddle.values()].sort((a, b) => a.joinedAt - b.joinedAt),
      startedAt: this.huddleStartedAt
    };
  }
  broadcastHuddle() {
    this.broadcast({ type: "huddle.room", room: this.huddleRoom() });
  }
  // A dropped socket takes a while to close, so a client coming back with the
  // peer id it already had takes its own place over rather than doubling up.
  handleHuddleJoin(ws, member, rawPeerId, muted, camera) {
    if (typeof rawPeerId !== "string" || rawPeerId.trim().length === 0) return;
    const peerId = rawPeerId.trim().slice(0, PEER_ID_CHARS);
    let existing = this.huddle.get(ws);
    for (const [other, peer] of [...this.huddle]) {
      if (peer.peerId !== peerId || other === ws) continue;
      existing = existing ?? peer;
      this.huddle.delete(other);
    }
    if (!existing && this.huddle.size >= MAX_HUDDLE_PEERS) {
      this.send(ws, { type: "error", message: "This huddle is full." });
      return;
    }
    this.huddle.set(ws, {
      peerId,
      memberId: member.id,
      name: member.name,
      muted: muted === true,
      camera: camera === true,
      sharing: existing?.sharing ?? false,
      joinedAt: existing?.joinedAt ?? Date.now()
    });
    this.recordHuddleArrival(member);
    this.broadcastHuddle();
  }
  handleHuddleLeave(ws) {
    if (!this.huddle.delete(ws)) return;
    if (this.huddle.size === 0) this.recordHuddleEnd();
    this.broadcastHuddle();
  }
  // The chat keeps the record of a call: who started it, who came, and how long
  // it ran. The call itself stays out of the log, so nothing about the media or
  // the handshake is ever committed.
  recordHuddleArrival(member) {
    if (this.huddleStartedAt === null) {
      this.huddleStartedAt = Date.now();
      this.huddleId = randomUUID();
      this.huddleNamed = /* @__PURE__ */ new Set([member.id]);
      this.emit({
        id: randomUUID(),
        ts: this.huddleStartedAt,
        kind: "huddle.started",
        huddleId: this.huddleId,
        byId: member.id,
        byName: member.name
      });
      return;
    }
    if (this.huddleId === null || this.huddleNamed.has(member.id)) return;
    this.huddleNamed.add(member.id);
    this.emit({
      id: randomUUID(),
      ts: Date.now(),
      kind: "huddle.joined",
      huddleId: this.huddleId,
      memberId: member.id,
      name: member.name
    });
  }
  recordHuddleEnd() {
    const huddleId = this.huddleId;
    const startedAt = this.huddleStartedAt;
    this.huddleId = null;
    this.huddleStartedAt = null;
    this.huddleNamed.clear();
    if (huddleId === null || startedAt === null) return;
    const ts = Date.now();
    this.emit({ id: randomUUID(), ts, kind: "huddle.ended", huddleId, ms: ts - startedAt });
  }
  handleHuddleUpdate(ws, change) {
    const peer = this.huddle.get(ws);
    if (!peer) return;
    if (typeof change.muted === "boolean") peer.muted = change.muted;
    if (typeof change.camera === "boolean") peer.camera = change.camera;
    if (typeof change.sharing === "boolean") peer.sharing = change.sharing;
    if (peer.sharing) {
      for (const other of this.huddle.values()) {
        if (other !== peer) other.sharing = false;
      }
    }
    this.broadcastHuddle();
  }
  // Where the loop has got to by now. The clients are told a position rather
  // than a moment on this machine's clock, so nothing depends on two computers
  // agreeing what time it is.
  musicRoom() {
    const music = this.music;
    if (!music) return emptyMusic();
    const run = music.playing ? (Date.now() - music.since) / 1e3 : 0;
    return {
      trackId: music.track.id,
      playing: music.playing,
      at: wrapAt(music.from + run, music.track.seconds),
      by: music.by
    };
  }
  broadcastMusic() {
    this.broadcast({ type: "music.room", room: this.musicRoom() });
  }
  broadcastShelf() {
    this.broadcast({ type: "music.shelf", uploads: [...this.uploads.values()] });
  }
  // A track of the crew's own. The bytes are kept beside the session the way an
  // attachment is, and everyone plays their own copy of the file rather than
  // listening down the wire to whoever added it.
  handleMusicAdd(member, name, mime, seconds, data) {
    const extension = audioExtension(mime);
    if (!extension || this.uploads.size >= MAX_UPLOADS) return;
    if (!Number.isFinite(seconds) || seconds <= 0 || seconds > MAX_UPLOAD_SECONDS) return;
    const bytes = Buffer.from(data ?? "", "base64");
    if (bytes.length === 0 || bytes.length > MAX_UPLOAD_BYTES) return;
    const trackId = randomUUID();
    const file = `${trackId}.${extension}`;
    try {
      this.store.saveMusic(file, bytes);
    } catch {
      return;
    }
    const upload = {
      id: trackId,
      name: cleanUploadName(name ?? ""),
      file,
      seconds,
      by: member.name.slice(0, BY_LIMIT),
      ts: Date.now()
    };
    this.uploads.set(trackId, upload);
    this.emit({
      id: randomUUID(),
      ts: upload.ts,
      kind: "music.added",
      trackId,
      name: upload.name,
      file,
      seconds,
      byName: upload.by
    });
    this.broadcastShelf();
  }
  // Taking a track off the shelf while it is playing stops it, or everyone is
  // left holding a position in something that is no longer there.
  handleMusicRemove(member, trackId) {
    const upload = this.uploads.get(trackId);
    if (!upload) return;
    this.uploads.delete(trackId);
    this.store.deleteMusic(upload.file);
    if (this.music?.track.id === trackId) {
      this.music = null;
      this.broadcastMusic();
    }
    this.emit({ id: randomUUID(), ts: Date.now(), kind: "music.removed", trackId, byName: member.name });
    this.broadcastShelf();
  }
  musicPath(file) {
    return this.store.musicPath(file);
  }
  // Anyone can put something on, and anyone can take it off again. A track
  // nobody has heard of is nothing to play, so it is dropped rather than sent
  // on to everyone as a name their build cannot draw.
  handleMusicSet(member, trackId, playing, at) {
    const track = itemFor(trackId, [...this.uploads.values()]);
    if (!track) return;
    this.music = {
      track,
      playing: playing === true,
      from: wrapAt(typeof at === "number" ? at : 0, track.seconds),
      since: Date.now(),
      by: member.name.slice(0, BY_LIMIT)
    };
    this.broadcastMusic();
  }
  handleMusicOff() {
    if (!this.music) return;
    this.music = null;
    this.broadcastMusic();
  }
  handleHuddleSignal(ws, to, signal) {
    const from = this.huddle.get(ws);
    if (!from || typeof to !== "string") return;
    if (JSON.stringify(signal ?? null).length > MAX_SIGNAL_CHARS) return;
    for (const [target, peer] of this.huddle) {
      if (peer.peerId !== to) continue;
      this.send(target, { type: "huddle.signal", from: from.peerId, signal });
      return;
    }
  }
  scheduleDesignSave(board) {
    if (board.saveTimer) return;
    board.saveTimer = setTimeout(() => {
      board.saveTimer = null;
      try {
        this.store.saveDesign(board.id, { name: board.name, document: board.document });
      } catch {
        return;
      }
      this.onSyncNeeded?.();
    }, DESIGN_SAVE_MS);
    board.saveTimer.unref?.();
  }
  designBoardSummary(boardId) {
    const board = this.designs.get(boardId);
    if (!board) return null;
    return boardSummary(board.id, board.name, board.document);
  }
  runDesignOps(boardId, byAgent, ops) {
    const board = this.designs.get(boardId);
    if (!board) return null;
    if (!board.document) {
      return ops.map(() => ({ error: "This board has never been opened in the app, so it has no page yet." }));
    }
    const applied = applyDesignOps(board.document, ops);
    if (applied.put.length > 0 || applied.remove.length > 0) {
      this.broadcast({ type: "design.changes", boardId, put: applied.put, remove: applied.remove });
      this.scheduleDesignSave(board);
    }
    this.walkAgentCursor(board, byAgent, applied);
    return applied.results;
  }
  // The agent's cursor hops from shape to shape a beat behind the edits, so
  // people watching the board see the work land where it happened.
  walkAgentCursor(board, agentKey, applied) {
    const key = `${board.id}:${agentKey}`;
    for (const timer of this.designCursorTimers.get(key) ?? []) clearTimeout(timer);
    const steps = applied.cursors.slice(0, DESIGN_CURSOR_STEPS_MAX);
    if (steps.length === 0) return;
    const label = this.agents.get(agentKey)?.label ?? agentKey;
    const pageId = Object.keys(board.document?.store ?? {}).find((id) => id.startsWith("page:")) ?? null;
    const touched = applied.results.flatMap((result) => result.id ? [result.id] : []).slice(0, 50);
    const timers = [];
    steps.forEach((cursor, i) => {
      const timer = setTimeout(() => {
        const presence = {
          userId: agentKey,
          name: label,
          kind: "agent",
          cursor,
          selection: touched,
          pageId,
          ts: Date.now()
        };
        board.presence.set(agentKey, presence);
        this.broadcast({ type: "design.presence", boardId: board.id, presence });
      }, i * DESIGN_CURSOR_STEP_MS);
      timer.unref?.();
      timers.push(timer);
    });
    const done = setTimeout(() => {
      board.presence.delete(agentKey);
      this.designCursorTimers.delete(key);
      this.broadcast({
        type: "design.presence",
        boardId: board.id,
        presence: { userId: agentKey, name: label, kind: "agent", cursor: null, selection: [], pageId: null, ts: Date.now() }
      });
    }, steps.length * DESIGN_CURSOR_STEP_MS + 6e3);
    done.unref?.();
    timers.push(done);
    this.designCursorTimers.set(key, timers);
  }
  queuedEntry(promptId) {
    for (const thread of this.threads.values()) {
      const entry = thread.queue.find((q) => q.promptId === promptId);
      if (entry) return { thread, entry };
    }
    return null;
  }
  handleQueueEdit(member, promptId, text) {
    const found = this.queuedEntry(promptId);
    const trimmed = text.trim();
    if (!found || !trimmed || found.entry.authorId !== member.id) return;
    const { docMentions, boardMentions } = this.refsOf(trimmed);
    for (const entry of found.thread.queue) {
      if (entry.messageId === found.entry.messageId) {
        entry.text = trimmed;
        entry.docMentions = docMentions;
        entry.boardMentions = boardMentions;
      }
    }
    if (this.emittedMessages.has(found.entry.messageId)) {
      const message = this.events.find((e) => e.kind === "message" && e.id === found.entry.messageId);
      if (message && message.kind === "message") {
        message.text = trimmed;
        message.docMentions = docMentions;
        message.boardMentions = boardMentions;
        this.emit({
          id: randomUUID(),
          ts: Date.now(),
          kind: "message.edited",
          messageId: message.id,
          text: trimmed,
          docMentions,
          boardMentions
        });
      }
    }
    this.broadcastQueue(found.thread);
  }
  handleQueueRemove(member, promptId) {
    const found = this.queuedEntry(promptId);
    if (!found || found.entry.authorId !== member.id) return;
    found.thread.queue = found.thread.queue.filter((q) => q.promptId !== promptId);
    const shared = found.thread.queue.some((q) => q.messageId === found.entry.messageId) || [...this.prompts.values()].some((ref) => ref.messageId === found.entry.messageId);
    if (this.emittedMessages.has(found.entry.messageId) && !shared) {
      this.handleDeleteMessage(member, found.entry.messageId);
    }
    this.broadcastQueue(found.thread);
  }
  handleDocRename(member, from, to, title) {
    if (from === to || from === "main" || !this.docs.has(from)) return;
    if (to === from || to.startsWith(`${from}/`)) return;
    try {
      this.store.renameDoc(from, to);
    } catch {
      return;
    }
    for (const [page, doc] of [...this.docs.entries()]) {
      if (page !== from && !page.startsWith(`${from}/`)) continue;
      this.docs.delete(page);
      this.docs.set(to + page.slice(from.length), doc);
    }
    const moved = this.docs.get(to);
    if (title !== void 0 && moved && moved.title !== title) {
      const doc = { title, text: moved.text };
      try {
        this.store.saveDoc(to, doc);
        this.docs.set(to, doc);
      } catch {
        title = moved.title;
      }
    }
    let titlesChanged = false;
    for (const [page, legacyTitle] of [...this.docTitles.entries()]) {
      if (page !== from && !page.startsWith(`${from}/`)) continue;
      this.docTitles.delete(page);
      this.docTitles.set(to + page.slice(from.length), legacyTitle);
      titlesChanged = true;
    }
    if (title !== void 0 && this.docTitles.delete(to)) titlesChanged = true;
    if (titlesChanged) this.store.saveTitles(Object.fromEntries(this.docTitles));
    this.docRenames.set(from, { to, ts: Date.now() });
    for (const [key, move] of this.docRenames) {
      if (Date.now() - move.ts > 1e4) this.docRenames.delete(key);
    }
    this.emit(
      { id: randomUUID(), ts: Date.now(), kind: "doc.renamed", from, to, title, byName: member.name },
      { persist: false }
    );
    this.onSyncNeeded?.();
  }
  handleUsage(meta, id, usage) {
    const agent = this.agents.get(id);
    if (!agent || !meta.agentIds.includes(id)) return;
    agent.usage = usage;
    this.broadcast({ type: "agent.usage", agentId: id, usage });
    this.persistMeta();
  }
  handleTokens(meta, promptId, tokens) {
    const agent = this.ownedAgent(meta, promptId);
    const ref = this.prompts.get(promptId);
    const run = agent?.runs.get(promptId);
    if (!agent || !ref || !run) return;
    run.tokens = Math.max(run.tokens, tokens);
    this.broadcast({ type: "agent.tokens", promptId, agentId: agent.id, threadId: ref.threadId, tokens: run.tokens });
  }
  handleStep(meta, promptId, step) {
    const agent = this.ownedAgent(meta, promptId);
    const ref = this.prompts.get(promptId);
    const run = agent?.runs.get(promptId);
    if (!agent || !ref || !run) return;
    const existing = run.steps.get(step.id)?.step;
    const merged = {
      id: step.id,
      ts: existing?.ts ?? Date.now(),
      kind: existing?.kind ?? step.kind,
      status: step.status,
      name: step.name || existing?.name,
      detail: step.detail ?? existing?.detail,
      output: step.output ?? existing?.output,
      files: step.files ?? existing?.files,
      text: (existing?.text ?? "") + (step.text ?? "") || void 0
    };
    run.steps.set(step.id, { step: merged, persisted: false });
    if (merged.status === "done") {
      const pending = this.stepFlushes.get(`${promptId}:${step.id}`);
      if (pending) {
        clearTimeout(pending.timer);
        this.stepFlushes.delete(`${promptId}:${step.id}`);
      }
      this.broadcast({ type: "agent.step", promptId, agentId: agent.id, threadId: ref.threadId, step: merged });
      this.persistStep(agent, promptId, ref.threadId, step.id);
      return;
    }
    this.broadcastStep(agent, promptId, ref.threadId, step.id, merged);
  }
  broadcastStep(agent, promptId, threadId, stepId, step) {
    const key = `${promptId}:${stepId}`;
    const pending = this.stepFlushes.get(key);
    if (pending) {
      pending.dirty = true;
      return;
    }
    this.broadcast({ type: "agent.step", promptId, agentId: agent.id, threadId, step });
    const timer = setTimeout(() => {
      const entry = this.stepFlushes.get(key);
      this.stepFlushes.delete(key);
      const latest = agent.runs.get(promptId)?.steps.get(stepId)?.step;
      if (!entry?.dirty || !latest || latest.status === "done") return;
      this.broadcast({ type: "agent.step", promptId, agentId: agent.id, threadId, step: latest });
    }, this.stepFlushMs);
    timer.unref?.();
    this.stepFlushes.set(key, { timer, dirty: false });
  }
  persistStep(agent, promptId, threadId, stepId) {
    const entry = agent.runs.get(promptId)?.steps.get(stepId);
    if (!entry || entry.persisted) return;
    entry.persisted = true;
    this.emit({
      id: randomUUID(),
      ts: Date.now(),
      kind: "agent.step",
      promptId,
      agentId: agent.id,
      agentLabel: agent.label,
      threadId,
      step: entry.step
    });
  }
  handleCancel(promptId) {
    const ref = this.prompts.get(promptId);
    if (!ref) {
      this.closeOrphanRun(promptId);
      return;
    }
    const agent = this.agents.get(ref.agentId);
    if (!agent) return;
    if (!agent.runner) {
      this.finishPrompt(agent, promptId, { ok: false, error: "Stopped" });
      return;
    }
    this.send(agent.runner, { type: "cancel", promptId });
    const timer = setTimeout(() => {
      if (this.prompts.has(promptId)) this.finishPrompt(agent, promptId, { ok: false, error: "Stopped" });
    }, this.cancelTimeoutMs);
    timer.unref?.();
  }
  closeOrphanRun(promptId) {
    let start = null;
    for (const event of this.events) {
      if (event.kind === "agent.start" && event.promptId === promptId) start = event;
      if (event.kind === "agent.end" && event.promptId === promptId) return;
    }
    if (!start) return;
    this.emit({
      id: randomUUID(),
      ts: Date.now(),
      kind: "agent.end",
      promptId,
      agentId: start.agentId,
      agentLabel: start.agentLabel,
      threadId: start.threadId,
      ok: false,
      error: "Stopped"
    });
  }
  handleDone(meta, promptId, text) {
    const agent = this.ownedAgent(meta, promptId);
    if (!agent) return;
    this.finishPrompt(agent, promptId, { ok: true, text });
  }
  handleError(meta, promptId, message) {
    const agent = this.ownedAgent(meta, promptId);
    if (!agent) return;
    this.finishPrompt(agent, promptId, { ok: false, error: message });
  }
  reconcileRuns(agentIds, running) {
    for (const id of agentIds) {
      const agent = this.agents.get(id);
      if (!agent) continue;
      for (const promptId of [...agent.running]) {
        if (running.has(promptId)) continue;
        const ref = this.prompts.get(promptId);
        const entry = agent.runs.get(promptId)?.entry;
        if (!ref || !entry || !agent.runner) {
          this.finishPrompt(agent, promptId, { ok: false, error: `${agent.label} lost this prompt.` });
          continue;
        }
        this.send(agent.runner, {
          type: "prompt",
          promptId,
          agentId: agent.id,
          threadId: ref.threadId,
          text: this.buildPrompt(agent, entry, this.assignedReactions(promptId)),
          settings: agent.settings,
          attachments: entry.attachments,
          designBoard: this.boardOf(this.threads.get(ref.threadId)),
          designBoards: this.referencedBoards(entry)
        });
      }
    }
  }
  boardOf(thread) {
    if (!thread?.boardId) return void 0;
    const board = this.designs.get(thread.boardId);
    return board ? { id: board.id, name: board.name } : void 0;
  }
  promptGone(ws, meta, promptId) {
    if (meta.role !== "runner" || this.prompts.has(promptId)) return false;
    this.send(ws, { type: "cancel", promptId });
    return true;
  }
  ownedAgent(meta, promptId) {
    const ref = this.prompts.get(promptId);
    if (!ref) return null;
    const agent = this.agents.get(ref.agentId);
    if (!agent || !meta.agentIds.includes(agent.id)) return null;
    return agent;
  }
  enqueuePrompt(agent, member, text, threadId, attachments, route) {
    const thread = this.threads.get(threadId);
    if (!thread) return;
    const entry = {
      promptId: randomUUID(),
      agentId: agent.id,
      text,
      byName: member.name,
      authorId: member.id,
      threadId,
      mentions: route?.mentions ?? [agent.id],
      ...this.refsOf(text),
      attachments,
      messageId: route?.messageId ?? randomUUID(),
      replyTo: route?.replyTo
    };
    if (!agent.runner && !agent.dropTimer) {
      this.emitThreadMessage(entry);
      this.systemMessage(`${agent.label} is not here right now.`, threadId);
      return;
    }
    const runningAgentId = thread.running ? this.prompts.get(thread.running)?.agentId : void 0;
    if (agent.runner && thread.running && runningAgentId === agent.id && agent.steerable) {
      this.emitThreadMessage(entry);
      this.sendSteer(agent, thread.running, {
        messageId: entry.messageId,
        text,
        byName: member.name,
        authorId: member.id,
        threadId,
        attachments,
        replyTo: entry.replyTo
      });
      return;
    }
    thread.queue.push(entry);
    if (this.emittedMessages.has(entry.messageId)) this.routed(entry.messageId, threadId, entry.promptId, "queued");
    this.broadcastQueue(thread);
    this.runThread(thread);
  }
  queueItems(thread) {
    return thread.queue.map(({ promptId, authorId, byName, text, agentId: agentId2 }) => ({
      promptId,
      authorId,
      authorName: byName,
      text,
      agentId: agentId2,
      agentLabel: this.agents.get(agentId2)?.label ?? ""
    }));
  }
  broadcastQueue(thread) {
    this.broadcast({ type: "queue.state", threadId: thread.id, items: this.queueItems(thread) });
  }
  sendSteer(agent, promptId, steer) {
    const waiting = this.steers.get(promptId) ?? [];
    waiting.push(steer);
    this.steers.set(promptId, waiting);
    this.routed(steer.messageId, steer.threadId, promptId, "steered");
    this.send(agent.runner, {
      type: "steer",
      promptId,
      text: steer.text,
      byName: steer.byName,
      attachments: steer.attachments
    });
  }
  // Acks arrive in the order the steers were sent over the same socket, so the
  // oldest outstanding one is the one being answered.
  handleSteered(meta, promptId, ok) {
    const agent = this.ownedAgent(meta, promptId);
    if (!agent) return;
    const waiting = this.steers.get(promptId);
    const steer = waiting?.shift();
    if (waiting?.length === 0) this.steers.delete(promptId);
    if (!steer || ok) return;
    this.requeueSteer(agent, steer);
  }
  // The run would not take the message, so fall back to a normal prompt. The
  // fresh route event supersedes the optimistic 'steered' one in the UI.
  requeueSteer(agent, steer) {
    const thread = this.threads.get(steer.threadId);
    if (!thread) return;
    if (!agent.runner && !agent.dropTimer) {
      this.systemMessage(`${agent.label} went offline before getting to this.`, steer.threadId);
      return;
    }
    const promptId = randomUUID();
    thread.queue.push({
      promptId,
      agentId: agent.id,
      text: steer.text,
      byName: steer.byName,
      authorId: steer.authorId ?? "",
      threadId: steer.threadId,
      mentions: [agent.id],
      ...this.refsOf(steer.text),
      attachments: steer.attachments,
      messageId: steer.messageId,
      replyTo: steer.replyTo
    });
    this.routed(steer.messageId, steer.threadId, promptId, "queued");
    this.broadcastQueue(thread);
    this.runThread(thread);
  }
  routed(messageId, threadId, promptId, mode) {
    this.emit({ id: randomUUID(), ts: Date.now(), kind: "message.route", messageId, threadId, promptId, mode });
  }
  runThread(thread) {
    if (thread.running) return;
    const next = thread.queue[0];
    if (!next) return;
    const agent = this.agents.get(next.agentId);
    if (!agent?.runner) return;
    thread.queue.shift();
    this.broadcastQueue(thread);
    this.emitThreadMessage(next);
    thread.running = next.promptId;
    agent.running.add(next.promptId);
    agent.runs.set(next.promptId, { steps: /* @__PURE__ */ new Map(), tokens: 0, startedAt: Date.now(), entry: next });
    this.prompts.set(next.promptId, { agentId: agent.id, threadId: thread.id, messageId: next.messageId });
    const reactions = this.pendingReactions(agent.id);
    this.emit({
      id: randomUUID(),
      ts: Date.now(),
      kind: "agent.start",
      promptId: next.promptId,
      agentId: agent.id,
      agentLabel: agent.label,
      promptText: next.text,
      byName: next.byName,
      threadId: thread.id,
      reactionIds: reactions.length > 0 ? reactions.map((reaction) => reaction.id) : void 0
    });
    this.send(agent.runner, {
      type: "prompt",
      promptId: next.promptId,
      agentId: agent.id,
      threadId: thread.id,
      text: this.buildPrompt(agent, next, reactions),
      settings: agent.settings,
      attachments: next.attachments,
      designBoard: this.boardOf(thread),
      designBoards: this.referencedBoards(next)
    });
  }
  finishPrompt(agent, promptId, result) {
    const threadId = this.prompts.get(promptId)?.threadId;
    this.prompts.delete(promptId);
    agent.running.delete(promptId);
    const thread = threadId ? this.threads.get(threadId) : void 0;
    if (thread?.running === promptId) thread.running = null;
    if (threadId) {
      for (const [stepId, entry] of agent.runs.get(promptId)?.steps ?? []) {
        entry.step.status = "done";
        this.persistStep(agent, promptId, threadId, stepId);
      }
    }
    agent.runs.delete(promptId);
    this.emit({
      id: randomUUID(),
      ts: Date.now(),
      kind: "agent.end",
      promptId,
      agentId: agent.id,
      agentLabel: agent.label,
      threadId,
      ...result
    });
    if (thread && thread.mode === "plan" && result.ok && result.text?.trim()) {
      thread.plan = result.text.trim();
      this.emit({
        id: randomUUID(),
        ts: Date.now(),
        kind: "thread.plan",
        threadId: thread.id,
        text: thread.plan,
        agentId: agent.id,
        agentLabel: agent.label
      });
    }
    const orphaned = this.steers.get(promptId) ?? [];
    this.steers.delete(promptId);
    for (const steer of orphaned) this.requeueSteer(agent, steer);
    if (thread) this.runThread(thread);
  }
  pendingReactions(agentId2) {
    const delivered = new Set(
      this.events.filter((event) => event.kind === "agent.start").flatMap((event) => event.reactionIds ?? [])
    );
    const latest = /* @__PURE__ */ new Map();
    for (const event of this.events) {
      if (event.kind !== "message.reaction" || event.targetAuthorId !== agentId2) continue;
      latest.set(JSON.stringify([event.targetId, event.memberId, event.emoji]), event);
    }
    return [...latest.values()].filter((event) => event.active && !delivered.has(event.id));
  }
  assignedReactions(promptId) {
    const start = this.events.find(
      (event) => event.kind === "agent.start" && event.promptId === promptId
    );
    const ids = new Set(start?.reactionIds ?? []);
    return this.events.filter(
      (event) => event.kind === "message.reaction" && ids.has(event.id)
    );
  }
  threadContext(threadId) {
    return this.events.filter(
      (e) => (e.kind === "message" || e.kind === "agent.end") && e.threadId === threadId
    ).slice(-CONTEXT_EVENT_LIMIT);
  }
  buildPrompt(agent, prompt, reactions) {
    const people = [...this.members.values()].map((m) => m.name).join(", ");
    const context = this.threadContext(prompt.threadId);
    const transcript = context.map((e) => {
      if (e.kind === "message") {
        const images = (e.attachments ?? []).map((a) => `[image: ${a.name}]`).join(" ");
        const reply = e.replyTo ? `, replying to ${e.replyTo.authorName}: ${JSON.stringify(e.replyTo.text)}` : "";
        return `${e.authorName}${reply}: ${[e.text, images].filter(Boolean).join(" ")}`;
      }
      if (e.ok && e.text) return `${e.agentLabel}: ${e.text}`;
      return null;
    }).filter(Boolean).join("\n");
    const others = [...this.agents.values()].filter((a) => a.id !== agent.id).map((a) => a.label);
    const lines = [
      `You are ${agent.label}, one of several agents in a crew session with ${people}.`,
      `You share a project folder and can read and edit files in it.`,
      `You are in a focused thread. Only this thread's messages are shown here.`
    ];
    if (others.length > 0) {
      lines.push(
        `Other agents in the session: ${others.join(", ")}. A mention like @name in a thread hands that message to the named agent, so replies from several agents can appear here.`
      );
    }
    const thread = this.threads.get(prompt.threadId);
    if (thread?.mode === "plan") lines.push(``, PLAN_INSTRUCTIONS);
    else if (thread?.plan) lines.push(``, `The plan this thread agreed on:`, thread.plan);
    lines.push(``, `Thread so far:`, transcript || "(nothing yet)");
    const referenced = this.referencedPages(context, prompt);
    for (const page of referenced) {
      const doc = this.docs.get(page);
      if (!doc) continue;
      lines.push(``, `Doc page "${doc.title}", referenced above as #${doc.title}:`, this.docExcerpt(doc.text));
    }
    if (reactions.length > 0) {
      lines.push(``, `Reactions to your earlier messages since your last turn:`);
      for (const reaction of reactions) {
        const text = this.reactionTarget(reaction.targetId)?.text.replace(/\s+/g, " ").trim().slice(0, 180);
        lines.push(
          text ? `- ${reaction.memberName} reacted ${reaction.emoji} to your message: ${JSON.stringify(text)}` : `- ${reaction.memberName} reacted ${reaction.emoji} to one of your earlier messages.`
        );
      }
    }
    lines.push(``, `Continue as ${agent.label}. Reply to the latest message from ${prompt.byName}.`);
    return lines.join("\n");
  }
  referencedPages(context, prompt) {
    const docs = Object.fromEntries(this.docs);
    const pages = [];
    const add = (page) => {
      if (page && !pages.includes(page)) pages.push(page);
    };
    for (const event of context) {
      if (event.kind === "message" && event.docMentions) {
        for (const ref of event.docMentions) add(resolveDocRef(docs, ref));
      } else {
        for (const ref of this.crewRefsIn(event.text ?? "")) {
          if (ref.kind === "doc") add(ref.key);
        }
      }
    }
    for (const ref of prompt.docMentions) add(resolveDocRef(docs, ref));
    return pages;
  }
  referencedBoards(prompt) {
    const boards = this.boardList();
    const found = [];
    const add = (id) => {
      const board = id ? boards.find((candidate) => candidate.id === id) : void 0;
      if (board && !found.some((seen) => seen.id === board.id)) found.push(board);
    };
    for (const event of this.threadContext(prompt.threadId)) {
      if (event.kind === "message" && event.boardMentions) {
        for (const ref of event.boardMentions) add(resolveBoardRef(boards, ref));
        continue;
      }
      for (const ref of this.crewRefsIn(event.text ?? "")) {
        if (ref.kind === "board") add(ref.key);
      }
    }
    for (const ref of prompt.boardMentions) add(resolveBoardRef(boards, ref));
    return found;
  }
  docExcerpt(text) {
    if (text.length <= MAX_DOC_PROMPT_CHARS) return text;
    return `${text.slice(0, MAX_DOC_PROMPT_CHARS)}
[doc cut off here]`;
  }
  handleSettings(id, settings) {
    const agent = this.agents.get(id);
    if (!agent) return;
    agent.settings = resolveSettings(agent.fields, { ...agent.settings, ...settings });
    this.emit({ id: randomUUID(), ts: Date.now(), kind: "agent.updated", agentId: id, settings: agent.settings });
    this.persistMeta();
  }
  // Only the owner renames their own agent. Everyone sees the new name, and
  // the owner's machine is told so the local definition keeps up.
  handleRename(member, id, label) {
    const agent = this.agents.get(id);
    if (!agent || agent.ownerId !== member.id) return;
    const wanted = label.replace(/\s+/g, " ").trim().slice(0, LABEL_LIMIT);
    if (!wanted || wanted === agent.label) return;
    agent.label = this.uniqueLabel(wanted, id);
    for (const thread of this.threads.values()) {
      if (thread.agentId === id) thread.agentLabel = agent.label;
    }
    const renamed = { type: "agent.renamed", agentId: id, label: agent.label };
    this.broadcast(renamed);
    if (agent.runner) this.send(agent.runner, renamed);
    this.persistMeta();
  }
  // Only the owner sets a photo on their own agent. Taking the photo off puts
  // back the generated icon, which comes from the agent id and never changes.
  handleAvatar(member, id, image) {
    const agent = this.agents.get(id);
    if (!agent || agent.ownerId !== member.id) return;
    if (image) {
      const saved = this.saveAttachment(image.mime, image.name, Buffer.from(image.data, "base64"));
      if (!saved) return;
      agent.avatar = saved.file;
    } else {
      if (!agent.avatar) return;
      delete agent.avatar;
    }
    this.broadcast({ type: "agent.avatar", agentId: id, file: agent.avatar ?? null });
    this.persistMeta();
  }
  // Anyone can remove any agent: the pool is shared, and a stale agent in it is
  // everyone's problem.
  handleRemove(id) {
    const agent = this.agents.get(id);
    if (agent) this.dropAgent(agent);
  }
  registerAgent(ws, member, llm) {
    const id = llm.id ?? agentId(member.name, llm.instanceId);
    if (this.removedAgents.has(id)) {
      this.send(ws, { type: "agent.removed", agentId: id });
      return;
    }
    const meta = this.meta.get(ws);
    const existing = this.agents.get(id);
    if (existing) {
      if (existing.runner && existing.ownerId !== member.id) return;
      if (existing.dropTimer) {
        clearTimeout(existing.dropTimer);
        existing.dropTimer = null;
      }
      existing.runner = ws;
      existing.fields = llm.fields;
      existing.steerable = llm.steerable === true;
      existing.settings = resolveSettings(llm.fields, existing.settings);
      const moved = existing.ownerId !== member.id;
      existing.ownerId = member.id;
      existing.ownerName = member.name;
      meta?.agentIds.push(id);
      if (moved) this.broadcast({ type: "agent.added", agent: this.pooled(existing) });
      this.emit({ id: randomUUID(), ts: Date.now(), kind: "agent.online", agentId: id, label: existing.label });
      this.runThreadsOf(existing);
      if (moved) this.persistMeta();
      return;
    }
    const label = this.uniqueLabel(llm.label);
    const agent = {
      id,
      label,
      provider: llm.provider,
      ownerId: member.id,
      ownerName: member.name,
      settings: resolveSettings(llm.fields, llm.settings ?? {}),
      fields: llm.fields,
      steerable: llm.steerable === true,
      runner: ws,
      running: /* @__PURE__ */ new Set(),
      runs: /* @__PURE__ */ new Map(),
      dropTimer: null
    };
    this.agents.set(id, agent);
    meta?.agentIds.push(id);
    this.broadcast({ type: "agent.added", agent: this.pooled(agent) });
    this.emit({ id: randomUUID(), ts: Date.now(), kind: "agent.online", agentId: id, label });
    this.persistMeta();
  }
  deregisterAgent(id) {
    const agent = this.agents.get(id);
    if (agent) this.dropAgent(agent);
  }
  dropAgent(agent) {
    if (agent.dropTimer) {
      clearTimeout(agent.dropTimer);
      agent.dropTimer = null;
    }
    this.clearQueues(agent, `${agent.label} was removed before getting to this.`);
    this.dropRunning(agent, `${agent.label} was removed.`);
    this.agents.delete(agent.id);
    this.removedAgents.add(agent.id);
    for (const meta of this.meta.values()) meta.agentIds = meta.agentIds.filter((a) => a !== agent.id);
    const removed = { type: "agent.removed", agentId: agent.id };
    this.broadcast(removed);
    if (agent.runner) this.send(agent.runner, removed);
    this.persistMeta();
  }
  uniqueLabel(base, exceptId) {
    const taken = new Set([...this.agents.values()].filter((a) => a.id !== exceptId).map((a) => a.label.toLowerCase()));
    if (!taken.has(base.toLowerCase())) return base;
    let i = 2;
    while (taken.has(`${base} ${i}`.toLowerCase())) i++;
    return `${base} ${i}`;
  }
  titleFrom(text) {
    const flat = text.replace(/\s+/g, " ").trim();
    return flat.length > TITLE_LIMIT ? flat.slice(0, TITLE_LIMIT) + "\u2026" : flat;
  }
  runThreadsOf(agent) {
    for (const thread of this.threads.values()) {
      if (thread.queue[0]?.agentId === agent.id) this.runThread(thread);
    }
  }
  clearQueues(agent, reason) {
    for (const thread of this.threads.values()) {
      const dropped = thread.queue.filter((q) => q.agentId === agent.id);
      if (dropped.length === 0) continue;
      thread.queue = thread.queue.filter((q) => q.agentId !== agent.id);
      for (const prompt of dropped) this.systemMessage(reason, prompt.threadId);
      this.broadcastQueue(thread);
      this.runThread(thread);
    }
    for (const promptId of agent.running) {
      for (const steer of this.steers.get(promptId) ?? []) this.systemMessage(reason, steer.threadId);
      this.steers.delete(promptId);
    }
  }
  dropRunning(agent, reason) {
    for (const promptId of [...agent.running]) this.finishPrompt(agent, promptId, { ok: false, error: reason });
  }
  statusOf(agent) {
    if (!agent.runner) return "offline";
    return agent.running.size > 0 ? "busy" : "idle";
  }
  pooled(agent) {
    const { runner, running, runs, dropTimer, ...rest } = agent;
    const live = {};
    for (const [promptId, run] of runs) {
      live[promptId] = {
        steps: [...run.steps.values()].map((entry) => entry.step),
        tokens: run.tokens,
        startedAt: run.startedAt
      };
    }
    return { ...rest, status: this.statusOf(agent), runs: live };
  }
  memberFor(name) {
    const key = name.trim().toLowerCase();
    let member = this.members.get(key);
    if (!member) {
      member = { id: randomUUID(), name: name.trim(), connections: /* @__PURE__ */ new Set() };
      this.members.set(key, member);
    }
    return member;
  }
  detach(ws, code = 1006) {
    const meta = this.meta.get(ws);
    if (!meta) return;
    this.meta.delete(ws);
    const member = this.members.get(meta.memberKey);
    if (member) {
      member.connections.delete(ws);
      if (member.connections.size === 0) {
        this.emit({ id: randomUUID(), ts: Date.now(), kind: "person.left", memberId: member.id, name: member.name });
      }
      if (meta.role === "ui") this.dropDesignPresence(member);
    }
    if (meta.role === "ui") this.handleHuddleLeave(ws);
    const left = code === 1e3 || code === 1001 || code === 1005;
    for (const id of meta.agentIds) {
      const agent = this.agents.get(id);
      if (!agent || agent.runner !== ws) continue;
      agent.runner = null;
      if (left) {
        this.clearQueues(agent, `${agent.label} went offline before getting to this.`);
        this.dropRunning(agent, `${agent.label} disconnected.`);
      } else {
        agent.dropTimer = setTimeout(() => {
          agent.dropTimer = null;
          if (agent.runner) return;
          this.clearQueues(agent, `${agent.label} went offline before getting to this.`);
          this.dropRunning(agent, `${agent.label} disconnected.`);
        }, this.resumeGraceMs);
        agent.dropTimer.unref?.();
      }
      this.emit({ id: randomUUID(), ts: Date.now(), kind: "agent.offline", agentId: id, label: agent.label });
    }
    this.persistMeta();
  }
  systemMessage(text, threadId) {
    this.emit({
      id: randomUUID(),
      ts: Date.now(),
      kind: "message",
      authorId: SYSTEM_AUTHOR_ID,
      authorName: SYSTEM_AUTHOR_NAME,
      text,
      mentions: [],
      threadId
    });
  }
  emit(event, opts = {}) {
    const ephemeral = event.kind === "doc" || event.kind === "doc.titled" || event.kind === "doc.renamed" || event.kind === "doc.deleted" || event.kind === "message.edited";
    if (!ephemeral) this.events.push(event);
    if (opts.persist !== false) this.store.appendEvent(event);
    this.broadcast({ type: "event", event });
    if (opts.persist !== false) this.onSyncNeeded?.();
  }
  broadcast(msg) {
    for (const [ws, meta] of this.meta) {
      if (meta.role === "ui") this.send(ws, msg);
    }
  }
  broadcastExcept(skip, msg) {
    for (const [ws, meta] of this.meta) {
      if (meta.role === "ui" && ws !== skip) this.send(ws, msg);
    }
  }
  send(ws, msg) {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  }
  persistMeta() {
    this.store.saveSession({
      code: this.code,
      createdAt: this.createdAt,
      members: [...this.members.values()].map((m) => ({ id: m.id, name: m.name })),
      agents: [...this.agents.values()].map(({ runner, running, runs, dropTimer, ...agent }) => agent),
      removedAgents: [...this.removedAgents]
    });
  }
};

// src/server/store.ts
import fs2 from "node:fs";
import path from "node:path";
var PAGE_SEGMENT = "[a-z0-9][a-z0-9-]*";
var PAGE_NAME = new RegExp(`^${PAGE_SEGMENT}(/${PAGE_SEGMENT})*$`);
var Store = class {
  root;
  constructor(repoPath) {
    this.root = path.join(repoPath, ".crew");
    fs2.mkdirSync(path.join(this.root, "docs"), { recursive: true });
    fs2.mkdirSync(path.join(this.root, "attachments"), { recursive: true });
    fs2.mkdirSync(path.join(this.root, "designs"), { recursive: true });
    fs2.mkdirSync(path.join(this.root, "music"), { recursive: true });
  }
  saveAttachment(file, data) {
    if (!isAttachmentFile(file)) throw new Error(`Bad attachment name: ${file}`);
    this.writeAtomic(path.join(this.root, "attachments", file), data);
  }
  attachmentPath(file) {
    if (!isAttachmentFile(file)) return null;
    const full = path.join(this.root, "attachments", file);
    return fs2.existsSync(full) ? full : null;
  }
  saveMusic(file, data) {
    if (!isUploadFile(file)) throw new Error(`Bad track name: ${file}`);
    this.writeAtomic(path.join(this.root, "music", file), data);
  }
  musicPath(file) {
    if (!isUploadFile(file)) return null;
    const full = path.join(this.root, "music", file);
    return fs2.existsSync(full) ? full : null;
  }
  deleteMusic(file) {
    if (!isUploadFile(file)) return;
    fs2.rmSync(path.join(this.root, "music", file), { force: true });
  }
  loadSession() {
    try {
      return JSON.parse(fs2.readFileSync(this.sessionPath(), "utf8"));
    } catch {
      return null;
    }
  }
  saveSession(session) {
    this.writeAtomic(this.sessionPath(), JSON.stringify(session, null, 2));
  }
  appendEvent(event) {
    fs2.appendFileSync(path.join(this.root, "chat.jsonl"), JSON.stringify(event) + "\n");
  }
  loadEvents() {
    let raw;
    try {
      raw = fs2.readFileSync(path.join(this.root, "chat.jsonl"), "utf8");
    } catch {
      return [];
    }
    const events = [];
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        events.push(JSON.parse(line));
      } catch {
        continue;
      }
    }
    return events;
  }
  loadDocs() {
    const docs = {};
    const walk = (dir, prefix) => {
      for (const entry of fs2.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full, `${prefix}${entry.name}/`);
        } else if (entry.name.endsWith(".md")) {
          const page = `${prefix}${entry.name.slice(0, -3)}`;
          docs[page] = parseDocFile(fs2.readFileSync(full, "utf8"), page);
        }
      }
    };
    walk(path.join(this.root, "docs"), "");
    return docs;
  }
  saveDoc(page, doc) {
    if (!PAGE_NAME.test(page)) throw new Error(`Bad page name: ${page}`);
    const file = path.join(this.root, "docs", `${page}.md`);
    fs2.mkdirSync(path.dirname(file), { recursive: true });
    this.writeAtomic(file, serializeDocFile(doc));
  }
  loadTitles() {
    try {
      const parsed = JSON.parse(fs2.readFileSync(this.titlesPath(), "utf8"));
      const titles = {};
      for (const [page, title] of Object.entries(parsed)) {
        if (typeof title === "string" && title) titles[page] = title;
      }
      return titles;
    } catch {
      return {};
    }
  }
  saveTitles(titles) {
    const entries = Object.entries(titles).filter(([, title]) => title);
    if (entries.length === 0) {
      fs2.rmSync(this.titlesPath(), { force: true });
      return;
    }
    this.writeAtomic(this.titlesPath(), JSON.stringify(Object.fromEntries(entries), null, 2));
  }
  deleteDoc(page) {
    if (!PAGE_NAME.test(page)) throw new Error(`Bad page name: ${page}`);
    const docsDir = path.join(this.root, "docs");
    fs2.rmSync(path.join(docsDir, `${page}.md`), { force: true });
    fs2.rmSync(path.join(docsDir, page), { recursive: true, force: true });
  }
  renameDoc(from, to) {
    if (!PAGE_NAME.test(from)) throw new Error(`Bad page name: ${from}`);
    if (!PAGE_NAME.test(to)) throw new Error(`Bad page name: ${to}`);
    const docsDir = path.join(this.root, "docs");
    const sourceFile = path.join(docsDir, `${from}.md`);
    const targetFile = path.join(docsDir, `${to}.md`);
    const sourceDir = path.join(docsDir, from);
    const targetDir = path.join(docsDir, to);
    if (fs2.existsSync(targetFile)) throw new Error(`Page exists: ${to}`);
    if (fs2.existsSync(sourceDir) && fs2.existsSync(targetDir)) throw new Error(`Page exists: ${to}`);
    fs2.mkdirSync(path.dirname(targetFile), { recursive: true });
    fs2.renameSync(sourceFile, targetFile);
    if (fs2.existsSync(sourceDir)) fs2.renameSync(sourceDir, targetDir);
  }
  loadDesigns() {
    const designs = {};
    for (const entry of fs2.readdirSync(path.join(this.root, "designs"))) {
      if (!entry.endsWith(".json")) continue;
      const id = entry.slice(0, -5);
      if (!BOARD_ID.test(id)) continue;
      try {
        const parsed = JSON.parse(fs2.readFileSync(path.join(this.root, "designs", entry), "utf8"));
        designs[id] = { name: typeof parsed.name === "string" ? parsed.name : id, document: parsed.document ?? null };
      } catch {
        continue;
      }
    }
    return designs;
  }
  saveDesign(id, design) {
    if (!BOARD_ID.test(id)) throw new Error(`Bad board id: ${id}`);
    this.writeAtomic(path.join(this.root, "designs", `${id}.json`), JSON.stringify(design));
  }
  deleteDesign(id) {
    if (!BOARD_ID.test(id)) throw new Error(`Bad board id: ${id}`);
    fs2.rmSync(path.join(this.root, "designs", `${id}.json`), { force: true });
  }
  sessionPath() {
    return path.join(this.root, "session.json");
  }
  titlesPath() {
    return path.join(this.root, "docs", ".titles.json");
  }
  writeAtomic(file, contents) {
    const tmp = `${file}.tmp`;
    fs2.writeFileSync(tmp, contents);
    fs2.renameSync(tmp, file);
  }
};

// scripts/tmp-host-entry.mjs
async function startHost(repoPath) {
  const store = new Store(repoPath);
  const session = new CrewSession(store);
  const server = await createCrewServer(session, { port: 0, host: "127.0.0.1" });
  return { port: server.port(), code: session.code, close: () => server.close() };
}
export {
  startHost
};
