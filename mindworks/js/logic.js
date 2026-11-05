// Game logic shared with the original Mindworks (tested): helpers, painted scenes, chess engine, maze, patterns, jigsaw matching.
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function rng(seed) { // mulberry32
  var a = seed >>> 0;
  return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function ri(r, a, b) { return a + Math.floor(r() * (b - a + 1)); }
function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }
function shuffle(r, arr) { for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }

/* ===== Painted scenes (used by Picture Puzzles and the Jigsaw) + jigsaw piece shapes ===== */
var Scenes = (function () {
  function lerpC(a, b, t) {
    var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    var r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t), g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t), bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }
  var SKY = {
    day: ['#5fb4ff', '#cdeaff'], sunset: ['#3b2a73', '#ff9a5a'], night: ['#060a24', '#23306b'], dawn: ['#7fa8e8', '#ffd6b0']
  };
  function sky(c, w, h, tod, hor) {
    var s = SKY[tod] || SKY.day, g = c.createLinearGradient(0, 0, 0, h * hor);
    g.addColorStop(0, s[0]); g.addColorStop(1, s[1]); c.fillStyle = g; c.fillRect(0, 0, w, h);
  }
  function stars(c, w, h, r, n) { c.fillStyle = '#fff'; for (var i = 0; i < n; i++) { c.globalAlpha = .4 + r() * .6; c.beginPath(); c.arc(r() * w, r() * h, r() * 1.6 + .3, 0, 7); c.fill(); } c.globalAlpha = 1; }
  function sun(c, x, y, rad, tod) {
    if (tod === 'night') { c.fillStyle = '#fff6d8'; c.beginPath(); c.arc(x, y, rad * .8, 0, 7); c.fill(); c.fillStyle = 'rgba(0,0,0,.08)'; c.beginPath(); c.arc(x - rad * .2, y - rad * .1, rad * .18, 0, 7); c.arc(x + rad * .25, y + rad * .2, rad * .12, 0, 7); c.fill(); return; }
    var g = c.createRadialGradient(x, y, 0, x, y, rad * 2.4);
    g.addColorStop(0, tod === 'sunset' ? 'rgba(255,200,120,.9)' : 'rgba(255,255,220,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(x - rad * 3, y - rad * 3, rad * 6, rad * 6);
    c.fillStyle = tod === 'sunset' ? '#ffcf6b' : '#fff3a6'; c.beginPath(); c.arc(x, y, rad, 0, 7); c.fill();
  }
  function cloud(c, x, y, s, a) { c.fillStyle = 'rgba(255,255,255,' + a + ')'; c.beginPath(); c.arc(x, y, s, 0, 7); c.arc(x + s, y - s * .4, s * 1.2, 0, 7); c.arc(x + s * 2.2, y, s * .9, 0, 7); c.arc(x + s, y + s * .3, s, 0, 7); c.fill(); }
  function hills(c, w, h, r, y0, amp, col, n) {
    c.fillStyle = col; c.beginPath(); c.moveTo(0, h); c.lineTo(0, y0);
    var ph = r() * 6, f = (n || 2) * Math.PI / w;
    for (var x = 0; x <= w; x += w / 60) c.lineTo(x, y0 - Math.sin(x * f + ph) * amp - Math.sin(x * f * 2.3 + ph * 2) * amp * .35);
    c.lineTo(w, h); c.fill();
  }
  function mountains(c, w, h, r, y0, hgt, col, snow) {
    var x = -w * .1; c.fillStyle = col; c.beginPath(); c.moveTo(-10, h);
    var peaks = [];
    while (x < w * 1.1) { var pw = w * (.18 + r() * .2), ph = hgt * (.55 + r() * .45); c.lineTo(x, y0); c.lineTo(x + pw / 2, y0 - ph); peaks.push([x + pw / 2, y0 - ph, pw]); x += pw * (.7 + r() * .2); }
    c.lineTo(w + 10, y0); c.lineTo(w + 10, h); c.fill();
    if (snow) { c.fillStyle = snow; peaks.forEach(function (p) { c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(p[0] - p[2] * .13, p[1] + p[2] * .17); c.lineTo(p[0] - p[2] * .03, p[1] + p[2] * .13); c.lineTo(p[0] + p[2] * .05, p[1] + p[2] * .19); c.lineTo(p[0] + p[2] * .14, p[1] + p[2] * .17); c.fill(); }); }
  }
  function pine(c, x, y, s, col, trunk) {
    c.fillStyle = trunk || '#4a2f1e'; c.fillRect(x - s * .07, y - s * .25, s * .14, s * .25);
    c.fillStyle = col; for (var i = 0; i < 3; i++) { var yy = y - s * .2 - i * s * .28, ww = s * (.42 - i * .1); c.beginPath(); c.moveTo(x, yy - s * .42); c.lineTo(x - ww, yy); c.lineTo(x + ww, yy); c.fill(); }
  }
  function roundTree(c, x, y, s, col, hi) {
    c.fillStyle = '#5a3a22'; c.fillRect(x - s * .06, y - s * .45, s * .12, s * .45);
    c.fillStyle = col; c.beginPath(); c.arc(x, y - s * .62, s * .3, 0, 7); c.arc(x - s * .2, y - s * .5, s * .22, 0, 7); c.arc(x + s * .2, y - s * .5, s * .22, 0, 7); c.fill();
    if (hi) { c.fillStyle = hi; c.beginPath(); c.arc(x - s * .08, y - s * .72, s * .12, 0, 7); c.fill(); }
  }
  function palm(c, x, y, s, lean) {
    c.strokeStyle = '#7a5230'; c.lineWidth = s * .07; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + lean * s * .3, y - s * .5, x + lean * s * .45, y - s); c.stroke();
    var tx = x + lean * s * .45, ty = y - s; c.strokeStyle = '#2f9a4a'; c.lineWidth = s * .06;
    for (var i = 0; i < 6; i++) { var a = -Math.PI + i * Math.PI / 5; c.beginPath(); c.moveTo(tx, ty); c.quadraticCurveTo(tx + Math.cos(a) * s * .3, ty + Math.sin(a) * s * .3 - s * .1, tx + Math.cos(a) * s * .45, ty + Math.sin(a) * s * .2 + s * .12); c.stroke(); }
  }
  function house(c, x, y, w, h, wall, roof, lit) {
    c.fillStyle = wall; c.fillRect(x, y - h, w, h);
    c.fillStyle = roof; c.beginPath(); c.moveTo(x - w * .1, y - h); c.lineTo(x + w / 2, y - h - w * .45); c.lineTo(x + w * 1.1, y - h); c.fill();
    c.fillStyle = lit ? '#ffd76a' : '#9fd3ff'; c.fillRect(x + w * .15, y - h * .7, w * .22, h * .25); c.fillRect(x + w * .63, y - h * .7, w * .22, h * .25);
    c.fillStyle = '#5b3a24'; c.fillRect(x + w * .4, y - h * .45, w * .2, h * .45);
  }
  function water(c, w, h, y0, top, bot, r) {
    var g = c.createLinearGradient(0, y0, 0, h); g.addColorStop(0, top); g.addColorStop(1, bot); c.fillStyle = g; c.fillRect(0, y0, w, h - y0);
    c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 1.5;
    for (var i = 0; i < 40; i++) { var yy = y0 + Math.pow(r(), 1.5) * (h - y0), xx = r() * w, ll = 8 + r() * 30 * (yy - y0) / (h - y0 + 1); c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx + ll, yy); c.stroke(); }
  }
  function flowers(c, w, y0, y1, r, n) { var cols = ['#ff5d8f', '#ffd23f', '#ffffff', '#b07cff', '#ff8a3d']; for (var i = 0; i < n; i++) { var x = r() * w, y = y0 + r() * (y1 - y0), s = 2 + (y - y0) / (y1 - y0) * 5; c.fillStyle = pick(r, cols); for (var k = 0; k < 5; k++) { c.beginPath(); c.arc(x + Math.cos(k * 1.26) * s, y + Math.sin(k * 1.26) * s, s * .7, 0, 7); c.fill(); } c.fillStyle = '#ffcc33'; c.beginPath(); c.arc(x, y, s * .5, 0, 7); c.fill(); } }

  var LIST = {
    rainforest: { name: 'Rainforest', words: 'rainforest jungle rain tropical parrot toucan amazon monkey vines lush', tods: ['day', 'dawn', 'sunset'], draw: function (c, w, h, r, tod) {
      sky(c, w, h, tod, .5); sun(c, w * .8, h * .15, h * .06, tod);
      hills(c, w, h, r, h * .42, h * .05, '#1f6b3a', 3); hills(c, w, h, r, h * .5, h * .04, '#185a2f', 4);
      for (var i = 0; i < 22; i++) roundTree(c, r() * w, h * (.55 + r() * .1), h * (.35 + r() * .25), pick(r, ['#1e7d3c', '#2b9346', '#16672f', '#3aa652']), 'rgba(255,255,255,.12)');
      c.fillStyle = '#0f4a24'; c.fillRect(0, h * .7, w, h * .3);
      var wx = w * (.35 + r() * .3); c.fillStyle = 'rgba(200,240,255,.85)'; c.beginPath(); c.moveTo(wx - w * .04, h * .38); c.lineTo(wx + w * .04, h * .38); c.lineTo(wx + w * .07, h * .78); c.lineTo(wx - w * .07, h * .78); c.fill();
      water(c, w, h, h * .78, '#3fb4c8', '#1d6f86', r);
      for (i = 0; i < 9; i++) { c.strokeStyle = '#2f7d2f'; c.lineWidth = 3; var vx = r() * w; c.beginPath(); c.moveTo(vx, 0); c.quadraticCurveTo(vx + 20, h * .2, vx - 5, h * (.25 + r() * .3)); c.stroke(); }
      for (i = 0; i < 26; i++) { var lx = r() * w, ly = h * (.72 + r() * .28); c.fillStyle = pick(r, ['#2fa84f', '#46c060', '#1c8a3d']); c.beginPath(); c.ellipse(lx, ly, h * .05, h * .018, r() * 3, 0, 7); c.fill(); }
      var px = w * (.15 + r() * .7), py = h * (.3 + r() * .15); c.fillStyle = '#e8352e'; c.beginPath(); c.ellipse(px, py, 9, 15, 0, 0, 7); c.fill(); c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(px, py - 12, 6, 0, 7); c.fill(); c.fillStyle = '#2a6df0'; c.fillRect(px - 4, py + 8, 8, 16);
    } },
    forest: { name: 'Forest', words: 'forest woods trees pine evergreen cabin deer camping wild autumn fall leaves', tods: ['day', 'sunset', 'night'], draw: function (c, w, h, r, tod) {
      sky(c, w, h, tod, .6); if (tod === 'night') stars(c, w, h * .5, r, 90); sun(c, w * .25, h * .2, h * .07, tod);
      mountains(c, w, h, r, h * .5, h * .25, tod === 'night' ? '#1f2a4f' : '#6f8fb8', tod === 'night' ? '#c8d0ee' : '#eef5ff');
      hills(c, w, h, r, h * .58, h * .04, tod === 'night' ? '#14301f' : '#3f7a3c', 2);
      for (var row = 0; row < 3; row++) for (var i = 0; i < 16; i++) { var s = h * (.18 + row * .1); pine(c, r() * w, h * (.6 + row * .1) + r() * 10, s, pick(r, row === 2 ? ['#174d27', '#1e5c2f'] : ['#2b6e3a', '#22603a', '#367a43'])); }
      c.fillStyle = tod === 'night' ? '#0d2416' : '#2d5a2a'; c.fillRect(0, h * .88, w, h * .12);
      house(c, w * (.55 + r() * .25), h * .9, w * .1, h * .08, '#8a5a34', '#5a2f22', tod !== 'day');
      if (tod === 'night') { c.fillStyle = 'rgba(255,240,150,.8)'; for (i = 0; i < 18; i++) { c.beginPath(); c.arc(r() * w, h * (.6 + r() * .35), 1.6, 0, 7); c.fill(); } }
    } },
    desert: { name: 'Desert', words: 'desert sand dunes cactus camel hot dry sahara canyon pyramid oasis', tods: ['day', 'sunset', 'night'], draw: function (c, w, h, r, tod) {
      sky(c, w, h, tod, .55); if (tod === 'night') stars(c, w, h * .55, r, 140); sun(c, w * (.2 + r() * .6), h * .18, h * .08, tod);
      var dark = tod === 'night', sand = dark ? ['#4a3b5e', '#3a2e4f', '#2c2340'] : tod === 'sunset' ? ['#e59a5a', '#d37f45', '#bf6a35'] : ['#f3cf86', '#e8b866', '#d9a14d'];
      mountains(c, w, h, r, h * .52, h * .12, dark ? '#2a2440' : '#c98a5a');
      hills(c, w, h, r, h * .58, h * .05, sand[0], 1.5); hills(c, w, h, r, h * .7, h * .06, sand[1], 2); hills(c, w, h, r, h * .84, h * .05, sand[2], 1.2);
      for (var i = 0; i < 5; i++) {
        var x = w * (.08 + r() * .84), y = h * (.72 + r() * .2), s = h * (.1 + (y / h - .7) * .6);
        c.fillStyle = dark ? '#1f3b2e' : '#3f9a52'; c.beginPath(); c.roundRect ? c.roundRect(x - s * .1, y - s, s * .2, s, s * .1) : c.rect(x - s * .1, y - s, s * .2, s); c.fill();
        c.beginPath(); c.roundRect ? c.roundRect(x - s * .38, y - s * .7, s * .14, s * .38, s * .07) : c.rect(x - s * .38, y - s * .7, s * .14, s * .38); c.fill(); c.fillRect(x - s * .3, y - s * .4, s * .25, s * .1);
        c.beginPath(); c.roundRect ? c.roundRect(x + s * .24, y - s * .82, s * .14, s * .42, s * .07) : c.rect(x + s * .24, y - s * .82, s * .14, s * .42); c.fill(); c.fillRect(x + s * .05, y - s * .5, s * .25, s * .1);
      }
      c.fillStyle = 'rgba(255,255,255,.1)'; for (i = 0; i < 60; i++) c.fillRect(r() * w, h * (.6 + r() * .4), 2, 1);
    } },
    restaurant: { name: 'Empty restaurant', words: 'empty restaurant cafe diner tables chairs kitchen dinner food inside indoor bistro pizza', tods: ['day', 'sunset', 'night'], draw: function (c, w, h, r, tod) {
      var wallTop = pick(r, ['#7a2f3a', '#2f5a4f', '#34407a', '#6b4a2a']);
      c.fillStyle = wallTop; c.fillRect(0, 0, w, h * .62);
      c.fillStyle = 'rgba(255,255,255,.06)'; for (var x = 0; x < w; x += w / 24) c.fillRect(x, 0, w / 48, h * .62);
      // windows
      for (var i = 0; i < 3; i++) { var wx = w * (.08 + i * .32), ww = w * .22; sky(c, 0, 0, tod, 1); var g = c.createLinearGradient(0, h * .1, 0, h * .45); var s = SKY[tod]; g.addColorStop(0, s[0]); g.addColorStop(1, s[1]); c.fillStyle = g; c.fillRect(wx, h * .1, ww, h * .34); c.strokeStyle = '#2a1a12'; c.lineWidth = 6; c.strokeRect(wx, h * .1, ww, h * .34); c.beginPath(); c.moveTo(wx + ww / 2, h * .1); c.lineTo(wx + ww / 2, h * .44); c.stroke(); if (tod === 'night') stars(c, ww, h * .3, r, 4); }
      c.fillStyle = '#3a2416'; c.fillRect(0, h * .55, w, h * .07);
      // floor checker with perspective
      var fy = h * .62; for (var row = 0; row < 8; row++) { var y0 = fy + (h - fy) * Math.pow(row / 8, 1.3), y1 = fy + (h - fy) * Math.pow((row + 1) / 8, 1.3); for (var col = -8; col < 16; col++) { c.fillStyle = (row + col) % 2 ? '#f1e7d6' : '#3b302b'; var spread = .6 + row * .1; c.beginPath(); c.moveTo(w / 2 + (col * w / 8 - w / 2) * spread, y0); c.lineTo(w / 2 + ((col + 1) * w / 8 - w / 2) * spread, y0); c.lineTo(w / 2 + ((col + 1) * w / 8 - w / 2) * (spread + .1), y1); c.lineTo(w / 2 + (col * w / 8 - w / 2) * (spread + .1), y1); c.fill(); } }
      // lamps
      for (i = 0; i < 4; i++) { var lx = w * (.14 + i * .24); c.strokeStyle = '#111'; c.lineWidth = 2; c.beginPath(); c.moveTo(lx, 0); c.lineTo(lx, h * .12); c.stroke(); c.fillStyle = '#222'; c.beginPath(); c.moveTo(lx - 16, h * .16); c.lineTo(lx + 16, h * .16); c.lineTo(lx + 7, h * .11); c.lineTo(lx - 7, h * .11); c.fill(); var lg = c.createRadialGradient(lx, h * .17, 0, lx, h * .17, h * .2); lg.addColorStop(0, 'rgba(255,220,140,.55)'); lg.addColorStop(1, 'rgba(255,220,140,0)'); c.fillStyle = lg; c.fillRect(lx - h * .2, h * .1, h * .4, h * .3); }
      // tables
      var cloth = pick(r, ['#ffffff', '#e8463c', '#f6e7c8']);
      [[.2, .72, 1], [.5, .7, 1], [.8, .72, 1], [.33, .88, 1.35], [.68, .88, 1.35]].forEach(function (t) {
        var tx = w * t[0], ty = h * t[1], s = h * .09 * t[2];
        c.fillStyle = '#5a3a24'; c.fillRect(tx - s * 1.3, ty - s * .2, s * .18, s * .9); c.fillRect(tx + s * 1.12, ty - s * .2, s * .18, s * .9); c.fillRect(tx - s * 1.4, ty - s * .9, s * .14, s * .8); c.fillRect(tx + s * 1.26, ty - s * .9, s * .14, s * .8);
        c.fillStyle = '#3a2416'; c.fillRect(tx - s * .06, ty, s * .12, s * .6);
        c.fillStyle = cloth; c.beginPath(); c.ellipse(tx, ty, s, s * .32, 0, 0, 7); c.fill(); c.fillRect(tx - s, ty, s * 2, s * .25);
        c.fillStyle = '#ffd23f'; c.fillRect(tx - 2, ty - s * .35, 4, s * .3); c.fillStyle = 'rgba(255,200,80,.7)'; c.beginPath(); c.arc(tx, ty - s * .4, 4, 0, 7); c.fill();
      });
      c.fillStyle = '#2a1a12'; c.font = 'bold ' + Math.round(h * .05) + 'px Fredoka, sans-serif'; c.textAlign = 'center'; c.fillText(pick(r, ['CAFÉ', 'BISTRO', 'DINER', 'TRATTORIA']), w / 2, h * .07);
    } },
    beach: { name: 'Beach', words: 'beach ocean sea sand waves palm tropical island summer surf shore', tods: ['day', 'sunset', 'dawn'], draw: function (c, w, h, r, tod) {
      sky(c, w, h, tod, .5); sun(c, w * (.3 + r() * .4), h * .3, h * .07, tod); for (var i = 0; i < 4; i++) cloud(c, r() * w, h * (.08 + r() * .2), h * .04, .7);
      water(c, w, h, h * .45, tod === 'sunset' ? '#5a4ba0' : '#2aa6d6', tod === 'sunset' ? '#e88a6a' : '#5fd0e0', r);
      c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.moveTo(0, h * .66); for (var x = 0; x <= w; x += 10) c.lineTo(x, h * .66 + Math.sin(x / 25) * 4); c.lineTo(w, h * .7); c.lineTo(0, h * .7); c.fill();
      hills(c, w, h, r, h * .7, h * .02, tod === 'sunset' ? '#e2b07a' : '#f6dca0', 1);
      palm(c, w * .12, h * .92, h * .55, .6); palm(c, w * .88, h * .95, h * .5, -.6);
      var ux = w * (.4 + r() * .2); c.fillStyle = '#ff5d73'; c.beginPath(); c.arc(ux, h * .74, h * .09, Math.PI, 0); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(ux, h * .74); c.arc(ux, h * .74, h * .09, Math.PI * 1.33, Math.PI * 1.66); c.fill(); c.fillStyle = '#555'; c.fillRect(ux - 1.5, h * .74, 3, h * .12);
      for (i = 0; i < 8; i++) { c.fillStyle = pick(r, ['#ff9a7a', '#fff2e0', '#ffd0a0']); c.beginPath(); c.arc(r() * w, h * (.8 + r() * .18), 3, 0, 7); c.fill(); }
    } },
    mountains: { name: 'Mountains', words: 'mountain mountains snow peak alps hike hiking lake cliffs valley', tods: ['day', 'dawn', 'sunset'], draw: function (c, w, h, r, tod) {
      sky(c, w, h, tod, .5); sun(c, w * .7, h * .2, h * .06, tod); for (var i = 0; i < 3; i++) cloud(c, r() * w, h * (.1 + r() * .15), h * .03, .6);
      mountains(c, w, h, r, h * .55, h * .4, '#5a6f9a', '#ffffff'); mountains(c, w, h, r, h * .62, h * .25, '#3d5378', '#e6eefc');
      water(c, w, h, h * .62, '#4f86b8', '#264f78', r);
      hills(c, w, h, r, h * .8, h * .04, '#2f6a3a', 2); for (i = 0; i < 14; i++) pine(c, r() * w, h * (.82 + r() * .12), h * (.12 + r() * .08), pick(r, ['#1f5a30', '#2a6e3c']));
      flowers(c, w, h * .9, h, r, 40);
    } },
    city: { name: 'City at night', words: 'city skyline buildings night lights town downtown skyscraper street urban', tods: ['night', 'sunset', 'day'], draw: function (c, w, h, r, tod) {
      sky(c, w, h, tod, .7); if (tod === 'night') stars(c, w, h * .5, r, 60); sun(c, w * .85, h * .15, h * .05, tod);
      for (var layer = 0; layer < 2; layer++) {
        var x = 0; while (x < w) {
          var bw = w * (.05 + r() * .07), bh = h * (.25 + r() * .4) * (layer ? .8 : 1.1);
          c.fillStyle = layer ? (tod === 'night' ? '#1a1d3a' : '#4a5378') : (tod === 'night' ? '#0e1028' : '#2f3554');
          var by = h * .82 - bh; c.fillRect(x, by, bw, bh);
          if (r() < .3) { c.fillRect(x + bw * .4, by - h * .05, bw * .2, h * .05); }
          c.fillStyle = tod === 'day' ? 'rgba(180,220,255,.6)' : '#ffd76a';
          for (var wy = by + 6; wy < h * .8; wy += 10) for (var wx = x + 4; wx < x + bw - 5; wx += 8) if (r() < (tod === 'day' ? .5 : .45)) c.fillRect(wx, wy, 4, 5);
          x += bw + (layer ? 2 : 4);
        }
      }
      water(c, w, h, h * .82, tod === 'night' ? '#141a3e' : '#3e5d8a', tod === 'night' ? '#05071a' : '#1f3456', r);
      if (tod !== 'day') { for (var i = 0; i < 40; i++) { c.fillStyle = 'rgba(255,215,106,' + (.2 + r() * .4) + ')'; c.fillRect(r() * w, h * (.83 + r() * .16), 2 + r() * 6, 2); } }
    } },
    underwater: { name: 'Under the sea', words: 'underwater ocean sea fish coral reef shark whale dolphin octopus submarine', tods: ['day'], draw: function (c, w, h, r) {
      var g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2bb6e0'); g.addColorStop(1, '#0a2f63'); c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(255,255,255,.08)'; for (var i = 0; i < 6; i++) { var x = r() * w; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 40, 0); c.lineTo(x + 120, h); c.lineTo(x + 60, h); c.fill(); }
      hills(c, w, h, r, h * .86, h * .03, '#e8d39a', 2);
      for (i = 0; i < 12; i++) { var cx = r() * w, cy = h * (.82 + r() * .1), col = pick(r, ['#ff6f91', '#ff9a5a', '#c86bff', '#ffd23f']); c.strokeStyle = col; c.lineWidth = 6; c.lineCap = 'round'; for (var k = 0; k < 4; k++) { c.beginPath(); c.moveTo(cx, cy); c.quadraticCurveTo(cx + (k - 1.5) * 12, cy - 30, cx + (k - 1.5) * 18, cy - 40 - r() * 40); c.stroke(); } }
      for (i = 0; i < 9; i++) { c.strokeStyle = '#2f9a5a'; c.lineWidth = 4; var sx = r() * w; c.beginPath(); c.moveTo(sx, h); for (var y = h; y > h * (.5 + r() * .2); y -= 12) c.lineTo(sx + Math.sin(y / 15) * 8, y); c.stroke(); }
      for (i = 0; i < 14; i++) { var fx = r() * w, fy = h * (.15 + r() * .6), fs = 8 + r() * 14, fc = pick(r, ['#ffb000', '#ff5d73', '#4be08a', '#fff', '#ffd23f']), dir = r() < .5 ? 1 : -1; c.fillStyle = fc; c.beginPath(); c.ellipse(fx, fy, fs, fs * .55, 0, 0, 7); c.fill(); c.beginPath(); c.moveTo(fx - dir * fs * .8, fy); c.lineTo(fx - dir * fs * 1.5, fy - fs * .5); c.lineTo(fx - dir * fs * 1.5, fy + fs * .5); c.fill(); c.fillStyle = '#111'; c.beginPath(); c.arc(fx + dir * fs * .5, fy - 2, 1.8, 0, 7); c.fill(); }
      for (i = 0; i < 20; i++) { c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1.2; c.beginPath(); c.arc(r() * w, r() * h * .8, 2 + r() * 4, 0, 7); c.stroke(); }
    } },
    space: { name: 'Outer space', words: 'space planet stars galaxy moon rocket astronaut saturn mars universe cosmic', tods: ['night'], draw: function (c, w, h, r) {
      c.fillStyle = '#05041a'; c.fillRect(0, 0, w, h);
      for (var i = 0; i < 4; i++) { var nx = r() * w, ny = r() * h, ng = c.createRadialGradient(nx, ny, 0, nx, ny, h * .5); ng.addColorStop(0, pick(r, ['rgba(160,80,255,.35)', 'rgba(255,90,170,.3)', 'rgba(60,160,255,.3)'])); ng.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = ng; c.fillRect(0, 0, w, h); }
      stars(c, w, h, r, 260);
      var px = w * (.25 + r() * .2), py = h * (.55 + r() * .15), pr = h * .22, pg = c.createRadialGradient(px - pr * .4, py - pr * .4, pr * .1, px, py, pr); pg.addColorStop(0, '#ffd8a0'); pg.addColorStop(1, '#c0602a'); c.fillStyle = pg; c.beginPath(); c.arc(px, py, pr, 0, 7); c.fill();
      c.strokeStyle = 'rgba(255,230,190,.7)'; c.lineWidth = 6; c.beginPath(); c.ellipse(px, py, pr * 1.7, pr * .35, -.3, 0, 7); c.stroke();
      var mx = w * (.72 + r() * .15), my = h * (.25 + r() * .1); c.fillStyle = '#9fb3d9'; c.beginPath(); c.arc(mx, my, h * .07, 0, 7); c.fill(); c.fillStyle = '#7f93bb'; c.beginPath(); c.arc(mx - 8, my - 6, 6, 0, 7); c.arc(mx + 10, my + 8, 5, 0, 7); c.fill();
      var rx = w * (.6 + r() * .2), ry = h * (.65 + r() * .1); c.save(); c.translate(rx, ry); c.rotate(-.7); c.fillStyle = '#eee'; c.beginPath(); c.moveTo(0, -30); c.quadraticCurveTo(12, -10, 10, 20); c.lineTo(-10, 20); c.quadraticCurveTo(-12, -10, 0, -30); c.fill(); c.fillStyle = '#ff5d73'; c.beginPath(); c.moveTo(-10, 10); c.lineTo(-18, 26); c.lineTo(-10, 22); c.fill(); c.beginPath(); c.moveTo(10, 10); c.lineTo(18, 26); c.lineTo(10, 22); c.fill(); c.fillStyle = '#4fb0ff'; c.beginPath(); c.arc(0, -8, 5, 0, 7); c.fill(); c.fillStyle = '#ffb000'; c.beginPath(); c.moveTo(-7, 20); c.lineTo(0, 40); c.lineTo(7, 20); c.fill(); c.restore();
    } },
    farm: { name: 'Farm', words: 'farm barn cows pigs chickens fields tractor countryside sheep horse hay', tods: ['day', 'sunset', 'dawn'], draw: function (c, w, h, r, tod) {
      sky(c, w, h, tod, .5); sun(c, w * .15, h * .18, h * .07, tod); for (var i = 0; i < 4; i++) cloud(c, r() * w, h * (.08 + r() * .15), h * .035, .8);
      hills(c, w, h, r, h * .5, h * .05, '#7cbf55', 1.5); hills(c, w, h, r, h * .62, h * .04, '#5fa845', 2);
      for (i = 0; i < 8; i++) { c.strokeStyle = 'rgba(80,140,40,.5)'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, h * (.66 + i * .04)); c.lineTo(w, h * (.64 + i * .045)); c.stroke(); }
      var bx = w * (.55 + r() * .2), by = h * .7, bw = w * .2, bh = h * .2; c.fillStyle = '#c0392b'; c.fillRect(bx, by - bh, bw, bh); c.fillStyle = '#7a1f17'; c.beginPath(); c.moveTo(bx - 8, by - bh); c.lineTo(bx + bw / 2, by - bh - bh * .55); c.lineTo(bx + bw + 8, by - bh); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 3; c.strokeRect(bx + bw * .35, by - bh * .6, bw * .3, bh * .6); c.beginPath(); c.moveTo(bx + bw * .35, by - bh * .6); c.lineTo(bx + bw * .65, by); c.moveTo(bx + bw * .65, by - bh * .6); c.lineTo(bx + bw * .35, by); c.stroke();
      c.fillStyle = '#d8d8d8'; c.fillRect(bx + bw + 4, by - bh * 1.2, bw * .22, bh * 1.2); c.beginPath(); c.arc(bx + bw + 4 + bw * .11, by - bh * 1.2, bw * .11, Math.PI, 0); c.fill();
      for (i = 0; i < 12; i++) { var fx = w * i / 11; c.fillStyle = '#f2e6c8'; c.fillRect(fx, h * .82, 4, h * .06); } c.fillRect(0, h * .84, w, 4); c.fillRect(0, h * .86, w, 3);
      for (i = 0; i < 3; i++) { var cx = w * (.1 + r() * .35), cy = h * (.74 + r() * .06); c.fillStyle = '#fff'; c.beginPath(); c.ellipse(cx, cy, 18, 11, 0, 0, 7); c.fill(); c.fillStyle = '#222'; c.beginPath(); c.arc(cx - 5, cy - 3, 4, 0, 7); c.arc(cx + 7, cy + 2, 3, 0, 7); c.fill(); c.fillRect(cx - 14, cy + 6, 3, 9); c.fillRect(cx + 10, cy + 6, 3, 9); c.beginPath(); c.arc(cx + 20, cy - 4, 6, 0, 7); c.fill(); }
      flowers(c, w, h * .9, h, r, 30);
    } },
    snow: { name: 'Snowy village', words: 'snow winter village christmas snowman ice cold cabin holiday sled', tods: ['day', 'sunset', 'night'], draw: function (c, w, h, r, tod) {
      sky(c, w, h, tod, .55); if (tod === 'night') stars(c, w, h * .4, r, 80); sun(c, w * .8, h * .18, h * .05, tod);
      mountains(c, w, h, r, h * .52, h * .22, tod === 'night' ? '#3a4a7a' : '#a9bde0', '#ffffff');
      hills(c, w, h, r, h * .62, h * .04, tod === 'night' ? '#cdd6f2' : '#f4f8ff', 2);
      for (var i = 0; i < 6; i++) house(c, w * (.05 + i * .16) + r() * 10, h * (.72 + r() * .04), w * .1, h * .1, pick(r, ['#b5543c', '#3f6aa5', '#d9a34a', '#6a8a4a']), '#f4f8ff', tod !== 'day');
      for (i = 0; i < 8; i++) pine(c, r() * w, h * (.66 + r() * .06), h * .14, '#2a5a44');
      c.fillStyle = tod === 'night' ? '#dfe6fb' : '#ffffff'; c.fillRect(0, h * .8, w, h * .2);
      var sx = w * (.3 + r() * .4), sy = h * .9; c.fillStyle = '#fff'; c.beginPath(); c.arc(sx, sy, h * .05, 0, 7); c.arc(sx, sy - h * .07, h * .035, 0, 7); c.fill(); c.strokeStyle = '#ccd'; c.stroke(); c.fillStyle = '#ff8a3d'; c.beginPath(); c.moveTo(sx, sy - h * .07); c.lineTo(sx + 14, sy - h * .065); c.lineTo(sx, sy - h * .06); c.fill();
      c.fillStyle = '#fff'; for (i = 0; i < 120; i++) { c.globalAlpha = .5 + r() * .5; c.beginPath(); c.arc(r() * w, r() * h, r() * 2.2 + .5, 0, 7); c.fill(); } c.globalAlpha = 1;
    } },
    lake: { name: 'Sunset lake', words: 'lake sunset river boat dock calm reflection pond canoe fishing', tods: ['sunset', 'day', 'night'], draw: function (c, w, h, r, tod) {
      sky(c, w, h, tod, .5); if (tod === 'night') stars(c, w, h * .5, r, 100); var sx = w * (.4 + r() * .2); sun(c, sx, h * .4, h * .08, tod);
      hills(c, w, h, r, h * .5, h * .06, tod === 'night' ? '#141a38' : '#3a3f6a', 2);
      water(c, w, h, h * .5, tod === 'sunset' ? '#ff9a6a' : tod === 'night' ? '#1a2350' : '#5fa8e0', tod === 'sunset' ? '#3b2a73' : tod === 'night' ? '#060a24' : '#2a5f9a', r);
      c.fillStyle = tod === 'night' ? 'rgba(255,246,216,.35)' : 'rgba(255,220,140,.5)'; for (var i = 0; i < 14; i++) { var yy = h * (.52 + i * .03); c.fillRect(sx - (20 - i) * 2 - r() * 10, yy, (20 - i) * 4 + r() * 20, 3); }
      c.fillStyle = '#5a3a22'; c.fillRect(w * .62, h * .78, w * .38, h * .03); for (i = 0; i < 5; i++) c.fillRect(w * (.64 + i * .08), h * .8, 5, h * .1);
      c.fillStyle = '#7a2f22'; var bx = w * (.2 + r() * .2), by = h * .7; c.beginPath(); c.moveTo(bx - 40, by); c.quadraticCurveTo(bx, by + 18, bx + 40, by); c.closePath(); c.fill();
      for (i = 0; i < 6; i++) pine(c, w * (i < 3 ? i * .06 : .82 + (i - 3) * .06), h * .55, h * .2, tod === 'night' ? '#0d1530' : '#1f2a44');
    } },
    garden: { name: 'Flower garden', words: 'garden flowers spring butterfly roses tulips park bees meadow', tods: ['day', 'dawn'], draw: function (c, w, h, r, tod) {
      sky(c, w, h, tod, .45); sun(c, w * .85, h * .15, h * .06, tod); for (var i = 0; i < 3; i++) cloud(c, r() * w, h * (.08 + r() * .14), h * .04, .85);
      hills(c, w, h, r, h * .45, h * .04, '#8ccf6a', 1.5); for (i = 0; i < 6; i++) roundTree(c, r() * w, h * .5, h * .3, pick(r, ['#4caf50', '#3a9a45']), 'rgba(255,255,255,.15)');
      c.fillStyle = '#62b04a'; c.fillRect(0, h * .5, w, h * .5);
      c.fillStyle = '#d9c3a0'; c.beginPath(); c.moveTo(w * .45, h * .5); c.lineTo(w * .55, h * .5); c.lineTo(w * .8, h); c.lineTo(w * .2, h); c.fill();
      flowers(c, w, h * .52, h, r, 160);
      for (i = 0; i < 5; i++) { var bx = r() * w, by = h * (.2 + r() * .4), bc = pick(r, ['#ff8a3d', '#b07cff', '#4fb0ff']); c.fillStyle = bc; c.beginPath(); c.ellipse(bx - 6, by, 6, 9, -.5, 0, 7); c.ellipse(bx + 6, by, 6, 9, .5, 0, 7); c.fill(); c.fillStyle = '#222'; c.fillRect(bx - 1, by - 6, 2, 12); }
    } },
    castle: { name: 'Castle', words: 'castle king queen knight kingdom princess dragon fairy tale medieval tower', tods: ['day', 'sunset', 'night'], draw: function (c, w, h, r, tod) {
      sky(c, w, h, tod, .6); if (tod === 'night') stars(c, w, h * .5, r, 90); sun(c, w * .18, h * .2, h * .06, tod);
      hills(c, w, h, r, h * .62, h * .06, tod === 'night' ? '#173020' : '#5aa54a', 1.5);
      var cx = w * .5, base = h * .66, cw = w * .36, stone = tod === 'night' ? '#5a5f80' : '#c9c3b6', dark = tod === 'night' ? '#3a3f5a' : '#9a9384';
      c.fillStyle = stone; c.fillRect(cx - cw / 2, base - h * .22, cw, h * .22);
      [[-.5, .34], [.5, .34], [-.15, .42], [.15, .42]].forEach(function (t) { var tx = cx + t[0] * cw, tw = cw * .16, th = h * t[1]; c.fillStyle = stone; c.fillRect(tx - tw / 2, base - th, tw, th); c.fillStyle = tod === 'night' ? '#6a2a4a' : '#3f5fb0'; c.beginPath(); c.moveTo(tx - tw * .65, base - th); c.lineTo(tx, base - th - tw * 1.3); c.lineTo(tx + tw * .65, base - th); c.fill(); c.fillStyle = tod === 'night' ? '#ffd76a' : '#2a2a3a'; c.fillRect(tx - 3, base - th * .75, 6, 10); c.strokeStyle = '#333'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(tx, base - th - tw * 1.3); c.lineTo(tx, base - th - tw * 1.3 - 16); c.stroke(); c.fillStyle = '#ff5d73'; c.fillRect(tx, base - th - tw * 1.3 - 16, 10, 6); });
      for (var x = cx - cw / 2; x < cx + cw / 2; x += cw / 12) { c.fillStyle = stone; c.fillRect(x, base - h * .24, cw / 24, h * .02); }
      c.fillStyle = '#4a2f1e'; c.beginPath(); c.moveTo(cx - cw * .08, base); c.lineTo(cx - cw * .08, base - h * .08); c.arc(cx, base - h * .08, cw * .08, Math.PI, 0); c.lineTo(cx + cw * .08, base); c.fill();
      c.strokeStyle = dark; c.lineWidth = 1; for (var y = base - h * .2; y < base; y += 8) { c.beginPath(); c.moveTo(cx - cw / 2, y); c.lineTo(cx + cw / 2, y); c.stroke(); }
      water(c, w, h, h * .7, tod === 'night' ? '#1a2a5a' : '#4f9ad8', tod === 'night' ? '#0a1030' : '#2a5f9a', r);
      c.fillStyle = tod === 'night' ? '#173020' : '#4a9a3c'; c.fillRect(0, h * .84, w, h * .16); flowers(c, w, h * .86, h, r, 40);
    } }
  };
  var TOD_NAMES = { day: 'Daytime', sunset: 'Sunset', night: 'Night', dawn: 'Morning' };

  function paint(c, w, h, key, seed, tod) {
    var s = LIST[key]; var r = rng(seed);
    c.save(); s.draw(c, w, h, r, tod || s.tods[0]); c.restore();
  }
  function keys() { return Object.keys(LIST); }

  // ----- jigsaw piece outline (edges: [top,right,bottom,left], +1 tab out, -1 tab in, 0 flat) -----
  function edge(c, x0, y0, x1, y1, t) {
    if (!t) { c.lineTo(x1, y1); return; }
    var dx = x1 - x0, dy = y1 - y0, nx = dy * t, ny = -dx * t;
    function P(u, v) { return [x0 + dx * u + nx * v, y0 + dy * u + ny * v]; }
    var a;
    a = P(.36, 0); c.lineTo(a[0], a[1]);
    var p = [P(.44, 0), P(.44, .06), P(.40, .10)]; c.bezierCurveTo(p[0][0], p[0][1], p[1][0], p[1][1], p[2][0], p[2][1]);
    p = [P(.33, .17), P(.38, .26), P(.50, .26)]; c.bezierCurveTo(p[0][0], p[0][1], p[1][0], p[1][1], p[2][0], p[2][1]);
    p = [P(.62, .26), P(.67, .17), P(.60, .10)]; c.bezierCurveTo(p[0][0], p[0][1], p[1][0], p[1][1], p[2][0], p[2][1]);
    p = [P(.56, .06), P(.56, 0), P(.64, 0)]; c.bezierCurveTo(p[0][0], p[0][1], p[1][0], p[1][1], p[2][0], p[2][1]);
    c.lineTo(x1, y1);
  }
  function piecePath(c, x, y, w, h, e) {
    c.beginPath(); c.moveTo(x, y);
    edge(c, x, y, x + w, y, e[0]); edge(c, x + w, y, x + w, y + h, e[1]);
    edge(c, x + w, y + h, x, y + h, e[2]); edge(c, x, y + h, x, y, e[3]);
    c.closePath();
  }
  return { LIST: LIST, TOD_NAMES: TOD_NAMES, paint: paint, keys: keys, piecePath: piecePath };
})();

/* ===== Game 4: Chess — full rules, robot opponent, 2-player drag ===== */
var ChessEngine = (function () {
  var N = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  var K = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  var DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]], ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  function white(p) { return p >= 'A' && p <= 'Z'; }
  function colorOf(p) { return p === '.' ? null : white(p) ? 'w' : 'b'; }
  function initial() {
    var rows = ['rnbqkbnr', 'pppppppp', '........', '........', '........', '........', 'PPPPPPPP', 'RNBQKBNR'];
    return { b: rows.join('').split(''), turn: 'w', castle: { K: 1, Q: 1, k: 1, q: 1 }, ep: -1, half: 0 };
  }
  function attacked(b, sq, by) {
    var r = sq >> 3, c = sq & 7, i, rr, cc, p;
    // pawns
    var pr = by === 'w' ? r + 1 : r - 1, pawn = by === 'w' ? 'P' : 'p';
    if (pr >= 0 && pr < 8) { if (c > 0 && b[pr * 8 + c - 1] === pawn) return true; if (c < 7 && b[pr * 8 + c + 1] === pawn) return true; }
    var kn = by === 'w' ? 'N' : 'n', kg = by === 'w' ? 'K' : 'k';
    for (i = 0; i < 8; i++) { rr = r + N[i][0]; cc = c + N[i][1]; if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[rr * 8 + cc] === kn) return true; }
    for (i = 0; i < 8; i++) { rr = r + K[i][0]; cc = c + K[i][1]; if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[rr * 8 + cc] === kg) return true; }
    var bq = by === 'w' ? 'BQ' : 'bq', rq = by === 'w' ? 'RQ' : 'rq';
    for (i = 0; i < 4; i++) { rr = r + DIAG[i][0]; cc = c + DIAG[i][1]; while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) { p = b[rr * 8 + cc]; if (p !== '.') { if (bq.indexOf(p) >= 0) return true; break; } rr += DIAG[i][0]; cc += DIAG[i][1]; } }
    for (i = 0; i < 4; i++) { rr = r + ORTH[i][0]; cc = c + ORTH[i][1]; while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) { p = b[rr * 8 + cc]; if (p !== '.') { if (rq.indexOf(p) >= 0) return true; break; } rr += ORTH[i][0]; cc += ORTH[i][1]; } }
    return false;
  }
  function pseudo(pos) {
    var b = pos.b, me = pos.turn, opp = me === 'w' ? 'b' : 'w', out = [];
    for (var sq = 0; sq < 64; sq++) {
      var p = b[sq]; if (p === '.' || colorOf(p) !== me) continue;
      var r = sq >> 3, c = sq & 7, t = p.toUpperCase(), i, rr, cc, to;
      if (t === 'P') {
        var dir = me === 'w' ? -1 : 1, startR = me === 'w' ? 6 : 1, lastR = me === 'w' ? 0 : 7;
        rr = r + dir;
        if (rr >= 0 && rr < 8) {
          to = rr * 8 + c;
          if (b[to] === '.') {
            out.push({ f: sq, t: to, promo: rr === lastR ? 'Q' : null });
            if (r === startR && b[(r + 2 * dir) * 8 + c] === '.') out.push({ f: sq, t: (r + 2 * dir) * 8 + c, dbl: true });
          }
          for (var dc = -1; dc <= 1; dc += 2) {
            cc = c + dc; if (cc < 0 || cc > 7) continue; to = rr * 8 + cc;
            if (b[to] !== '.' && colorOf(b[to]) === opp) out.push({ f: sq, t: to, promo: rr === lastR ? 'Q' : null, cap: b[to] });
            else if (to === pos.ep) out.push({ f: sq, t: to, ep: true, cap: me === 'w' ? 'p' : 'P' });
          }
        }
      } else if (t === 'N' || t === 'K') {
        var offs = t === 'N' ? N : K;
        for (i = 0; i < 8; i++) { rr = r + offs[i][0]; cc = c + offs[i][1]; if (rr < 0 || rr > 7 || cc < 0 || cc > 7) continue; to = rr * 8 + cc; if (b[to] === '.' || colorOf(b[to]) === opp) out.push({ f: sq, t: to, cap: b[to] !== '.' ? b[to] : null }); }
        if (t === 'K') {
          var home = me === 'w' ? 60 : 4, cr = pos.castle, ks = me === 'w' ? 'K' : 'k', qs = me === 'w' ? 'Q' : 'q', rk = me === 'w' ? 'R' : 'r';
          if (sq === home && !attacked(b, home, opp)) {
            if (cr[ks] && b[home + 1] === '.' && b[home + 2] === '.' && b[home + 3] === rk && !attacked(b, home + 1, opp) && !attacked(b, home + 2, opp)) out.push({ f: sq, t: home + 2, castle: 'K' });
            if (cr[qs] && b[home - 1] === '.' && b[home - 2] === '.' && b[home - 3] === '.' && b[home - 4] === rk && !attacked(b, home - 1, opp) && !attacked(b, home - 2, opp)) out.push({ f: sq, t: home - 2, castle: 'Q' });
          }
        }
      } else {
        var dirs = t === 'B' ? DIAG : t === 'R' ? ORTH : DIAG.concat(ORTH);
        for (i = 0; i < dirs.length; i++) {
          rr = r + dirs[i][0]; cc = c + dirs[i][1];
          while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) {
            to = rr * 8 + cc;
            if (b[to] === '.') out.push({ f: sq, t: to });
            else { if (colorOf(b[to]) === opp) out.push({ f: sq, t: to, cap: b[to] }); break; }
            rr += dirs[i][0]; cc += dirs[i][1];
          }
        }
      }
    }
    return out;
  }
  function make(pos, m) {
    var b = pos.b.slice(), p = b[m.f], me = pos.turn;
    var castle = { K: pos.castle.K, Q: pos.castle.Q, k: pos.castle.k, q: pos.castle.q };
    b[m.t] = m.promo ? (me === 'w' ? m.promo : m.promo.toLowerCase()) : p; b[m.f] = '.';
    if (m.ep) b[m.t + (me === 'w' ? 8 : -8)] = '.';
    if (m.castle) { var home = me === 'w' ? 60 : 4; if (m.castle === 'K') { b[home + 1] = b[home + 3]; b[home + 3] = '.'; } else { b[home - 1] = b[home - 4]; b[home - 4] = '.'; } }
    if (p === 'K') { castle.K = 0; castle.Q = 0; } if (p === 'k') { castle.k = 0; castle.q = 0; }
    [[63, 'K'], [56, 'Q'], [7, 'k'], [0, 'q']].forEach(function (x) { if (m.f === x[0] || m.t === x[0]) castle[x[1]] = 0; });
    return { b: b, turn: me === 'w' ? 'b' : 'w', castle: castle, ep: m.dbl ? (m.f + m.t) / 2 : -1, half: (p.toUpperCase() === 'P' || m.cap) ? 0 : pos.half + 1 };
  }
  function kingSq(b, color) { var k = color === 'w' ? 'K' : 'k'; return b.indexOf(k); }
  function inCheck(pos, color) { color = color || pos.turn; return attacked(pos.b, kingSq(pos.b, color), color === 'w' ? 'b' : 'w'); }
  function legal(pos) {
    var me = pos.turn, opp = me === 'w' ? 'b' : 'w';
    return pseudo(pos).filter(function (m) { var n = make(pos, m); return !attacked(n.b, kingSq(n.b, me), opp); });
  }
  function insufficient(b) {
    var rest = b.filter(function (p) { return p !== '.' && p !== 'K' && p !== 'k'; });
    return rest.length === 0 || (rest.length === 1 && /[NBnb]/.test(rest[0]));
  }
  function status(pos) {
    var ms = legal(pos);
    if (!ms.length) return inCheck(pos) ? { over: true, result: pos.turn === 'w' ? 'b' : 'w', why: 'checkmate' } : { over: true, result: 'draw', why: 'stalemate' };
    if (insufficient(pos.b)) return { over: true, result: 'draw', why: 'not enough pieces to checkmate' };
    if (pos.half >= 100) return { over: true, result: 'draw', why: '50 moves without a capture' };
    return { over: false, moves: ms };
  }
  // --- evaluation ---
  var V = { P: 100, N: 320, B: 335, R: 500, Q: 900, K: 0 };
  var PST = {
    P: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    N: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    B: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    R: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    Q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    K: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20]
  };
  function evaluate(b) { // + = good for white
    var s = 0;
    for (var i = 0; i < 64; i++) { var p = b[i]; if (p === '.') continue; var t = p.toUpperCase(); if (white(p)) s += V[t] + PST[t][i]; else s -= V[t] + PST[t][(7 - (i >> 3)) * 8 + (i & 7)]; }
    return s;
  }
  function order(ms) { return ms.sort(function (a, b) { return (b.cap ? V[b.cap.toUpperCase()] * 10 + (b.promo ? 800 : 0) : (b.promo ? 800 : 0)) - (a.cap ? V[a.cap.toUpperCase()] * 10 + (a.promo ? 800 : 0) : (a.promo ? 800 : 0)); }); }
  var nodes, deadline, timedOut;
  function quiesce(pos, alpha, beta, qd) {
    var stand = evaluate(pos.b) * (pos.turn === 'w' ? 1 : -1);
    if (stand >= beta) return beta; if (alpha < stand) alpha = stand;
    if (qd <= 0) return alpha;
    var me = pos.turn, opp = me === 'w' ? 'b' : 'w';
    var caps = order(pseudo(pos).filter(function (m) { return m.cap || m.promo; }));
    for (var i = 0; i < caps.length; i++) {
      var n = make(pos, caps[i]); if (attacked(n.b, kingSq(n.b, me), opp)) continue;
      var sc = -quiesce(n, -beta, -alpha, qd - 1);
      if (sc >= beta) return beta; if (sc > alpha) alpha = sc;
    }
    return alpha;
  }
  function negamax(pos, depth, alpha, beta, ply) {
    if ((++nodes & 1023) === 0 && Date.now() > deadline) timedOut = true;
    if (timedOut) return 0;
    if (pos.half >= 100) return 0;
    if (depth <= 0) return quiesce(pos, alpha, beta, 4);
    var ms = order(legal(pos));
    if (!ms.length) return inCheck(pos) ? -100000 + ply : 0;
    for (var i = 0; i < ms.length; i++) {
      var sc = -negamax(make(pos, ms[i]), depth - 1, -beta, -alpha, ply + 1);
      if (sc >= beta) return beta; if (sc > alpha) alpha = sc;
    }
    return alpha;
  }
  function search(pos, maxDepth, ms, noise, r) {
    nodes = 0; timedOut = false; deadline = Date.now() + ms;
    var moves = order(legal(pos)), best = moves[0], bestScore = -Infinity;
    for (var d = 1; d <= maxDepth; d++) {
      var scored = [], alpha = -Infinity;
      for (var i = 0; i < moves.length; i++) {
        var sc = -negamax(make(pos, moves[i]), d - 1, -Infinity, noise ? Infinity : -alpha, 1);
        if (timedOut) break;
        sc += noise ? (r() - .5) * noise : 0;
        scored.push([sc, moves[i]]); if (!noise && sc > alpha) alpha = sc;
      }
      if (timedOut && d > 1) break;
      scored.sort(function (a, b) { return b[0] - a[0]; });
      if (scored.length) { best = scored[0][1]; bestScore = scored[0][0]; moves = scored.map(function (s) { return s[1]; }).concat(moves.slice(scored.length)); }
      if (timedOut) break;
    }
    return { move: best, score: bestScore };
  }
  function perft(pos, d) { if (d === 0) return 1; var n = 0; legal(pos).forEach(function (m) { n += perft(make(pos, m), d - 1); }); return n; }
  return { initial: initial, legal: legal, make: make, status: status, inCheck: inCheck, kingSq: kingSq, search: search, perft: perft, colorOf: colorOf, evaluate: evaluate };
})();


var MazeGen = (function () {
  function gen(cols, rows, r) {
    // walls bitmask: 1=N 2=E 4=S 8=W ; recursive backtracker (iterative)
    var g = []; for (var i = 0; i < cols * rows; i++) g.push(15);
    var seen = new Uint8Array(cols * rows), stack = [0]; seen[0] = 1;
    var D = [[0, -1, 1, 4], [1, 0, 2, 8], [0, 1, 4, 1], [-1, 0, 8, 2]];
    while (stack.length) {
      var c = stack[stack.length - 1], x = c % cols, y = (c / cols) | 0, opts = [];
      for (var k = 0; k < 4; k++) { var nx = x + D[k][0], ny = y + D[k][1]; if (nx >= 0 && ny >= 0 && nx < cols && ny < rows && !seen[ny * cols + nx]) opts.push(k); }
      if (!opts.length) { stack.pop(); continue; }
      var d = D[pick(r, opts)], n = (y + d[1]) * cols + x + d[0];
      g[c] &= ~d[2]; g[n] &= ~d[3]; seen[n] = 1; stack.push(n);
    }
    // at higher sizes, knock out a few extra walls so there are loops (harder to follow one path)
    return g;
  }
  function solve(g, cols, rows, from, to) {
    var prev = new Int32Array(cols * rows).fill(-1), q = [from]; prev[from] = from;
    while (q.length) {
      var c = q.shift(); if (c === to) break;
      var x = c % cols, y = (c / cols) | 0;
      [[1, 0, -cols], [2, 1, 0], [4, 0, cols], [8, -1, 0]].forEach(function (m) {
        if (g[c] & m[0]) return;
        var n = m[0] === 2 ? c + 1 : m[0] === 8 ? c - 1 : c + m[2];
        if (prev[n] < 0) { prev[n] = c; q.push(n); }
      });
    }
    var path = [], p = to; while (p !== from && p >= 0) { path.unshift(p); p = prev[p]; } return path;
  }
  return { gen: gen, solve: solve };
})();
var Patterns = (function () {
  function gcd(a, b) { return b ? gcd(b, a % b) : a; }
  // Remembers recent questions across levels (for this session) so the same
  // table / same sequence doesn't come back-to-back.
  var recentTables = [], recentSigs = [];
  function tablesFor(level) {
    if (level <= 3) return [2, 3, 5, 10];
    if (level <= 6) return [2, 3, 4, 5, 6, 10];
    if (level <= 14) return [2, 3, 4, 5, 6, 7, 8, 9, 10];
    if (level <= 20) return [3, 4, 6, 7, 8, 9, 11, 12];
    var top = Math.min(25, 12 + (level - 20)), t = [];
    for (var i = 6; i <= top; i++) t.push(i);
    return t;
  }
  function pickQ(level, r) {
    var tables = tablesFor(level);
    // don't reuse any of the last few tables (keep at least 2 choices available)
    var avoid = Math.min(recentTables.length, tables.length - 2, 3);
    var blocked = recentTables.slice(-avoid);
    var allowed = tables.filter(function (t) { return blocked.indexOf(t) < 0; });
    if (!allowed.length) allowed = tables;
    var q;
    for (var tries = 0; tries < 25; tries++) {
      q = makeQ(level, r, pick(r, allowed));
      if (recentSigs.indexOf(q.sig) < 0) break;
    }
    recentTables.push(q.table); if (recentTables.length > 6) recentTables.shift();
    recentSigs.push(q.sig); if (recentSigs.length > 30) recentSigs.shift();
    return q;
  }
  function makeQ(level, r, n) {
    var len, start;
    if (n == null) n = pick(r, tablesFor(level));
    var kind;
    if (level <= 3) kind = r() < .5 ? 'next' : 'blank';
    else if (level <= 7) kind = r() < .2 ? 'next' : 'blank';
    else if (level <= 10) kind = pick(r, ['blank', 'blank', 'which', 'next']);
    else if (level <= 14) kind = pick(r, ['which', 'which', 'blank', 'two']);
    else kind = pick(r, ['which', 'blank', 'two']);
    if (level >= 12 && r() < .2) kind = 'down';
    if (kind === 'which') {
      // k and k+1 are always included so the only table that fits is n itself
      var cnt = level >= 15 ? 5 : 4, k = ri(r, 1, 9), mults = [k, k + 1];
      while (mults.length < cnt) { var x = ri(r, 1, 12); if (mults.indexOf(x) < 0) mults.push(x); }
      shuffle(r, mults);
      var nums = mults.map(function (m) { return m * n; });
      var g = nums.reduce(gcd);
      return { kind: kind, table: n, sig: 'w' + nums.join(','), shown: nums, blanks: [], answers: [g], prompt: 'Which times table are these from?', suffix: '’s' };
    }
    len = level <= 6 ? 6 : 7;
    var maxStart = level <= 3 ? 4 : level <= 6 ? 6 : Math.min(12, 4 + level);
    start = ri(r, 1, maxStart);
    var seq = []; for (var i = 0; i < len; i++) seq.push((start + i) * n);
    if (kind === 'down') seq.reverse();
    var blanks;
    if (kind === 'next') blanks = [len - 1];
    else if (kind === 'two') { var a = ri(r, 1, len - 3); blanks = [a, ri(r, a + 2, len - 1)]; }
    else blanks = [ri(r, level <= 3 ? 2 : 1, len - 2)];
    return { kind: kind, table: n, sig: seq.join(',') + '|' + blanks.join(','), shown: seq, blanks: blanks, answers: blanks.map(function (b) { return seq[b]; }), prompt: blanks.length > 1 ? 'Fill in both missing numbers' : kind === 'down' ? 'This one counts down — what’s missing?' : kind === 'next' ? 'What comes next?' : 'What number goes in the box?' };
  }
  return { pickQ: pickQ, makeQ: makeQ };
})();
var JigsawMatch = (function () {
  var TOD_WORDS = { night: 'night dark stars starry moon midnight evening', sunset: 'sunset dusk golden orange sundown', dawn: 'morning sunrise dawn early', day: 'day daytime sunny bright noon' };
  function match(text) {
    var words = (text || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(function (w) { return w.length > 2; });
    var tod = null;
    Object.keys(TOD_WORDS).forEach(function (t) { words.forEach(function (w) { if (TOD_WORDS[t].split(' ').indexOf(w) >= 0) tod = t; }); });
    var scores = Scenes.keys().map(function (k) {
      var vocab = (Scenes.LIST[k].words + ' ' + Scenes.LIST[k].name.toLowerCase()).split(/\s+/), sc = 0;
      words.forEach(function (w) { vocab.forEach(function (v) { if (v === w) sc += 3; else if (v.length > 3 && (v.indexOf(w) === 0 || w.indexOf(v) === 0)) sc += 1; }); });
      return { key: k, sc: sc };
    }).sort(function (a, b) { return b.sc - a.sc; });
    var r = rng(Date.now() % 1e9), list = [];
    var hits = scores.filter(function (s) { return s.sc > 0; });
    function add(key, t) { var L = Scenes.LIST[key]; t = t && L.tods.indexOf(t) >= 0 ? t : t ? L.tods[0] : t; list.push({ key: key, tod: t, seed: ri(r, 1, 1e9), name: L.name + (L.tods.length > 1 ? ' · ' + Scenes.TOD_NAMES[t] : '') }); }
    if (hits.length) {
      var top = hits[0].key, L = Scenes.LIST[top];
      if (tod && L.tods.indexOf(tod) >= 0) { add(top, tod); add(top, tod); list[1].name += ' (another view)'; }
      L.tods.forEach(function (t) { if (list.length < 3 && !(tod === t && list.length)) add(top, t); });
      while (list.length < 2) add(top, L.tods[0]);
      hits.slice(1, 3).forEach(function (h) { if (list.length < 4) add(h.key, tod || pick(r, Scenes.LIST[h.key].tods)); });
      while (list.length < 4) add(top, pick(r, L.tods));
      return { matched: true, list: list.slice(0, 4) };
    }
    shuffle(r, Scenes.keys().slice()).slice(0, 4).forEach(function (k) { add(k, tod || pick(r, Scenes.LIST[k].tods)); });
    return { matched: false, list: list };
  }
  return match;
})();
export { clamp, rng, ri, pick, shuffle, Scenes, ChessEngine, MazeGen, Patterns, JigsawMatch };
