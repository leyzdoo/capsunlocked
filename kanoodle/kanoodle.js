/* Kanoodle Genius challenges — renders cards from challenges.js (window.KANOODLE). */
(function () {
  "use strict";
  const K = window.KANOODLE;
  const P = K.pieces;
  const LIGHT_TEXT = ["C", "E", "F", "G"]; // white letters on dark balls
  const BONUS = [
    "Time yourself, then try to beat your time.",
    "Race a grown-up. Who finishes first?",
    "Solve it without pressing Hint.",
    "Build it together: take turns placing one noodle each.",
    "Before you start, guess which noodle fits the tightest spot.",
    "Try it one-handed!",
    "When you finish, explain why the last noodle had to go there.",
    "Set it up for someone else and time them.",
  ];
  const LEVEL_CLASS = { "Super Pro": "lvl1", "Champ": "lvl2", "Whiz": "lvl3", "Expert": "lvl3",
    "Genius Quiz": "lvl4", "Genius": "lvl4", "Kanoodle Genius": "lvl5" };
  const $ = (s, r = document) => r.querySelector(s);
  const store = {
    get(k, d) { try { const v = localStorage.getItem("kanoodle." + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("kanoodle." + k, JSON.stringify(v)); } catch (e) {} },
  };
  let solved = store.get("genius-solved", { twoD: [], threeD: [] });
  let tab = store.get("tab", "twoD");
  if (!K[tab]) tab = "twoD";
  const shown = { twoD: {}, threeD: {} };

  /* ---------- drawing ---------- */
  const R = 13, S = 30, H = S * 0.866;
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    return "#" + [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v * (1 + f)).toString(16).padStart(2, "0")).join("");
  }
  function ball(cx, cy, pc, mark, r = R) {
    const col = P[pc].color;
    return `<g><circle cx="${cx}" cy="${cy}" r="${r}" fill="${col}" stroke="${shade(col, -0.45)}" stroke-width="1.5"/>` +
      (mark ? `<circle cx="${cx}" cy="${cy}" r="${r + 3}" fill="none" stroke="#193b51" stroke-width="2.4" stroke-dasharray="4 3"/>` : "") +
      `<text x="${cx}" y="${cy + r * 0.36}" text-anchor="middle" font-size="${r * 1.05}" font-weight="900" fill="${LIGHT_TEXT.includes(pc) ? "#fff" : "#16222b"}">${pc}</text></g>`;
  }
  const hole = (cx, cy, r = R) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#d9dcdf" stroke="#b3b8bd" stroke-width="1.5"/>`;

  function cellMap(ch, nShown) {
    const m = new Map();
    for (const [pc, cells] of Object.entries(ch.given)) cells.forEach((c) => m.set(c.join(","), { pc }));
    ch.use.slice(0, nShown).forEach((pc) => ch.answer[pc].forEach((c) => m.set(c.join(","), { pc, mark: true })));
    return m;
  }

  // 2D hexagon board: cells in doubled coords [x, y]
  function board2D(m, label) {
    const px = (x) => 12 + x * S / 2, py = (y) => 24 + y * H;
    const pts = [[3, 0], [9, 0], [11, 2], [11, 4], [9, 6], [3, 6], [1, 4], [1, 2]];
    const poly = pts.map(([x, y]) => `${px(x)},${py(y)}`).join(" ");
    let s = `<svg viewBox="0 0 ${px(12) + 12} ${py(6) + 24}" class="k-svg k-board" role="img" aria-label="${label}">` +
      `<polygon points="${poly}" fill="#16191c" stroke="#16191c" stroke-width="44" stroke-linejoin="round"/>`;
    for (const [x, y] of K.board) {
      const v = m.get(x + "," + y);
      s += v ? ball(px(x), py(y), v.pc, v.mark) : hole(px(x), py(y));
    }
    return s + "</svg>";
  }

  // 3D pyramid: cells [a, b, c, d]; level d (0 = bottom, 15 balls). Drawn top-down like the guide.
  function pyramid3D(m) {
    let s = '<div class="k-pyr">';
    for (let d = 4; d >= 0; d--) {
      const n = 5 - d; // rows in this level
      const r = 11, step = 26, h = step * 0.866;
      const W = n * step + 12, Ht = (n - 1) * h + r * 2 + 12;
      let g = `<svg viewBox="0 0 ${W} ${Ht}" style="width:${W}px" class="k-svg">`;
      for (let row = 0; row < n; row++) for (let pos = 0; pos <= row; pos++) {
        const a = n - 1 - row, c = pos, b = row - pos;
        const cx = W / 2 + (pos - row / 2) * step, cy = r + 6 + row * h;
        const v = m.get(`${a},${b},${c},${d}`);
        g += v ? ball(cx, cy, v.pc, v.mark, r) : hole(cx, cy, r);
      }
      g += "</svg>";
      s += `<figure class="k-level"><figcaption>${d === 4 ? "Top" : d === 0 ? "Bottom" : ""}<small>Level ${5 - d}</small></figcaption>${g}</figure>`;
    }
    return s + "</div>";
  }

  function noodleIcon(pc, r = 9) {
    const cells = P[pc].cells, step = r * 2.1, h = step * 0.866;
    const mx = Math.min(...cells.map((c) => c[0])), my = Math.min(...cells.map((c) => c[1]));
    const W = (Math.max(...cells.map((c) => c[0])) - mx) * step / 2 + r * 2 + 4;
    const Ht = (Math.max(...cells.map((c) => c[1])) - my) * h + r * 2 + 4;
    let s = `<svg viewBox="0 0 ${W} ${Ht}" width="${W}" height="${Ht}" aria-hidden="true">`;
    cells.forEach(([x, y]) => { s += ball(r + 2 + (x - mx) * step / 2, r + 2 + (y - my) * h, pc, false, r); });
    return s + "</svg>";
  }

  /* ---------- cards ---------- */
  function task(kind, ch) {
    const g = Object.keys(ch.given).length, u = ch.use.length;
    return kind === "twoD"
      ? `Put ${g > 1 ? `these ${g} noodles` : "this noodle"} on the board exactly as shown. Then fill every empty hole with the other ${u}.`
      : `Build each level as shown, starting at the bottom. Then place ${u > 1 ? `the last ${u} noodles` : "the last noodle"} to finish the pyramid.`;
  }
  function card(kind, ch, i) {
    const n = shown[kind][i] || 0, done = solved[kind].includes(i), all = n >= ch.use.length;
    const m = cellMap(ch, n);
    return `<article class="k-card ${done ? "is-done" : ""}" data-kind="${kind}" data-i="${i}">
      <div class="k-card-top"><span class="k-num">${kind === "twoD" ? "2D" : "3D"} · ${String(i + 1).padStart(2, "0")}</span><span class="k-lvl ${LEVEL_CLASS[ch.level]}">${ch.level}</span></div>
      <p class="k-task">${task(kind, ch)}</p>
      <div class="k-pic">${kind === "twoD" ? board2D(m, "Kanoodle Genius board") : pyramid3D(m)}</div>
      <div class="k-use"><b>Your noodles to place:</b>
        <ul>${ch.use.map((pc) => `<li>${noodleIcon(pc, 8)}<span>${pc} · ${P[pc].name}</span></li>`).join("")}</ul></div>
      <p class="k-bonus"><b>Bonus:</b> ${BONUS[(i * 3 + (kind === "threeD" ? 1 : 0)) % BONUS.length]}</p>
      <p class="k-status" role="status">${all ? "Answer shown. Dashed rings mark the noodles you place." : n ? `Hint: ${n} of ${ch.use.length} noodles shown with dashed rings.` : ""}</p>
      <div class="k-actions">
        <button data-act="hint" ${all ? "disabled" : ""}>Hint</button>
        <button data-act="answer">${all ? "Hide answer" : "Answer"}</button>
        <button data-act="solved" class="k-solved" aria-pressed="${done}">${done ? "✓ Solved!" : "Solved"}</button>
      </div>
    </article>`;
  }
  function progress() {
    ["twoD", "threeD"].forEach((k) => { $(`[data-progress="${k}"]`).textContent = `${solved[k].length}/${K[k].length} solved`; });
  }
  function render() {
    $("[data-grid]").innerHTML = K[tab].map((ch, i) => card(tab, ch, i)).join("");
    $("[data-grid]").className = "k-grid k-grid-" + tab;
    document.querySelectorAll("[data-tab]").forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === tab));
    progress();
  }
  function rerenderCard(kind, i) {
    const old = $(`.k-card[data-kind="${kind}"][data-i="${i}"]`);
    const tmp = document.createElement("div"); tmp.innerHTML = card(kind, K[kind][i], i);
    old.replaceWith(tmp.firstElementChild); progress();
  }

  $("[data-key]").innerHTML = Object.keys(P).map((pc) =>
    `<div class="k-piece">${noodleIcon(pc, 11)}<span>${pc} · ${P[pc].name}</span></div>`).join("");
  (function hero() {
    const ch = K.twoD[0], m = new Map();
    for (const part of [ch.given, ch.answer]) for (const [pc, cells] of Object.entries(part)) cells.forEach((c) => m.set(c.join(","), { pc }));
    $("[data-hero]").innerHTML = board2D(m, "A solved Kanoodle Genius board");
  })();

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-tab]");
    if (t) { tab = t.dataset.tab; store.set("tab", tab); render(); return; }
    const a = e.target.closest("[data-act]");
    if (!a) return;
    const c = a.closest(".k-card"), kind = c.dataset.kind, i = +c.dataset.i, ch = K[kind][i];
    const n = shown[kind][i] || 0;
    if (a.dataset.act === "hint") shown[kind][i] = Math.min(ch.use.length, n + 1);
    if (a.dataset.act === "answer") shown[kind][i] = n >= ch.use.length ? 0 : ch.use.length;
    if (a.dataset.act === "solved") {
      const s = new Set(solved[kind]); s.has(i) ? s.delete(i) : s.add(i);
      solved[kind] = [...s]; store.set("genius-solved", solved);
    }
    rerenderCard(kind, i);
    const sel = `.k-card[data-kind="${kind}"][data-i="${i}"]`;
    const btn = $(`${sel} [data-act="${a.dataset.act}"]`);
    (btn && !btn.disabled ? btn : $(`${sel} [data-act="answer"]`)).focus();
  });

  render();
})();
