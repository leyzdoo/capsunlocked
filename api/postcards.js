'use strict';

const { createDecipheriv, createHash, createHmac, timingSafeEqual } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { get, put } = require('@vercel/blob');

const sessionName = '__Host-postcards';
const lifetime = 7 * 24 * 60 * 60;
const quinaultPath = 'postcards/quinault-lodge.json';
const maxUpload = 1400000;
const quinaultSides = {
  front: '24c2cb818c5d9cb43b5c932d0b2df8f930726842374217d409233a4487630a6d',
  back: 'b2bcbbeeff23076bc4693cd750683f256144f9fc8cd134caaee7b1602a8c92d1',
};

function validQuinault(data) {
  return Object.entries(quinaultSides).every(([side, hash]) => {
    const encoded = data?.[side];
    return typeof encoded === 'string' && encoded.length <= maxUpload &&
      /^[A-Za-z0-9+/]+={0,2}$/.test(encoded) &&
      createHash('sha256').update(Buffer.from(encoded, 'base64')).digest('hex') === hash;
  });
}

async function readQuinault() {
  const result = await get(quinaultPath, { access: 'private', useCache: false });
  if (result?.statusCode !== 200 || result.blob.size > maxUpload) return null;
  const data = await new Response(result.stream).json();
  return validQuinault(data) ? data : null;
}

function addQuinault(html, data) {
  if (!data) return html;
  const item = {
    id: 'quinault-lodge-nov-22-2026',
    kind: 'postcard',
    title: 'Historic Quinault Lodge',
    date: '2026-11-22',
    location: 'Quinault, WA',
    portraitCover: true,
    cover: 'data:image/webp;base64,' + data.front,
    back: 'data:image/webp;base64,' + data.back,
    backAlt: 'Handwritten postcard with a John Coltrane stamp and Pacific Beach postmark',
  };
  return html.replace('    const mail = [', () => '    const mail = [\n      ' + JSON.stringify(item) + ',');
}

function quinaultInstaller() {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Add the Quinault postcard</title></head><body><main>
<h1>Add the Quinault postcard</h1>
<form id="quinault-install">
<p><label>Front <input type="file" name="front" accept="image/webp" required></label></p>
<p><label>Back <input type="file" name="back" accept="image/webp" required></label></p>
<button type="submit">Put in mailbox</button>
</form>
<p id="quinault-status" role="status"></p>
<p><a href="/postcards">Open postcards</a></p>
<script src="/postcards-runtime/quinault-install.js" defer></script>
</main></body></html>`;
}

async function installQuinault(req, res) {
  if (req.headers.origin !== 'https://www.capsunlocked.com' &&
      req.headers.origin !== 'https://capsunlocked.com') {
    return res.status(403).send('Open the installer on capsunlocked.com.');
  }
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  const data = req.body;
  if (Number(req.headers['content-length']) > maxUpload || !validQuinault(data)) {
    return res.status(400).send('Choose the prepared Quinault front and back files.');
  }
  try {
    const payload = JSON.stringify({ front: data.front, back: data.back });
    if (Buffer.byteLength(payload) > maxUpload) return res.status(413).end();
    if (!await readQuinault()) {
      await put(quinaultPath, payload, {
        access: 'private', allowOverwrite: false, contentType: 'application/json',
      });
    }
    return res.status(204).end();
  } catch {
    console.error('The Quinault postcard could not be saved to private Blob storage.');
    return res.status(503).send('The postcard could not be saved. Retry from the installer.');
  }
}

const privateMail = {
  conference: {
    path: 'postcards/waffle-house-conference.json',
    digest: '4d9a53ebff8abffb36c3ab44c7a645167b52ea5b6deca7f6ffeb3ba341b01fd6',
    label: 'conference envelope',
  },
  sauna: {
    path: 'postcards/pacific-beach-sauna.json',
    digest: '7a6c0bdba85f6725a112238ba98b700fe8637a07270f6160b761380b13371a78',
    label: 'Pacific Beach postcard',
  },
  'game-changers': {
    path: 'postcards/game-changers.json',
    digest: '5831ca311bd505bedde3a4a091d543b7c62eb15cd5aa8a034897622150c1a144',
    label: 'Game Changers postcard',
  },
  'taiwan-travelogue': {
    path: 'postcards/taiwan-travelogue.json',
    digest: 'a99b7d8dda41dc65c37a9e66137f7feccefafa176e232080ddd54d4ec7c295d6',
    label: 'Taiwan Travelogue postcard',
  },
};

function privateMailPayload(body, mail) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  return payload && Buffer.byteLength(payload) <= maxUpload &&
    createHash('sha256').update(payload).digest('hex') === mail.digest ? payload : null;
}

async function readPrivateMail(mail) {
  const result = await get(mail.path, { access: 'private', useCache: false });
  if (result?.statusCode !== 200 || result.blob.size > maxUpload) return null;
  return privateMailPayload(await new Response(result.stream).text(), mail);
}

async function installPrivateMail(req, res, mail) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  if (!['https://www.capsunlocked.com', 'https://capsunlocked.com'].includes(req.headers.origin)) {
    return res.status(403).send('Open the installer on capsunlocked.com.');
  }
  const payload = privateMailPayload(req.body, mail);
  if (!payload) return res.status(400).send('Choose the prepared mail file.');
  try {
    if (!await readPrivateMail(mail)) {
      try {
        await put(mail.path, payload, {
          access: 'private', allowOverwrite: false, contentType: 'application/json',
        });
      } catch (error) {
        if (!await readPrivateMail(mail)) throw error;
      }
    }
    return res.status(204).end();
  } catch {
    console.error('Private postcard mail could not be saved.');
    return res.status(503).send('The mail could not be saved. Retry from the installer.');
  }
}

function privateMailInstaller(mail) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Add the ${mail.label}</title></head><body><main>
<h1>Add the ${mail.label}</h1>
<form id="conference-install">
<label>Prepared mail file <input type="file" accept=".json,application/json" required></label>
<button type="submit">Put in mailbox</button>
</form><p id="conference-status" role="status"></p>
<script src="/postcards-runtime/conference-install.js" defer></script>
</main></body></html>`;
}

function addSauna(html, payload) {
  if (!payload) return html;
  const data = JSON.parse(payload);
  const item = {
    id: 'pacific-beach-sauna-nov-23-2026',
    kind: 'postcard',
    title: 'Pacific Beach Sauna',
    date: '2026-11-23',
    location: 'Pacific Beach, WA',
    portraitCover: true,
    cover: 'data:image/webp;base64,' + data.front,
    back: 'data:image/webp;base64,' + data.back,
    backAlt: 'Typewritten note to Sadie with a Coltrane stamp and Pacific Beach postmark',
  };
  return html.replace('    const mail = [', () => '    const mail = [\n      ' + JSON.stringify(item) + ',');
}

function addConference(html, payload) {
  if (!payload) return html;
  const data = JSON.parse(payload);
  const image = key => 'data:image/webp;base64,' + data[key];
  const item = {
    id: 'waffle-house-conference-2026',
    title: 'Waffle House Conference Mail',
    date: '2026-11-22',
    location: 'Rochester, NY',
    kind: 'envelope',
    envelopeArt: true,
    cover: image('cover'),
    contents: [
      ['Handwritten note', 'note'],
      ['Love Languages Report — page 1', 'inventory'],
      ['Love Languages Report — page 2', 'letter'],
      ['Love Languages Report — page 3', 'profile'],
    ].map(([title, key]) => ({ title, src: image(key) })),
  };
  return html.replace('    const mail = [', () => '    const mail = [\n      ' + JSON.stringify(item) + ',');
}

function addGameChangers(html, payload) {
  if (!payload) return html;
  const data = JSON.parse(payload);
  const item = {
    id: 'game-changers-nov-23-2026',
    kind: 'postcard',
    title: 'Game Changers',
    date: '2026-11-23',
    location: 'Pacific Beach, WA',
    portraitCover: true,
    cover: 'data:image/webp;base64,' + data.front,
    back: 'data:image/webp;base64,' + data.back,
    backAlt: 'Handwritten postcard with a squash stamp and Pacific Beach postmark dated November 23, 2026',
    postalLayers: [
      { kind: 'cancellation', left: 66, top: 9, width: 29, angle: -8, label: 'PACIFIC BEACH, WA · NOV 23 2026' },
      { kind: 'tracking', left: 64, top: 82, width: 29, angle: 0, label: 'ROUTED • 23 NOV 2026' },
    ],
  };
  return html.replace('    const mail = [', () => '    const mail = [\n      ' + JSON.stringify(item) + ',');
}

function addTaiwanTravelogue(html, payload) {
  if (!payload) return html;
  const data = JSON.parse(payload);
  const item = {
    id: 'taiwan-travelogue-nov-24-2026',
    kind: 'postcard',
    title: 'Taiwan Travelogue',
    date: '2026-11-24',
    location: 'Pacific Beach, WA',
    portraitCover: true,
    cover: 'data:image/webp;base64,' + data.front,
    back: 'data:image/webp;base64,' + data.back,
    backAlt: 'Handwritten postcard with a fox stamp and Pacific Beach postmark',
    postalLayers: [
      { kind: 'cancellation', left: 67, top: 10, width: 29, angle: -8, label: 'PACIFIC BEACH, WA · NOV 24 2026' },
      { kind: 'tracking', left: 65, top: 85, width: 29, angle: 0, label: 'ROUTED • 24 NOV 2026' },
    ],
  };
  return html.replace('    const mail = [', () => '    const mail = [\n      ' + JSON.stringify(item) + ',');
}

function withTableControls(html) {
  const start = html.indexOf("    const stage = document.querySelector('.stage');");
  const end = html.indexOf('</script>', start);
  if (start === -1 || end === -1) return html;

  return (html.slice(0, start) + html.slice(end))
    .replace('</style>', `
      .mail-actions { flex-wrap: wrap; gap: .35rem .6rem; }
      .mail-actions .hint { flex-basis: 100%; text-align: center; }
      .tabletop { position: absolute; bottom: max(1rem, env(safe-area-inset-bottom)); z-index: 4; }
      .postcard.conference-envelope { aspect-ratio: 684 / 297; }
      .conference-envelope .envelope-recipient { width: 100%; height: 100%; left: 0; top: 0; border-radius: .5rem; }
      .enclosure-button { display: grid; justify-items: center; gap: .45rem; padding: .6rem; color: inherit; background: #302820; border: 1px solid #766650; border-radius: .5rem; }
      .photo-list.enclosures { grid-template-columns: repeat(auto-fit, minmax(min(100%, 11rem), 1fr)); }
      .photo-list.enclosures img { max-width: 11rem; max-height: 11rem; object-fit: contain; }
      .photo-list.enclosure-detail { justify-items: center; }
      .photo-list.enclosure-detail img { height: auto; }
      .postcard.portrait-view.portrait-postcard { width: min(66vw, 25rem, calc((100svh - 8rem) * .52)); aspect-ratio: 3 / 4; }
      .mail-thumbnail.portrait-postcard { aspect-ratio: 3 / 4; }
      .postcard.portrait-postcard:not(.portrait-view) { aspect-ratio: 4 / 3; }
    </style>`)
    .replace('<button class="action deposit" type="button" hidden>Put in basket</button>',
      '<button class="action deposit" type="button" hidden>Put in basket</button>' +
      '<button class="action return-mail" type="button" hidden>Return to mailbox</button>')
    .replace('</main>', '<button class="action tabletop" type="button" aria-haspopup="dialog" ' +
      'aria-controls="postcards-table" hidden>On the table</button></main>')
    .replace('</body>', `
      <dialog class="table-dialog" id="postcards-table" aria-labelledby="postcards-table-title">
        <header class="dialog-header">
          <h1 id="postcards-table-title">On the table</h1>
          <form method="dialog"><button class="action">Close</button></form>
        </header>
        <div class="archive-content"><ul class="mail-list"></ul></div>
      </dialog>
      <script src="/postcards-runtime/table.js" defer></script>
    </body>`);
}

function sign(key, purpose, data) {
  return createHmac('sha256', key).update(purpose).update('\0').update(data).digest();
}

function authorized(req, key) {
  const token = (req.headers.cookie || '').split(';').map(part => part.trim())
    .find(part => part.startsWith(sessionName + '='));
  const match = token?.slice(sessionName.length + 1).match(/^(\d{10})\.([A-Za-z0-9_-]{43})$/);
  if (!match || Number(match[1]) <= Math.floor(Date.now() / 1000)) return false;
  return timingSafeEqual(Buffer.from(match[2], 'base64url'), sign(key, 'postcards-session', match[1]));
}

function entrance(invalid) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Postcards</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100svh; display: grid; place-items: center; padding: 1.25rem; color: #eee5d7; background: #121212; font: 1rem/1.5 system-ui, sans-serif; }
  main { width: min(100%, 24rem); border: 1px solid #52463a; border-radius: 1rem; padding: 1.75rem; background: #201c18; }
  h1 { margin: 0 0 1.25rem; font: 2rem Georgia, serif; }
  label, input, button { display: block; width: 100%; }
  input, button { font: inherit; padding: .65rem .75rem; border: 1px solid #766650; border-radius: .45rem; color: inherit; }
  input { background: #141210; margin: .35rem 0 .9rem; }
  button { background: #403328; cursor: pointer; }
  :focus-visible { outline: 2px solid #e9d8bd; outline-offset: 3px; }
  p { color: #f5b2a2; }
</style>
</head>
<body>
<main>
<h1>Postcards</h1>
<form action="/postcards" method="post">
<label for="password">Password</label>
<input id="password" name="password" type="password" autocomplete="current-password" autocapitalize="none" required maxlength="128">
${invalid ? '<p role="alert">That password didn’t match. Try again.</p>' : ''}
<button type="submit">Open postcards</button>
</form>
</main>
</body>
</html>`;
}

module.exports = async function postcards(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('X-Postcards-Revision', 'taiwan-travelogue-private-postcard');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  const encodedKey = process.env.POSTCARDS_KEY?.trim() || '';
  const password = process.env.POSTCARDS_PASSWORD || '';
  const validKey = /^[A-Za-z0-9_-]{43}$/.test(encodedKey);
  if (!validKey || !password) {
    console.error('Postcards configuration is incomplete.', {
      key: !encodedKey ? 'missing' : validKey ? 'valid' : 'invalid format',
      password: password ? 'configured' : 'missing',
    });
    return res.status(503).send('Postcards are temporarily unavailable.');
  }
  const key = Buffer.from(encodedKey, 'base64url');
  const liveStore = process.env.VERCEL_ENV === 'production' && Boolean(process.env.BLOB_STORE_ID);
  const installer = new URL(req.url || '/postcards', 'https://www.capsunlocked.com')
    .searchParams.get('install');

  const mailToInstall = Object.hasOwn(privateMail, installer) ? privateMail[installer] : null;
  if (installer === 'quinault' || mailToInstall) {
    if (!authorized(req, key)) return res.status(401).send('Open /postcards and sign in first.');
    if (!liveStore) return res.status(404).end();
    if (req.method === 'POST') return mailToInstall ? installPrivateMail(req, res, mailToInstall) : installQuinault(req, res);
    if (req.method === 'GET') return res.status(200).send(mailToInstall ? privateMailInstaller(mailToInstall) : quinaultInstaller());
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end();
  }

  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? new URLSearchParams(req.body) : null;
    const candidate = body ? body.get('password') : req.body?.password;
    if (typeof candidate !== 'string' || candidate.length > 128 ||
        !timingSafeEqual(sign(key, 'postcards-password', candidate), sign(key, 'postcards-password', password))) {
      return res.status(401).send(entrance(true));
    }

    const expiry = String(Math.floor(Date.now() / 1000) + lifetime);
    const signature = sign(key, 'postcards-session', expiry).toString('base64url');
    res.setHeader('Set-Cookie', `${sessionName}=${expiry}.${signature}; Path=/; Max-Age=${lifetime}; HttpOnly; Secure; SameSite=Strict`);
    res.setHeader('Location', '/postcards');
    return res.status(303).end();
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD, POST');
    return res.status(405).end();
  }

  if (!authorized(req, key)) return res.status(200).send(entrance(false));

  try {
    const encrypted = readFileSync(join(process.cwd(), 'postcards-data', 'postcards.aes'));
    const decipher = createDecipheriv('aes-256-gcm', key, encrypted.subarray(0, 12));
    decipher.setAuthTag(encrypted.subarray(12, 28));
    const html = Buffer.concat([decipher.update(encrypted.subarray(28)), decipher.final()]);
    const quinault = liveStore ? await readQuinault().catch(() => {
      console.error('The private Quinault postcard store could not be read.');
      return null;
    }) : null;
    const [conference, sauna, gameChangers, taiwanTravelogue] = liveStore ? await Promise.all(
      Object.values(privateMail).map(mail => readPrivateMail(mail).catch(() => {
        console.error('Private postcard mail could not be read.');
        return null;
      }))
    ) : [];
    const withExistingMail = addConference(addQuinault(html.toString('utf8'), quinault), conference);
    const withGameChangers = addGameChangers(addSauna(withExistingMail, sauna), gameChangers);
    return res.status(200).send(withTableControls(addTaiwanTravelogue(withGameChangers, taiwanTravelogue)));
  } catch {
    console.error('Postcards payload could not be loaded or authenticated.');
    return res.status(503).send('Postcards are temporarily unavailable.');
  }
};
