/**
 * games.js — Where's Waldo booth games for capsunlocked.com/waldo
 * Plain JavaScript, no libraries. Settings live in config.js.
 *
 * Screens: attract ("Tap to play") → menu (10-second pick) → game → result
 * Saved on this device only: play counts per game, Perfect Pairs best time
 * per grade, Waldo's Hand best score. No names are ever asked for.
 */
(function () {
  "use strict";
  const B = window.BOOTH;
  const app = document.getElementById("app");
  const MARK = new URLSearchParams(location.search).has("mark");

  const GAMES = [
    { id: "search", title: "Big Picture Search", icon: "🔍", tag: "LOOK CLOSELY",
      text: "Find Waldo hiding in a busy beach, forest, school, ball field and more.", meta: "Harder each grade", color: "red" },
    { id: "hats", title: "Hat Trick", icon: "🎩", tag: "WATCH & FOLLOW",
      text: "Keep your eyes on the star while the hats shuffle.", meta: B.hatRounds + " rounds", color: "yellow" },
    { id: "pairs", title: "Perfect Pairs", icon: "🃏", tag: "REMEMBER & MATCH",
      text: "Match all 6 pairs before your grade's timer runs out.", meta: "Pick your grade", color: "blue" },
    { id: "hand", title: "Waldo's Hand", icon: "🖐️", tag: "READY, SET, TAP!",
      text: "Tap the hand every time it pops out of a trunk!", meta: B.handSeconds + " seconds", color: "green" },
  ];

  /* ---------- saved data (this device only) ---------- */
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem("waldo." + key); return v ? JSON.parse(v) : fallback; }
      catch (e) { return fallback; }
    },
    set(key, val) { try { localStorage.setItem("waldo." + key, JSON.stringify(val)); } catch (e) {} },
  };
  const tally = () => store.get("tally", { search: 0, hats: 0, pairs: 0, hand: 0 });
  function countPlay(id) { const t = tally(); t[id] = (t[id] || 0) + 1; store.set("tally", t); }
  function mostPopular() {
    const t = tally();
    return GAMES.reduce((best, g) => ((t[g.id] || 0) > (t[best.id] || 0) ? g : best), GAMES[0]);
  }

  /* ---------- timers: every screen change clears them all ---------- */
  let timers = [];
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  const every = (fn, ms) => { const t = setInterval(fn, ms); timers.push(t); return t; };
  function clearTimers() { timers.forEach((t) => { clearTimeout(t); clearInterval(t); }); timers = []; }

  /* ---------- helpers ---------- */
  function shuffle(arr) { // Fisher–Yates
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const $ = (sel) => app.querySelector(sel);
  const secs = (ms) => Math.max(0, Math.ceil(ms / 1000));
  let screen = "attract";
  function show(name, html) {
    clearTimers();
    screen = name;
    app.innerHTML = html;
    const h = app.querySelector("h1, h2");
    if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
    window.scrollTo(0, 0);
    bumpIdle();
  }
  function status(msg) { const s = $("[data-status]"); if (s) s.textContent = msg; }
  /* ---------- leaderboard: one row per finished round ---------- */
  // Rounds wait in a queue on this device, so nothing is lost if the booth Wi-Fi drops.
  let flushing = false;
  async function flushScores() {
    if (!B.leaderboardUrl || flushing) return;
    flushing = true;
    try {
      let q = store.get("queue", []);
      while (q.length) {
        // text/plain + no-cors: the simple kind of request Apps Script accepts from another site
        await fetch(B.leaderboardUrl, { method: "POST", mode: "no-cors",
          headers: { "Content-Type": "text/plain" }, body: JSON.stringify(q[0]) });
        q = store.get("queue", []); q.shift(); store.set("queue", q);
      }
    } catch (e) { /* offline: try again later */ }
    flushing = false;
  }
  function sendScore(game, score) {
    if (!player) return "";
    const q = store.get("queue", []);
    q.push({ game, score, teacher: player.team, grade: player.grade, device: "booth", at: Date.now() });
    store.set("queue", q);
    flushScores();
    return `<p class="w-sent">★ Added to the leaderboard for <b>${teamName(player)}</b></p>`;
  }
  window.addEventListener("online", flushScores);
  setInterval(flushScores, 30000);

  function endButtons(id, note = "") {
    return `${note}<div class="w-endbar">
      <button class="w-primary" data-replay="${id}">Play again ↻</button>
      <button class="w-secondary" data-action="menu">Next player →</button></div>`;
  }

  /* ---------- idle: back to "Tap to play" ---------- */
  let idleTimer = null;
  function bumpIdle() {
    clearTimeout(idleTimer);
    if (screen === "attract" || screen === "settings") return;
    const limit = B.idleSeconds * 1000 * (screen === "search" ? 3 : 1); // searching takes a while
    idleTimer = setTimeout(attract, limit);
  }
  ["pointerdown", "keydown"].forEach((ev) => document.addEventListener(ev, bumpIdle, true));

  /* ================= ATTRACT ================= */
  function attract() {
    show("attract", `
      <section class="w-attract">
        <p class="w-label">LITTLE EXPLORERS. BIG DISCOVERIES.</p>
        <h1>Where's <span>Waldo?</span></h1>
        <p class="w-intro">Four quick games. Can you find him?</p>
        <button class="w-giant" data-action="menu">Tap to play ▶</button>
        <p class="w-small">Most played today: <b>${mostPopular().title}</b></p>
      </section>`);
  }

  /* ================= MENU (Camilo's 10-second pick) ================= */
  function menu() {
    player = null; // new kid at the screen: they pick their class again
    const fav = mostPopular();
    show("menu", `
      <section class="w-menu">
        <div class="w-menu-head">
          <h2>Pick your game!</h2>
          <div class="w-count" aria-hidden="true"><span data-count>${B.pickSeconds}</span></div>
        </div>
        <p class="w-forclass">🏆 Play for your class! You'll pick your grade and teacher next.</p>
        <p class="w-small" data-autonote>If you don't pick, <b>${fav.title}</b> (most played) starts in ${B.pickSeconds} seconds.</p>
        <div class="w-games">
          ${GAMES.map((g, i) => `
            <button class="w-card ${g.color}" data-play="${g.id}">
              <span class="w-card-num">0${i + 1}</span>
              ${g.id === fav.id ? '<span class="w-badge">★ Most played</span>' : ""}
              <span class="w-card-icon" aria-hidden="true">${g.icon}</span>
              <span class="w-label">${g.tag}</span>
              <span class="w-card-title">${g.title}</span>
              <span class="w-card-text">${g.text}</span>
              <span class="w-card-meta">${g.meta} · <b>Play →</b></span>
            </button>`).join("")}
        </div>
      </section>`);
    const end = Date.now() + B.pickSeconds * 1000;
    every(() => {
      const left = secs(end - Date.now());
      const c = $("[data-count]"); if (c) c.textContent = left;
      if (left <= 0) play(mostPopular().id);
    }, 200);
  }

  /* ================= CLASS PICKER: grade, then teacher ================= */
  let player = null; // { grade, team } for the kid at the screen, or null if skipped
  const teamName = (p) => `Team ${p.team} (${p.grade})`;
  const gameTitle = (id) => GAMES.find((g) => g.id === id).title;

  function play(id) { // chosen from the menu: pick the class first
    countPlay(id);
    pickGrade(id);
  }
  function replay(id) { // "Play again": same kid, same class
    countPlay(id);
    start(id);
  }
  function start(id) {
    if (id === "pairs" && player) pairsBoard(B.grades.find((g) => g.id === player.grade));
    else ({ search: gameSearch, hats: gameHats, pairs: gamePairs, hand: gameHand })[id]();
    if (player) {
      const sec = app.querySelector("section");
      if (sec) sec.insertAdjacentHTML("afterbegin", `<p class="w-team">Playing for <b>${teamName(player)}</b></p>`);
    }
  }
  function pickGrade(id) {
    player = null;
    show("pick", `
      <section class="w-play">
        <p class="w-label">${gameTitle(id).toUpperCase()}</p>
        <h1>What grade are you in?</h1>
        <p class="w-clue">Play for your class!</p>
        <div class="w-grades">
          ${B.grades.map((g) => `<button class="w-grade" data-pickgrade="${g.id}"><b>${g.label}</b></button>`).join("")}
        </div>
        <div class="w-endbar"><button class="w-secondary" data-skip>Just play (no class)</button></div>
      </section>`);
    app.querySelectorAll("[data-pickgrade]").forEach((b) => b.addEventListener("click", () => pickTeacher(id, b.dataset.pickgrade)));
    $("[data-skip]").addEventListener("click", () => start(id));
  }
  function pickTeacher(id, gradeId) {
    const grade = B.grades.find((g) => g.id === gradeId);
    const rooms = B.classrooms.filter((c) => c.grade === gradeId);
    show("pick", `
      <section class="w-play">
        <p class="w-label">${gameTitle(id).toUpperCase()} · ${grade.label.toUpperCase()}</p>
        <h1>Who is your teacher?</h1>
        <div class="w-teachers">
          ${rooms.map((c, i) => `<button class="w-grade" data-pickteacher="${i}"><b>${c.team}</b></button>`).join("")}
        </div>
        <div class="w-endbar">
          <button class="w-secondary" data-back>← Change grade</button>
          <button class="w-secondary" data-skip>Just play (no class)</button>
        </div>
      </section>`);
    app.querySelectorAll("[data-pickteacher]").forEach((b) => b.addEventListener("click", () => {
      player = rooms[+b.dataset.pickteacher];
      start(id);
    }));
    $("[data-back]").addEventListener("click", () => pickGrade(id));
    $("[data-skip]").addEventListener("click", () => start(id));
  }

  /* ================= 1. BIG PICTURE SEARCH ================= */
  // Real (approved) pictures are dealt like cards: every one shows before repeats.
  // Until there are real pictures, a brand-new crowd is drawn each round (scene-maker.js)
  // with the gold-star person somewhere random.
  let sceneBag = [], lastScene = -1;
  const realScenes = () => B.SCENES.filter((s) => !s.placeholder);
  function nextScene(list) {
    if (!sceneBag.length || sceneBag.some((i) => i >= list.length)) {
      sceneBag = shuffle(list.map((_, i) => i));
      if (sceneBag.length > 1 && sceneBag[sceneBag.length - 1] === lastScene) sceneBag.unshift(sceneBag.pop());
    }
    return (lastScene = sceneBag.pop());
  }
  function pickScene() {
    const real = realScenes();
    if (real.length) {
      const sc = Object.assign({}, real[nextScene(real)]);
      // Mirror the picture half the time, so Waldo isn't always on the same side
      if (B.mirrorScenes !== false && Math.random() < 0.5) { sc.flip = true; sc.x = 100 - sc.x; }
      return sc;
    }
    if (window.WaldoScene) {
      // Harder by grade (config.js searchLevels); a new setting each round, no repeats until all are seen
      const g = (player && player.grade) || B.searchDefaultGrade || "2";
      return Object.assign(window.WaldoScene.makeScene((B.searchLevels || {})[g], nextTheme()), { grade: g });
    }
    return B.SCENES[nextScene(B.SCENES)];
  }
  let themeBag = [], lastTheme = "";
  function nextTheme() {
    const all = (B.searchThemes || []).filter((t) => window.WaldoScene.themes.includes(t));
    if (!all.length) return undefined;
    if (!themeBag.length) {
      themeBag = shuffle(all);
      if (themeBag.length > 1 && themeBag[themeBag.length - 1] === lastTheme) themeBag.unshift(themeBag.pop());
    }
    return (lastTheme = themeBag.pop());
  }
  function gameSearch() {
    const markIdx = parseInt(new URLSearchParams(location.search).get("mark"), 10);
    const sc = MARK && markIdx >= 1 && markIdx <= B.SCENES.length ? B.SCENES[markIdx - 1] : pickScene();
    const gradeLabel = sc.grade ? " · " + B.grades.find((x) => x.id === sc.grade).label.toUpperCase() : "";
    show("search", `
      <section class="w-play">
        <p class="w-label">GAME 01 · BIG PICTURE SEARCH${gradeLabel}${sc.theme ? " · " + sc.name.toUpperCase() : ""}</p>
        <h1>${MARK ? "Marking mode" : "Find Waldo!"}</h1>
        <p class="w-clue">${MARK ? "Tap Waldo to get his x and y numbers for config.js." : sc.clue}</p>
        <div class="w-controls">
          <button class="w-secondary" data-hint>Need a hint?</button>
          <span class="w-score" data-clock>0s</span>
        </div>
        <div class="w-scene" data-scene>
          <img src="${sc.src}" alt="A busy, detailed picture with lots of people. ${sc.clue}" draggable="false"${sc.flip ? ' style="transform:scaleX(-1)"' : ""} />
          <div class="w-hintbox" data-hintbox hidden></div>
        </div>
        <p class="w-feedback" role="status" data-status>Look carefully. Tap him when you spot him!</p>
        <div data-end></div>
      </section>`);
    const start = Date.now();
    let found = false;
    every(() => { if (!found) $("[data-clock]").textContent = Math.floor((Date.now() - start) / 1000) + "s"; }, 500);

    const scene = $("[data-scene]");
    const img = scene.querySelector("img");
    function mark(px, py, cls, label) {
      const m = document.createElement("span");
      m.className = "w-mark " + cls;
      m.style.left = px + "%"; m.style.top = py + "%";
      m.textContent = label;
      scene.appendChild(m);
      return m;
    }
    img.addEventListener("click", (e) => {
      if (found && !MARK) return;
      const r = img.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * 100;
      const py = ((e.clientY - r.top) / r.height) * 100;
      if (MARK) { status(`x: ${px.toFixed(1)}, y: ${py.toFixed(1)}`); mark(px, py, "miss", "+"); return; }
      const dx = px - sc.x;
      const dy = (py - sc.y) * (r.height / r.width); // compare in the same units
      if (Math.hypot(dx, dy) <= sc.r) {
        found = true;
        const t = Math.round((Date.now() - start) / 1000);
        mark(sc.x, sc.y, "hit", "");
        $("[data-hintbox]").hidden = true;
        status(`You found him in ${t} seconds! Amazing spotting! ★`);
        $("[data-end]").innerHTML = endButtons("search", sendScore("search", Math.round((Date.now() - start) / 100) / 10));
      } else {
        const m = mark(px, py, "miss", "✕");
        later(() => m.remove(), 900);
        status("Not there. Keep looking!");
      }
    });
    $("[data-hint]").addEventListener("click", () => {
      if (found) return;
      const box = $("[data-hintbox]");
      const left = sc.x < 50, top = sc.y < 50;
      Object.assign(box.style, { left: left ? "0" : "50%", top: top ? "0" : "50%" });
      box.hidden = false;
      status(`Hint: look in the ${top ? "top" : "bottom"} ${left ? "left" : "right"} part of the picture.`);
    });
  }

  /* ================= 2. HAT TRICK ================= */
  const HAT_SVG = `<svg viewBox="0 0 120 110" aria-hidden="true"><rect x="28" y="8" width="64" height="72" rx="6" fill="#26313a" stroke="#193b51" stroke-width="4"/><rect x="28" y="56" width="64" height="14" fill="#cf3436"/><ellipse cx="60" cy="86" rx="56" ry="14" fill="#26313a" stroke="#193b51" stroke-width="4"/></svg>`;
  const STAR_SVG = `<svg viewBox="0 0 50 50" aria-hidden="true"><path d="M25 3l6.5 14 15 1.6-11.3 10.2 3.3 14.9L25 36l-13.5 7.7 3.3-14.9L3.5 18.6l15-1.6z" fill="#f2c230" stroke="#193b51" stroke-width="3"/></svg>`;
  function gameHats() {
    let round = 1, stars = 0;
    show("hats", `
      <section class="w-play">
        <p class="w-label">GAME 02 · HAT TRICK</p>
        <h1>Hat Trick</h1>
        <p class="w-clue">Watch which hat the star goes under. Follow it while the hats shuffle!</p>
        <div class="w-score" data-score></div>
        <div class="w-hats" data-hats>
          ${[0, 1, 2].map((id) => `<button class="w-hatbtn" data-hat="${id}" disabled aria-label="Hat">
            <span class="w-star">${STAR_SVG}</span><span class="w-hat">${HAT_SVG}</span></button>`).join("")}
        </div>
        <p class="w-feedback" role="status" data-status>Ready?</p>
        <div data-end><button class="w-primary" data-start>Start →</button></div>
      </section>`);
    const btns = [...app.querySelectorAll("[data-hat]")];
    let order = [0, 1, 2]; // order[position] = hat id
    let starHat = 0;
    const place = () => btns.forEach((b) => {
      const pos = order.indexOf(+b.dataset.hat);
      b.style.left = pos * 33.333 + "%";
      b.setAttribute("aria-label", "Hat " + (pos + 1));
    });
    const lift = (on, onlyStar) => btns.forEach((b) => b.classList.toggle("up", on && (!onlyStar || +b.dataset.hat === starHat)));
    const score = () => { $("[data-score]").innerHTML = `Round ${round} / ${B.hatRounds} <span>•</span> ${stars} ★ found`; };
    function startRound() {
      $("[data-end]").innerHTML = "";
      order = shuffle([0, 1, 2]);
      starHat = Math.floor(Math.random() * 3);
      btns.forEach((b) => { b.disabled = true; b.classList.toggle("has-star", +b.dataset.hat === starHat); b.classList.remove("picked"); });
      place(); score(); lift(true, true);
      status(`The star is under hat ${order.indexOf(starHat) + 1}. Watch it!`);
      later(() => {
        lift(false);
        status("Follow that hat…");
        for (let k = 0; k < B.hatSwaps; k++) {
          later(() => {
            const a = Math.floor(Math.random() * 3);
            const b = (a + 1 + Math.floor(Math.random() * 2)) % 3;
            [order[a], order[b]] = [order[b], order[a]];
            place();
          }, 500 + k * B.hatSwapMs);
        }
        later(() => { btns.forEach((b) => (b.disabled = false)); status("Where is the star? Tap a hat!"); },
          500 + B.hatSwaps * B.hatSwapMs + 300);
      }, 1800);
    }
    btns.forEach((b) => b.addEventListener("click", () => {
      btns.forEach((x) => (x.disabled = true));
      b.classList.add("picked");
      const win = +b.dataset.hat === starHat;
      if (win) stars++;
      lift(true, true); b.classList.add("up"); score();
      status(win ? "You found the star! ★" : "Not that one. The star was here!");
      if (round < B.hatRounds) {
        $("[data-end]").innerHTML = `<button class="w-primary" data-next>Next round →</button>`;
        $("[data-next]").addEventListener("click", () => { round++; startRound(); });
      } else {
        status(`All done! You found ${stars} of ${B.hatRounds} stars. ${win ? "★" : ""}`);
        $("[data-end]").innerHTML = endButtons("hats", sendScore("hats", stars));
      }
    }));
    place(); score();
    $("[data-start]").addEventListener("click", startRound);
  }

  /* ================= 3. PERFECT PAIRS (grade timers) ================= */
  const CARDS = [
    { s: "🎈", n: "balloon" }, { s: "🎃", n: "pumpkin" }, { s: "🍿", n: "popcorn" },
    { s: "🍭", n: "lollipop" }, { s: "🎩", n: "top hat" }, { s: "⭐", n: "star" },
  ];
  const fmt = (ms) => (ms / 1000).toFixed(1) + " s";
  function gamePairs() {
    const best = store.get("best", {});
    show("pairs", `
      <section class="w-play">
        <p class="w-label">GAME 03 · PERFECT PAIRS</p>
        <h1>What grade are you in?</h1>
        <p class="w-clue">Each grade gets its own timer. Can you beat your grade's best time?</p>
        <div class="w-grades">
          ${B.grades.map((g) => `<button class="w-grade" data-grade="${g.id}">
            <b>${g.label}</b><span>${g.seconds} seconds</span>
            <small>Best: ${best[g.id] ? fmt(best[g.id]) : "nobody yet!"}</small></button>`).join("")}
        </div>
      </section>`);
    app.querySelectorAll("[data-grade]").forEach((b) => b.addEventListener("click", () => pairsBoard(B.grades.find((g) => g.id === b.dataset.grade))));
  }
  function pairsBoard(grade) {
    const deck = shuffle(CARDS.concat(CARDS));
    const best = store.get("best", {});
    show("pairs", `
      <section class="w-play">
        <p class="w-label">GAME 03 · PERFECT PAIRS · ${grade.label.toUpperCase()}</p>
        <h1>Perfect Pairs</h1>
        <div class="w-score"><span data-pairs>0 / 6 pairs</span> <span>•</span> <b data-left>${grade.seconds}s</b> left</div>
        <div class="w-timebar"><div data-bar></div></div>
        <p class="w-small">${grade.label} best: <b>${best[grade.id] ? fmt(best[grade.id]) : "nobody yet!"}</b></p>
        <div class="w-memory">
          ${deck.map((c, i) => `<button class="w-mcard" data-card="${i}" aria-label="Card ${i + 1}, face down"><span>?</span></button>`).join("")}
        </div>
        <p class="w-feedback" role="status" data-status>Flip two cards to find a match. Go!</p>
        <div data-end></div>
      </section>`);
    const btns = [...app.querySelectorAll("[data-card]")];
    let open = [], matched = 0, done = false;
    const start = Date.now(), limit = grade.seconds * 1000;
    every(() => {
      if (done) return;
      const left = limit - (Date.now() - start);
      $("[data-left]").textContent = secs(left) + "s";
      $("[data-bar]").style.width = Math.max(0, (left / limit) * 100) + "%";
      if (left <= 0) finish(false);
    }, 100);
    function face(i, up) {
      const b = btns[i];
      b.classList.toggle("up", up);
      b.firstElementChild.textContent = up ? deck[i].s : "?";
      b.setAttribute("aria-label", up ? deck[i].n : `Card ${i + 1}, face down`);
    }
    function finish(win) {
      done = true;
      btns.forEach((b) => (b.disabled = true));
      let note = "";
      if (win) {
        const t = Date.now() - start;
        note = sendScore("pairs", Math.round(t / 100) / 10);
        const all = store.get("best", {});
        const record = !all[grade.id] || t < all[grade.id];
        if (record) { all[grade.id] = t; store.set("best", all); }
        status(`All 6 pairs in ${fmt(t)}! ${record ? `New ${grade.label} record! 🏆` : `${grade.label} best is ${fmt(all[grade.id])}.`}`);
      } else {
        status(`Time's up! You found ${matched} of 6 pairs. Try again!`);
      }
      $("[data-end]").innerHTML = endButtons("pairs", note);
    }
    btns.forEach((b, i) => b.addEventListener("click", () => {
      if (done || open.length === 2 || open.includes(i) || b.classList.contains("matched")) return;
      face(i, true); open.push(i);
      if (open.length < 2) return;
      const [a, c] = open;
      if (deck[a].n === deck[c].n) {
        btns[a].classList.add("matched"); btns[c].classList.add("matched");
        btns[a].setAttribute("aria-label", deck[a].n + ", matched"); btns[c].setAttribute("aria-label", deck[c].n + ", matched");
        open = []; matched++;
        $("[data-pairs]").textContent = `${matched} / 6 pairs`;
        status(`Match: ${deck[a].n}! ✓`);
        if (matched === 6) finish(true);
      } else {
        later(() => { if (!done) { face(a, false); face(c, false); } open = []; }, 750);
      }
    }));
  }

  /* ================= 4. WALDO'S HAND (Camilo's game) ================= */
  function gameHand() {
    const record = store.get("handBest", 0);
    show("hand", `
      <section class="w-play">
        <p class="w-label">GAME 04 · WALDO'S HAND</p>
        <h1>Waldo's Hand</h1>
        <p class="w-clue">A hand pops out of a trunk. Tap it before it hides! You have ${B.handSeconds} seconds.</p>
        <div class="w-score"><b data-left>${B.handSeconds}s</b> left <span>•</span> <span data-caught>0</span> caught</div>
        <p class="w-small">Booth record: <b>${record || "nobody yet!"}</b></p>
        <div class="w-trunks">
          ${Array.from({ length: 9 }, (_, i) => `<button class="w-trunk" data-trunk="${i}" disabled aria-label="Trunk ${i + 1}"><span class="w-trunk-lid"></span></button>`).join("")}
        </div>
        <p class="w-feedback" role="status" data-status>Get your tapping finger ready!</p>
        <div data-end><button class="w-primary" data-start>Start ${B.handSeconds}-second round →</button></div>
      </section>`);
    const trunks = [...app.querySelectorAll("[data-trunk]")];
    const handHTML = B.handImage
      ? `<img class="w-handimg" src="${B.handImage}" alt="" draggable="false" />`
      : `<span class="w-handemoji" aria-hidden="true">🖐️</span>`;
    let at = -1, caught = 0, running = false, moveTimer = null, end = 0;
    function pop() {
      clearTimeout(moveTimer);
      if (at >= 0) { trunks[at].classList.remove("out"); trunks[at].innerHTML = '<span class="w-trunk-lid"></span>'; trunks[at].setAttribute("aria-label", "Trunk " + (at + 1)); }
      let next; do { next = Math.floor(Math.random() * 9); } while (next === at);
      at = next;
      trunks[at].classList.add("out");
      trunks[at].innerHTML = handHTML;
      trunks[at].setAttribute("aria-label", "Tap the hand!");
      moveTimer = later(pop, B.handStaysOutMs);
    }
    trunks.forEach((t, i) => t.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (!running || i !== at) return;
      caught++;
      $("[data-caught]").textContent = caught;
      pop();
    }));
    function stop() {
      running = false;
      clearTimeout(moveTimer);
      trunks.forEach((t) => { t.disabled = true; t.classList.remove("out"); t.innerHTML = '<span class="w-trunk-lid"></span>'; });
      const prev = store.get("handBest", 0);
      if (caught > prev) store.set("handBest", caught);
      status(`Time's up! You caught ${caught} hands! ${caught > prev ? "New booth record! 🏆" : ""}`);
      $("[data-end]").innerHTML = endButtons("hand", sendScore("hand", caught));
    }
    $("[data-start]").addEventListener("click", () => {
      $("[data-end]").innerHTML = "";
      trunks.forEach((t) => (t.disabled = false));
      running = true; end = Date.now() + B.handSeconds * 1000;
      status("Go, go, go!");
      pop();
      every(() => {
        const left = end - Date.now();
        $("[data-left]").textContent = secs(left) + "s";
        if (left <= 0 && running) stop();
      }, 100);
    });
  }

  /* ================= BOOTH SETTINGS ================= */
  function settings() {
    const t = tally(), best = store.get("best", {});
    show("settings", `
      <section class="w-play w-settings">
        <p class="w-label">FOR GROWN-UPS</p>
        <h1>Booth settings</h1>
        <h3>Times each game was played</h3>
        <ul>${GAMES.map((g) => `<li>${g.title}: <b>${t[g.id] || 0}</b></li>`).join("")}</ul>
        <h3>Perfect Pairs best times</h3>
        <ul>${B.grades.map((g) => `<li>${g.label}: <b>${best[g.id] ? fmt(best[g.id]) : "—"}</b></li>`).join("")}</ul>
        <h3>Waldo's Hand booth record</h3>
        <ul><li><b>${store.get("handBest", 0) || "—"}</b></li></ul>
        <h3>Leaderboard</h3>
        <ul><li>${B.leaderboardUrl ? "Connected" : "Not connected yet (add leaderboardUrl in config.js)"} · rounds waiting to send: <b>${store.get("queue", []).length}</b></li></ul>
        <div class="w-endbar">
          <button class="w-secondary" data-reset="tally">Reset play counts</button>
          <button class="w-secondary" data-reset="scores">Reset best times &amp; records</button>
          <button class="w-primary" data-action="home">Back to the booth</button>
        </div>
        <p class="w-small">Saved on this device only. Change timers and pictures in /waldo/config.js.</p>
      </section>`);
    app.querySelectorAll("[data-reset]").forEach((b) => b.addEventListener("click", () => {
      if (!confirm("Reset these numbers? This can't be undone.")) return;
      if (b.dataset.reset === "tally") store.set("tally", { search: 0, hats: 0, pairs: 0, hand: 0 });
      else { store.set("best", {}); store.set("handBest", 0); }
      settings();
    }));
  }

  /* ---------- shared clicks ---------- */
  document.addEventListener("click", (e) => {
    const p = e.target.closest("[data-play]");
    if (p) { play(p.dataset.play); return; }
    const r = e.target.closest("[data-replay]");
    if (r) { replay(r.dataset.replay); return; }
    const a = e.target.closest("[data-action]");
    if (!a) return;
    const act = a.dataset.action;
    if (act === "menu") menu();
    else if (act === "home") attract();
    else if (act === "settings") settings();
  });

  // Deep link from the homepage: /waldo?play=search|hats|pairs|hand
  const START = new URLSearchParams(location.search).get("play");
  if (MARK) gameSearch();
  else if (GAMES.some((g) => g.id === START)) play(START);
  else attract();
})();
