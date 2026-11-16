// "Buy anything": turns what you type into something real in Mindworks — a house, a car, a boat,
// a plane, or a 3D thing (a dragon, a rocket, a pool, a giant pizza…) — with a picture, a reason and a price.
import * as THREE from 'three';
import { CARS, BOATS, PLANES } from './vehicles.js';
import { designHomes } from './homes.js';
import { tree } from './town.js';
import { rng } from './tex.js';

const has = (q, ...w) => w.some(x => new RegExp('\\b' + x).test(q));
function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
const std = (c, r = .6, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

const COLORS = { red: 0xd8452f, blue: 0x2f6fd8, green: 0x3fae5a, yellow: 0xffd34d, pink: 0xff8fc0, purple: 0x8a5ad8, white: 0xf2f2f2, black: 0x26262a, gray: 0x8a8a90, grey: 0x8a8a90, orange: 0xff8a2a, brown: 0x8a5a35, gold: 0xd8b04a, silver: 0xc9ccd1, teal: 0x2fb8b0, rainbow: -1 };
const RAINBOW = [0xff4a4a, 0xff9a2a, 0xffe14a, 0x4ad66a, 0x4a9aff, 0x9a5aff];

/* animals: [body length, body height, leg, neck, default colour, extras] — all built by one 4-legged animal maker */
const ANIMALS = {
  dog: [.9, .42, .38, .2, 0xb07a45, { ears: 'flop', tail: .4, line: 'Loyal, fluffy and always happy to see you.' }], puppy: [.6, .32, .26, .15, 0xd8a86a, { ears: 'flop', tail: .3, line: 'A tiny puppy that wags its whole body.' }],
  cat: [.7, .32, .3, .12, 0x8a8a90, { ears: 'point', tail: .7, line: 'Purrs when you walk by.' }], kitten: [.45, .24, .2, .1, 0xff9a4a, { ears: 'point', tail: .5, line: 'A teeny kitten — careful, it pounces!' }],
  horse: [1.6, .7, 1.0, .7, 0x8a5a35, { ears: 'point', tail: .8, mane: true, line: 'Fast and strong — the best friend a explorer could have.' }], pony: [1.1, .55, .65, .5, 0xd8b088, { ears: 'point', tail: .6, mane: true, line: 'A friendly little pony.' }],
  unicorn: [1.5, .7, 1.0, .7, 0xf6f2ff, { ears: 'point', tail: .8, mane: 'rainbow', horn: true, line: 'Magic! Its horn sparkles in the sun.' }],
  dragon: [2.2, .85, .6, .9, 0x2f9a4a, { ears: 'horns', tail: 2.0, wings: true, spikes: true, line: 'It guards your treasure and breathes (pretend) fire.' }],
  dinosaur: [2.2, .9, .9, 1.4, 0x5a9a3a, { tail: 2.0, spikes: true, line: 'A real-looking dinosaur — luckily it eats plants.' }], dino: [2.2, .9, .9, 1.4, 0x5a9a3a, { tail: 2.0, spikes: true, line: 'A real-looking dinosaur — luckily it eats plants.' }],
  't-rex': [2.0, .9, 1.1, .5, 0x4a7a3a, { tail: 2.0, spikes: true, teeth: true, line: 'The king of the dinosaurs. ROAR!' }], trex: [2.0, .9, 1.1, .5, 0x4a7a3a, { tail: 2.0, spikes: true, teeth: true, line: 'The king of the dinosaurs. ROAR!' }],
  lion: [1.5, .65, .6, .3, 0xd8a050, { ears: 'round', tail: .9, mane: 'lion', line: 'The king of the jungle, sitting proudly.' }], tiger: [1.6, .6, .6, .3, 0xff8a2a, { ears: 'round', tail: 1.0, stripes: true, line: 'Big, orange and stripy.' }],
  bear: [1.4, .8, .55, .3, 0x6a4a2a, { ears: 'round', tail: .1, line: 'A big cuddly bear (don’t hug it too hard).' }], 'polar bear': [1.5, .85, .6, .35, 0xf4f4f0, { ears: 'round', tail: .1, line: 'All the way from the North Pole.' }],
  wolf: [1.2, .5, .55, .3, 0x7a7a80, { ears: 'point', tail: .7, line: 'It howls at the moon.' }], fox: [.9, .38, .35, .2, 0xe8702a, { ears: 'point', tail: .8, line: 'Clever and quick, with a fluffy tail.' }],
  bunny: [.5, .32, .16, .12, 0xf2efe8, { ears: 'long', tail: .1, line: 'Hop hop hop!' }], rabbit: [.5, .32, .16, .12, 0xc9b49a, { ears: 'long', tail: .1, line: 'Hop hop hop!' }],
  elephant: [2.2, 1.4, 1.1, .2, 0x8a8a92, { ears: 'big', tail: .5, trunk: true, line: 'Huge, gentle, and never forgets you.' }], pig: [1.0, .55, .3, .1, 0xffb0b8, { ears: 'flop', tail: .2, line: 'Oink! It loves mud.' }],
  cow: [1.6, .8, .7, .25, 0xf2f2f2, { ears: 'flop', tail: .7, spots: true, line: 'Moo! Fresh milk every morning.' }], sheep: [1.0, .6, .45, .2, 0xf4f0e6, { ears: 'flop', tail: .2, line: 'Fluffy wool, perfect for sweaters.' }],
  giraffe: [1.5, .8, 1.6, 1.8, 0xe8b850, { ears: 'point', tail: .6, spots: true, line: 'So tall it can see over your house.' }], monkey: [.7, .45, .4, .1, 0x7a5a3a, { ears: 'round', tail: .9, line: 'Cheeky and loves bananas.' }],
  panda: [1.2, .75, .45, .25, 0xf4f4f0, { ears: 'round', tail: .1, panda: true, line: 'Munches bamboo all day.' }], deer: [1.2, .55, .8, .5, 0xa8703a, { ears: 'point', tail: .2, antlers: true, line: 'Quiet, with big antlers.' }]
};
/* other things: maker name, price, a fun line */
const THINGS = [
  [['robot', 'android', 'bot'], 'robot', 40, 'Your very own robot helper. Beep boop!'],
  [['rocket', 'spaceship', 'space ship'], 'rocket', 90, 'Ready for blast-off (it stays on the launch pad for now).'],
  [['ufo', 'flying saucer', 'alien'], 'ufo', 70, 'It hovers and glows. Nobody knows where it came from…'],
  [['pool', 'hot tub', 'jacuzzi'], 'pool', 50, 'Cool, clear water for hot days.'],
  [['trampoline'], 'trampoline', 25, 'Boing! Higher and higher.'],
  [['slide', 'playground', 'swing'], 'playground', 30, 'Swings and a big slide — recess anytime.'],
  [['statue'], 'statue', 35, 'A shining statue so everyone knows this place is special.'],
  [['trophy', 'cup', 'award', 'medal'], 'trophy', 20, 'For being the best Mindworks player ever.'],
  [['crown'], 'crown', 30, 'Fit for a king or queen.'],
  [['treasure', 'chest', 'money', 'coins'], 'chest', 40, 'Overflowing with gold coins (sorry — they’re just for looks!).'],
  [['diamond', 'gem', 'crystal', 'jewel', 'ruby', 'emerald'], 'gem', 45, 'It sparkles in every colour.'],
  [['tree', 'oak', 'palm'], 'tree', 8, 'Shade on a sunny day.'], [['flower', 'garden', 'rose', 'plant'], 'flowers', 6, 'Smells wonderful.'],
  [['tv', 'television', 'computer', 'game console', 'video game', 'xbox', 'playstation', 'nintendo'], 'tv', 30, 'A giant screen for movies and games.'],
  [['tent', 'campfire', 'camp'], 'tent', 15, 'Camp out under the stars.'], [['snowman'], 'snowman', 6, 'He never melts here.'],
  [['ball', 'soccer', 'football', 'beach ball'], 'ball', 5, 'Kick it, throw it, bounce it.'], [['basketball', 'hoop'], 'hoop', 15, 'Shoot some hoops!'],
  [['bed'], 'bed', 15, 'A comfy bed for big naps.'], [['couch', 'sofa', 'chair', 'armchair'], 'couch', 12, 'Sit down and relax.'], [['table', 'desk'], 'table', 10, 'Great for snacks and homework.'],
  [['fountain'], 'fountain', 35, 'The water sparkles and splashes.'], [['tower', 'lighthouse'], 'lighthouse', 45, 'A lighthouse that lights the way home.'],
  [['flag'], 'flag', 6, 'Wave it proudly.'], [['lamp', 'light', 'lantern'], 'lamp', 6, 'Glows at night.'], [['sign'], 'sign', 4, 'Says whatever you want it to say.']
];
const EMOJI = { pizza: '🍕', burger: '🍔', hamburger: '🍔', 'hot dog': '🌭', 'ice cream': '🍦', cake: '🎂', donut: '🍩', doughnut: '🍩', cookie: '🍪', taco: '🌮', candy: '🍬', lollipop: '🍭', apple: '🍎', banana: '🍌', watermelon: '🍉', strawberry: '🍓', guitar: '🎸', piano: '🎹', drum: '🥁', star: '⭐', heart: '❤️', moon: '🌙', sun: '☀️', rainbow: '🌈', skateboard: '🛹', bike: '🚲', bicycle: '🚲', scooter: '🛴', book: '📚', balloon: '🎈', present: '🎁', gift: '🎁', clock: '⏰', bell: '🔔', umbrella: '☂️', teddy: '🧸', 'teddy bear': '🧸', octopus: '🐙', shark: '🦈', whale: '🐳', dolphin: '🐬', fish: '🐟', turtle: '🐢', snake: '🐍', frog: '🐸', bird: '🐦', parrot: '🦜', eagle: '🦅', owl: '🦉', penguin: '🐧', chicken: '🐔', duck: '🦆', bee: '🐝', butterfly: '🦋', spider: '🕷️', ghost: '👻', pumpkin: '🎃', volcano: '🌋', mountain: '⛰️', globe: '🌍', planet: '🪐', earth: '🌍', cactus: '🌵', mushroom: '🍄', shoe: '👟', hat: '🎩', sunglasses: '🕶️', phone: '📱', camera: '📷', magnet: '🧲', robot: '🤖', sword: '🗡️', shield: '🛡️', wand: '🪄', key: '🔑', lock: '🔒', bomb: '💣', fire: '🔥', lightning: '⚡', snowflake: '❄️', cloud: '☁️', music: '🎵', dice: '🎲', puzzle: '🧩', kite: '🪁', trophy: '🏆', castle: '🏰', egg: '🥚', cheese: '🧀', bread: '🍞', popcorn: '🍿', soda: '🥤', juice: '🧃', milk: '🥛' };

/** read what you typed and decide what it is, what it costs and why */
export function interpret(text, free, salt = 0) {
  const q0 = (text || '').trim(), q = q0.toLowerCase();
  const r = rng((hash(q) + salt * 977) % 1e6 + 1);
  const size = has(q, 'biggest', 'largest', 'world', 'enormous', 'gigantic', 'colossal', 'mega', 'ultra') ? 4 : has(q, 'giant', 'huge', 'massive', 'super big') ? 2.6 : has(q, 'big', 'large', 'tall') ? 1.6 : has(q, 'tiny', 'mini', 'little', 'small', 'baby') ? .55 : 1;
  const colorName = Object.keys(COLORS).find(c => has(q, c)), fancy = has(q, 'gold', 'diamond', 'golden', 'platinum', 'luxury', 'fancy', 'rich');
  const freePrice = 1 + (hash(q + salt) % 4); // 1–4 coins
  const priced = (base, mult = 1) => free ? freePrice : Math.max(1, Math.min(999, Math.round(base * mult * (size >= 4 ? 4 : size >= 2.6 ? 2.5 : size >= 1.6 ? 1.6 : size < 1 ? .6 : 1) * (fancy ? 2 : 1))));
  // houses → your home
  if (has(q, 'house', 'home', 'mansion', 'castle', 'palace', 'skyscraper', 'cabin', 'cottage', 'villa', 'apartment', 'hotel', 'igloo', 'treehouse', 'tree house', 'fort') && !has(q, 'dog house', 'doghouse', 'bird house', 'birdhouse', 'dollhouse')) {
    const homes = designHomes(q0 + (salt ? ' ' + salt : '')); let T = homes[0];
    const vol = h => (h.kind === 'tower' ? h.floors * 3 : h.stories * 4) * h.w * h.d;
    if (size >= 1.6) T = homes.reduce((a, b) => vol(b) > vol(a) ? b : a);
    if (size >= 4) { T = { ...T }; if (T.kind === 'tower') T.floors = 60; else { T.stories = 3; T.w = 20; T.d = 16; T.wings = 2; T.bigWings = true; T.fountain = true; T.pool = true; T.gold = true; T.statues = true; T.tower = true; } T.name = 'The Biggest ' + T.name.replace(/ (II|III|IV|V|VI)$/, '').replace(/^(Grand|Super|The Biggest) /, '') + ' in the World'; }
    const base = T.kind === 'tower' ? 60 + T.floors * 4 : 30 + T.stories * 20 + (T.wings ? 40 : 0) + (T.pool ? 20 : 0) + (T.gold ? 40 : 0);
    return { type: 'house', spec: T, name: T.name, price: free ? freePrice : Math.min(999, base * (size >= 4 ? 2 : 1)), why: (T.blurb || '') + ' — it becomes your home, and you can walk right in.' };
  }
  // vehicles → your garage, dock or airport
  if (has(q, 'plane', 'jet', 'airplane', '747', 'jumbo', 'helicopter', 'chopper', 'seaplane')) {
    const k = has(q, '747', 'jumbo', 'biggest', 'giant') ? 'jumbo' : has(q, 'heli', 'chopper') ? 'heli' : has(q, 'sea', 'water') ? 'sea' : has(q, 'jet', 'fast') ? 'jet' : 'sky';
    return { type: 'plane', kind: k, name: PLANES[k].name, price: free ? freePrice : 25, why: 'It will be waiting for you at Hometown Airport.' };
  }
  if (has(q, 'boat', 'yacht', 'sail', 'canoe', 'kayak') || (has(q, 'ship') && !has(q, 'space', 'rocket', 'star'))) {
    const k = has(q, 'speed', 'fast', 'yacht', 'race') ? 'speed' : has(q, 'sail', 'ship') ? 'sail' : 'row';
    return { type: 'boat', kind: k, name: BOATS[k].name, price: free ? freePrice : BOATS[k].price, why: BOATS[k].blurb + ' Walk to the water to use it.' };
  }
  if (has(q, 'car', 'truck', 'jeep', 'van', 'limo', 'bus', 'race car', 'racecar', 'tractor', 'monster truck')) {
    const k = has(q, 'race', 'fast', 'sport', 'lambo', 'ferrari') ? 'race' : has(q, 'truck', 'tractor', 'bus', 'van') ? 'truck' : has(q, 'jeep', 'jungle', 'off') ? 'jeep' : 'sedan';
    return { type: 'car', kind: k, name: CARS[k].name, price: free ? freePrice : CARS[k].price, why: CARS[k].blurb + ' Tap 🚗 Drive outside.' };
  }
  // a 3D thing
  const noun = (() => {
    for (const a of Object.keys(ANIMALS).sort((a, b) => b.length - a.length)) if (has(q, a)) return { maker: 'animal', key: a };
    for (const t of THINGS) for (const w of t[0]) if (has(q, w)) return { maker: t[1], word: w, base: t[2], line: t[3] };
    for (const e of Object.keys(EMOJI).sort((a, b) => b.length - a.length)) if (has(q, e)) return { maker: 'emoji', emoji: EMOJI[e], word: e };
    return { maker: 'gift' };
  })();
  const color = colorName ? COLORS[colorName] : null, seed = Math.floor(r() * 1e6);
  const scale = (noun.maker === 'animal' ? 1.3 : 1) * size;
  let name, why, base;
  if (noun.maker === 'animal') { const A = ANIMALS[noun.key]; name = (colorName ? cap(colorName) + ' ' : '') + cap(noun.key); why = A[5].line; base = noun.key === 'dragon' || noun.key === 'unicorn' ? 60 : noun.key.includes('rex') || noun.key.startsWith('dino') || noun.key === 'elephant' || noun.key === 'giraffe' ? 45 : 20; }
  else if (noun.maker === 'emoji') { name = (colorName ? cap(colorName) + ' ' : '') + cap(noun.word); why = 'A ' + (size >= 2.6 ? 'giant ' : '') + noun.word + ' statue for your town.'; base = 12; }
  else if (noun.maker === 'gift') { name = cap(q0.replace(/^(a|an|the|my)\s+/i, '').slice(0, 30)) || 'Mystery Gift'; why = 'I don’t know how to build that yet, so here it is as a giant surprise present with its name on it!'; base = 10; }
  else { name = (colorName ? cap(colorName) + ' ' : '') + cap(noun.word); why = noun.line; base = noun.base; }
  if (size >= 4) name = 'The Biggest ' + name + ' in the World'; else if (size >= 2.6) name = 'Giant ' + name; else if (size < 1) name = 'Tiny ' + name;
  return { type: 'thing', name, why, price: priced(base), thing: { ...noun, color, colorName, rainbow: colorName === 'rainbow', gold: has(q, 'gold', 'golden'), scale, seed, label: name } };
}

/* ---------------- 3D makers ---------------- */
const bx = (g, w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
const ball = (g, rad, m, x, y, z, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(new THREE.SphereGeometry(rad, 18, 12), m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; g.add(o); return o; };
const cyl = (g, r1, r2, h, m, x, y, z, seg = 16) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
function labelTex(text, emoji) {
  const c = document.createElement('canvas'); c.width = 512; c.height = emoji ? 512 : 256; const x = c.getContext('2d');
  x.textAlign = 'center'; x.textBaseline = 'middle';
  if (emoji) { x.font = '400px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; x.fillText(text, 256, 290); }
  else { x.fillStyle = '#fff8e0'; x.fillRect(0, 0, 512, 256); x.strokeStyle = '#8a5a35'; x.lineWidth = 14; x.strokeRect(7, 7, 498, 242); x.fillStyle = '#3a2a1a'; let fs = 70; x.font = '700 ' + fs + 'px Fredoka, Arial'; while (x.measureText(text).width > 460 && fs > 26) { fs -= 4; x.font = '700 ' + fs + 'px Fredoka, Arial'; } x.fillText(text, 256, 130); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function animal(g, key, T, r) {
  const [L, H, leg, neck, def, X] = ANIMALS[key];
  const mainC = T.gold ? 0xf2c84a : T.color != null && T.color >= 0 ? T.color : def, m = std(mainC, T.gold ? .35 : .75, T.gold ? .45 : 0);
  const dark = std(new THREE.Color(mainC).multiplyScalar(.55).getHex(), .8), eye = std(0x111111, .3), white = std(0xffffff, .5);
  const y0 = leg + H / 2;
  ball(g, .5, m, 0, y0, 0, H * 1.0, H, L); // body
  if (X.spots) for (let k = 0; k < 6; k++) ball(g, .16 * H + .05, dark, (r() - .5) * H * .9, y0 + (r() - .2) * H * .4, (r() - .5) * L * .7, 1, .4, 1);
  if (X.stripes) for (let k = -2; k <= 2; k++) bx(g, H * 1.02, H * .9, .06, dark, 0, y0, k * L * .17);
  if (X.panda) { bx(g, H * 1.02, H * .8, L * .3, std(0x222222, .8), 0, y0, 0); }
  [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz]) => { const l = cyl(g, H * .16, H * .13, leg, X.panda ? std(0x222222, .8) : m, sx * H * .3, leg / 2, sz * L * .32); l.castShadow = true; });
  // neck + head
  const hz = L / 2 + neck * .45, hy = y0 + neck * .85 + H * .1, hs = Math.max(.18, H * .42);
  if (neck > .25) { const n = cyl(g, H * .17, H * .22, neck * 1.2, m, 0, y0 + neck * .45, L / 2 + neck * .2); n.rotation.x = .55; }
  ball(g, hs, m, 0, hy, hz, 1, .9, 1.25);
  ball(g, hs * .55, m, 0, hy - hs * .2, hz + hs * .95, 1, .8, 1); // snout
  [-1, 1].forEach(s => { ball(g, hs * .14, eye, s * hs * .5, hy + hs * .25, hz + hs * .75); if (X.panda) ball(g, hs * .25, std(0x222222, .8), s * hs * .5, hy + hs * .22, hz + hs * .68, 1, 1, .4); });
  [-1, 1].forEach(s => {
    if (X.ears === 'point') { const e = new THREE.Mesh(new THREE.ConeGeometry(hs * .28, hs * .6, 8), m); e.position.set(s * hs * .5, hy + hs * .85, hz - hs * .2); g.add(e); }
    else if (X.ears === 'long') ball(g, hs * .2, m, s * hs * .35, hy + hs * 1.3, hz - hs * .2, .8, 3, .6);
    else if (X.ears === 'flop') ball(g, hs * .3, dark, s * hs * .85, hy + hs * .2, hz - hs * .1, .5, 1.3, .9);
    else if (X.ears === 'round') ball(g, hs * .25, X.panda ? std(0x222222, .8) : dark, s * hs * .6, hy + hs * .75, hz - hs * .15, 1, 1, .5);
    else if (X.ears === 'big') ball(g, hs * .8, dark, s * hs * 1.1, hy + hs * .1, hz - hs * .3, .25, 1.2, 1);
    else if (X.ears === 'horns') { const e = new THREE.Mesh(new THREE.ConeGeometry(hs * .14, hs * .9, 8), std(0xf2e6c8, .5)); e.position.set(s * hs * .45, hy + hs * .9, hz - hs * .4); e.rotation.x = -.6; g.add(e); }
  });
  if (X.horn) { const h = new THREE.Mesh(new THREE.ConeGeometry(hs * .14, hs * 1.3, 10), std(0xffd34d, .3, .7)); h.position.set(0, hy + hs * .9, hz + hs * .55); h.rotation.x = .6; g.add(h); }
  if (X.antlers) [-1, 1].forEach(s => { const a = cyl(g, .03, .04, hs * 1.4, std(0x6a4a2a, .8), s * hs * .4, hy + hs * 1.2, hz - hs * .2, 6); a.rotation.z = s * .5; });
  if (X.trunk) { const t = cyl(g, hs * .18, hs * .3, hs * 1.6, m, 0, hy - hs * .8, hz + hs * 1.1); t.rotation.x = .25; }
  if (X.teeth) bx(g, hs * .9, hs * .12, hs * .1, white, 0, hy - hs * .45, hz + hs * 1.35);
  if (X.mane) { const mc = X.mane === 'rainbow' ? null : X.mane === 'lion' ? std(0x8a4a1a, .9) : dark; if (X.mane === 'lion') ball(g, hs * 1.45, mc, 0, hy, hz - hs * .25, 1, 1, .6); else for (let k = 0; k < 6; k++) bx(g, .08, H * .35, neck * .25, mc || std(RAINBOW[k], .6), 0, y0 + neck * (.2 + k * .14) + H * .35, L / 2 + neck * (.1 - k * .03) - .1); }
  if (X.tail) { const t = cyl(g, H * .1, H * .03, X.tail, X.mane === 'rainbow' ? std(RAINBOW[4], .6) : m, 0, y0 + .05, -L / 2 - X.tail * .4); t.rotation.x = key === 'dog' || key === 'puppy' ? -.9 : -1.25; }
  if (X.spikes) for (let k = 0; k < 7; k++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(H * .1, H * .3, 6), std(0xffd34d, .6)); sp.position.set(0, y0 + H * .52, L * (.35 - k * .12)); g.add(sp); }
  if (X.wings) [-1, 1].forEach(s => { const w = new THREE.Shape(); w.moveTo(0, 0); w.lineTo(s * L * .9, L * .45); w.lineTo(s * L * .75, -L * .1); w.lineTo(s * L * .35, -L * .2); const wm = new THREE.Mesh(new THREE.ShapeGeometry(w), new THREE.MeshStandardMaterial({ color: dark.color, side: THREE.DoubleSide, roughness: .8 })); wm.rotation.x = -Math.PI / 2 + .35; wm.position.set(s * H * .2, y0 + H * .4, L * .1); wm.castShadow = true; g.add(wm); });
}
const MAKERS = {
  robot(g, T, m) { const met = T.color != null && T.color >= 0 ? std(T.color, .35, .6) : std(0xb8c0cc, .3, .8), d = std(0x22252b, .4), glow = new THREE.MeshBasicMaterial({ color: 0x4ad6ff });
    bx(g, .9, 1.0, .6, met, 0, 1.4, 0); bx(g, .6, .5, .5, met, 0, 2.2, 0); [-1, 1].forEach(s => { bx(g, .12, .1, .05, glow, s * .14, 2.25, .26); bx(g, .25, .8, .25, met, s * .62, 1.35, 0); bx(g, .28, .9, .3, d, s * .22, .45, 0); }); cyl(g, .03, .03, .35, d, 0, 2.6, 0); ball(g, .08, new THREE.MeshBasicMaterial({ color: 0xff4a4a }), 0, 2.8, 0); bx(g, .4, .3, .02, glow, 0, 1.5, .31); },
  rocket(g, T) { const w = std(T.color != null && T.color >= 0 ? T.color : 0xf2f2f2, .4, .3), red = std(0xd8452f, .5); cyl(g, .8, .8, 5, w, 0, 3.5, 0, 24); const n = new THREE.Mesh(new THREE.ConeGeometry(.8, 2, 24), red); n.position.y = 7; g.add(n); for (let k = 0; k < 4; k++) { const f = bx(g, .1, 1.6, 1.0, red, Math.sin(k * Math.PI / 2) * .8, 1.6, Math.cos(k * Math.PI / 2) * .8); f.rotation.y = k * Math.PI / 2; } ball(g, .35, std(0x4ad6ff, .1, .5), 0, 5, .72, 1, 1, .3); cyl(g, .6, .9, .8, std(0x333333, .5, .6), 0, .6, 0); cyl(g, 2.2, 2.4, .3, std(0x777777, .7), 0, .15, 0, 24); },
  ufo(g, T) { const m = std(T.color != null && T.color >= 0 ? T.color : 0xc9ccd1, .25, .8); ball(g, 2, m, 0, 2.4, 0, 1, .25, 1); ball(g, .9, std(0x7fe0ff, .05, .3), 0, 2.8, 0, 1, .8, 1); for (let k = 0; k < 8; k++) ball(g, .14, new THREE.MeshBasicMaterial({ color: 0xffe14a }), Math.cos(k * Math.PI / 4) * 1.7, 2.3, Math.sin(k * Math.PI / 4) * 1.7); const beam = new THREE.Mesh(new THREE.ConeGeometry(1.4, 2.2, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0x9fff9f, transparent: true, opacity: .25 })); beam.position.y = 1.1; g.add(beam); },
  pool(g, T) { bx(g, 6, .5, 4, std(0xf2efe8, .7), 0, .25, 0); const w = bx(g, 5.4, .1, 3.4, std(T.color != null && T.color >= 0 ? T.color : 0x2fa8e0, .05, .2), 0, .45, 0); w.castShadow = false; cyl(g, .05, .05, 1.2, std(0xc9ccd1, .2, .9), 2.7, .9, 1.4); },
  trampoline(g, T) { cyl(g, 1.8, 1.8, .12, std(0x222222, .7), 0, .9, 0, 28); const ring = new THREE.Mesh(new THREE.TorusGeometry(1.85, .12, 8, 28), std(T.color != null && T.color >= 0 ? T.color : 0x2f6fd8, .5)); ring.rotation.x = Math.PI / 2; ring.position.y = .92; g.add(ring); for (let k = 0; k < 6; k++) cyl(g, .05, .05, .9, std(0x888888, .4, .7), Math.cos(k) * 1.75, .45, Math.sin(k) * 1.75, 6); },
  playground(g, T) { const c = std(T.color != null && T.color >= 0 ? T.color : 0xd8452f, .6), metal = std(0x8a8f99, .4, .7); [-1.5, 1.5].forEach(x => { const a = cyl(g, .07, .07, 2.6, metal, x, 1.25, -.6, 6); a.rotation.x = .35; const b = cyl(g, .07, .07, 2.6, metal, x, 1.25, .6, 6); b.rotation.x = -.35; }); const top = cyl(g, .07, .07, 3.2, metal, 0, 2.45, 0, 6); top.rotation.z = Math.PI / 2; [-.6, .6].forEach(x => { bx(g, .5, .06, .25, c, x, .6, 0); cyl(g, .015, .015, 1.8, metal, x - .2, 1.5, 0, 4); cyl(g, .015, .015, 1.8, metal, x + .2, 1.5, 0, 4); }); bx(g, 1.2, .1, 1.2, std(0xffd34d, .6), 3.2, 1.6, 0); const s = bx(g, .9, .08, 3.2, c, 3.2, .85, 1.9); s.rotation.x = .5; },
  statue(g, T, m, r) { bx(g, 1.6, 1.2, 1.6, std(0xd9d2c2, .8), 0, .6, 0); const gm = T.color != null && T.color >= 0 && !T.gold ? std(T.color, .4, .3) : std(0xd8b04a, .25, .9); const s = new THREE.Group(); animal(s, Object.keys(ANIMALS)[Math.floor(r() * 10)], { gold: false, color: gm.color.getHex() }, r); s.traverse(o => { if (o.isMesh) o.material = gm; }); s.position.y = 1.2; s.scale.setScalar(1.1); g.add(s); },
  trophy(g, T) { const gm = std(0xd8b04a, .2, .95); bx(g, 1, .4, 1, std(0x3a2a1a, .6), 0, .2, 0); cyl(g, .15, .3, .8, gm, 0, .8, 0); const cup = new THREE.Mesh(new THREE.CylinderGeometry(.7, .25, 1.1, 24, 1, true), gm); cup.material.side = THREE.DoubleSide; cup.position.y = 1.75; g.add(cup); [-1, 1].forEach(s => { const h = new THREE.Mesh(new THREE.TorusGeometry(.3, .06, 8, 16, Math.PI), gm); h.position.set(s * .75, 1.8, 0); h.rotation.z = s * -Math.PI / 2; g.add(h); }); },
  crown(g) { const gm = std(0xd8b04a, .2, .95); cyl(g, .6, .6, .12, std(0xd8452f, .6), 0, .9, 0, 24); cyl(g, .62, .62, .5, gm, 0, 1.2, 0, 24); for (let k = 0; k < 6; k++) { const p = new THREE.Mesh(new THREE.ConeGeometry(.14, .5, 6), gm); p.position.set(Math.cos(k * Math.PI / 3) * .58, 1.65, Math.sin(k * Math.PI / 3) * .58); g.add(p); ball(g, .07, std(RAINBOW[k], .1, .3), Math.cos(k * Math.PI / 3) * .6, 1.25, Math.sin(k * Math.PI / 3) * .6); } bx(g, 1.2, .8, 1.2, std(0x6a2a3a, .9), 0, .4, 0); },
  chest(g) { const wd = std(0x8a5a35, .8), gm = std(0xd8b04a, .25, .9); bx(g, 1.6, .8, 1, wd, 0, .4, 0); const lid = bx(g, 1.6, .15, 1, wd, 0, 1.05, -.45); lid.rotation.x = -1.1; for (let k = 0; k < 18; k++) ball(g, .14, gm, (k % 6 - 2.5) * .24, .85 + (k % 3) * .06, (Math.floor(k / 6) - 1) * .25, 1, .35, 1); bx(g, 1.65, .1, 1.05, gm, 0, .65, 0); },
  gem(g, T) { const c = T.color != null && T.color >= 0 ? T.color : 0x7fe0ff, gm = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: c, roughness: .05, metalness: .2, transparent: true, opacity: .85 })); gm.scale.set(1, 1.4, 1); gm.position.y = 2; gm.castShadow = true; g.add(gm); bx(g, 1.2, .8, 1.2, std(0xd9d2c2, .8), 0, .4, 0); },
  tree(g, T, m, r) { const t = tree(r, 1.2); g.add(t); },
  flowers(g, T, m, r) { bx(g, 3, .3, 1.4, std(0x6a4a2a, .9), 0, .15, 0); for (let k = 0; k < 24; k++) { const x = (r() - .5) * 2.7, z = (r() - .5) * 1.2; cyl(g, .02, .02, .5, std(0x3a8a3a, .8), x, .55, z, 4); ball(g, .1, std(T.color != null && T.color >= 0 ? T.color : RAINBOW[k % 6], .6), x, .82, z); } },
  tv(g, T) { bx(g, 2.4, .7, .6, std(0x3a2a1a, .6), 0, .35, 0); bx(g, 3.2, 1.9, .12, std(0x111111, .3, .4), 0, 1.75, 0); bx(g, 3.0, 1.7, .02, new THREE.MeshBasicMaterial({ color: T.color != null && T.color >= 0 ? T.color : 0x3aa0ff }), 0, 1.75, .07); bx(g, .4, .15, .25, std(0xffffff, .4), .6, .78, .1); },
  tent(g, T) { const t = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2, 4), std(T.color != null && T.color >= 0 ? T.color : 0x3fae5a, .8)); t.position.y = 1; t.rotation.y = Math.PI / 4; t.castShadow = true; g.add(t); for (let k = 0; k < 5; k++) { const l = cyl(g, .06, .06, .6, std(0x6a4a2a, .9), 2.4 + Math.cos(k) * .2, .1, Math.sin(k) * .2, 5); l.rotation.z = Math.PI / 2; l.rotation.y = k; } const f = new THREE.Mesh(new THREE.ConeGeometry(.25, .6, 8), new THREE.MeshBasicMaterial({ color: 0xff8a2a })); f.position.set(2.4, .4, 0); g.add(f); },
  snowman(g) { const w = std(0xffffff, .8); ball(g, .7, w, 0, .7, 0); ball(g, .5, w, 0, 1.75, 0); ball(g, .35, w, 0, 2.45, 0); const n = new THREE.Mesh(new THREE.ConeGeometry(.07, .4, 8), std(0xff8a2a, .6)); n.rotation.x = Math.PI / 2; n.position.set(0, 2.45, .5); g.add(n); cyl(g, .3, .3, .4, std(0x222222, .6), 0, 2.95, 0); cyl(g, .45, .45, .05, std(0x222222, .6), 0, 2.76, 0); },
  ball(g, T) { ball(g, .6, std(T.color != null && T.color >= 0 ? T.color : 0xf2f2f2, .5), 0, .6, 0); ball(g, .605, std(0x222222, .6), 0, .6, 0, 1, .2, 1); },
  hoop(g) { cyl(g, .08, .08, 3, std(0x777777, .4, .7), 0, 1.5, -.4, 8); bx(g, 1.4, .9, .06, std(0xffffff, .5), 0, 3.0, -.3); const r = new THREE.Mesh(new THREE.TorusGeometry(.28, .03, 8, 20), std(0xff6a2a, .5)); r.rotation.x = Math.PI / 2; r.position.set(0, 2.7, 0); g.add(r); ball(g, .14, std(0xe8702a, .7), .5, .14, .5); },
  bed(g, T) { bx(g, 1.6, .4, 2.2, std(0x6a4a2a, .7), 0, .2, 0); bx(g, 1.5, .25, 2.1, std(0xffffff, .9), 0, .5, 0); bx(g, 1.52, .15, 1.3, std(T.color != null && T.color >= 0 ? T.color : 0x2f6fd8, .9), 0, .65, .4); bx(g, .7, .18, .4, std(0xffffff, .9), -.35, .7, -.8); bx(g, .7, .18, .4, std(0xffffff, .9), .35, .7, -.8); bx(g, 1.6, 1, .1, std(0x6a4a2a, .7), 0, .7, -1.1); },
  couch(g, T) { const c = std(T.color != null && T.color >= 0 ? T.color : 0x8a5a35, .9); bx(g, 2.4, .45, 1, c, 0, .35, 0); bx(g, 2.4, .7, .25, c, 0, .8, -.4); bx(g, .25, .65, 1, c, -1.15, .55, 0); bx(g, .25, .65, 1, c, 1.15, .55, 0); },
  table(g, T) { const w = std(T.color != null && T.color >= 0 ? T.color : 0x8a5a35, .6); bx(g, 2, .1, 1.2, w, 0, .8, 0); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => bx(g, .1, .8, .1, w, a * .9, .4, b * .5)); ball(g, .15, std(0xd8452f, .6), .3, .95, 0); },
  fountain(g, T) { const s = std(0xd9d2c2, .8); cyl(g, 2, 2.1, .6, s, 0, .3, 0, 24); cyl(g, 1.8, 1.8, .1, std(0x2fa8e0, .05, .2), 0, .58, 0, 24); cyl(g, .25, .3, 1.6, s, 0, 1.1, 0); cyl(g, .9, .5, .3, s, 0, 1.9, 0); ball(g, .4, std(0x9fd8ff, .05, .1), 0, 2.3, 0, 1, 1.4, 1); },
  lighthouse(g) { const r = std(0xd8452f, .6), w = std(0xf2f2f2, .6); for (let k = 0; k < 5; k++) cyl(g, 1.2 - k * .12, 1.2 - (k + 1) * .12, 1.6, k % 2 ? w : r, 0, .8 + k * 1.6, 0, 20); ball(g, .6, new THREE.MeshBasicMaterial({ color: 0xffe9a0 }), 0, 8.6, 0); const c = new THREE.Mesh(new THREE.ConeGeometry(.75, .8, 16), r); c.position.y = 9.4; g.add(c); },
  flag(g, T) { cyl(g, .05, .05, 4, std(0xc9ccd1, .3, .8), 0, 2, 0, 8); const f = bx(g, .04, .9, 1.4, T.rainbow ? std(RAINBOW[2]) : std(T.color != null && T.color >= 0 ? T.color : 0xd8452f, .7), 0, 3.5, .72); f.castShadow = false; },
  lamp(g, T) { cyl(g, .06, .08, 3, std(0x333333, .5, .6), 0, 1.5, 0, 8); ball(g, .35, new THREE.MeshBasicMaterial({ color: T.color != null && T.color >= 0 ? T.color : 0xffe9a0 }), 0, 3.2, 0); },
  sign(g, T) { cyl(g, .06, .06, 1.6, std(0x6a4a2a, .9), 0, .8, 0, 6); const p = new THREE.Mesh(new THREE.PlaneGeometry(2, 1), new THREE.MeshStandardMaterial({ map: labelTex(T.label), side: THREE.DoubleSide })); p.position.y = 1.9; g.add(p); },
  emoji(g, T) { bx(g, 1.4, .6, 1.4, std(0xd9d2c2, .8), 0, .3, 0); const tx = labelTex(T.emoji, true); [0, Math.PI].forEach(ry => { const p = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({ map: tx, transparent: true, alphaTest: .1 })); p.position.y = 1.85; p.rotation.y = ry; g.add(p); }); },
  gift(g, T) { const c = std(T.color != null && T.color >= 0 ? T.color : 0x8a5ad8, .6), rib = std(0xffd34d, .5, .3); bx(g, 2, 2, 2, c, 0, 1, 0); bx(g, 2.04, 2.04, .3, rib, 0, 1, 0); bx(g, .3, 2.04, 2.04, rib, 0, 1, 0); [-1, 1].forEach(s => { const b = new THREE.Mesh(new THREE.TorusGeometry(.35, .1, 8, 16), rib); b.position.set(s * .35, 2.25, 0); b.rotation.y = Math.PI / 2; b.rotation.x = s * .5; g.add(b); });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.8, .9), new THREE.MeshStandardMaterial({ map: labelTex(T.label) })); p.position.set(0, .7, 1.04); g.add(p); }
};
/** build a thing you bought */
export function makeThing(T) {
  const g = new THREE.Group(), inner = new THREE.Group(), r = rng((T.seed || 1) % 1e6 + 1);
  if (T.maker === 'animal') animal(inner, T.key, T, r); else (MAKERS[T.maker] || MAKERS.gift)(inner, T, null, r);
  if (T.rainbow && T.maker !== 'animal') { let k = 0; inner.traverse(o => { if (o.isMesh && o.material.isMeshStandardMaterial && !o.material.map) o.material = std(RAINBOW[k++ % 6], .5); }); }
  if (T.gold && T.maker !== 'animal' && T.maker !== 'emoji') inner.traverse(o => { if (o.isMesh && o.material.isMeshStandardMaterial && !o.material.map) o.material = std(0xd8b04a, .25, .9); });
  inner.scale.setScalar(T.scale || 1); g.add(inner);
  const bb = new THREE.Box3().setFromObject(g), sz = bb.getSize(new THREE.Vector3());
  g.userData.radius = Math.max(sz.x, sz.z) / 2;
  return g;
}
