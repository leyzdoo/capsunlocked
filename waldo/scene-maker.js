/**
 * scene-maker.js — draws a brand-new crowd for Big Picture Search every round.
 * Seven settings (festival, beach, forest, school, playground, river, ball field),
 * and the gold-star-hat person is somewhere random. Difficulty comes from a level:
 *   { people, decoys, tricky, size, zone }   (see searchLevels in config.js)
 *
 * makeScene(level, themeId?) → { src, x, y, r, clue, name, theme }  (x, y, r in %)
 */
(function () {
  "use strict";
  const W = 1600, H = 1000, INK = "#193b51";
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const f = (n) => Math.round(n);

  const SHIRTS = ["#c94f6d", "#d9743f", "#7aa6c2", "#e0a93b", "#5d5aa0", "#4f7d5a", "#3a3a3a", "#2f6f8f", "#9b5fa0"];
  const SKIN = ["#8a5636", "#b9784f", "#e0a77e", "#f5d2b6", "#f1c7a3"];
  const PANTS = ["#5a4632", "#6b6b6b", "#3d5a3d", "#27445e", "#333"];
  const HAIR = ["#c9a26b", "#7a4b2a", "#1d1d1d", "#3a3a3a", "#a0522d"];
  const BRIGHT = ["#d9743f", "#c94f6d", "#7aa6c2", "#9b5fa0", "#e0a93b", "#4f7d5a", "#2f6f8f"];
  const STAR = "M0 -27 L2.4 -21.5 L8 -21 L3.7 -17.5 L5 -12 L0 -15 L-5 -12 L-3.7 -17.5 L-8 -21 L-2.4 -21.5Z";

  const baseScale = (y) => 0.666 + 0.0008 * y; // further back = smaller

  /* ---------- people ---------- */
  function person(x, y, size, kind) {
    const s = baseScale(y) * size, skin = pick(SKIN);
    let head;
    if (kind === "target") {
      head = `<path d="M-12 -12 Q0 -30 12 -12Z" fill="#f2c230" stroke="${INK}" stroke-width="1.5"/><path d="${STAR}" fill="#fff" stroke="${INK}" stroke-width="1.2"/>`;
    } else if (kind === "decoy") { // gold hat, no star
      head = `<path d="M-12 -12 Q0 -30 12 -12Z" fill="#f2c230" stroke="${INK}" stroke-width="1.5"/>`;
    } else if (kind === "tricky") { // a star, but not on a gold hat
      head = `<path d="M-12 -12 Q0 -30 12 -12Z" fill="${pick(["#d9743f", "#c94f6d", "#e8e0c8", "#7aa6c2"])}" stroke="${INK}" stroke-width="1.5"/><path d="${STAR}" fill="#fff" stroke="${INK}" stroke-width="1.2"/>`;
    } else {
      const k = Math.random();
      if (k < 0.62) head = `<path d="M-10 -10 Q0 -22 10 -10Z" fill="${pick(HAIR)}"/>`;
      else if (k < 0.86) head = `<path d="M-11 -11 Q0 -24 11 -11Z M8 -12 L18 -10" fill="${pick(SHIRTS)}" stroke="${INK}" stroke-width="1.5"/>`;
      else head = `<path d="M-10 -12 L0 -38 L10 -12Z" fill="${pick(SHIRTS)}" stroke="${INK}" stroke-width="1.5"/>`;
    }
    return `<g transform="translate(${f(x)} ${f(y)}) scale(${s.toFixed(3)})">` +
      `<path d="M-6 30 L-8 52 M6 30 L8 52" stroke="${pick(PANTS)}" stroke-width="7" stroke-linecap="round"/>` +
      `<path d="M-11 10 L-18 30 M11 10 L18 30" stroke="${skin}" stroke-width="5" stroke-linecap="round"/>` +
      `<rect x="-11" y="4" width="22" height="30" rx="6" fill="${pick(SHIRTS)}" stroke="${INK}" stroke-width="1.5"/>` +
      `<circle cx="0" cy="-6" r="10" fill="${skin}" stroke="${INK}" stroke-width="1.5"/>${head}</g>`;
  }

  /* ---------- props: each returns { y: depth, svg, box: [x0,y0,x1,y1] } ---------- */
  const P = (y, svg, box) => ({ y, svg, box });
  const props = {
    car(x, y) {
      const c = pick(["#c98f8f", "#8fb0c9", "#a8c98f", "#c9b98f"]), flip = Math.random() < 0.5;
      const t = flip ? `translate(${f(x + 170)} ${f(y)}) scale(-1 1)` : `translate(${f(x)} ${f(y)})`;
      return P(y + 100, `<g stroke="${INK}" stroke-width="3" transform="${t}"><rect x="0" y="40" width="170" height="60" rx="14" fill="${c}"/><path d="M20 40 L40 0 L120 0 L150 40Z" fill="${c}"/><rect x="130" y="-15" width="60" height="40" fill="#f7d36a"/><circle cx="35" cy="102" r="16" fill="#333"/><circle cx="135" cy="102" r="16" fill="#333"/></g>`, [x - 25, y - 20, x + 215, y + 120]);
    },
    pumpkin: (x, y) => P(y, `<g><ellipse cx="${f(x)}" cy="${f(y)}" rx="16" ry="13" fill="#e07b2a" stroke="${INK}" stroke-width="2"/><rect x="${f(x - 2)}" y="${f(y - 18)}" width="4" height="7" fill="#4f7d5a"/></g>`, null),
    balloon: (x, y) => P(y + 62, `<g><path d="M${f(x)} ${f(y + 17)} Q${f(x + 6)} ${f(y + 40)} ${f(x)} ${f(y + 62)}" stroke="#555" stroke-width="1.5" fill="none"/><ellipse cx="${f(x)}" cy="${f(y)}" rx="13" ry="17" fill="${pick(BRIGHT)}" stroke="${INK}" stroke-width="2"/></g>`, null),
    umbrella(x, y) {
      const c = pick(["#c94f6d", "#d9743f", "#2f6f8f", "#4f7d5a", "#9b5fa0"]);
      return P(y, `<g stroke="${INK}" stroke-width="3"><path d="M${f(x)} ${f(y)} L${f(x)} ${f(y - 105)}" /><path d="M${f(x - 62)} ${f(y - 100)} Q${f(x)} ${f(y - 170)} ${f(x + 62)} ${f(y - 100)} Z" fill="${c}"/><path d="M${f(x - 20)} ${f(y - 100)} Q${f(x)} ${f(y - 165)} ${f(x + 20)} ${f(y - 100)} Z" fill="#fff8e8"/></g>`, [x - 66, y - 150, x + 66, y + 5]);
    },
    towel(x, y) {
      const a = pick(BRIGHT), b = "#fff8e8", r = f(rnd(-12, 12));
      return P(y - 30, `<g transform="rotate(${r} ${f(x)} ${f(y)})" stroke="${INK}" stroke-width="2"><rect x="${f(x - 50)}" y="${f(y - 20)}" width="100" height="40" fill="${a}"/><rect x="${f(x - 30)}" y="${f(y - 20)}" width="14" height="40" fill="${b}"/><rect x="${f(x + 16)}" y="${f(y - 20)}" width="14" height="40" fill="${b}"/></g>`, null);
    },
    sandcastle: (x, y) => P(y, `<g stroke="#9c7b3e" stroke-width="2" fill="#e3c27a"><rect x="${f(x - 40)}" y="${f(y - 36)}" width="80" height="36"/><rect x="${f(x - 48)}" y="${f(y - 62)}" width="24" height="62"/><rect x="${f(x + 24)}" y="${f(y - 62)}" width="24" height="62"/><rect x="${f(x - 12)}" y="${f(y - 80)}" width="24" height="44"/><path d="M${f(x)} ${f(y - 80)} L${f(x)} ${f(y - 100)} L${f(x + 16)} ${f(y - 94)} L${f(x)} ${f(y - 90)}" fill="#c94f6d" stroke="${INK}"/></g>`, [x - 52, y - 100, x + 52, y + 4]),
    beachball: (x, y) => P(y, `<g stroke="${INK}" stroke-width="2"><circle cx="${f(x)}" cy="${f(y - 14)}" r="14" fill="#fff"/><path d="M${f(x)} ${f(y - 28)} Q${f(x - 12)} ${f(y - 14)} ${f(x)} ${f(y)}" fill="#c94f6d"/><path d="M${f(x)} ${f(y - 28)} Q${f(x + 12)} ${f(y - 14)} ${f(x)} ${f(y)}" fill="#2f6f8f"/></g>`, null),
    lifeguard: (x, y) => P(y, `<g stroke="${INK}" stroke-width="3"><path d="M${f(x - 35)} ${f(y)} L${f(x - 20)} ${f(y - 110)} M${f(x + 35)} ${f(y)} L${f(x + 20)} ${f(y - 110)} M${f(x - 30)} ${f(y - 40)} L${f(x + 30)} ${f(y - 40)}" fill="none"/><rect x="${f(x - 40)}" y="${f(y - 160)}" width="80" height="50" fill="#fff8e8"/><path d="M${f(x - 50)} ${f(y - 160)} L${f(x)} ${f(y - 195)} L${f(x + 50)} ${f(y - 160)}Z" fill="#c94f6d"/></g>`, [x - 55, y - 195, x + 55, y + 4]),
    pine(x, y) {
      const s = rnd(0.8, 1.2), c = pick(["#2f6b45", "#3d7d50", "#285c3c"]);
      const tri = (top, w, bot) => `<path d="M${f(x)} ${f(y - top * s)} L${f(x + w * s)} ${f(y - bot * s)} L${f(x - w * s)} ${f(y - bot * s)}Z" fill="${c}"/>`;
      return P(y, `<g stroke="${INK}" stroke-width="2.5"><rect x="${f(x - 8 * s)}" y="${f(y - 30 * s)}" width="${f(16 * s)}" height="${f(30 * s)}" fill="#7a4b2a"/>${tri(110, 62, 28)}${tri(150, 50, 70)}${tri(185, 36, 110)}</g>`, [x - 66 * s, y - 185 * s, x + 66 * s, y + 4]);
    },
    roundTree(x, y) {
      const s = rnd(0.85, 1.15), c = pick(["#4f8f55", "#5a9a5e", "#3f7f4a"]);
      return P(y, `<g stroke="${INK}" stroke-width="2.5"><rect x="${f(x - 9 * s)}" y="${f(y - 60 * s)}" width="${f(18 * s)}" height="${f(60 * s)}" fill="#7a4b2a"/><circle cx="${f(x - 28 * s)}" cy="${f(y - 85 * s)}" r="${f(34 * s)}" fill="${c}"/><circle cx="${f(x + 28 * s)}" cy="${f(y - 85 * s)}" r="${f(34 * s)}" fill="${c}"/><circle cx="${f(x)}" cy="${f(y - 115 * s)}" r="${f(40 * s)}" fill="${c}"/></g>`, [x - 64 * s, y - 158 * s, x + 64 * s, y + 4]);
    },
    log: (x, y) => P(y, `<g stroke="${INK}" stroke-width="2.5"><rect x="${f(x - 55)}" y="${f(y - 24)}" width="110" height="24" rx="12" fill="#8a5a36"/><ellipse cx="${f(x + 50)}" cy="${f(y - 12)}" rx="8" ry="12" fill="#d8b07a"/></g>`, [x - 58, y - 28, x + 60, y + 3]),
    mushroom: (x, y) => P(y, `<g stroke="${INK}" stroke-width="2"><rect x="${f(x - 5)}" y="${f(y - 16)}" width="10" height="16" fill="#fff8e8"/><path d="M${f(x - 16)} ${f(y - 14)} Q${f(x)} ${f(y - 38)} ${f(x + 16)} ${f(y - 14)}Z" fill="#c94f6d"/><circle cx="${f(x - 5)}" cy="${f(y - 24)}" r="3" fill="#fff" stroke="none"/><circle cx="${f(x + 6)}" cy="${f(y - 21)}" r="2.5" fill="#fff" stroke="none"/></g>`, null),
    campfire: (x, y) => P(y, `<g stroke="${INK}" stroke-width="2.5"><path d="M${f(x - 30)} ${f(y)} L${f(x + 30)} ${f(y - 14)} M${f(x + 30)} ${f(y)} L${f(x - 30)} ${f(y - 14)}" stroke="#7a4b2a" stroke-width="9"/><path d="M${f(x - 18)} ${f(y - 10)} Q${f(x - 20)} ${f(y - 40)} ${f(x)} ${f(y - 62)} Q${f(x + 22)} ${f(y - 38)} ${f(x + 18)} ${f(y - 10)}Z" fill="#e0a93b"/><path d="M${f(x - 8)} ${f(y - 12)} Q${f(x)} ${f(y - 40)} ${f(x + 8)} ${f(y - 12)}Z" fill="#d9743f"/></g>`, [x - 36, y - 64, x + 36, y + 4]),
    bus(x, y) {
      let win = ""; for (let i = 0; i < 6; i++) win += `<rect x="${f(x + 18 + i * 34)}" y="${f(y + 10)}" width="24" height="22" fill="#cfe7f2"/>`;
      return P(y + 92, `<g stroke="${INK}" stroke-width="3"><rect x="${f(x)}" y="${f(y)}" width="250" height="80" rx="10" fill="#f2c230"/><rect x="${f(x + 215)}" y="${f(y + 10)}" width="28" height="50" fill="#cfe7f2"/>${win}<rect x="${f(x)}" y="${f(y + 46)}" width="250" height="6" fill="${INK}" stroke="none"/><circle cx="${f(x + 50)}" cy="${f(y + 82)}" r="16" fill="#333"/><circle cx="${f(x + 200)}" cy="${f(y + 82)}" r="16" fill="#333"/></g>`, [x - 25, y - 30, x + 275, y + 100]);
    },
    hoop: (x, y) => P(y, `<g stroke="${INK}" stroke-width="3"><path d="M${f(x)} ${f(y)} L${f(x)} ${f(y - 150)}"/><rect x="${f(x - 36)}" y="${f(y - 190)}" width="72" height="48" fill="#fff"/><rect x="${f(x - 14)}" y="${f(y - 175)}" width="28" height="20" fill="none"/><ellipse cx="${f(x)}" cy="${f(y - 142)}" rx="16" ry="5" fill="none" stroke="#d9743f"/></g>`, [x - 40, y - 192, x + 40, y + 4]),
    bench: (x, y) => P(y, `<g stroke="${INK}" stroke-width="2.5"><rect x="${f(x - 45)}" y="${f(y - 30)}" width="90" height="10" fill="#8a5a36"/><rect x="${f(x - 45)}" y="${f(y - 48)}" width="90" height="8" fill="#8a5a36"/><path d="M${f(x - 38)} ${f(y - 20)} L${f(x - 38)} ${f(y)} M${f(x + 38)} ${f(y - 20)} L${f(x + 38)} ${f(y)}"/></g>`, [x - 48, y - 50, x + 48, y + 3]),
    backpack: (x, y) => P(y, `<g stroke="${INK}" stroke-width="2"><rect x="${f(x - 11)}" y="${f(y - 26)}" width="22" height="26" rx="6" fill="${pick(BRIGHT)}"/><rect x="${f(x - 7)}" y="${f(y - 14)}" width="14" height="9" rx="2" fill="#fff8e8"/></g>`, null),
    slide: (x, y) => P(y, `<g stroke="${INK}" stroke-width="3"><path d="M${f(x - 40)} ${f(y)} L${f(x - 40)} ${f(y - 120)} M${f(x - 10)} ${f(y)} L${f(x - 10)} ${f(y - 120)} M${f(x - 40)} ${f(y - 30)} L${f(x - 10)} ${f(y - 30)} M${f(x - 40)} ${f(y - 60)} L${f(x - 10)} ${f(y - 60)} M${f(x - 40)} ${f(y - 90)} L${f(x - 10)} ${f(y - 90)}" fill="none"/><rect x="${f(x - 46)}" y="${f(y - 128)}" width="44" height="10" fill="#2f6f8f"/><path d="M${f(x - 4)} ${f(y - 124)} L${f(x + 90)} ${f(y - 6)} L${f(x + 110)} ${f(y - 6)} L${f(x + 14)} ${f(y - 124)}Z" fill="#c94f6d"/></g>`, [x - 50, y - 130, x + 114, y + 4]),
    swings(x, y) {
      let sw = ""; [-50, 0, 50].forEach((d) => { sw += `<path d="M${f(x + d - 12)} ${f(y - 130)} L${f(x + d - 12)} ${f(y - 38)} M${f(x + d + 12)} ${f(y - 130)} L${f(x + d + 12)} ${f(y - 38)}" stroke="#6b6b6b" stroke-width="2"/><rect x="${f(x + d - 16)}" y="${f(y - 40)}" width="32" height="7" fill="${pick(BRIGHT)}"/>`; });
      return P(y, `<g stroke="${INK}" stroke-width="3"><path d="M${f(x - 110)} ${f(y)} L${f(x - 90)} ${f(y - 134)} L${f(x - 70)} ${f(y)} M${f(x + 70)} ${f(y)} L${f(x + 90)} ${f(y - 134)} L${f(x + 110)} ${f(y)} M${f(x - 92)} ${f(y - 132)} L${f(x + 92)} ${f(y - 132)}" fill="none" stroke-width="5"/>${sw}</g>`, [x - 114, y - 138, x + 114, y + 4]);
    },
    sandbox: (x, y) => P(y - 40, `<g stroke="${INK}" stroke-width="3"><rect x="${f(x - 75)}" y="${f(y - 55)}" width="150" height="55" fill="#f2deb0"/><rect x="${f(x - 75)}" y="${f(y - 55)}" width="150" height="55" fill="none" stroke="#8a5a36" stroke-width="8"/><path d="M${f(x + 20)} ${f(y - 30)} L${f(x + 44)} ${f(y - 30)} L${f(x + 40)} ${f(y - 12)} L${f(x + 24)} ${f(y - 12)}Z" fill="#c94f6d" stroke-width="2"/></g>`, [x - 80, y - 60, x + 80, y + 4]),
    seesaw: (x, y) => P(y, `<g stroke="${INK}" stroke-width="3"><path d="M${f(x - 16)} ${f(y)} L${f(x)} ${f(y - 30)} L${f(x + 16)} ${f(y)}Z" fill="#6b6b6b"/><rect x="${f(x - 85)}" y="${f(y - 40)}" width="170" height="10" fill="#e0a93b" transform="rotate(-10 ${f(x)} ${f(y - 35)})"/></g>`, [x - 90, y - 62, x + 90, y + 4]),
    dome(x, y) {
      let lines = ""; for (let i = -2; i <= 2; i++) lines += `<path d="M${f(x + i * 26)} ${f(y)} Q${f(x + i * 14)} ${f(y - 95)} ${f(x)} ${f(y - 92)}" fill="none"/>`;
      return P(y, `<g stroke="#2f6f8f" stroke-width="4"><path d="M${f(x - 80)} ${f(y)} Q${f(x)} ${f(y - 140)} ${f(x + 80)} ${f(y)}" fill="none"/>${lines}<path d="M${f(x - 62)} ${f(y - 40)} L${f(x + 62)} ${f(y - 40)} M${f(x - 38)} ${f(y - 72)} L${f(x + 38)} ${f(y - 72)}"/></g>`, [x - 84, y - 96, x + 84, y + 4]);
    },
    rock: (x, y) => P(y, `<ellipse cx="${f(x)}" cy="${f(y - 10)}" rx="${f(rnd(14, 24))}" ry="${f(rnd(9, 13))}" fill="#9a9a92" stroke="${INK}" stroke-width="2"/>`, null),
    reeds: (x, y) => P(y, `<g stroke="#4f7d5a" stroke-width="3"><path d="M${f(x - 8)} ${f(y)} L${f(x - 12)} ${f(y - 40)} M${f(x)} ${f(y)} L${f(x)} ${f(y - 50)} M${f(x + 8)} ${f(y)} L${f(x + 13)} ${f(y - 38)}"/><rect x="${f(x - 3)}" y="${f(y - 58)}" width="6" height="16" rx="3" fill="#7a4b2a" stroke="none"/></g>`, null),
    blanket: (x, y) => P(y - 30, `<g stroke="${INK}" stroke-width="2"><rect x="${f(x - 55)}" y="${f(y - 30)}" width="110" height="44" fill="#c94f6d"/><path d="M${f(x - 28)} ${f(y - 30)} L${f(x - 28)} ${f(y + 14)} M${f(x)} ${f(y - 30)} L${f(x)} ${f(y + 14)} M${f(x + 28)} ${f(y - 30)} L${f(x + 28)} ${f(y + 14)} M${f(x - 55)} ${f(y - 8)} L${f(x + 55)} ${f(y - 8)}" stroke="#fff8e8" stroke-width="5"/></g>`, null),
    canoe: (x, y) => P(y, `<g stroke="${INK}" stroke-width="2.5"><path d="M${f(x - 60)} ${f(y - 14)} Q${f(x)} ${f(y + 10)} ${f(x + 60)} ${f(y - 14)}Z" fill="${pick(["#c94f6d", "#d9743f", "#e0a93b"])}"/></g>`, null),
    duck: (x, y) => P(y, `<g stroke="${INK}" stroke-width="1.5"><ellipse cx="${f(x)}" cy="${f(y - 6)}" rx="12" ry="7" fill="#f2c230"/><circle cx="${f(x + 9)}" cy="${f(y - 15)}" r="5" fill="#f2c230"/><path d="M${f(x + 13)} ${f(y - 15)} L${f(x + 19)} ${f(y - 13)} L${f(x + 13)} ${f(y - 12)}Z" fill="#d9743f"/></g>`, null),
    dugout: (x, y) => P(y, `<g stroke="${INK}" stroke-width="3"><rect x="${f(x - 90)}" y="${f(y - 60)}" width="180" height="60" fill="#8f969c"/><rect x="${f(x - 78)}" y="${f(y - 46)}" width="156" height="34" fill="#3a3a3a"/><rect x="${f(x - 96)}" y="${f(y - 68)}" width="192" height="12" fill="#2f6f8f"/></g>`, [x - 100, y - 70, x + 100, y + 4]),
  };

  /* ---------- settings ---------- */
  // Each: name, bg (svg string), area [yTop, yBottom] where people stand, blocked(x, footY) for water,
  // and a list of props to scatter: [propName, count, yMin, yMax].
  function sky(h, c = "#bcd9e6") { return `<rect width="${W}" height="${h}" fill="${c}"/>`; }
  const THEMES = {
    festival: () => {
      const wave = rnd(-60, 60);
      const tents = ["#4f7d5a", "#2f6f8f", "#e0a93b", "#d9743f", "#9b5fa0", "#c94f6d"].sort(() => Math.random() - 0.5).map((c, i) => {
        const x = 55 + i * 260 + rnd(-20, 20);
        return `<g><path d="M${f(x)} 250 L${f(x + 90)} 110 L${f(x + 180)} 250Z" fill="${c}" stroke="${INK}" stroke-width="3"/><path d="M${f(x + 70)} 250 L${f(x + 90)} 190 L${f(x + 110)} 250Z" fill="#fff8e8"/></g>`;
      }).join("");
      return { name: "At the festival", area: [235, 967],
        bg: `<rect width="${W}" height="${H}" fill="#cfe3c4"/>${sky(170)}<path d="M0 ${f(520 + wave)} C400 ${f(470 - wave)} 1200 ${f(600 + wave)} 1600 ${f(520 - wave)} L1600 ${f(600 - wave)} C1200 ${f(680 + wave)} 400 ${f(550 - wave)} 0 ${f(600 + wave)}Z" fill="#e8dcc0"/><path d="M760 170 L840 170 L900 1000 L700 1000Z" fill="#e8dcc0"/>${tents}`,
        scatter: [["car", 5, 330, 860], ["pumpkin", 18, 260, 980], ["balloon", 14, 200, 880]] };
    },
    beach: () => {
      let waves = ""; for (let i = 0; i < 9; i++) { const y = rnd(175, 300), x = rnd(0, W - 120); waves += `<path d="M${f(x)} ${f(y)} q20 -10 40 0 t40 0 t40 0" stroke="#fff" stroke-width="3" fill="none" opacity=".7"/>`; }
      let gulls = ""; for (let i = 0; i < 4; i++) { const x = rnd(100, 1500), y = rnd(40, 120); gulls += `<path d="M${f(x)} ${f(y)} q9 -9 18 0 q9 -9 18 0" stroke="${INK}" stroke-width="2.5" fill="none"/>`; }
      return { name: "At the beach", area: [345, 967], blocked: (x, y) => y < 345,
        bg: `<rect width="${W}" height="${H}" fill="#f2deb0"/>${sky(160, "#cfe9f5")}<circle cx="1420" cy="70" r="40" fill="#f2c230"/>${gulls}<rect y="150" width="${W}" height="190" fill="#5fa8d3"/>${waves}<path d="M0 330 Q100 350 200 332 T400 332 T600 332 T800 332 T1000 332 T1200 332 T1400 332 T1600 332 L1600 350 L0 350Z" fill="#fff" opacity=".8"/>`,
        scatter: [["umbrella", 7, 470, 960], ["towel", 9, 380, 960], ["sandcastle", 3, 420, 960], ["beachball", 6, 380, 960], ["lifeguard", 1, 470, 600]] };
    },
    forest: () => {
      let ridge = "M0 270"; for (let x = 0; x <= W; x += 80) ridge += ` Q${x + 40} ${f(rnd(150, 195))} ${x + 80} 250`;
      return { name: "In the forest", area: [280, 967],
        bg: `<rect width="${W}" height="${H}" fill="#b9d39a"/>${sky(200, "#d4e7ee")}<path d="${ridge} L${W} 290 L0 290Z" fill="#2f5d3a"/><path d="M700 290 C650 450 900 600 760 760 C680 860 820 940 780 1000 L900 1000 C950 920 820 860 880 760 C1000 600 760 450 820 290Z" fill="#d9c29a"/>`,
        scatter: [["pine", 9, 330, 950], ["roundTree", 4, 330, 950], ["log", 4, 380, 960], ["mushroom", 10, 320, 980], ["campfire", 1, 500, 850]] };
    },
    school: () => {
      let win = ""; for (let r = 0; r < 2; r++) for (let c = 0; c < 12; c++) { if (r === 1 && (c === 5 || c === 6)) continue; win += `<rect x="${250 + c * 95}" y="${160 + r * 70}" width="56" height="42" fill="#cfe7f2" stroke="#fff" stroke-width="4"/>`; }
      let hop = ""; [0, 1, 2, 3, 4].forEach((i) => { hop += `<rect x="${180 + (i % 2 ? 0 : 0)}" y="${420 + i * 40}" width="40" height="40" fill="none" stroke="#f2c230" stroke-width="4"/>`; });
      return { name: "At school", area: [345, 967],
        bg: `<rect width="${W}" height="${H}" fill="#cfe3c4"/>${sky(140)}<rect x="210" y="125" width="1180" height="215" fill="#b5563c" stroke="${INK}" stroke-width="3"/><rect x="190" y="110" width="1220" height="22" fill="#7d3a28" stroke="${INK}" stroke-width="3"/>${win}<rect x="730" y="245" width="140" height="95" fill="#6b4226" stroke="${INK}" stroke-width="3"/><path d="M800 245 L800 340" stroke="${INK}" stroke-width="3"/><rect x="725" y="200" width="150" height="34" fill="#fff8e8" stroke="${INK}" stroke-width="3"/><text x="800" y="225" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="22" fill="${INK}">SCHOOL</text><path d="M1460 340 L1460 60" stroke="#6b6b6b" stroke-width="6"/><rect x="1462" y="62" width="70" height="44" fill="#c94f6d" stroke="${INK}" stroke-width="2"/><rect x="1462" y="62" width="30" height="22" fill="#2f6f8f"/><rect x="0" y="340" width="${W}" height="330" fill="#8f969c"/><path d="M600 420 L1000 420 L1000 620 L600 620Z M800 420 L800 620 M600 520 L1000 520" fill="none" stroke="#fff" stroke-width="4"/>${hop}`,
        scatter: [["bus", 1, 380, 560], ["hoop", 1, 560, 640], ["bench", 3, 700, 960], ["backpack", 10, 360, 980], ["roundTree", 3, 720, 960]] };
    },
    playground: () => {
      let fence = ""; for (let x = 10; x < W; x += 60) fence += `<rect x="${x}" y="240" width="10" height="55" fill="#8a5a36"/>`;
      let bush = ""; for (let x = -20; x < W + 40; x += 90) bush += `<circle cx="${x}" cy="${f(rnd(195, 225))}" r="${f(rnd(50, 70))}" fill="#4f8f55"/>`;
      return { name: "On the playground", area: [300, 967],
        bg: `<rect width="${W}" height="${H}" fill="#e2c595"/>${sky(200, "#cfe9f5")}${bush}<rect y="280" width="${W}" height="20" fill="#cfe3c4"/>${fence}<rect y="252" width="${W}" height="8" fill="#8a5a36"/><rect y="275" width="${W}" height="8" fill="#8a5a36"/>`,
        scatter: [["slide", 2, 420, 900], ["swings", 1, 420, 900], ["sandbox", 1, 520, 940], ["seesaw", 1, 420, 940], ["dome", 1, 420, 940], ["bench", 3, 340, 960], ["backpack", 6, 330, 980]] };
    },
    river: () => {
      const ph = rnd(0, 6.28), amp = rnd(40, 80), bx = rnd(350, 1250);
      const yc = (x) => 600 + amp * Math.sin(x / 260 + ph), half = 58;
      let top = "", bot = "";
      for (let x = 0; x <= W; x += 40) { top += `${x === 0 ? "M" : "L"}${x} ${f(yc(x) - half)} `; }
      for (let x = W; x >= 0; x -= 40) { bot += `L${x} ${f(yc(x) + half)} `; }
      let ripples = ""; for (let i = 0; i < 10; i++) { const x = rnd(20, W - 80); ripples += `<path d="M${f(x)} ${f(yc(x) + rnd(-30, 30))} q15 -8 30 0 t30 0" stroke="#fff" stroke-width="3" fill="none" opacity=".6"/>`; }
      let hills = ""; for (let i = 0; i < 5; i++) hills += `<ellipse cx="${f(i * 400 + rnd(-60, 60))}" cy="250" rx="300" ry="${f(rnd(80, 120))}" fill="${pick(["#9cc27e", "#8db870"])}"/>`;
      const ybr = yc(bx);
      const bridge = `<g stroke="${INK}" stroke-width="3"><rect x="${f(bx - 55)}" y="${f(ybr - half - 16)}" width="110" height="${f(2 * half + 32)}" fill="#a87447"/><path d="M${f(bx - 55)} ${f(ybr - half - 16)} L${f(bx - 55)} ${f(ybr + half + 16)} M${f(bx + 55)} ${f(ybr - half - 16)} L${f(bx + 55)} ${f(ybr + half + 16)}" stroke="#6b4226" stroke-width="8"/></g>`;
      const water = (x, y) => Math.abs(y - yc(x)) < half + 18;
      return { name: "By the river", area: [290, 967],
        blocked: (x, y) => water(x, y) && Math.abs(x - bx) > 40,
        bg: `<rect width="${W}" height="${H}" fill="#c6df9e"/>${sky(230, "#d4e7ee")}${hills}<path d="${top}${bot}Z" fill="#5fa8d3" stroke="#8bb867" stroke-width="10"/>${ripples}${bridge}`,
        water: (x) => yc(x),
        bridgeX: bx,
        scatter: [["roundTree", 5, 300, 960], ["rock", 10, 300, 980], ["reeds", 8, 300, 980], ["blanket", 3, 320, 960], ["canoe", 2, "water"], ["duck", 5, "water"]] };
    },
    baseball: () => {
      let fans = ""; for (let r = 0; r < 4; r++) for (let i = 0; i < 70; i++) { const x = 60 + i * 21 + rnd(-4, 4), y = 128 + r * 42; fans += `<circle cx="${f(x)}" cy="${f(y)}" r="7" fill="${pick(SKIN)}"/><rect x="${f(x - 7)}" y="${f(y + 7)}" width="14" height="12" rx="3" fill="${pick(SHIRTS)}"/>`; }
      let rows = ""; for (let r = 0; r < 4; r++) rows += `<rect x="40" y="${140 + r * 42}" width="1520" height="16" fill="#c9ced2" stroke="${INK}" stroke-width="2"/>`;
      let stripes = ""; for (let y = 320; y < H; y += 70) stripes += `<rect y="${y}" width="${W}" height="35" fill="#85c46f"/>`;
      const hx = 800, hy = 930, d = 230; // home plate and diamond size
      const diamond = `<path d="M${hx} ${hy} L${hx + d} ${hy - d} L${hx} ${hy - 2 * d} L${hx - d} ${hy - d}Z" fill="#c99a63" stroke="#fff" stroke-width="5"/><path d="M${hx} ${hy - 40} L${hx + d - 50} ${hy - d} L${hx} ${hy - 2 * d + 50} L${hx - d + 50} ${hy - d}Z" fill="#7fbf6a"/><circle cx="${hx}" cy="${hy - d}" r="26" fill="#c99a63"/>` +
        [[hx, hy], [hx + d, hy - d], [hx, hy - 2 * d], [hx - d, hy - d]].map(([x, y]) => `<rect x="${x - 10}" y="${y - 10}" width="20" height="20" fill="#fff" stroke="${INK}" stroke-width="2" transform="rotate(45 ${x} ${y})"/>`).join("") +
        `<path d="M${hx} ${hy} L${hx - (hy - 325)} 325 M${hx} ${hy} L${hx + (hy - 325)} 325" stroke="#fff" stroke-width="4"/>`;
      return { name: "At the ball field", area: [330, 967],
        bg: `<rect width="${W}" height="${H}" fill="#74b35f"/>${sky(110, "#cfe9f5")}<rect x="30" y="105" width="1540" height="215" fill="#8f969c" stroke="${INK}" stroke-width="3"/>${rows}${fans}<rect x="680" y="20" width="240" height="80" fill="#2f5d3a" stroke="${INK}" stroke-width="3"/><text x="800" y="58" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="22" fill="#fff">HOME 3 · AWAY 2</text><text x="800" y="86" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#f2c230">INNING 7</text>${stripes}${diamond}`,
        scatter: [["dugout", 2, 380, 420], ["bench", 2, 700, 960], ["backpack", 6, 340, 980]] };
    },
  };
  const THEME_IDS = Object.keys(THEMES);

  /* ---------- build a scene ---------- */
  function makeScene(level, themeId) {
    const L = Object.assign({ people: 230, decoys: 10, tricky: 0, size: 1, zone: 3.5 }, level || {});
    const id = themeId && THEMES[themeId] ? themeId : pick(THEME_IDS);
    const T = THEMES[id]();
    const [yTop, yBot] = T.area;
    const blocked = T.blocked || (() => false);
    const items = [], boxes = [];
    const hits = (x, y, pad) => boxes.some(([a, b, c, d]) => x > a - pad && x < c + pad && y > b - pad && y < d + pad);

    // scatter props (no overlap between big props)
    for (const [name, count, yMin, yMax] of T.scatter) {
      for (let n = 0; n < count; n++) {
        for (let tries = 0; tries < 40; tries++) {
          let x = rnd(40, W - 60), y;
          if (yMin === "water") { y = T.water(x) + rnd(-25, 25); if (Math.abs(x - (T.bridgeX || -999)) < 80) continue; }
          else { y = rnd(yMin, yMax); if (blocked(x, y)) continue; }
          const p = props[name](x, y);
          if (p.box && hits((p.box[0] + p.box[2]) / 2, (p.box[1] + p.box[3]) / 2, ((p.box[2] - p.box[0]) / 2) + 10)) continue;
          items.push([p.y, p.svg]); if (p.box) boxes.push(p.box);
          break;
        }
      }
    }

    // where the star person stands: inside the crowd, on dry land, not behind a prop
    let tx, ty, t = 0;
    do { tx = rnd(45, W - 45); ty = rnd(yTop + 15, yBot - 40); t++; }
    while (t < 500 && (blocked(tx, ty + 40) || hits(tx, ty, 30)));
    const ts = baseScale(ty) * L.size;

    // the crowd (nobody stands right on top of the target)
    const near = (x, y) => Math.abs(x - tx) < 36 * L.size && y > ty - 45 * L.size && y < ty + 80 * L.size;
    let decoys = L.decoys, tricky = L.tricky, placed = 0, guard = 0;
    while (placed < L.people && guard++ < L.people * 6) {
      const x = rnd(15, W - 15), y = rnd(yTop, yBot);
      if (near(x, y) || blocked(x, y + 40)) continue;
      const kind = decoys > 0 ? (decoys--, "decoy") : tricky > 0 ? (tricky--, "tricky") : "plain";
      items.push([y + 52, person(x, y, L.size, kind)]); placed++;
    }
    items.sort((a, b) => a[0] - b[0]);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${T.bg}` +
      items.map((it) => it[1]).join("") + person(tx, ty, L.size, "target") + `</svg>`; // target last: never covered

    let clue = "Find the person with the GOLD STAR hat!";
    if (L.tricky > 0) clue = "Find the GOLD hat with a STAR. Careful: some gold hats have no star, and some stars are on other hats!";
    else if (L.decoys > 0) clue = "Find the person with the GOLD STAR hat. (Some hats are gold but have no star!)";
    return {
      name: T.name, theme: id, clue,
      src: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg),
      x: +(tx / W * 100).toFixed(1),
      y: +((ty - 12 * ts) / H * 100).toFixed(1),
      r: L.zone,
    };
  }

  window.WaldoScene = { makeScene, themes: THEME_IDS };
})();
