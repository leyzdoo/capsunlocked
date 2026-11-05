// Procedural textures painted on canvases — brick, siding, shingles, concrete, asphalt, wood, grass…
// Every texture is cached by key so the GPU only gets one copy.
import * as THREE from 'three';

const cache = new Map();
let maxAniso = 4;
export function setAnisotropy(n) { maxAniso = n; }

export function rng(seed) {
  let a = seed >>> 0;
  return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function hex(c) { return '#' + new THREE.Color(c).getHexString(); }
function shade(color, amt) { const c = new THREE.Color(color); const hsl = {}; c.getHSL(hsl); c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amt))); return '#' + c.getHexString(); }
function noise(ctx, w, h, r, n, alpha, light) {
  for (let i = 0; i < n; i++) { ctx.fillStyle = (light ? 'rgba(255,255,255,' : 'rgba(0,0,0,') + (r() * alpha) + ')'; ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
}
function toTex(canvas, repeatX = 1, repeatY = 1, color = true) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeatX, repeatY);
  t.anisotropy = maxAniso; if (color) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function cached(key, make) { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); }

/* ---- painters return {map, bump} canvases ---- */
function brick(base, mortar = '#cfc6b8', seed = 1) {
  const W = 512, H = 512, r = rng(seed), c = cv(W, H), b = cv(W, H), x = c.getContext('2d'), y = b.getContext('2d');
  x.fillStyle = mortar; x.fillRect(0, 0, W, H); y.fillStyle = '#000'; y.fillRect(0, 0, W, H);
  const rows = 16, bh = H / rows, bw = W / 4, gap = 4;
  for (let row = 0; row < rows; row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let col = -1; col < 5; col++) {
      const bx = col * bw + off + gap / 2, by = row * bh + gap / 2;
      x.fillStyle = shade(base, (r() - .5) * .14); x.fillRect(bx, by, bw - gap, bh - gap);
      // subtle face variation
      x.fillStyle = 'rgba(0,0,0,' + (r() * .12) + ')'; x.fillRect(bx, by + (bh - gap) * .6, bw - gap, (bh - gap) * .4);
      y.fillStyle = '#' + ['c8', 'd2', 'dc'][Math.floor(r() * 3)].repeat(3); y.fillRect(bx, by, bw - gap, bh - gap);
    }
  }
  noise(x, W, H, r, 5000, .18, false); noise(x, W, H, r, 1500, .1, true);
  noise(y, W, H, r, 3000, .3, false);
  return { map: c, bump: b };
}
function siding(base, seed = 2) {
  const W = 512, H = 512, r = rng(seed), c = cv(W, H), b = cv(W, H), x = c.getContext('2d'), y = b.getContext('2d');
  const rows = 12, bh = H / rows;
  for (let i = 0; i < rows; i++) {
    const g = x.createLinearGradient(0, i * bh, 0, (i + 1) * bh);
    g.addColorStop(0, shade(base, -.12)); g.addColorStop(.18, shade(base, .02)); g.addColorStop(1, shade(base, -.02));
    x.fillStyle = g; x.fillRect(0, i * bh, W, bh);
    const gy = y.createLinearGradient(0, i * bh, 0, (i + 1) * bh); gy.addColorStop(0, '#222'); gy.addColorStop(.2, '#ddd'); gy.addColorStop(1, '#bbb');
    y.fillStyle = gy; y.fillRect(0, i * bh, W, bh);
  }
  noise(x, W, H, r, 2500, .06, false);
  return { map: c, bump: b };
}
function shingles(base, seed = 3) {
  const W = 512, H = 512, r = rng(seed), c = cv(W, H), b = cv(W, H), x = c.getContext('2d'), y = b.getContext('2d');
  x.fillStyle = shade(base, -.15); x.fillRect(0, 0, W, H); y.fillStyle = '#000'; y.fillRect(0, 0, W, H);
  const rows = 14, sh = H / rows, sw = W / 10;
  for (let row = 0; row < rows; row++) for (let col = -1; col < 11; col++) {
    const sx = col * sw + (row % 2 ? sw / 2 : 0) + (r() - .5) * 4, sy = row * sh;
    const g = x.createLinearGradient(0, sy, 0, sy + sh); const cc = shade(base, (r() - .5) * .12);
    g.addColorStop(0, shade(cc, -.06)); g.addColorStop(1, shade(cc, .06)); x.fillStyle = g; x.fillRect(sx + 1, sy, sw - 2, sh - 2);
    const gy = y.createLinearGradient(0, sy, 0, sy + sh); gy.addColorStop(0, '#555'); gy.addColorStop(1, '#eee'); y.fillStyle = gy; y.fillRect(sx + 1, sy, sw - 2, sh - 2);
  }
  noise(x, W, H, r, 8000, .2, false); noise(x, W, H, r, 3000, .1, true);
  return { map: c, bump: b };
}
function concrete(base = '#bdbab3', joint = 128, seed = 4) {
  const W = 512, H = 512, r = rng(seed), c = cv(W, H), b = cv(W, H), x = c.getContext('2d'), y = b.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, W, H); y.fillStyle = '#ccc'; y.fillRect(0, 0, W, H);
  for (let i = 0; i < 30; i++) { x.fillStyle = 'rgba(' + (r() < .5 ? '0,0,0,' : '255,255,255,') + (r() * .05) + ')'; x.beginPath(); x.arc(r() * W, r() * H, 20 + r() * 80, 0, 7); x.fill(); }
  noise(x, W, H, r, 9000, .12, false); noise(x, W, H, r, 4000, .08, true); noise(y, W, H, r, 6000, .25, false);
  if (joint) { x.strokeStyle = 'rgba(0,0,0,.35)'; y.strokeStyle = '#000'; x.lineWidth = y.lineWidth = 3;
    for (let p = 0; p <= W; p += joint) { [x, y].forEach(k => { k.beginPath(); k.moveTo(p, 0); k.lineTo(p, H); k.moveTo(0, p); k.lineTo(W, p); k.stroke(); }); } }
  return { map: c, bump: b };
}
function asphalt(seed = 5) {
  const W = 512, H = 512, r = rng(seed), c = cv(W, H), b = cv(W, H), x = c.getContext('2d'), y = b.getContext('2d');
  x.fillStyle = '#3b3d40'; x.fillRect(0, 0, W, H); y.fillStyle = '#888'; y.fillRect(0, 0, W, H);
  for (let i = 0; i < 26000; i++) { const v = Math.floor(40 + r() * 70); x.fillStyle = `rgba(${v},${v},${v + 3},.6)`; x.fillRect(r() * W, r() * H, 1.5, 1.5); }
  for (let i = 0; i < 10; i++) { x.fillStyle = 'rgba(0,0,0,.08)'; x.beginPath(); x.ellipse(r() * W, r() * H, 30 + r() * 90, 10 + r() * 40, r() * 3, 0, 7); x.fill(); }
  noise(y, W, H, r, 20000, .5, false); noise(y, W, H, r, 10000, .5, true);
  return { map: c, bump: b };
}
function grass(seed = 6) {
  const W = 512, H = 512, r = rng(seed), c = cv(W, H), x = c.getContext('2d');
  x.fillStyle = '#4f7d33'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(${60 + r() * 50},${100 + r() * 50},${30 + r() * 20},.25)`; x.beginPath(); x.arc(r() * W, r() * H, 20 + r() * 60, 0, 7); x.fill(); }
  for (let i = 0; i < 22000; i++) { const g = 90 + r() * 90; x.strokeStyle = `rgba(${g * .45},${g},${g * .3},.55)`; x.lineWidth = 1; const px = r() * W, py = r() * H; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r() - .5) * 3, py - 3 - r() * 5); x.stroke(); }
  return { map: c, bump: null };
}
function wood(base = '#a0703f', planks = 6, seed = 7) {
  const W = 512, H = 512, r = rng(seed), c = cv(W, H), b = cv(W, H), x = c.getContext('2d'), y = b.getContext('2d');
  const ph = H / planks;
  for (let i = 0; i < planks; i++) {
    const cc = shade(base, (r() - .5) * .12); x.fillStyle = cc; x.fillRect(0, i * ph, W, ph);
    for (let k = 0; k < 40; k++) { x.strokeStyle = 'rgba(60,30,10,' + (r() * .18) + ')'; x.lineWidth = 1 + r() * 1.5; x.beginPath(); const yy = i * ph + r() * ph; x.moveTo(0, yy); x.bezierCurveTo(W * .3, yy + (r() - .5) * 8, W * .6, yy + (r() - .5) * 8, W, yy + (r() - .5) * 6); x.stroke(); }
    const cut = r() * W; x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(cut, i * ph, 2, ph);
    x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(0, i * ph, W, 2);
    y.fillStyle = '#ddd'; y.fillRect(0, i * ph, W, ph); y.fillStyle = '#222'; y.fillRect(0, i * ph, W, 3); y.fillRect(cut, i * ph, 3, ph);
  }
  return { map: c, bump: b };
}
function tiles(a = '#e9e6df', bcol = '#d5d1c8', n = 8, seed = 8) {
  const W = 512, H = 512, r = rng(seed), c = cv(W, H), b = cv(W, H), x = c.getContext('2d'), y = b.getContext('2d');
  const s = W / n; x.fillStyle = '#9b958a'; x.fillRect(0, 0, W, H); y.fillStyle = '#000'; y.fillRect(0, 0, W, H);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    x.fillStyle = shade((i + j) % 2 ? a : bcol, (r() - .5) * .04); x.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
    y.fillStyle = '#ddd'; y.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
  }
  noise(x, W, H, r, 3000, .05, false);
  return { map: c, bump: b };
}
function plaster(base = '#ece6da', seed = 9) {
  const W = 256, H = 256, r = rng(seed), c = cv(W, H), x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, W, H); noise(x, W, H, r, 4000, .05, false); noise(x, W, H, r, 2000, .05, true);
  return { map: c, bump: null };
}
function carpet(base = '#6b3b3b', seed = 10) {
  const W = 256, H = 256, r = rng(seed), c = cv(W, H), x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, W, H); noise(x, W, H, r, 14000, .2, false); noise(x, W, H, r, 8000, .1, true);
  return { map: c, bump: null };
}
function hedge(seed = 11) {
  const W = 256, H = 256, r = rng(seed), c = cv(W, H), b = cv(W, H), x = c.getContext('2d'), y = b.getContext('2d');
  x.fillStyle = '#2f5a24'; x.fillRect(0, 0, W, H); y.fillStyle = '#444'; y.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) { const g = 60 + r() * 90, px = r() * W, py = r() * H, s = 2 + r() * 5; x.fillStyle = `rgb(${g * .35},${g},${g * .3})`; x.beginPath(); x.ellipse(px, py, s, s * .6, r() * 3, 0, 7); x.fill(); y.fillStyle = `rgb(${g * 2},${g * 2},${g * 2})`; y.beginPath(); y.arc(px, py, s * .8, 0, 7); y.fill(); }
  return { map: c, bump: b };
}

const PAINTERS = { brick, siding, shingles, concrete, asphalt, grass, wood, tiles, plaster, carpet, hedge };

/** Material from a painted texture. kind: painter name; args: painter args; rx/ry: repeats */
export function mat(kind, args = [], rx = 1, ry = 1, opts = {}) {
  const key = kind + JSON.stringify(args);
  const p = cached(key, () => PAINTERS[kind](...args));
  const m = new THREE.MeshStandardMaterial({ map: toTex(p.map, rx, ry), roughness: opts.roughness ?? .9, metalness: opts.metalness ?? 0, color: opts.color ?? 0xffffff });
  if (p.bump) { m.bumpMap = toTex(p.bump, rx, ry, false); m.bumpScale = opts.bump ?? 1.2; }
  return m;
}
export const COLORS = { hex, shade };

/** Canvas text sign → texture */
export function signTexture(text, { bg = '#1d2a44', fg = '#ffffff', font = '600 120px "Fredoka", "Arial Rounded MT Bold", Arial, sans-serif', w = 1024, h = 256, border = null, sub = null } = {}) {
  const c = cv(w, h), x = c.getContext('2d');
  if (bg) { x.fillStyle = bg; x.fillRect(0, 0, w, h); }
  if (border) { x.strokeStyle = border; x.lineWidth = 14; x.strokeRect(10, 10, w - 20, h - 20); }
  x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = font;
  let size = parseInt(font.match(/(\d+)px/)[1], 10);
  while (x.measureText(text).width > w * .88 && size > 20) { size -= 4; x.font = font.replace(/\d+px/, size + 'px'); }
  x.fillText(text, w / 2, sub ? h * .42 : h / 2 + 4);
  if (sub) { x.font = '500 ' + Math.round(h * .16) + 'px Nunito, Arial, sans-serif'; x.globalAlpha = .85; x.fillText(sub, w / 2, h * .78); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; return t;
}
export function stripes(a, b, n = 8) {
  return cached('stripes' + a + b + n, () => { const c = cv(256, 64), x = c.getContext('2d'); for (let i = 0; i < n; i++) { x.fillStyle = i % 2 ? b : a; x.fillRect(i * 256 / n, 0, 256 / n, 64); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; });
}
