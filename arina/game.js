// Движок детского квеста. Общий для всех игр серии: сюжет, места и тексты берутся из passport.js и strings.js.
import { STR } from "./strings.js";
import { PASSPORT as P } from "./passport.js";

const W = 720, H = 1280, STEP = 1000 / 60, DPR_CAP = 1.5, TAU = Math.PI * 2;
const FONT = 'system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const EMOJI = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
const C = { cream: "#FFF7E8", line: "#6B4A2B", coral: "#FF7A59", gold: "#FFC83D", glow: "#FF9F1C", green: "#6CBF5A", sky: "#8FD3FF", print: "rgba(90,60,35,.78)" };
const CONF = ["#FF7A59", "#FFC83D", "#6CBF5A", "#8FD3FF", "#FF9FD0"];
const HINT_AFTER = 9;      // секунд без нажатий до подсказки
const TAP_PAD = 30;        // запас вокруг предмета, чтобы детский палец попадал

const canvas = document.getElementById("c"), ctx = canvas.getContext("2d");
const devEl = document.getElementById("dev");
const Q = new URLSearchParams(location.search);
const DEV = Q.has("dev");

// ---------- случайные числа: отдельно для правил и для украшений ----------
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rnd = mulberry32(P.seed), vrnd = mulberry32(P.seed ^ 0x9E3779B9);
function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }

// ---------- состояние ----------
const S = {
  t: 0, name: "", scene: null, progress: 0, muted: false, done: false, after: null, idle: 0,
  fade: { a: 1, dir: -1, next: null },
  bub: { id: "", text: "", lines: null, h: 0 },
};
const KEY = "kidsgame:" + P.id;
function load() { try { const d = JSON.parse(localStorage.getItem(KEY) || "{}"); S.progress = Math.max(0, Math.min(d.progress | 0, P.levels.length)); S.muted = !!d.muted; } catch (e) { /* без сохранения тоже играется */ } }
function save() { try { localStorage.setItem(KEY, JSON.stringify({ progress: S.progress, muted: S.muted })); } catch (e) { /* нет доступа к памяти браузера */ } }

// ---------- экран ----------
const view = { dpr: 1, scale: 1, ox: 0, oy: 0 };
function resize() {
  view.dpr = Math.min(devicePixelRatio || 1, DPR_CAP);
  canvas.width = Math.round(innerWidth * view.dpr); canvas.height = Math.round(innerHeight * view.dpr);
  canvas.style.width = innerWidth + "px"; canvas.style.height = innerHeight + "px";
  view.scale = Math.min(innerWidth / W, innerHeight / H);
  view.ox = (innerWidth - W * view.scale) / 2; view.oy = (innerHeight - H * view.scale) / 2;
}
addEventListener("resize", resize); addEventListener("orientationchange", resize); resize();

// ---------- картинки ----------
const IMG = {};
for (const id in P.images) { const im = new Image(); im.onload = () => { IMG[id] = im; }; im.src = "./assets/img/" + P.images[id]; }

function art(id, cx, cy, size, alpha, rot) {
  const im = IMG[id];
  if (alpha !== undefined && alpha !== 1) ctx.globalAlpha = alpha;
  if (rot) { ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); cx = 0; cy = 0; }
  if (im) { const k = size / Math.max(im.width, im.height); ctx.drawImage(im, cx - im.width * k / 2, cy - im.height * k / 2, im.width * k, im.height * k); }
  else glyph(P.emoji[id] || "?", cx, cy, size);
  if (rot) ctx.restore();
  ctx.globalAlpha = 1;
}
function glyph(g, cx, cy, size) {
  ctx.font = ((size * 0.82) | 0) + "px " + EMOJI; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#000";
  ctx.fillText(g, cx, cy + size * 0.04);
}
const gradCache = new Map();
function grad(key, y0, y1, c0, c1) {
  let g = gradCache.get(key);
  if (!g) { g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, c0); g.addColorStop(1, c1); gradCache.set(key, g); }
  return g;
}
function drawBg(id) {
  const im = IMG[id];
  if (im) { const k = Math.max(W / im.width, H / im.height); ctx.drawImage(im, (W - im.width * k) / 2, (H - im.height * k) / 2, im.width * k, im.height * k); return; }
  const b = P.bg[id] || P.bg.bg_map, hz = H * 0.42;
  ctx.fillStyle = grad(id + "s", 0, hz, b.sky[0], b.sky[1]); ctx.fillRect(0, 0, W, hz);
  ctx.fillStyle = grad(id + "g", hz, H, b.ground[0], b.ground[1]); ctx.fillRect(0, hz, W, H - hz);
  ctx.fillStyle = "#FFE27A"; ctx.beginPath(); ctx.arc(610, 380, 58, 0, TAU); ctx.fill();
  if (b.mark) { ctx.globalAlpha = 0.9; glyph(b.mark, 360, hz - 40, 330); ctx.globalAlpha = 1; }
  for (const d of b.decor) glyph(d[0], d[1], d[2], d[3]);
}

// ---------- рисование интерфейса ----------
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function txt(s, x, y, size, fill, stroke, weight) {
  ctx.font = (weight || 800) + " " + size + "px " + FONT; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  if (stroke) { ctx.lineWidth = size * 0.18; ctx.lineJoin = "round"; ctx.strokeStyle = stroke; ctx.strokeText(s, x, y); }
  ctx.fillStyle = fill; ctx.fillText(s, x, y);
}
function wrapText(text, font, maxW) {
  ctx.font = font; const out = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const w of para.split(" ")) { const t = line ? line + " " + w : w; if (line && ctx.measureText(t).width > maxW) { out.push(line); line = w; } else line = t; }
    out.push(line);
  }
  return out;
}
function star(cx, cy, r, fill) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r * 0.45 : r; ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); }
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 4; ctx.lineJoin = "round"; ctx.strokeStyle = C.line; ctx.stroke();
}
function drawBtn(b, label, pulse) {
  const s = 1 + (pulse ? Math.sin(S.t * 5) * 0.035 : 0);
  ctx.save(); ctx.translate(b.x + b.w / 2, b.y + b.h / 2); ctx.scale(s, s);
  rr(-b.w / 2, -b.h / 2, b.w, b.h, b.h / 2); ctx.fillStyle = b.color || C.coral; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = C.line; ctx.stroke();
  txt(label, 0, 2, b.fs || 46, "#fff");
  ctx.restore();
}
const hit = (b, x, y) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
const near = (ax, ay, bx, by, r) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy <= r * r; };
const BTN = {
  play: { x: 160, y: 950, w: 400, h: 130, fs: 58 },
  restart: { x: 235, y: 1110, w: 250, h: 80, fs: 32, color: C.green },
  next: { x: 200, y: 1120, w: 320, h: 112, fs: 50 },
  again: { x: 130, y: 1100, w: 460, h: 112, fs: 44 },
  mute: { x: 660, y: 55, r: 38 }, home: { x: 60, y: 55, r: 38 },
};
function roundBtn(b, g) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fillStyle = C.cream; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = C.line; ctx.stroke(); glyph(g, b.x, b.y, b.r * 1.3); }

const BUB = { x: 30, y: 110, w: 660, font: "700 36px " + FONT, lh: 48 };
function say(id) { const b = S.bub; b.id = id; b.text = STR.lines[id] || ""; b.lines = null; speak(id); }
function drawBubble() {
  const b = S.bub; if (!b.text) return;
  if (!b.lines) { b.lines = wrapText(b.text, BUB.font, BUB.w - 70); b.h = b.lines.length * BUB.lh + 44; }
  rr(BUB.x, BUB.y, BUB.w, b.h, 34); ctx.fillStyle = C.cream; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = C.line; ctx.stroke();
  ctx.font = BUB.font; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = C.line;
  for (let i = 0; i < b.lines.length; i++) ctx.fillText(b.lines[i], W / 2, BUB.y + 22 + BUB.lh * (i + 0.5));
}
function drawTopBar() {
  if (S.name === "title" || S.name === "diploma") { roundBtn(BTN.mute, S.muted ? STR.ui.soundOff : STR.ui.soundOn); return; }
  const n = P.levels.length, x0 = W / 2 - (n - 1) * 34;
  for (let i = 0; i < n; i++) star(x0 + i * 68, 55, 28, i < S.progress ? C.gold : "rgba(255,255,255,.55)");
  roundBtn(BTN.mute, S.muted ? STR.ui.soundOff : STR.ui.soundOn);
  if (S.scene && S.scene.isGame) roundBtn(BTN.home, STR.ui.home);
}

// ---------- искры ----------
const parts = Array.from({ length: 200 }, () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, c: 0, s: 8 }));
function burst(x, y, n) {
  for (const p of parts) {
    if (n <= 0) break; if (p.on) continue;
    const a = vrnd() * TAU, v = 120 + vrnd() * 380;
    p.on = true; p.x = x; p.y = y; p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v - 220;
    p.life = p.max = 0.6 + vrnd() * 0.7; p.c = (vrnd() * CONF.length) | 0; p.s = 8 + vrnd() * 12; n--;
  }
}
function updateParts(dt) { for (const p of parts) { if (!p.on) continue; p.life -= dt; if (p.life <= 0) { p.on = false; continue; } p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt; } }
function drawParts() { for (const p of parts) { if (!p.on) continue; ctx.globalAlpha = Math.min(1, p.life / p.max * 2); ctx.fillStyle = CONF[p.c]; ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); } ctx.globalAlpha = 1; }

// ---------- звук ----------
let ac = null, voiceEl = null, music = null;
function unlockAudio() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } }
  if (ac && ac.state === "suspended") ac.resume();
  if (P.music && !music) { music = new Audio("./assets/audio/" + P.music); music.loop = true; music.volume = 0.22; }
  if (music && !S.muted && music.paused) music.play().catch(() => {});
}
function tone(freq, dur, when, type, vol) {
  if (!ac || S.muted) return;
  const t = ac.currentTime + (when || 0), o = ac.createOscillator(), g = ac.createGain();
  o.type = type || "sine"; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.16, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + dur + 0.05);
}
const sfx = {
  tap() { tone(520, 0.08); },
  good() { tone(660, 0.12); tone(880, 0.18, 0.1); },
  bad() { tone(210, 0.16, 0, "triangle", 0.1); },
  flip() { tone(440, 0.06, 0, "triangle"); },
  pop() { tone(900, 0.07); tone(1250, 0.09, 0.05); },
  bark() { tone(310, 0.09, 0, "square", 0.1); tone(250, 0.13, 0.13, "square", 0.1); },
  win() { tone(523, 0.25, 0, "triangle", 0.18); tone(659, 0.25, 0.12, "triangle", 0.18); tone(784, 0.25, 0.24, "triangle", 0.18); tone(1047, 0.4, 0.36, "triangle", 0.18); },
};
function speak(id) {
  if (voiceEl) { voiceEl.pause(); voiceEl = null; }
  const f = P.voice[id]; if (!f || S.muted) return;
  voiceEl = new Audio("./assets/voice/" + f); voiceEl.play().catch(() => {});
}
function toggleMute() {
  S.muted = !S.muted; save();
  if (S.muted) { if (voiceEl) voiceEl.pause(); if (music) music.pause(); } else unlockAudio();
}

// ---------- переходы между экранами ----------
const scenes = {};
function go(name, arg) { if (S.fade.next) return; S.fade.next = { name, arg }; S.fade.dir = 1; }
function switchTo(name, arg) { S.name = name; S.scene = scenes[name]; S.done = false; S.after = null; S.idle = 0; S.scene.enter(arg); }
function later(t, fn) { S.after = { t, fn }; }
function introArg() { return { slides: P.intro, then() { go("map"); } }; }
function startNode(i) { if (i < P.levels.length) go(P.levels[i].type, i); else go("story", { slides: P.finale, then() { go("diploma"); } }); }
function levelDone(i) {
  if (S.done) return; S.done = true; sfx.win(); burst(360, 640, 50);
  later(1.4, () => { S.progress = Math.max(S.progress, i + 1); save(); go("story", { slides: [P.levels[i].winSlide], then() { go("map"); } }); });
}

// ---------- заставка ----------
scenes.title = {
  enter() { S.bub.text = ""; },
  update() {},
  render() {
    drawBg("bg_map");
    txt(STR.title, 360, 250, 76, "#fff", C.line); txt(STR.subtitle, 360, 345, 46, C.gold, C.line);
    art("hero_idle", 240, 650 + Math.sin(S.t * 2) * 10, 330); art("finik", 500, 720 + Math.sin(S.t * 2 + 1.5) * 12, 260);
    drawBtn(BTN.play, S.progress > 0 ? STR.ui.cont : STR.ui.play, true);
    if (S.progress > 0) drawBtn(BTN.restart, STR.ui.restart, false);
  },
  start() { sfx.tap(); if (S.progress > 0) go("map"); else go("story", introArg()); },
  down(x, y) {
    if (hit(BTN.play, x, y)) this.start();
    else if (S.progress > 0 && hit(BTN.restart, x, y)) { sfx.tap(); S.progress = 0; save(); go("story", introArg()); }
  },
  key() { this.start(); },
};

// ---------- картинки с рассказом (вступление, награды, финал) ----------
scenes.story = {
  bgId() { return this.slides[this.i].bg; },
  enter(arg) { this.slides = arg.slides; this.then = arg.then; this.i = 0; this.t = 0; say(this.slides[0].line); },
  update(dt) { this.t += dt; },
  render() {
    const s = this.slides[this.i]; drawBg(s.bg);
    for (const a of s.actors) art(a[0], a[1], a[2] + Math.sin(S.t * 2.2 + a[1]) * 8, a[3]);
    drawBubble(); if (this.t > 0.6) drawBtn(BTN.next, STR.ui.next, true);
  },
  next() {
    if (this.t <= 0.6) return; sfx.tap();
    if (this.i + 1 >= this.slides.length) { this.then(); return; }
    this.i++; this.t = 0; say(this.slides[this.i].line);
  },
  down(x, y) { if (hit(BTN.next, x, y)) this.next(); },
  key() { this.next(); },
};

// ---------- карта двора ----------
scenes.map = {
  enter() { this.cur = Math.min(S.progress, P.map.nodes.length - 1); this.shake = -1; this.shakeT = 0; say("map" + this.cur); },
  update(dt) { if (this.shakeT > 0) this.shakeT -= dt; },
  render() {
    drawBg("bg_map"); const N = P.map.nodes;
    ctx.setLineDash([4, 26]); ctx.lineCap = "round"; ctx.lineWidth = 14; ctx.strokeStyle = "rgba(255,255,255,.8)";
    ctx.beginPath(); for (let i = 0; i < N.length; i++) { if (i) ctx.lineTo(N[i].x, N[i].y); else ctx.moveTo(N[i].x, N[i].y); } ctx.stroke(); ctx.setLineDash([]);
    for (let i = 0; i < N.length; i++) {
      const n = N[i], open = i <= this.cur, cur = i === this.cur;
      const r = 78 + (cur ? Math.sin(S.t * 5) * 7 : 0), dx = (this.shake === i && this.shakeT > 0) ? Math.sin(this.shakeT * 50) * 8 : 0;
      ctx.beginPath(); ctx.arc(n.x + dx, n.y, r, 0, TAU); ctx.fillStyle = cur ? C.gold : C.cream; ctx.globalAlpha = open ? 1 : 0.55; ctx.fill();
      ctx.lineWidth = cur ? 9 : 6; ctx.strokeStyle = cur ? C.glow : C.line; ctx.stroke(); ctx.globalAlpha = 1;
      art(n.icon, n.x + dx, n.y, 105, open ? 1 : 0.45);
      if (i < S.progress && i < P.levels.length) star(n.x + 58, n.y - 58, 26, C.gold);
    }
    const c = N[this.cur]; art("hero_idle", c.x - 105, c.y + 20 + Math.sin(S.t * 3) * 6, 120);
    drawBubble();
  },
  down(x, y) {
    const N = P.map.nodes;
    for (let i = 0; i < N.length; i++) {
      if (!near(x, y, N[i].x, N[i].y, 95)) continue;
      if (i <= this.cur) { sfx.tap(); startNode(i); } else { sfx.bad(); this.shake = i; this.shakeT = 0.4; }
      return;
    }
  },
  key() { startNode(this.cur); },
};

// ---------- игра 1: найди вещи ----------
const TRAY = { x: 30, y: 1095, w: 660, h: 150, cy: 1170 };
scenes.find = {
  isGame: true,
  bgId() { return this.bg; },
  enter(i) {
    const L = P.levels[i], n = L.targets.length; this.i = i; this.bg = L.bg; this.left = n;
    this.items = L.targets.map((t, k) => ({ id: t[0], x: t[1], y: t[2], s: t[3], found: false, fly: 0, sx: W / 2 + (k - (n - 1) / 2) * 128 }));
    this.decoys = L.decoys.map(t => ({ id: t[0], x: t[1], y: t[2], s: t[3], w: 0 }));
    say(L.line);
  },
  update(dt) {
    for (const it of this.items) if (it.found && it.fly < 1) it.fly = Math.min(1, it.fly + dt * 2.2);
    for (const d of this.decoys) if (d.w > 0) d.w -= dt;
  },
  render() {
    drawBg(this.bg);
    for (const d of this.decoys) art(d.id, d.x + (d.w > 0 ? Math.sin(d.w * 50) * 7 : 0), d.y, d.s);
    rr(TRAY.x, TRAY.y, TRAY.w, TRAY.h, 40); ctx.fillStyle = C.cream; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = C.line; ctx.stroke();
    for (const it of this.items) art(it.id, it.sx, TRAY.cy, 96, 0.28);
    for (const it of this.items) {
      if (!it.found) { art(it.id, it.x, it.y, it.s); continue; }
      const k = 1 - (1 - it.fly) * (1 - it.fly);
      art(it.id, it.x + (it.sx - it.x) * k, it.y + (TRAY.cy - it.y) * k - Math.sin(k * Math.PI) * 120, it.s + (96 - it.s) * k);
    }
    drawBubble();
  },
  down(x, y) {
    for (const it of this.items) {
      if (it.found || !near(x, y, it.x, it.y, it.s / 2 + TAP_PAD)) continue;
      it.found = true; this.left--; sfx.good(); burst(it.x, it.y, 14);
      if (this.left === 0) levelDone(this.i);
      return;
    }
    for (const d of this.decoys) if (near(x, y, d.x, d.y, d.s / 2 + 10)) { d.w = 0.4; sfx.bad(); return; }
  },
  hint() { for (const it of this.items) if (!it.found) return it; return null; },
};

// ---------- игра 2: следы ----------
function oval(x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill(); }
function drawPrint(kind, x, y, rot, sc, color) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sc, sc); ctx.fillStyle = color; ctx.strokeStyle = color;
  if (kind === "bird") {
    ctx.lineWidth = 7; ctx.lineCap = "round"; ctx.beginPath();
    ctx.moveTo(0, 6); ctx.lineTo(0, -30); ctx.moveTo(0, 6); ctx.lineTo(-20, -20); ctx.moveTo(0, 6); ctx.lineTo(20, -20); ctx.moveTo(0, 6); ctx.lineTo(0, 24); ctx.stroke();
  } else {
    const k = kind === "dog" ? 1 : 0.5;
    oval(0, 14 * k, 30 * k, 24 * k); oval(-30 * k, -16 * k, 11 * k, 14 * k); oval(-11 * k, -34 * k, 11 * k, 14 * k); oval(11 * k, -34 * k, 11 * k, 14 * k); oval(30 * k, -16 * k, 11 * k, 14 * k);
  }
  ctx.restore();
}
scenes.tracks = {
  isGame: true,
  bgId() { return this.bg; },
  enter(i) {
    const L = P.levels[i]; this.i = i; this.bg = L.bg; this.left = L.dog.length; this.prints = [];
    for (let k = 0; k < L.dog.length; k++) {
      const a = L.dog[k], b = L.dog[Math.min(k + 1, L.dog.length - 1)], p = L.dog[Math.max(k - 1, 0)];
      this.prints.push({ kind: "dog", x: a[0], y: a[1], rot: Math.atan2(b[1] - p[1], b[0] - p[0]) + Math.PI / 2, found: false, w: 0, pop: 0 });
    }
    for (const a of L.cat) this.prints.push({ kind: "cat", x: a[0], y: a[1], rot: rnd() * TAU, found: false, w: 0, pop: 0 });
    for (const a of L.bird) this.prints.push({ kind: "bird", x: a[0], y: a[1], rot: rnd() * TAU, found: false, w: 0, pop: 0 });
    say(L.line);
  },
  update(dt) { for (const p of this.prints) { if (p.w > 0) p.w -= dt; if (p.pop > 0) p.pop -= dt; } },
  render() {
    drawBg(this.bg);
    for (const p of this.prints) {
      const dx = p.w > 0 ? Math.sin(p.w * 50) * 7 : 0, sc = 1 + (p.pop > 0 ? p.pop * 1.2 : 0);
      if (p.found) { ctx.beginPath(); ctx.arc(p.x, p.y, 62, 0, TAU); ctx.fillStyle = "rgba(255,200,61,.55)"; ctx.fill(); }
      drawPrint(p.kind, p.x + dx, p.y, p.rot, sc, p.found ? C.glow : C.print);
    }
    drawBubble();
  },
  down(x, y) {
    for (const p of this.prints) {
      if (p.found || !near(x, y, p.x, p.y, 62)) continue;
      if (p.kind === "dog") {
        p.found = true; p.pop = 0.3; this.left--; sfx.good(); burst(p.x, p.y, 10);
        if (this.left === 0) { sfx.bark(); levelDone(this.i); }
      } else { p.w = 0.4; sfx.bad(); if (!S.done) say(p.kind === "cat" ? "tracks_cat" : "tracks_bird"); }
      return;
    }
  },
  hint() { for (const p of this.prints) if (p.kind === "dog" && !p.found) return p; return null; },
};

// ---------- игра 3: найди пару ----------
const CARD = { w: 190, h: 185, gap: 20, x0: 55, y0: 320, cols: 3 };
scenes.memory = {
  isGame: true,
  bgId() { return this.bg; },
  enter(i) {
    const L = P.levels[i]; this.i = i; this.bg = L.bg; this.first = null; this.second = null; this.wait = 0; this.pairs = L.pairs.length;
    const ids = shuffle(L.pairs.concat(L.pairs));
    this.cards = ids.map((id, k) => ({ id, x: CARD.x0 + (k % CARD.cols) * (CARD.w + CARD.gap), y: CARD.y0 + ((k / CARD.cols) | 0) * (CARD.h + CARD.gap), face: false, flip: 0, matched: false }));
    say(L.line);
  },
  update(dt) {
    for (const c of this.cards) { const to = c.face ? 1 : 0; if (c.flip < to) c.flip = Math.min(to, c.flip + dt * 5); else if (c.flip > to) c.flip = Math.max(to, c.flip - dt * 5); }
    if (this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        const a = this.first, b = this.second; this.first = this.second = null;
        if (a.id === b.id) { a.matched = b.matched = true; sfx.good(); burst(a.x + CARD.w / 2, a.y + CARD.h / 2, 10); burst(b.x + CARD.w / 2, b.y + CARD.h / 2, 10); if (--this.pairs === 0) levelDone(this.i); }
        else { a.face = b.face = false; }
      }
    }
  },
  render() {
    drawBg(this.bg);
    for (const c of this.cards) {
      const sx = Math.max(0.04, Math.abs(1 - 2 * c.flip)), up = c.flip > 0.5, cx = c.x + CARD.w / 2, cy = c.y + CARD.h / 2;
      ctx.save(); ctx.translate(cx, cy); ctx.scale(sx, 1);
      rr(-CARD.w / 2, -CARD.h / 2, CARD.w, CARD.h, 28); ctx.fillStyle = up ? C.cream : C.coral; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = c.matched ? C.glow : C.line; ctx.stroke();
      if (up) art(c.id, 0, 0, 130); else drawPrint("dog", 0, 8, 0, 1.2, "rgba(255,255,255,.85)");
      ctx.restore();
    }
    drawBubble();
  },
  down(x, y) {
    if (this.wait > 0 || S.done) return;
    for (const c of this.cards) {
      if (c.matched || c.face || x < c.x || x > c.x + CARD.w || y < c.y || y > c.y + CARD.h) continue;
      c.face = true; sfx.flip();
      if (!this.first) this.first = c; else { this.second = c; this.wait = this.first.id === c.id ? 0.45 : 1.0; }
      return;
    }
  },
};

// ---------- игра 4: поймай мячики ----------
const FIELD = { x0: 80, x1: 640, y0: 380, y1: 1170, r: 62 };
scenes.catch = {
  isGame: true,
  bgId() { return this.bg; },
  enter(i) {
    const L = P.levels[i]; this.i = i; this.bg = L.bg; this.need = L.need; this.caught = 0; this.spawned = 0; this.ids = L.balls;
    this.balls = Array.from({ length: 4 }, () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0, id: "", a: 0 }));
    say(L.line);
  },
  update(dt) {
    for (const b of this.balls) {
      if (!b.on) {
        if (this.spawned < this.need) {
          const ang = rnd() * TAU, v = 130 + rnd() * 90;
          b.on = true; b.id = this.ids[this.spawned % this.ids.length]; this.spawned++;
          b.x = FIELD.x0 + rnd() * (FIELD.x1 - FIELD.x0); b.y = FIELD.y0 + rnd() * (FIELD.y1 - FIELD.y0); b.vx = Math.cos(ang) * v; b.vy = Math.sin(ang) * v; b.a = 0;
        }
        continue;
      }
      b.x += b.vx * dt; b.y += b.vy * dt; b.a += b.vx * dt * 0.012;
      if (b.x < FIELD.x0) { b.x = FIELD.x0; b.vx = Math.abs(b.vx); } else if (b.x > FIELD.x1) { b.x = FIELD.x1; b.vx = -Math.abs(b.vx); }
      if (b.y < FIELD.y0) { b.y = FIELD.y0; b.vy = Math.abs(b.vy); } else if (b.y > FIELD.y1) { b.y = FIELD.y1; b.vy = -Math.abs(b.vy); }
    }
  },
  render() {
    drawBg(this.bg);
    for (const b of this.balls) if (b.on) art(b.id, b.x, b.y, FIELD.r * 2, 1, b.a || 0.0001);
    drawBubble();
    const x0 = W / 2 - (this.need - 1) * 26;
    for (let k = 0; k < this.need; k++) { ctx.beginPath(); ctx.arc(x0 + k * 52, 310, 18, 0, TAU); ctx.fillStyle = k < this.caught ? C.glow : "rgba(255,255,255,.7)"; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = C.line; ctx.stroke(); }
  },
  down(x, y) {
    if (S.done) return;
    for (const b of this.balls) {
      if (!b.on || !near(x, y, b.x, b.y, FIELD.r + TAP_PAD)) continue;
      b.on = false; this.caught++; sfx.pop(); burst(b.x, b.y, 16);
      if (this.caught >= this.need) levelDone(this.i);
      return;
    }
  },
};

// ---------- игра 5: собери картинку ----------
const BOARD = { x: 120, y: 320, cell: 240, trayY: 1160, small: 0.42 };
scenes.puzzle = {
  isGame: true,
  bgId() { return this.bg; },
  enter(i) {
    const L = P.levels[i]; this.i = i; this.bg = L.bg; this.cols = L.cols; this.rows = L.rows; this.drag = null; this.left = L.cols * L.rows;
    const pw = L.cols * BOARD.cell, ph = L.rows * BOARD.cell, pic = document.createElement("canvas"), g = pic.getContext("2d");
    pic.width = pw; pic.height = ph;
    if (IMG.puzzle) { const im = IMG.puzzle, k = Math.max(pw / im.width, ph / im.height); g.drawImage(im, (pw - im.width * k) / 2, (ph - im.height * k) / 2, im.width * k, im.height * k); }
    else {
      const sk = g.createLinearGradient(0, 0, 0, ph * 0.5); sk.addColorStop(0, "#8FD3FF"); sk.addColorStop(1, "#E6F6FF"); g.fillStyle = sk; g.fillRect(0, 0, pw, ph * 0.5);
      g.fillStyle = "#7CC96A"; g.fillRect(0, ph * 0.5, pw, ph * 0.5); g.textAlign = "center"; g.textBaseline = "middle";
      for (const d of L.pic) { g.font = ((d[3] * 0.82) | 0) + "px " + EMOJI; g.fillText(d[0], d[1], d[2]); }
    }
    this.pic = pic;
    const order = shuffle(Array.from({ length: this.left }, (_, k) => k)), step = (W - 60) / this.left;
    this.pieces = order.map((k, slot) => {
      const c = k % L.cols, r = (k / L.cols) | 0, hx = 30 + step * (slot + 0.5);
      return { c, r, tx: BOARD.x + (c + 0.5) * BOARD.cell, ty: BOARD.y + (r + 0.5) * BOARD.cell, hx, hy: BOARD.trayY, x: hx, y: BOARD.trayY, k: BOARD.small, placed: false };
    });
    say(L.line);
  },
  update(dt) {
    for (const p of this.pieces) {
      if (p === this.drag) { p.k = Math.min(1, p.k + dt * 5); continue; }
      const tx = p.placed ? p.tx : p.hx, ty = p.placed ? p.ty : p.hy, tk = p.placed ? 1 : BOARD.small, f = Math.min(1, dt * 14);
      p.x += (tx - p.x) * f; p.y += (ty - p.y) * f; p.k += (tk - p.k) * f;
    }
  },
  drawPiece(p) {
    const s = BOARD.cell * p.k;
    ctx.drawImage(this.pic, p.c * BOARD.cell, p.r * BOARD.cell, BOARD.cell, BOARD.cell, p.x - s / 2, p.y - s / 2, s, s);
    ctx.lineWidth = p.placed ? 2 : 5; ctx.strokeStyle = p.placed ? "rgba(107,74,43,.4)" : C.line; ctx.strokeRect(p.x - s / 2, p.y - s / 2, s, s);
  },
  render() {
    drawBg(this.bg);
    const bw = this.cols * BOARD.cell, bh = this.rows * BOARD.cell;
    ctx.fillStyle = C.cream; ctx.fillRect(BOARD.x, BOARD.y, bw, bh); ctx.globalAlpha = 0.18; ctx.drawImage(this.pic, BOARD.x, BOARD.y); ctx.globalAlpha = 1;
    ctx.lineWidth = 3; ctx.strokeStyle = "rgba(107,74,43,.5)";
    for (let c = 1; c < this.cols; c++) { ctx.beginPath(); ctx.moveTo(BOARD.x + c * BOARD.cell, BOARD.y); ctx.lineTo(BOARD.x + c * BOARD.cell, BOARD.y + bh); ctx.stroke(); }
    for (let r = 1; r < this.rows; r++) { ctx.beginPath(); ctx.moveTo(BOARD.x, BOARD.y + r * BOARD.cell); ctx.lineTo(BOARD.x + bw, BOARD.y + r * BOARD.cell); ctx.stroke(); }
    ctx.lineWidth = 8; ctx.strokeStyle = C.line; ctx.strokeRect(BOARD.x, BOARD.y, bw, bh);
    for (const p of this.pieces) if (p.placed) this.drawPiece(p);
    for (const p of this.pieces) if (!p.placed && p !== this.drag) this.drawPiece(p);
    drawBubble();
    if (this.drag) this.drawPiece(this.drag);
  },
  down(x, y) {
    if (S.done) return;
    for (const p of this.pieces) if (!p.placed && near(x, y, p.x, p.y, 75)) { this.drag = p; p.x = x; p.y = y - 70; sfx.tap(); return; }
  },
  move(x, y) { if (this.drag) { this.drag.x = x; this.drag.y = y - 70; } },
  up() {
    const p = this.drag; if (!p) return; this.drag = null;
    if (near(p.x, p.y, p.tx, p.ty, 115)) { p.placed = true; this.left--; sfx.good(); burst(p.tx, p.ty, 12); if (this.left === 0) levelDone(this.i); }
    else sfx.bad();
  },
  hint() { if (this.drag) return null; for (const p of this.pieces) if (!p.placed) return { x: p.tx, y: p.ty }; return null; },
};

// ---------- грамота ----------
scenes.diploma = {
  enter() { S.bub.text = ""; this.t = 0; this.c = 0; sfx.win(); speak("diploma"); },
  update(dt) { this.t += dt; this.c -= dt; if (this.c <= 0) { this.c = 0.22; burst(60 + vrnd() * 600, 150, 5); } },
  render() {
    ctx.fillStyle = C.sky; ctx.fillRect(0, 0, W, H);
    rr(40, 130, 640, 920, 44); ctx.fillStyle = C.cream; ctx.fill(); ctx.lineWidth = 14; ctx.strokeStyle = C.gold; ctx.stroke();
    rr(62, 152, 596, 876, 30); ctx.lineWidth = 4; ctx.strokeStyle = C.line; ctx.stroke();
    txt(STR.diploma.title, 360, 250, 70, C.line);
    art("hero_happy", 250, 480 + Math.sin(S.t * 2) * 8, 270); art("finik_happy", 480, 510 + Math.sin(S.t * 2 + 1.5) * 8, 220);
    txt(STR.diploma.name, 360, 710, 92, C.coral, "#fff");
    for (let i = 0; i < STR.diploma.body.length; i++) txt(STR.diploma.body[i], 360, 800 + i * 54, 40, C.line, null, 700);
    txt(STR.diploma.sign, 360, 965, 32, C.line, null, 600);
    if (this.t > 1) drawBtn(BTN.again, STR.ui.again, true);
  },
  again() { if (this.t <= 1) return; sfx.tap(); S.progress = 0; save(); go("story", introArg()); },
  down(x, y) { if (hit(BTN.again, x, y)) this.again(); },
  key() { this.again(); },
};

// ---------- ввод: нажатия и перетаскивание ----------
let pointerId = null;
function toStage(e, out) { out.x = (e.clientX - view.ox) / view.scale; out.y = (e.clientY - view.oy) / view.scale; return out; }
const pt = { x: 0, y: 0 };
canvas.addEventListener("pointerdown", e => {
  e.preventDefault(); unlockAudio(); S.idle = 0;
  if (pointerId !== null || S.fade.next || !S.scene) return;
  pointerId = e.pointerId; toStage(e, pt);
  if (near(pt.x, pt.y, BTN.mute.x, BTN.mute.y, BTN.mute.r + 12)) { toggleMute(); return; }
  if (S.scene.isGame && near(pt.x, pt.y, BTN.home.x, BTN.home.y, BTN.home.r + 12)) { sfx.tap(); go("map"); return; }
  if (S.bub.text && pt.y >= BUB.y && pt.y <= BUB.y + S.bub.h && S.name !== "story") { speak(S.bub.id); return; }
  S.scene.down(pt.x, pt.y);
});
canvas.addEventListener("pointermove", e => { if (e.pointerId !== pointerId || !S.scene || !S.scene.move) return; toStage(e, pt); S.scene.move(pt.x, pt.y); });
function release(e) { if (e.pointerId !== pointerId) return; pointerId = null; if (S.scene && S.scene.up) { toStage(e, pt); S.scene.up(pt.x, pt.y); } }
canvas.addEventListener("pointerup", release); canvas.addEventListener("pointercancel", release);
canvas.addEventListener("contextmenu", e => e.preventDefault());
const BIND = { Space: "next", Enter: "next", NumpadEnter: "next" };
addEventListener("keydown", e => {
  if (!BIND[e.code] || e.repeat) return; e.preventDefault(); unlockAudio(); S.idle = 0;
  if (!S.fade.next && S.scene && S.scene.key) S.scene.key();
});

// ---------- главный цикл ----------
function update(dt) {
  S.t += dt; S.idle += dt;
  const f = S.fade;
  if (f.dir) {
    f.a += f.dir * dt * 4;
    if (f.dir > 0 && f.a >= 1) { f.a = 1; f.dir = -1; switchTo(f.next.name, f.next.arg); }
    else if (f.dir < 0 && f.a <= 0) { f.a = 0; f.dir = 0; f.next = null; }
  }
  if (S.scene) S.scene.update(dt);
  if (S.after) { S.after.t -= dt; if (S.after.t <= 0) { const fn = S.after.fn; S.after = null; fn(); } }
  updateParts(dt);
}
function render() {
  // Поля вокруг сцены на высоких телефонах закрашиваем цветами неба и земли текущего фона.
  const eb = S.name === "diploma" ? null : P.bg[S.scene && S.scene.bgId ? S.scene.bgId() : "bg_map"];
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = eb ? eb.sky[0] : C.sky; ctx.fillRect(0, 0, canvas.width, canvas.height / 2);
  ctx.fillStyle = eb ? eb.ground[1] : C.sky; ctx.fillRect(0, canvas.height / 2, canvas.width, canvas.height / 2);
  const k = view.dpr * view.scale; ctx.setTransform(k, 0, 0, k, view.ox * view.dpr, view.oy * view.dpr);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  if (S.scene) {
    S.scene.render(); drawParts(); drawTopBar();
    if (!S.done && S.idle > HINT_AFTER && S.scene.hint) {
      const h = S.scene.hint();
      if (h) { ctx.beginPath(); ctx.arc(h.x, h.y, 72 + Math.sin(S.t * 6) * 8, 0, TAU); ctx.lineWidth = 9; ctx.strokeStyle = C.glow; ctx.stroke(); glyph(STR.ui.hand, h.x + 55, h.y + 70 + Math.sin(S.t * 6) * 8, 90); }
    }
  }
  if (S.fade.a > 0) { ctx.globalAlpha = Math.min(1, S.fade.a); ctx.fillStyle = C.cream; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  ctx.restore();
}

let acc = 0, last = performance.now(), paused = false, frames = 0, fpsAt = last;
document.addEventListener("visibilitychange", () => {
  paused = document.hidden; last = performance.now();
  if (paused) { if (voiceEl) voiceEl.pause(); if (music) music.pause(); } else if (music && !S.muted) music.play().catch(() => {});
});
function frame(now) {
  requestAnimationFrame(frame);
  if (paused) return;
  acc = Math.min(acc + (now - last), 250); last = now;
  while (acc >= STEP) { update(STEP / 1000); acc -= STEP; }
  render();
  if (DEV && (frames++, now - fpsAt >= 500)) { devEl.textContent = Math.round(frames * 1000 / (now - fpsAt)) + " fps · " + S.name; frames = 0; fpsAt = now; }
}

// ---------- запуск ----------
load();
if (Q.has("reset")) { S.progress = 0; save(); }
switchTo("title");
if (DEV) {
  devEl.style.display = "block";
  // Для проверки: шагнуть игру вручную и перейти сразу к нужному месту (?dev=1&go=2, go=finale, go=diploma).
  window.__game = { S, P, scenes, go, switchTo, step(n) { for (let i = 0; i < n; i++) update(STEP / 1000); render(); } };
  const g = Q.get("go");
  if (g === "diploma") switchTo("diploma");
  else if (g === "finale") { S.progress = P.levels.length; switchTo("map"); }
  else if (g !== null && P.levels[+g]) { S.progress = Math.max(S.progress, +g); switchTo(P.levels[+g].type, +g); }
}
requestAnimationFrame(frame);
