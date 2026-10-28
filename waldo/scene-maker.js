/**
 * scene-maker.js — draws a brand-new festival crowd for Big Picture Search
 * every round, with the gold-star-hat person somewhere random.
 * Same look as the old placeholder pictures (scene-1.svg … scene-8.svg),
 * but the crowd, tents, cars and the target's spot change every time.
 *
 * makeScene() → { src, x, y, r, clue, name }  (x, y, r in % like config.js SCENES)
 */
(function () {
  "use strict";
  const W = 1600, H = 1000, INK = "#193b51";
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const SHIRTS = ["#c94f6d", "#d9743f", "#7aa6c2", "#e0a93b", "#5d5aa0", "#4f7d5a", "#3a3a3a", "#2f6f8f", "#9b5fa0"];
  const SKIN = ["#8a5636", "#b9784f", "#e0a77e", "#f5d2b6", "#f1c7a3"];
  const PANTS = ["#5a4632", "#6b6b6b", "#3d5a3d", "#27445e", "#333"];
  const HAIR = ["#c9a26b", "#7a4b2a", "#1d1d1d", "#3a3a3a", "#a0522d"];
  const TENTS = ["#4f7d5a", "#2f6f8f", "#e0a93b", "#d9743f", "#9b5fa0", "#c94f6d"];
  const CARS = ["#c98f8f", "#8fb0c9", "#a8c98f", "#c9b98f"];
  const BALLOONS = ["#d9743f", "#c94f6d", "#7aa6c2", "#9b5fa0", "#e0a93b"];

  const scaleAt = (y) => 0.666 + 0.0008 * y; // people further back are smaller

  function person(x, y, opts = {}) {
    const s = scaleAt(y), skin = pick(SKIN);
    let head;
    if (opts.target) {
      head = `<path d="M-12 -12 Q0 -30 12 -12Z" fill="#f2c230" stroke="${INK}" stroke-width="1.5"/>` +
        `<path d="M0 -27 L2.4 -21.5 L8 -21 L3.7 -17.5 L5 -12 L0 -15 L-5 -12 L-3.7 -17.5 L-8 -21 L-2.4 -21.5Z" fill="#fff" stroke="${INK}" stroke-width="1.2"/>`;
    } else if (opts.decoy) { // gold hat, no star: keeps it tricky
      head = `<path d="M-12 -12 Q0 -30 12 -12Z" fill="#f2c230" stroke="${INK}" stroke-width="1.5"/>`;
    } else {
      const k = Math.random();
      if (k < 0.62) head = `<path d="M-10 -10 Q0 -22 10 -10Z" fill="${pick(HAIR)}"/>`;
      else if (k < 0.86) head = `<path d="M-11 -11 Q0 -24 11 -11Z M8 -12 L18 -10" fill="${pick(SHIRTS)}" stroke="${INK}" stroke-width="1.5"/>`;
      else head = `<path d="M-10 -12 L0 -38 L10 -12Z" fill="${pick(SHIRTS)}" stroke="${INK}" stroke-width="1.5"/>`;
    }
    const shirt = opts.target ? pick(["#e0a93b", "#c94f6d", "#7aa6c2", "#4f7d5a"]) : pick(SHIRTS);
    return `<g transform="translate(${x.toFixed(0)} ${y.toFixed(0)}) scale(${s.toFixed(3)})">` +
      `<path d="M-6 30 L-8 52 M6 30 L8 52" stroke="${pick(PANTS)}" stroke-width="7" stroke-linecap="round"/>` +
      `<path d="M-11 10 L-18 30 M11 10 L18 30" stroke="${skin}" stroke-width="5" stroke-linecap="round"/>` +
      `<rect x="-11" y="4" width="22" height="30" rx="6" fill="${shirt}" stroke="${INK}" stroke-width="1.5"/>` +
      `<circle cx="0" cy="-6" r="10" fill="${skin}" stroke="${INK}" stroke-width="1.5"/>${head}</g>`;
  }
  function car(x, y) {
    const c = pick(CARS), flip = Math.random() < 0.5;
    const body = `<rect x="0" y="40" width="170" height="60" rx="14" fill="${c}"/><path d="M20 40 L40 0 L120 0 L150 40Z" fill="${c}"/>` +
      `<rect x="130" y="-15" width="60" height="40" fill="#f7d36a"/><circle cx="35" cy="102" r="16" fill="#333"/><circle cx="135" cy="102" r="16" fill="#333"/>`;
    const t = flip ? `translate(${x + 170} ${y}) scale(-1 1)` : `translate(${x} ${y})`;
    return `<g stroke="${INK}" stroke-width="3" transform="${t}">${body}</g>`;
  }
  const pumpkin = (x, y) => `<g><ellipse cx="${x}" cy="${y}" rx="16" ry="13" fill="#e07b2a" stroke="${INK}" stroke-width="2"/><rect x="${x - 2}" y="${y - 18}" width="4" height="7" fill="#4f7d5a"/></g>`;
  const balloon = (x, y) => `<g><path d="M${x} ${y + 20} Q${x + 6} ${y + 40} ${x} ${y + 62}" stroke="#555" stroke-width="1.5" fill="none"/><ellipse cx="${x}" cy="${y}" rx="13" ry="17" fill="${pick(BALLOONS)}" stroke="${INK}" stroke-width="2"/></g>`;

  function makeScene() {
    // The star person goes anywhere in the crowd area, edge to edge
    const tx = rnd(40, W - 40), ty = rnd(250, H - 70);
    const items = []; // [baseY, svg] drawn back to front

    const cars = [];
    for (let i = 0; i < 5; i++) {
      for (let tries = 0; tries < 30; tries++) {
        const cx = rnd(20, W - 210), cy = rnd(330, 860);
        const clear = cars.every((c) => Math.abs(c[0] - cx) > 220 || Math.abs(c[1] - cy) > 130);
        const offTarget = !(tx > cx - 30 && tx < cx + 220 && ty > cy - 60 && ty < cy + 140);
        if (clear && offTarget) { cars.push([cx, cy]); items.push([cy + 100, car(cx, cy)]); break; }
      }
    }
    for (let i = 0; i < 18; i++) { const y = rnd(260, 980); items.push([y, pumpkin(rnd(20, W - 20).toFixed(0), y.toFixed(0))]); }
    for (let i = 0; i < 14; i++) { const y = rnd(200, 880); items.push([y + 62, balloon(rnd(20, W - 20).toFixed(0), y.toFixed(0))]); }

    const nearTarget = (x, y) => Math.abs(x - tx) < 34 && y > ty - 40 && y < ty + 75;
    let decoys = 10;
    for (let i = 0; i < 230; i++) {
      const x = rnd(15, W - 15), y = rnd(235, 967);
      if (nearTarget(x, y)) continue; // nobody stands right on top of the target
      items.push([y + 52, person(x, y, { decoy: decoys-- > 0 })]);
    }
    items.sort((a, b) => a[0] - b[0]);

    const tents = TENTS.slice().sort(() => Math.random() - 0.5).map((c, i) => {
      const x = 55 + i * 260 + rnd(-20, 20);
      return `<g><path d="M${x} 250 L${x + 90} 110 L${x + 180} 250Z" fill="${c}" stroke="${INK}" stroke-width="3"/><path d="M${x + 70} 250 L${x + 90} 190 L${x + 110} 250Z" fill="#fff8e8"/></g>`;
    }).join("");
    const wave = rnd(-60, 60);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
      `<rect width="${W}" height="${H}" fill="#cfe3c4"/><rect width="${W}" height="170" fill="#bcd9e6"/>` +
      `<path d="M0 ${520 + wave} C400 ${470 - wave} 1200 ${600 + wave} 1600 ${520 - wave} L1600 ${600 - wave} C1200 ${680 + wave} 400 ${550 - wave} 0 ${600 + wave}Z" fill="#e8dcc0"/>` +
      `<path d="M760 170 L840 170 L900 1000 L700 1000Z" fill="#e8dcc0"/>` + tents +
      items.map((it) => it[1]).join("") +
      person(tx, ty, { target: true }) + // drawn last so nothing covers the star
      `</svg>`;

    const s = scaleAt(ty);
    return {
      name: "Random festival",
      src: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg),
      clue: "Find the person with the GOLD STAR hat. (Some hats are gold but have no star!)",
      x: +(tx / W * 100).toFixed(1),
      y: +((ty - 12 * s) / H * 100).toFixed(1),
      r: 3.5,
    };
  }

  window.WaldoScene = { makeScene };
})();
