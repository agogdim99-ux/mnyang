script.js/* 멍냥 초원 — 강아지·고양이와 아침부터 밤까지 달려 집에 가는 게임 */
(() => {
'use strict';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = a => a[Math.floor(Math.random() * a.length)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- 저장 (이 브라우저에만) ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};

/* ---------- 친구들 ---------- */
const FRIENDS = [
  { id: 'kong',   kind: 'dog', name: '콩이',   body: '#f2c58e', dark: '#c98a4f', belly: '#fff1dc', nose: '#5a3b2a' },
  { id: 'bori',   kind: 'dog', name: '보리',   body: '#fffaf3', dark: '#c48a5a', belly: '#ffffff', nose: '#5a3b2a', leg: '#f1e2d0', patch: true },
  { id: 'dubu',   kind: 'dog', name: '두부',   body: '#b88560', dark: '#7a5034', belly: '#f6dcc2', nose: '#3a2418' },
  { id: 'cheese', kind: 'cat', name: '치즈',   body: '#ffd2a0', dark: '#f0965a', belly: '#fff6ea', nose: '#ff8fa3', stripes: true },
  { id: 'gureum', kind: 'cat', name: '구름이', body: '#e6eaf0', dark: '#a3acbb', belly: '#ffffff', nose: '#ff9fb0', stripes: true },
  { id: 'kkam',   kind: 'cat', name: '까망이', body: '#4b4453', dark: '#332d3a', belly: '#f4eef6', nose: '#ff9fb0', eye: '#ffd84d', line: '#f4eef6' },
];
const byId = id => FRIENDS.find(f => f.id === id) || FRIENDS[0];
const josa = (word, a, b) => { const c = word.charCodeAt(word.length - 1) - 0xac00; return (c >= 0 && c % 28) ? a : b; };

const MODES = {
  // dirs: 장애물이 오는 방향별 확률 (front 앞, fall 하늘에서 떨어짐, swoop 대각선, back 뒤에서)
  easy:   { name: '쉬운 모드', speed: 5.3, gain: .06, gap: [1.35, 2.2], snack: .5,  goal: 30, pair: 0,   dirs: { front: 1 } },
  normal: { name: '보통 모드', speed: 5.3, gain: .06, gap: [1.1, 1.9],  snack: .34, goal: 45, pair: .1,  dirs: { front: .65, fall: .35 } },
  hard:   { name: '하드 모드', speed: 6.3, gain: .075, gap: [.85, 1.5], snack: .22, goal: 60, pair: .2, dirs: { front: .4, fall: .22, swoop: .22, back: .16 } },
};

const S = {
  friend: byId(store.get('mn2-friend', 'cheese')),
  muted: store.get('mn-muted', false),
  best: Object.assign({ easy: 0, normal: 0, hard: 0 }, store.get('mn2-best', {})),
  home: Object.assign({ easy: false, normal: false, hard: false }, store.get('mn2-home', {})),
};

/* ---------- 소리 ---------- */
let ac = null;
function audio() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; } }
  if (ac.state === 'suspended') ac.resume();
}
function tone(f, dur = .15, type = 'sine', vol = .08, slide = 0, delay = 0) {
  if (S.muted || !ac) return;
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(f * slide, t + dur);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .012); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + .03);
}
const sfx = {
  pick() { tone(660, .12, 'triangle', .06); tone(990, .16, 'triangle', .05, 0, .08); },
  jump() { tone(520, .16, 'triangle', .06, 1.6); },
  snack() { tone(880, .12, 'triangle', .06); tone(1320, .18, 'triangle', .05, 0, .07); },
  hurt() { tone(300, .3, 'sine', .08, .5); },
  stage() { [523, 659, 784].forEach((f, i) => tone(f, .25, 'triangle', .05, 0, i * .09)); },
  home() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, .3, 'triangle', .05, 0, i * .13)); },
  over() { [523, 440, 392].forEach((f, i) => tone(f, .35, 'sine', .06, 0, i * .15)); },
};

/* ---------- 그리기 도구 ---------- */
function hex(c) { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function mix(a, b, t) { const A = hex(a), B = hex(b); return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',') + ')'; }
function ell(c, x, y, rx, ry, rot = 0) { c.beginPath(); c.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, Math.PI * 2); }
function rrect(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
}
function starPath(c, x, y, r, rot = 0) {
  c.beginPath();
  for (let i = 0; i < 10; i++) { const a = rot - Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .48 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath();
}
function heartPath(c, x, y, r) {
  c.beginPath(); c.moveTo(x, y + r * .9);
  c.bezierCurveTo(x - r * 1.5, y - r * .1, x - r * .7, y - r * 1.3, x, y - r * .45);
  c.bezierCurveTo(x + r * .7, y - r * 1.3, x + r * 1.5, y - r * .1, x, y + r * .9); c.closePath();
}

/* ---------- 강아지 · 고양이 그리기 ----------
   x,y = 발이 닿는 바닥, s = 크기. o: {t, run, air, hurt, happy, flip, sit} */
function drawPet(c, p, x, y, s, o = {}) {
  const t = o.t || 0, line = p.line || '#3d2b20';
  c.save(); c.translate(x, y); if (o.flip) c.scale(-1, 1);
  const bob = o.run && !o.air ? Math.abs(Math.sin(t * 14)) * s * .05 : Math.sin(t * 3) * s * .015;
  c.lineCap = 'round'; c.lineJoin = 'round';

  // 꼬리
  c.strokeStyle = p.dark; c.lineWidth = s * .13; c.beginPath();
  if (p.kind === 'dog') {
    const w = Math.sin(t * (o.happy ? 26 : 16)) * .25;
    c.moveTo(-s * .48, -s * .62 - bob); c.quadraticCurveTo(-s * (.78 + w * .3), -s * .8 - bob, -s * (.7 + w), -s * 1.02 - bob);
  } else {
    const w = Math.sin(t * 4) * .12;
    c.moveTo(-s * .48, -s * .55 - bob); c.bezierCurveTo(-s * .9, -s * .6 - bob, -s * (.82 + w), -s * 1.1 - bob, -s * (.62 + w), -s * 1.22 - bob);
  }
  c.stroke();

  // 다리
  c.fillStyle = p.leg || p.dark;
  [[-.34, 0], [-.14, 1], [.16, 0], [.34, 1]].forEach(([lx, ph]) => {
    let sw = 0, lift = 0, len = .4;
    if (o.air) { lift = s * .1; sw = (ph ? 1 : -1) * s * .05; }
    else if (o.run) { sw = Math.sin(t * 14 + ph * Math.PI) * s * .11; lift = Math.max(0, Math.sin(t * 14 + ph * Math.PI)) * s * .06; }
    rrect(c, lx * s + sw - s * .075, -s * len - lift, s * .15, s * len, s * .07); c.fill();
  });

  // 몸
  c.fillStyle = p.body; ell(c, 0, -s * .56 - bob, s * .56, s * .33); c.fill();
  c.fillStyle = p.belly; ell(c, s * .06, -s * .45 - bob, s * .34, s * .16); c.fill();
  if (p.stripes) {
    c.strokeStyle = p.dark; c.lineWidth = s * .06;
    for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-s * (.3 - i * .18), -s * .86 - bob); c.lineTo(-s * (.24 - i * .18), -s * .72 - bob); c.stroke(); }
  }
  if (p.patch) { c.fillStyle = p.dark; ell(c, -s * .18, -s * .74 - bob, s * .16, s * .1, -.2); c.fill(); }

  // 머리
  const hx = s * .5, hy = -s * .98 - bob, hr = s * .37;
  if (p.kind === 'cat') {
    [[-1, -.35], [1, .35]].forEach(([d, rot]) => {
      c.save(); c.translate(hx + d * hr * .55, hy - hr * .6); c.rotate(rot);
      c.fillStyle = p.body; c.beginPath(); c.moveTo(-s * .14, s * .08); c.lineTo(0, -s * .2); c.lineTo(s * .14, s * .08); c.closePath(); c.fill();
      c.fillStyle = '#ffb3c1'; c.beginPath(); c.moveTo(-s * .07, s * .05); c.lineTo(0, -s * .1); c.lineTo(s * .07, s * .05); c.closePath(); c.fill();
      c.restore();
    });
  }
  c.fillStyle = p.body; ell(c, hx, hy, hr, hr * .93); c.fill();
  if (p.patch) { c.fillStyle = p.dark; ell(c, hx + hr * .46, hy - hr * .05, s * .12, s * .11); c.fill(); }
  if (p.kind === 'dog') {
    const flap = o.air ? -.35 : Math.sin(t * 9) * .08;
    c.fillStyle = p.dark;
    ell(c, hx - hr * .82, hy + hr * .05, s * .12, s * .25, .35 + flap); c.fill();
    ell(c, hx + hr * .82, hy + hr * .05, s * .12, s * .25, -.35 - flap); c.fill();
  } else if (p.stripes) {
    c.strokeStyle = p.dark; c.lineWidth = s * .05;
    for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(hx + i * s * .08, hy - hr * .92); c.lineTo(hx + i * s * .07, hy - hr * .62); c.stroke(); }
  }
  // 주둥이, 코, 볼
  c.fillStyle = p.belly; ell(c, hx + s * .04, hy + hr * .38, s * .19, s * .13); c.fill();
  c.fillStyle = p.nose; ell(c, hx + s * .04, hy + hr * .24, s * .06, s * .045); c.fill();
  c.fillStyle = '#ff9fae77'; ell(c, hx - hr * .6, hy + hr * .32, s * .08, s * .05); c.fill(); ell(c, hx + hr * .68, hy + hr * .32, s * .08, s * .05); c.fill();
  // 눈
  const ex1 = hx - hr * .38, ex2 = hx + hr * .46, ey = hy - hr * .05;
  c.strokeStyle = p.eye ? p.eye : '#3d2b20'; c.lineWidth = s * .045;
  if (o.hurt) {
    [[ex1, 1], [ex2, -1]].forEach(([ex, d]) => { c.beginPath(); c.moveTo(ex - s * .05 * d, ey - s * .05); c.lineTo(ex + s * .04 * d, ey); c.lineTo(ex - s * .05 * d, ey + s * .05); c.stroke(); });
  } else if (o.happy) {
    [ex1, ex2].forEach(ex => { c.beginPath(); c.arc(ex, ey + s * .03, s * .05, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); });
  } else {
    [ex1, ex2].forEach(ex => {
      if (p.eye) { c.fillStyle = p.eye; ell(c, ex, ey, s * .06, s * .068); c.fill(); }
      c.fillStyle = '#2b1f18'; ell(c, ex, ey, p.eye ? s * .03 : s * .048, s * .058); c.fill();
      c.fillStyle = '#fff'; ell(c, ex + s * .016, ey - s * .022, s * .017, s * .017); c.fill();
    });
  }
  // 입
  c.strokeStyle = line; c.lineWidth = s * .03;
  const mx = hx + s * .04, my = hy + hr * .42;
  c.beginPath(); c.arc(mx - s * .035, my, s * .035, 0, Math.PI); c.arc(mx + s * .035, my, s * .035, 0, Math.PI); c.stroke();
  if (p.kind === 'dog' && (o.run || o.happy) && !o.hurt) { c.fillStyle = '#ff7f93'; ell(c, mx, my + s * .07, s * .04, s * .05); c.fill(); }
  if (p.kind === 'cat') {
    c.strokeStyle = p.eye ? '#d8cfe0' : '#8a6a55'; c.lineWidth = s * .018;
    [[-1, -.08], [-1, .06], [1, -.08], [1, .06]].forEach(([d, dy]) => { c.beginPath(); c.moveTo(mx + d * s * .14, my - s * .03); c.lineTo(mx + d * s * .34, my - s * .05 + dy * s); c.stroke(); });
  }
  c.restore();
}

/* ---------- 주인 ---------- */
function drawOwner(c, x, y, s, o = {}) {
  const t = o.t || 0;
  c.save(); c.translate(x, y); c.lineCap = 'round'; c.lineJoin = 'round';
  // 다리
  c.fillStyle = '#6f8fc9';
  rrect(c, -s * .3, -s * .9, s * .24, s * .9, s * .1); c.fill();
  rrect(c, s * .06, -s * .9, s * .24, s * .9, s * .1); c.fill();
  c.fillStyle = '#5a4636'; ell(c, -s * .18, -s * .02, s * .17, s * .08); c.fill(); ell(c, s * .18, -s * .02, s * .17, s * .08); c.fill();
  // 몸 (원피스 같은 상의)
  c.fillStyle = '#ffa69a';
  c.beginPath(); c.moveTo(-s * .38, -s * 1.95); c.quadraticCurveTo(0, -s * 2.08, s * .38, -s * 1.95);
  c.lineTo(s * .55, -s * .85); c.quadraticCurveTo(0, -s * .72, -s * .55, -s * .85); c.closePath(); c.fill();
  c.fillStyle = '#fff3c9'; ell(c, 0, -s * 1.3, s * .14, s * .14); c.fill();
  // 머리카락 뒤
  const hy = -s * 2.42;
  c.fillStyle = '#6b4a35'; ell(c, 0, hy + s * .05, s * .48, s * .5); c.fill();
  // 얼굴
  c.fillStyle = '#ffdcbf'; ell(c, 0, hy + s * .06, s * .38, s * .4); c.fill();
  // 앞머리
  c.fillStyle = '#6b4a35';
  c.beginPath(); c.moveTo(-s * .4, hy - s * .02); c.quadraticCurveTo(-s * .2, hy - s * .5, s * .1, hy - s * .4);
  c.quadraticCurveTo(s * .4, hy - s * .38, s * .42, hy + s * .02); c.quadraticCurveTo(s * .2, hy - s * .18, 0, hy - s * .14);
  c.quadraticCurveTo(-s * .25, hy - s * .1, -s * .4, hy - s * .02); c.fill();
  // 얼굴 표정
  c.strokeStyle = '#4a3326'; c.lineWidth = s * .045;
  if (o.happy) {
    [-1, 1].forEach(d => { c.beginPath(); c.arc(d * s * .14, hy + s * .08, s * .06, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); });
  } else {
    c.fillStyle = '#3d2b20'; [-1, 1].forEach(d => { ell(c, d * s * .14, hy + s * .06, s * .04, s * .05); c.fill(); });
  }
  c.fillStyle = '#ff9fae88'; ell(c, -s * .24, hy + s * .2, s * .07, s * .045); c.fill(); ell(c, s * .24, hy + s * .2, s * .07, s * .045); c.fill();
  c.beginPath(); c.arc(0, hy + s * .2, s * .08, .15 * Math.PI, .85 * Math.PI); c.stroke();
  // 팔 (안기 전에는 손 흔들기)
  if (!o.hug) {
    c.strokeStyle = '#ffdcbf'; c.lineWidth = s * .15;
    c.beginPath(); c.moveTo(-s * .38, -s * 1.8); c.lineTo(-s * .55, -s * 1.15); c.stroke();
    const wave = Math.sin(t * 8) * .35;
    c.beginPath(); c.moveTo(s * .38, -s * 1.8); c.lineTo(s * (.75 + wave * .2), -s * (2.4 + wave * .1)); c.stroke();
  }
  c.restore();
}
function drawHugArms(c, x, y, s) {
  c.save(); c.translate(x, y); c.strokeStyle = '#ffdcbf'; c.lineWidth = s * .16; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-s * .38, -s * 1.8); c.quadraticCurveTo(-s * .75, -s * 1.3, -s * .05, -s * 1.12); c.stroke();
  c.beginPath(); c.moveTo(s * .38, -s * 1.8); c.quadraticCurveTo(s * .8, -s * 1.45, s * .15, -s * 1.3); c.stroke();
  c.restore();
}
function drawHouse(c, x, y, s, night) {
  c.save(); c.translate(x, y);
  const w = s * 3.4, h = s * 2.3;
  c.fillStyle = '#fff4dd'; rrect(c, -w / 2, -h, w, h, s * .12); c.fill();
  c.strokeStyle = '#e8d2ae'; c.lineWidth = 3; c.stroke();
  c.fillStyle = '#b98a68'; c.fillRect(w * .22, -h - s * 1.3, s * .4, s * .8);
  c.fillStyle = '#ff8a7a'; c.beginPath(); c.moveTo(-w / 2 - s * .3, -h + 2); c.lineTo(0, -h - s * 1.5); c.lineTo(w / 2 + s * .3, -h + 2); c.closePath(); c.fill();
  c.strokeStyle = '#e46b5d'; c.lineWidth = 3; c.stroke();
  // 문
  c.fillStyle = '#b07a52'; c.beginPath(); c.moveTo(-s * .45, 0); c.lineTo(-s * .45, -s * 1.05); c.arc(0, -s * 1.05, s * .45, Math.PI, 0); c.lineTo(s * .45, 0); c.closePath(); c.fill();
  c.fillStyle = '#ffd25c'; ell(c, s * .28, -s * .55, s * .06, s * .06); c.fill();
  // 창문
  c.fillStyle = night ? '#ffe28a' : '#cfeeff'; rrect(c, w * .2, -h * .72, s * .7, s * .6, s * .08); c.fill();
  c.strokeStyle = '#e8d2ae'; c.lineWidth = 3; c.beginPath(); c.moveTo(w * .2 + s * .35, -h * .72); c.lineTo(w * .2 + s * .35, -h * .72 + s * .6); c.stroke();
  if (night) { c.globalAlpha = .25; c.fillStyle = '#ffe28a'; ell(c, w * .2 + s * .35, -h * .72 + s * .3, s * .8, s * .7); c.fill(); c.globalAlpha = 1; }
  // 꽃 화분
  c.fillStyle = '#e09a6b'; rrect(c, -w * .42, -s * .35, s * .5, s * .35, s * .06); c.fill();
  ['#ff8fb0', '#ffd25c', '#ff8fb0'].forEach((col, i) => { c.fillStyle = col; ell(c, -w * .42 + s * (.1 + i * .15), -s * .45, s * .08, s * .08); c.fill(); });
  c.restore();
}

/* ---------- 초원 배경 ---------- */
const STAGES = [
  { name: '아침', msg: '상쾌한 아침! 나뭇잎과 벌레를 피해요', sky1: '#ffd3c4', sky2: '#fff3df', far: '#bde6a0', near: '#9fd97c', ground: '#86c968', tuft: '#5fae4f', sun: '#ffd37a' },
  { name: '오후', msg: '오후가 됐어요! 빗방울을 피해요',     sky1: '#8fd1ff', sky2: '#e3f5ff', far: '#a9dc93', near: '#8dcf73', ground: '#7bc062', tuft: '#559f48', sun: '#ffe066' },
  { name: '밤',   msg: '밤이 됐어요! 별똥별을 피해요',       sky1: '#3f4590', sky2: '#9188cc', far: '#6f8f97', near: '#5c8a74', ground: '#55905d', tuft: '#3b6f45', sun: '#fff4c4' },
];
class Meadow {
  constructor() { this.w = 0; }
  build(w, h, g, s) {
    this.w = w; this.h = h; this.g = g; this.s = s;
    this.clouds = Array.from({ length: 5 }, () => ({ x: rand(0, w), y: rand(h * .06, h * .32), k: rand(.7, 1.3), sp: rand(.08, .18) }));
    this.tufts = Array.from({ length: Math.ceil(w / 26) + 2 }, () => ({ off: rand(0, 26), flower: Math.random() < .35, col: pick(['#fff', '#ffd9e1', '#fff1a8', '#d7c4ff']) }));
    this.dots = Array.from({ length: 45 }, () => ({ x: rand(0, 1), y: rand(0, .55), p: rand(0, 6) }));
    this.rain = Array.from({ length: 40 }, () => ({ x: rand(0, 1), y: rand(0, 1), v: rand(.6, 1) }));
  }
  pal(key, phase) {
    const p = clamp(phase, 0, 2), i = Math.min(1, Math.floor(p)), t = p - i;
    return mix(STAGES[i][key], STAGES[i + 1][key], p >= 2 ? 1 : t);
  }
  draw(c, scroll, phase, t) {
    const { w, h, g, s } = this;
    const sky = c.createLinearGradient(0, 0, 0, g);
    sky.addColorStop(0, this.pal('sky1', phase)); sky.addColorStop(1, this.pal('sky2', phase));
    c.fillStyle = sky; c.fillRect(-10, -10, w + 20, g + 20);
    const night = clamp(phase - 1, 0, 1);
    if (night > 0) {
      c.fillStyle = '#fffbe0';
      for (const d of this.dots) { c.globalAlpha = night * (.4 + .4 * Math.sin(t * 2 + d.p)); c.fillRect(d.x * w, d.y * g, 2, 2); }
      // 하늘의 작은 별똥별 장식
      const k = (t * .35) % 1; c.globalAlpha = night * (1 - k) * .8; c.strokeStyle = '#fffbe0'; c.lineWidth = 2;
      const sx0 = w * (.2 + ((Math.floor(t * .35) * 37) % 60) / 100), sy0 = g * .12;
      c.beginPath(); c.moveTo(sx0 - k * w * .3, sy0 + k * g * .15); c.lineTo(sx0 - k * w * .3 + 26, sy0 + k * g * .15 - 13); c.stroke();
      c.globalAlpha = 1;
    }
    // 해 / 달
    const sx = w * .82, sy = h * (.13 + Math.min(1, phase) * .02);
    c.fillStyle = this.pal('sun', phase);
    c.globalAlpha = .35; ell(c, sx, sy, s * .9, s * .9); c.fill(); c.globalAlpha = 1;
    ell(c, sx, sy, s * .55, s * .55); c.fill();
    if (night > .5) { c.fillStyle = this.pal('sky1', phase); ell(c, sx + s * .22, sy - s * .12, s * .45, s * .45); c.fill(); }
    // 구름
    c.fillStyle = night > .5 ? '#ffffff40' : '#ffffffdd';
    for (const cl of this.clouds) {
      const x = ((cl.x - scroll * cl.sp) % (w + 200) + w + 200) % (w + 200) - 100, k = cl.k * s * .5;
      ell(c, x, cl.y, k * 1.4, k * .7); c.fill(); ell(c, x - k, cl.y + k * .2, k, k * .55); c.fill(); ell(c, x + k, cl.y + k * .2, k, k * .55); c.fill();
    }
    this.hills(c, scroll * .15, g - s * 1.6, s * .7, 240, this.pal('far', phase));
    this.hills(c, scroll * .35, g - s * .7, s * .5, 170, this.pal('near', phase));
    // 오후 비 (배경 장식)
    const rainA = clamp(1 - Math.abs(phase - 1) * 1.6, 0, 1);
    if (rainA > 0) {
      c.strokeStyle = '#ffffff'; c.lineWidth = 1.5; c.globalAlpha = rainA * .5;
      for (const r of this.rain) { const y = ((r.y + t * r.v * .9) % 1) * g, x = ((r.x * w - t * 40) % w + w) % w; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 3, y + 10); c.stroke(); }
      c.globalAlpha = 1;
    }
    // 땅
    c.fillStyle = this.pal('ground', phase); c.fillRect(-10, g, w + 20, h - g + 10);
    c.strokeStyle = this.pal('tuft', phase); c.lineWidth = 2.5; c.lineCap = 'round';
    const step = 26, base = -(scroll % step);
    this.tufts.forEach((tf, i) => {
      const x = base + i * step + tf.off * .3, y = g + 6 + (i % 3) * 8;
      c.beginPath(); c.moveTo(x - 4, y); c.lineTo(x - 6, y - 7); c.moveTo(x, y); c.lineTo(x, y - 9); c.moveTo(x + 4, y); c.lineTo(x + 6, y - 7); c.stroke();
      if (tf.flower) { c.fillStyle = tf.col; ell(c, x + 10, y - 4, 3.5, 3.5); c.fill(); c.fillStyle = '#ffc94d'; ell(c, x + 10, y - 4, 1.5, 1.5); c.fill(); }
    });
  }
  hills(c, off, baseY, amp, len, col) {
    const { w, g } = this;
    c.fillStyle = col; c.beginPath(); c.moveTo(-10, g + 2);
    for (let x = -10; x <= w + 10; x += 8) c.lineTo(x, baseY - (Math.sin((x + off) / len) * .6 + Math.sin((x + off) / (len * .43)) * .4 + 1) * amp * .5);
    c.lineTo(w + 10, g + 2); c.closePath(); c.fill();
  }
}
function shadow(c, x, y, w) { c.fillStyle = '#00000018'; ell(c, x, y + 2, w, w * .22); c.fill(); }
function fitCanvas(cv) {
  const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  if (!r.width || !r.height) return null;
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { c, w: r.width, h: r.height };
}

/* ---------- 화면 전환 ---------- */
function showScreen(id) { for (const el of $$('.screen')) el.hidden = el.id !== id; requestAnimationFrame(() => { resizeTitle(); resizeGame(); }); }

/* =========================================================
   1) 첫 화면: 뛰어노는 친구들
   ========================================================= */
const titleCv = $('#titleCv');
const T = { c: null, w: 0, h: 0, g: 0, s: 40, meadow: new Meadow(), pals: [], chosen: null, chosenT: 0, hearts: [] };
function resizeTitle() {
  if ($('#titleScreen').hidden) return;
  const f = fitCanvas(titleCv); if (!f) return;
  Object.assign(T, f);
  T.g = T.h * .56; T.s = clamp(Math.min(T.h * .085, T.w * .13), 30, 62);
  T.meadow.build(T.w, T.h, T.g, T.s);
  if (!T.pals.length) {
    T.pals = FRIENDS.map((p, i) => ({
      p, depth: (i % 3) / 2 * .9 + rand(0, .1), x: rand(.12, .88), dir: Math.random() < .5 ? -1 : 1,
      sp: rand(.5, 1), y: 0, vy: 0, t: rand(0, 5), rest: 0, next: rand(1, 3),
    }));
  }
}
new ResizeObserver(resizeTitle).observe(titleCv);
function titlePalPos(a) {
  const scale = .78 + a.depth * .42, s = T.s * scale;
  const gy = T.g + (T.h - T.g) * (.16 + a.depth * .36);
  return { x: a.x * T.w, gy, s };
}
function updateTitle(dt) {
  for (const a of T.pals) {
    a.t += dt;
    if (a === T.chosen) { // 고른 친구는 제자리에서 폴짝
      a.vy -= 30 * dt; a.y += a.vy * dt; if (a.y <= 0) { a.y = 0; a.vy = T.chosenT < .9 ? 7 : 0; }
      continue;
    }
    if (a.rest > 0) { a.rest -= dt; }
    else { a.x += a.dir * a.sp * .09 * dt; if (a.x < .08 || a.x > .92) { a.dir *= -1; a.x = clamp(a.x, .08, .92); } }
    a.next -= dt;
    if (a.next <= 0) {
      const r = Math.random();
      if (r < .45 && a.y === 0) a.vy = rand(5, 8);
      else if (r < .7) a.rest = rand(.8, 2);
      else a.dir *= -1;
      a.next = rand(1, 2.8);
    }
    if (a.y > 0 || a.vy > 0) { a.vy -= 30 * dt; a.y += a.vy * dt; if (a.y <= 0) { a.y = 0; a.vy = 0; } }
  }
  if (T.chosen) {
    T.chosenT += dt;
    if (Math.random() < dt * 8) { const q = titlePalPos(T.chosen); T.hearts.push({ x: q.x + rand(-q.s * .6, q.s * .6), y: q.gy - q.s * 1.6, life: 1 }); }
    if (T.chosenT > 1.1) { T.chosen = null; T.chosenT = 0; T.hearts = []; openModes(); }
  }
  for (const hh of T.hearts) { hh.y -= 40 * dt; hh.life -= dt; }
  T.hearts = T.hearts.filter(hh => hh.life > 0);
}
function drawTitle() {
  const c = T.c; if (!c) return;
  T.meadow.draw(c, idleT * 20, 0.15, idleT);
  const order = [...T.pals].sort((a, b) => a.depth - b.depth);
  for (const a of order) {
    const q = titlePalPos(a), lift = a.y * q.s * .12;
    shadow(c, q.x, q.gy, q.s * .5 * Math.max(.5, 1 - lift / (q.s * 2)));
    drawPet(c, a.p, q.x, q.gy - lift, q.s, { t: a.t, run: a.rest <= 0 && a !== T.chosen, air: lift > 1, flip: a.dir < 0, happy: a === T.chosen });
    if (a === T.chosen) {
      c.font = `${Math.round(q.s * .38)}px Jua, sans-serif`; c.textAlign = 'center';
      c.lineWidth = 4; c.strokeStyle = '#fff'; c.strokeText(a.p.name + '!', q.x, q.gy - q.s * 1.9 - lift);
      c.fillStyle = '#5a4636'; c.fillText(a.p.name + '!', q.x, q.gy - q.s * 1.9 - lift);
    }
  }
  for (const hh of T.hearts) { c.globalAlpha = clamp(hh.life, 0, 1); c.fillStyle = '#ff6b81'; heartPath(c, hh.x, hh.y, 7); c.fill(); }
  c.globalAlpha = 1;
}
function choose(friend) {
  if (T.chosen) return;
  audio(); sfx.pick();
  S.friend = friend; store.set('mn2-friend', friend.id);
  T.chosen = T.pals.find(a => a.p.id === friend.id); T.chosenT = 0;
  if (T.chosen) { T.chosen.vy = 7; T.chosen.rest = 0; } else openModes();
}
titleCv.addEventListener('pointerdown', e => {
  const r = titleCv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  let best = null, bd = 1e9;
  for (const a of T.pals) {
    const q = titlePalPos(a), cx = q.x + (a.dir < 0 ? -1 : 1) * q.s * .1, cy = q.gy - a.y * q.s * .12 - q.s * .7;
    const d = Math.hypot((x - cx) / 1.2, y - cy);
    if (d < q.s * 1.05 && (d < bd || a.depth > (best?.depth ?? -1))) { if (!best || a.depth >= best.depth || d < bd) { best = a; bd = d; } }
  }
  if (best) choose(best.p);
});
$('#nameChips').innerHTML = FRIENDS.map(f => `<button class="name-chip" type="button" data-friend="${f.id}"><i style="background:${f.body}"></i>${f.name}</button>`).join('');
$$('.name-chip').forEach(b => b.addEventListener('click', () => choose(byId(b.dataset.friend))));

/* =========================================================
   2) 모드 고르기
   ========================================================= */
function openModes() {
  const f = S.friend;
  $('#modeHello').textContent = f.name + josa(f.name, '이', '가') + ' 함께 가요';
  $('#modeTitle').textContent = f.name + josa(f.name, '이랑', '랑') + ' 집까지 가 볼까요?';
  $$('[data-best]').forEach(el => {
    const m = el.dataset.best;
    el.textContent = S.best[m] ? '최고 ' + S.best[m] + '점' + (S.home[m] ? ' · 집 도착 성공' : '') : '';
  });
  showScreen('modeScreen');
}
$$('[data-mode]').forEach(b => b.addEventListener('click', () => { audio(); startGame(b.dataset.mode); }));
$('#backToTitle').addEventListener('click', () => showScreen('titleScreen'));

/* =========================================================
   3) 달리기
   ========================================================= */
const field = $('#field'), cv = $('#cv');
const G = { c: null, w: 300, h: 400, g: 320, s: 50, meadow: new Meadow() };
function resizeGame() {
  if ($('#gameScreen').hidden) return;
  const f = fitCanvas(cv); if (!f) return;
  Object.assign(G, f);
  G.s = clamp(Math.min(G.h * .13, G.w * .16), 38, 74);
  G.g = G.h * .84;
  G.meadow.build(G.w, G.h, G.g, G.s);
  if (R.px) R.px = Math.max(70, G.w * .22);
}
new ResizeObserver(resizeGame).observe(field);

const MAX_HP = 6; // 하트 3개 = 반쪽 6개
const R = { mode: 'easy', state: 'idle', hp: MAX_HP, score: 0, inv: 0, t: 0, ready: 0, hurtT: 0, happyT: 0, shake: 0, phase: 0, stage: 0, msg: null, paused: false };
let obs = [], snacks = [], parts = [], floats = [];

const HEART_SVG = (fill, id) => `<svg viewBox="0 0 24 24" aria-hidden="true"><defs><clipPath id="hc${id}"><rect x="0" y="0" width="${fill * 24}" height="24"/></clipPath></defs>
<path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.2 0 3.6 1.3 5.3 3.2 1.7-1.9 3.1-3.2 5.3-3.2 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z" fill="#e8dccd" stroke="#d2c3b0" stroke-width="1.5"/>
<path clip-path="url(#hc${id})" d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.2 0 3.6 1.3 5.3 3.2 1.7-1.9 3.1-3.2 5.3-3.2 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z" fill="#ff6b81" stroke="#e04660" stroke-width="1.5"/></svg>`;
function lifeLevel(hp) { return hp >= 5 ? 3 : hp >= 3 ? 2 : hp >= 1 ? 1 : 0; }
const LIFE_TEXT = { 3: '튼튼해요', 2: '조심조심!', 1: '마지막 힘!', 0: '쉬어 가요' };
function hud() {
  const hp = Math.max(0, R.hp), lv = lifeLevel(hp);
  $('#hearts').innerHTML = [0, 1, 2].map(i => HEART_SVG(clamp((hp - i * 2) / 2, 0, 1), i)).join('');
  const life = $('#life');
  life.className = life.className.replace(/\bs\d\b/, '').trim() + ' s' + lv;
  life.setAttribute('aria-label', '하트 ' + hp / 2 + '개 남음, ' + LIFE_TEXT[lv]);
  $('#pill').textContent = LIFE_TEXT[lv];
  $('#score').textContent = R.score;
  $('#goal').textContent = '/' + MODES[R.mode].goal + '점';
}
function pulseLife(cls) { const l = $('#life'); l.classList.remove('hit', 'heal'); void l.offsetWidth; l.classList.add(cls); }

function burst(x, y, colors, n = 10, sp = 1) {
  const s = G.s;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = s * rand(1.5, 4) * sp;
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - s, life: rand(.5, .9), c: pick(colors), r: rand(2, 4.5) });
  }
}
function floatText(x, y, text, color = '#f5a623') { floats.push({ x, y, text, color, life: 1.1 }); }

function startGame(mode) {
  R.mode = mode;
  showScreen('gameScreen');
  $('#resultOverlay').hidden = true; $('#pauseOverlay').hidden = true;
  resizeGame();
  Object.assign(R, { state: 'ready', hp: MAX_HP, score: 0, inv: 0, t: 0, ready: 1.6, hurtT: 0, happyT: 0, shake: 0, phase: 0, stage: 0, msg: null, paused: false,
    px: Math.max(70, G.w * .22), y: 0, vy: 0, jumps: 0, spawn: 1.2, scroll: 0, end: null });
  obs = []; snacks = []; parts = []; floats = [];
  hud();
}
function speed() { const m = MODES[R.mode]; return G.s * (m.speed + Math.min(4, R.score * m.gain)); }
function stageOf(score) { const goal = MODES[R.mode].goal; return score >= goal * 2 / 3 ? 2 : score >= goal / 3 ? 1 : 0; }

function jumpNow() {
  if (R.state !== 'play' || R.jumps >= 2) return;
  R.vy = G.s * (R.jumps ? 12 : 14); R.jumps++;
  sfx.jump(); burst(R.px, G.g, ['#ffffff', '#e8f6d8'], 5, .5);
}
function addScore(n) {
  R.score += n; hud();
  const st = stageOf(R.score);
  if (st > R.stage) { R.stage = st; R.msg = { text: STAGES[st].msg, life: 2.6 }; sfx.stage(); }
  if (R.score >= MODES[R.mode].goal && R.state === 'play') beginEnding();
}
function hit(x, y) {
  if (R.inv > 0 || R.state !== 'play') return false;
  R.hp = Math.max(0, R.hp - 2); R.inv = 1.4; R.hurtT = .8; R.shake = reduceMotion ? 0 : 8;
  burst(x, y, ['#ff6b81', '#ffb3c1'], 12); sfx.hurt(); pulseLife('hit'); hud();
  if (navigator.vibrate) { try { navigator.vibrate(60); } catch (e) {} }
  if (R.hp <= 0) gameOver();
  return true;
}
function eatSnack(k) {
  const y = G.g - k.h;
  burst(k.x, y, ['#ffe066', '#ffb3c1', '#ffffff'], 10); sfx.snack(); R.happyT = .6;
  if (R.hp < MAX_HP) { R.hp += 1; floatText(k.x, y - G.s * .5, '하트 +½', '#ff6b81'); pulseLife('heal'); hud(); addScore(1); }
  else { floatText(k.x, y - G.s * .5, '+3', '#f5a623'); addScore(3); }
}

/* 장애물 종류: 아침 = 나뭇잎·벌레, 오후 = 빗방울, 밤 = 별똥별 */
function pickDir() {
  const d = MODES[R.mode].dirs; let r = Math.random();
  for (const k in d) { r -= d[k]; if (r <= 0) return k; }
  return 'front';
}
function newObstacle(x, dir = 'front') {
  const type = R.stage === 0 ? (Math.random() < .5 ? 'leaf' : 'bug') : R.stage === 1 ? 'rain' : 'meteor';
  const s = G.s, o = { type, dir, x, ph: rand(0, 6), t: 0, passed: false, hit: false, h: 0 };
  if (dir === 'fall') { o.x = R.px + s * rand(4.5, 6.5); o.h = G.g + s; o.vh = (G.g + s) / .75; }
  if (dir === 'swoop') { o.h = G.g * .85; o.h0 = o.h; o.goal = Math.random() < .5 ? s * .3 : s * 1.75; }
  if (dir === 'back') { o.x = -s; o.delay = .9; }
  return o;
}
/* 방향별 움직임 */
function moveObs(o, dt, sp) {
  const s = G.s;
  o.t += dt;
  if (o.dir === 'back') {
    if (o.delay > 0) { o.delay -= dt; return; }
    o.x += s * 3.4 * dt; o.h = obsHeight(o); return;
  }
  o.x -= sp * OBS_SPEED[o.type] * (o.dir === 'swoop' ? 1.15 : 1) * dt;
  if (o.dir === 'fall') {
    const base = obsHeight(o);
    o.h -= o.vh * dt;
    if (o.h <= base) { o.h = base; o.dir = 'front'; burst(o.x, G.g - o.h, ['#ffffff', '#e8f6d8'], 5, .4); }
    return;
  }
  if (o.dir === 'swoop') {
    const end = R.px + s * 3, k = clamp((o.x - end) / Math.max(1, G.w + s - end), 0, 1);
    o.h = o.goal + (o.h0 - o.goal) * k * k; return;
  }
  o.h = obsHeight(o);
}
function obsHeight(o) {
  const s = G.s;
  if (o.type === 'rain') return s * .22 + Math.abs(Math.sin(o.t * 4.5 + o.ph)) * s * .55;
  if (o.type === 'leaf') return s * .3 + Math.sin(o.t * 3 + o.ph) * s * .12;
  if (o.type === 'bug') return s * .16;
  return s * .32 + Math.sin(o.t * 6 + o.ph) * s * .06;
}
const OBS_SPEED = { leaf: .9, bug: 1, rain: 1, meteor: 1.2 };

function updatePlay(dt) {
  const s = G.s, sp = speed(), m = MODES[R.mode];
  R.scroll += sp * dt;
  if (R.y > 0 || R.vy > 0) {
    R.vy -= s * 40 * dt; R.y += R.vy * dt;
    if (R.y <= 0) { R.y = 0; R.vy = 0; R.jumps = 0; }
  }
  R.spawn -= dt;
  if (R.spawn <= 0) {
    obs.push(newObstacle(G.w + s, pickDir()));
    if (Math.random() < m.pair) obs.push(newObstacle(G.w + s * 2.2));
    if (Math.random() < m.snack) snacks.push({ x: G.w + s * rand(2.6, 3.4), h: s * rand(1.7, 2.3), got: false });
    R.spawn = rand(m.gap[0], m.gap[1]) * Math.max(.7, 1 - R.score * .006);
  }
  const pcx = R.px + s * .1, pcy = G.g - R.y - s * .62, pr = s * .4;
  for (const o of obs) {
    moveObs(o, dt, sp);
    if (o.delay > 0) continue;
    if (!o.hit && Math.hypot(o.x - pcx, G.g - o.h - pcy) < pr + s * .22) { if (hit(o.x, G.g - o.h)) o.hit = true; }
    if (R.state !== 'play') return;
    const passed = o.dir === 'back' ? o.x > R.px + s * .9 : o.x < R.px - s * .7;
    if (!o.passed && !o.hit && passed) { o.passed = true; floatText(R.px, G.g - R.y - s * 1.7, '+1'); addScore(1); }
  }
  obs = obs.filter(o => o.dir === 'back' ? o.x < G.w + s * 2 : o.x > -s * 2);
  for (const k of snacks) {
    k.x -= sp * dt;
    if (!k.got && Math.hypot(k.x - pcx, G.g - k.h - pcy) < s * .75) { k.got = true; eatSnack(k); }
  }
  snacks = snacks.filter(k => k.x > -s && !k.got);
}

/* ---------- 엔딩: 집에 도착해서 주인 품에 안기기 ---------- */
function beginEnding() {
  R.state = 'ending'; R.inv = 99;
  R.end = { step: 'house', houseX: G.w + G.s * 3, t: 0, hugT: 0, heartT: 0, petX: R.px, petY: 0 };
  R.msg = { text: '저기 집이 보여요!', life: 2.2 };
  const best = R.score > S.best[R.mode];
  if (best) S.best[R.mode] = R.score;
  S.home[R.mode] = true;
  store.set('mn2-best', S.best); store.set('mn2-home', S.home);
  R.newBest = best;
}
function updateEnding(dt) {
  const E = R.end, s = G.s, sp = speed();
  E.t += dt;
  // 공중에 있었다면 착지
  if (R.y > 0 || R.vy > 0) { R.vy -= s * 40 * dt; R.y += R.vy * dt; if (R.y <= 0) { R.y = 0; R.vy = 0; } }
  for (const o of obs) moveObs(o, dt, sp);
  for (const k of snacks) k.x -= sp * dt;
  const ownerX = () => E.houseX - s * 2.2;
  if (E.step === 'house') {
    R.scroll += sp * dt; E.houseX -= sp * dt;
    if (E.houseX <= G.w * .68) { E.houseX = G.w * .68; E.step = 'walk'; sfx.stage(); }
  } else if (E.step === 'walk') {
    R.px += s * 4 * dt;
    if (R.px >= ownerX() - s * .9) { E.step = 'hug'; E.hugT = 0; sfx.home(); }
  } else if (E.step === 'hug') {
    E.hugT += dt; R.happyT = 1;
    E.heartT -= dt;
    if (E.heartT <= 0) { E.heartT = .18; floats.push({ heart: true, x: ownerX() + rand(-s, s), y: G.g - s * 2.4, life: 1.4 }); }
    if (E.hugT > 2.6 && !E.shown) { E.shown = true; showResult(true); }
  }
}
function gameOver() {
  R.state = 'over';
  const best = R.score > S.best[R.mode];
  if (best) { S.best[R.mode] = R.score; store.set('mn2-best', S.best); }
  R.newBest = best;
  sfx.over();
  setTimeout(() => { if (R.state === 'over') showResult(false); }, 1000);
}
function showResult(home) {
  const f = S.friend;
  $('#resultMode').textContent = MODES[R.mode].name + ' · ' + f.name;
  $('#resultTitle').textContent = home ? '집에 도착했어요!' : '조금만 쉬었다 다시 가요';
  $('#resultScore').textContent = R.score;
  $('#resultBest').textContent = R.newBest && R.score > 0 ? '새 최고 기록이에요' : '최고 기록 ' + S.best[R.mode] + '점';
  $('#resultMsg').textContent = home
    ? f.name + josa(f.name, '이', '가') + ' 주인 품에 꼭 안겼어요. 하트 ' + (R.hp / 2) + '개를 지켰어요.'
    : STAGES[R.stage].name + '까지 왔어요. 간식을 먹으면 하트가 반 개씩 차올라요.';
  $('#retryBtn').textContent = home ? '한 번 더' : '다시하기';
  RES.home = home;
  $('#resultOverlay').hidden = false;
  $('#retryBtn').focus();
}
$('#retryBtn').addEventListener('click', () => startGame(R.mode));
$('#menuBtn').addEventListener('click', () => { R.state = 'idle'; openModes(); });
$('#backBtn').addEventListener('click', () => { R.state = 'idle'; openModes(); });
$('#resumeBtn').addEventListener('click', resume);
function pause() { if ($('#gameScreen').hidden || R.paused || !['play', 'ready'].includes(R.state)) return; R.paused = true; $('#pauseOverlay').hidden = false; }
function resume() { R.paused = false; $('#pauseOverlay').hidden = true; last = performance.now(); }
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

const SPEAKER = on => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#5a4636" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z" fill="#ffcf5c"/>${on ? '<path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>' : '<path d="M17 9l5 6M22 9l-5 6"/>'}</svg>`;
function syncMute() { const b = $('#muteBtn'); b.innerHTML = SPEAKER(!S.muted); b.setAttribute('aria-label', S.muted ? '소리 켜기' : '소리 끄기'); }
$('#muteBtn').addEventListener('click', () => { S.muted = !S.muted; store.set('mn-muted', S.muted); audio(); syncMute(); });

/* 입력: 폰은 터치, 컴퓨터는 스페이스바 (마우스 클릭도 가능) */
field.addEventListener('pointerdown', e => {
  if (e.target !== cv || R.paused) return;
  audio(); jumpNow();
});
addEventListener('keydown', e => {
  if ($('#gameScreen').hidden) return;
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    if (document.activeElement && document.activeElement.tagName === 'BUTTON' && R.state !== 'play') return;
    e.preventDefault(); if (!e.repeat) { audio(); jumpNow(); }
  }
  if (e.code === 'Escape' || e.code === 'KeyP') R.paused ? resume() : pause();
});

/* ---------- 그리기: 장애물 · 간식 ---------- */
function drawMeteor(c, x, y, r, t) {
  const g = c.createLinearGradient(x, y, x + r * 5, y); g.addColorStop(0, '#ffb35caa'); g.addColorStop(1, '#ffb35c00');
  c.fillStyle = g; c.beginPath(); c.moveTo(x, y - r * .7); c.lineTo(x + r * 5, y); c.lineTo(x, y + r * .7); c.closePath(); c.fill();
  c.fillStyle = '#ffd25c'; c.strokeStyle = '#f08a2c'; c.lineWidth = 2;
  starPath(c, x, y, r, t * 4); c.fill(); c.stroke();
  c.fillStyle = '#7a4a1f'; ell(c, x - r * .25, y - r * .05, r * .08, r * .1); c.fill(); ell(c, x + r * .2, y - r * .05, r * .08, r * .1); c.fill();
}
function drawRain(c, x, y, r) {
  c.fillStyle = '#8fd0ff'; c.strokeStyle = '#4fa3e0'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(x, y - r * 1.5);
  c.bezierCurveTo(x + r * .9, y - r * .3, x + r, y + r * .9, x, y + r);
  c.bezierCurveTo(x - r, y + r * .9, x - r * .9, y - r * .3, x, y - r * 1.5); c.fill(); c.stroke();
  c.fillStyle = '#ffffffcc'; ell(c, x - r * .35, y - r * .1, r * .15, r * .28, -.3); c.fill();
  c.fillStyle = '#2f5d80'; ell(c, x - r * .25, y + r * .2, r * .07, r * .09); c.fill(); ell(c, x + r * .25, y + r * .2, r * .07, r * .09); c.fill();
}
function drawLeaf(c, x, y, r, rot) {
  c.save(); c.translate(x, y); c.rotate(rot);
  c.fillStyle = '#ffa94d'; c.strokeStyle = '#d9772a'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(-r * 1.1, 0); c.quadraticCurveTo(0, -r * .95, r * 1.1, 0); c.quadraticCurveTo(0, r * .95, -r * 1.1, 0); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(-r * 1.1, 0); c.lineTo(r * .9, 0); c.stroke();
  c.restore();
}
function drawBug(c, x, y, r, t) { // 무당벌레
  const wob = Math.sin(t * 12) * r * .06;
  c.strokeStyle = '#3d2b20'; c.lineWidth = 2;
  for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(x + i * r * .45, y + r * .2); c.lineTo(x + i * r * .55 + wob, y + r * .6); c.stroke(); }
  c.fillStyle = '#3d2b20'; ell(c, x - r * .85, y + r * .05, r * .38, r * .34); c.fill();
  c.fillStyle = '#fff'; ell(c, x - r * .95, y - r * .02, r * .09, r * .09); c.fill();
  c.fillStyle = '#ff5a5a'; c.strokeStyle = '#c93b3b'; ell(c, x, y, r, r * .78); c.fill(); c.stroke();
  c.strokeStyle = '#3d2b20'; c.beginPath(); c.moveTo(x - r * .1, y - r * .78); c.lineTo(x - r * .1, y + r * .6); c.stroke();
  c.fillStyle = '#3d2b20'; [[-.45, -.25], [.35, -.3], [-.4, .3], [.4, .25]].forEach(([a, b]) => { ell(c, x + a * r, y + b * r, r * .14, r * .14); c.fill(); });
}
function drawSnack(c, x, y, r, kind, rot) {
  c.save(); c.translate(x, y); c.rotate(rot);
  if (kind === 'dog') {
    c.fillStyle = '#fff6e6'; c.strokeStyle = '#d9b98f'; c.lineWidth = 2;
    rrect(c, -r * .8, -r * .22, r * 1.6, r * .44, r * .2); c.fill(); c.stroke();
    [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([a, b]) => { ell(c, a * r * .85, b * r * .25, r * .28, r * .28); c.fill(); c.stroke(); });
    c.fillStyle = '#fff6e6'; rrect(c, -r * .75, -r * .2, r * 1.5, r * .4, r * .18); c.fill();
  } else {
    c.fillStyle = '#9fd3ff'; c.strokeStyle = '#5ea3d9'; c.lineWidth = 2;
    ell(c, 0, 0, r * .85, r * .45); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-r * .75, 0); c.lineTo(-r * 1.2, -r * .4); c.lineTo(-r * 1.2, r * .4); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#3d2b20'; ell(c, r * .45, -r * .08, r * .08, r * .08); c.fill();
  }
  c.restore();
}
function drawProgress(c) {
  const goal = MODES[R.mode].goal, w = Math.min(G.w - 32, 420), x0 = (G.w - w) / 2, y = 22;
  c.fillStyle = '#ffffffcc'; rrect(c, x0 - 12, y - 12, w + 24, 40, 14); c.fill();
  c.fillStyle = '#f0e2cc'; rrect(c, x0, y - 4, w, 8, 4); c.fill();
  const p = clamp(R.score / goal, 0, 1);
  const g = c.createLinearGradient(x0, 0, x0 + w, 0); g.addColorStop(0, '#ffb38a'); g.addColorStop(.5, '#7cc4ff'); g.addColorStop(1, '#8f86d9');
  c.fillStyle = g; rrect(c, x0, y - 4, Math.max(8, w * p), 8, 4); c.fill();
  c.font = '12px Jua, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  [['아침', 0], ['오후', 1 / 3], ['밤', 2 / 3]].forEach(([n, q], i) => {
    const xx = x0 + w * (q + 1 / 6);
    c.fillStyle = R.stage === i ? '#5a4636' : '#a8957f'; c.fillText(n, xx, y + 15);
  });
  // 집 아이콘
  c.fillStyle = '#ff8a7a'; c.beginPath(); c.moveTo(x0 + w - 10, y - 1); c.lineTo(x0 + w, y - 10); c.lineTo(x0 + w + 10, y - 1); c.closePath(); c.fill();
  c.fillStyle = '#fff4dd'; c.fillRect(x0 + w - 7, y - 1, 14, 9);
  // 친구 위치
  const px = x0 + w * p; c.fillStyle = S.friend.body; c.strokeStyle = '#5a4636'; c.lineWidth = 1.5; ell(c, px, y, 7, 7); c.fill(); c.stroke();
}

function warnBadge(c, x, y, s, text) {
  c.fillStyle = '#e04660'; ell(c, x, y, s * .34, s * .34); c.fill();
  c.fillStyle = '#fff'; c.font = `${Math.round(s * .3)}px Jua, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, x, y + 1);
}
function drawGame() {
  const c = G.c; if (!c) return;
  const s = G.s;
  c.save();
  if (R.shake > 0) c.translate(rand(-1, 1) * R.shake, rand(-1, 1) * R.shake);
  G.meadow.draw(c, R.scroll, R.phase, R.t);
  if (R.end) drawHouse(c, R.end.houseX, G.g, s, R.phase > 1.5);
  for (const k of snacks) { const bob = Math.sin(R.t * 4 + k.x * .01) * s * .08; drawSnack(c, k.x, G.g - k.h + bob, s * .3, S.friend.kind, Math.sin(R.t * 2) * .2); }
  for (const o of obs) {
    const x = o.x, y = G.g - o.h, r = s * .28;
    if (o.delay > 0) { // 뒤에서 오는 장애물 예고
      if (Math.sin(R.t * 18) > -.3) warnBadge(c, s * .55, G.g - s * .6, s, '뒤!');
      continue;
    }
    if (o.dir === 'fall') { // 떨어질 자리 표시
      const k = clamp(1 - o.h / G.g, .2, 1);
      c.fillStyle = `rgba(224,70,96,${.25 * k})`; ell(c, x, G.g + 2, r * 1.4 * k + 4, r * .35 * k + 2); c.fill();
    }
    c.globalAlpha = o.hit || R.end ? .4 : 1;
    if (o.h < s * 1.2) shadow(c, x, G.g, r * .9);
    if (o.dir === 'back') { c.save(); c.translate(x * 2, 0); c.scale(-1, 1); }
    if (o.type === 'meteor') drawMeteor(c, x, y, r, R.t);
    else if (o.type === 'rain') drawRain(c, x, y, r);
    else if (o.type === 'leaf') drawLeaf(c, x, y, r, o.t * 5 + o.ph);
    else drawBug(c, x, y, r * .85, o.t);
    if (o.dir === 'back') c.restore();
    c.globalAlpha = 1;
  }
  // 친구와 주인
  const blink = R.inv > 0 && R.inv < 50 && Math.sin(R.t * 30) > 0;
  const petOpts = { t: R.t, hurt: R.hurtT > 0 || R.state === 'over', happy: R.happyT > 0 && R.hurtT <= 0 };
  if (R.end && R.end.step === 'hug') {
    const ox = R.end.houseX - s * 2.2, k = clamp(R.end.hugT / .45, 0, 1), os = s * 1.05;
    drawOwner(c, ox, G.g, os, { t: R.t, happy: true, hug: true });
    const hx = R.px + (ox - s * .25 - R.px) * k, hy = G.g - (os * 1.15) * k - Math.sin(k * Math.PI) * s * .6;
    drawPet(c, S.friend, hx, hy, s * (1 - .15 * k), Object.assign(petOpts, { happy: true, air: k < 1 }));
    if (k >= 1) drawHugArms(c, ox, G.g, os);
  } else {
    if (R.end) drawOwner(c, R.end.houseX - s * 2.2, G.g, s * 1.05, { t: R.t, happy: R.end.step === 'walk' });
    shadow(c, R.px + s * .1, G.g, s * .55 * Math.max(.4, 1 - R.y / (s * 3)));
    c.globalAlpha = blink ? .45 : 1;
    const running = R.state === 'play' || (R.end && R.end.step !== 'hug');
    drawPet(c, S.friend, R.px, G.g - R.y, s, Object.assign(petOpts, { run: running && R.state !== 'over', air: R.y > 1 }));
    c.globalAlpha = 1;
  }
  // 효과
  for (const p of parts) { c.globalAlpha = clamp(p.life * 1.5, 0, 1); c.fillStyle = p.c; ell(c, p.x, p.y, p.r, p.r); c.fill(); }
  c.globalAlpha = 1;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = `${Math.round(s * .38)}px Jua, sans-serif`;
  for (const f of floats) {
    c.globalAlpha = clamp(f.life * 2, 0, 1);
    if (f.heart) { c.fillStyle = '#ff6b81'; heartPath(c, f.x, f.y, s * .14); c.fill(); continue; }
    c.lineWidth = 4; c.strokeStyle = '#ffffff'; c.strokeText(f.text, f.x, f.y);
    c.fillStyle = f.color; c.fillText(f.text, f.x, f.y);
  }
  c.globalAlpha = 1;
  drawProgress(c);
  if (R.msg) bigText(c, R.msg.text, clamp(R.msg.life * 2, 0, 1), G.h * .3, Math.min(s * .5, G.w / 15));
  if (R.state === 'ready') {
    bigText(c, R.ready < .5 ? '출발!' : '준비~', 1, G.h * .38, s * .9);
    bigText(c, '터치 또는 스페이스바로 점프!', .9, G.h * .38 + s * .9, Math.min(s * .34, G.w / 17));
  }
  if (R.end && R.end.step === 'hug') bigText(c, '집에 왔어요!', clamp(R.end.hugT * 2, 0, 1), G.h * .3, s * .7);
  c.restore();
}
function bigText(c, text, a, y, size) {
  c.globalAlpha = a; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = `${Math.round(size)}px Jua, sans-serif`;
  c.lineWidth = Math.max(4, size * .18); c.strokeStyle = '#ffffff'; c.lineJoin = 'round';
  c.strokeText(text, G.w / 2, y); c.fillStyle = '#5a4636'; c.fillText(text, G.w / 2, y);
  c.globalAlpha = 1;
}

/* ---------- 작은 캔버스 (모드 화면, 결과 화면) ---------- */
const RES = { home: false };
function drawSmall(cv, scene, t) {
  const c = cv.getContext('2d'), w = cv.width, h = cv.height;
  c.clearRect(0, 0, w, h);
  c.fillStyle = '#d9f2c8'; ell(c, w / 2, h - 12, w * .42, 11); c.fill();
  const f = S.friend;
  if (scene === 'hug') {
    const os = h * .3, ox = w * .58;
    drawOwner(c, ox, h - 12, os, { t, happy: true, hug: true });
    drawPet(c, f, ox - os * .25, h - 12 - os * 1.15, os * .95, { t, happy: true });
    drawHugArms(c, ox, h - 12, os);
    c.fillStyle = '#ff6b81';
    for (let i = 0; i < 3; i++) { const k = (t * .6 + i / 3) % 1; c.globalAlpha = 1 - k; heartPath(c, w * (.25 + i * .12), h * .45 - k * h * .3, 6); c.fill(); }
    c.globalAlpha = 1;
  } else {
    drawPet(c, f, w / 2 - h * .12, h - 12, h * .55, { t, happy: scene === 'happy', hurt: scene === 'tired' });
  }
}

/* ---------- 메인 루프 ---------- */
let last = performance.now(), idleT = 0;
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now; idleT += dt;

  if (!$('#titleScreen').hidden) { updateTitle(dt); drawTitle(); }
  if (!$('#modeScreen').hidden) drawSmall($('#modePet'), 'happy', idleT);
  if (!$('#resultOverlay').hidden) drawSmall($('#resultCv'), RES.home ? 'hug' : 'tired', idleT);

  if (!$('#gameScreen').hidden && R.state !== 'idle') {
    if (!R.paused) {
      R.t += dt;
      if (R.state === 'ready') { R.ready -= dt; if (R.ready <= 0) R.state = 'play'; }
      else if (R.state === 'play') updatePlay(dt);
      else if (R.state === 'ending') updateEnding(dt);
      if (R.inv < 50) R.inv = Math.max(0, R.inv - dt);
      R.hurtT = Math.max(0, R.hurtT - dt); R.happyT = Math.max(0, R.happyT - dt);
      R.shake = Math.max(0, R.shake - dt * 30);
      R.phase += (R.stage - R.phase) * Math.min(1, dt * 1.2);
      for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += G.s * 9 * dt; p.life -= dt; }
      parts = parts.filter(p => p.life > 0);
      for (const f of floats) { f.y -= G.s * .9 * dt; f.life -= dt; }
      floats = floats.filter(f => f.life > 0);
      if (R.msg) { R.msg.life -= dt; if (R.msg.life <= 0) R.msg = null; }
    }
    drawGame();
  }
  requestAnimationFrame(frame);
}

/* ---------- 시작 ---------- */
syncMute();
showScreen('titleScreen');
requestAnimationFrame(frame);
})();
