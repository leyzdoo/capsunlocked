'use strict';

const { createDecipheriv, createHmac, timingSafeEqual } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const sessionName = '__Host-postcards';
const lifetime = 7 * 24 * 60 * 60;

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

module.exports = function postcards(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  const encodedKey = process.env.POSTCARDS_KEY || '';
  const password = process.env.POSTCARDS_PASSWORD || '';
  if (!/^[A-Za-z0-9_-]{43}$/.test(encodedKey) || !password) {
    return res.status(503).send('Postcards are temporarily unavailable.');
  }
  const key = Buffer.from(encodedKey, 'base64url');

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
    return res.status(200).send(html);
  } catch {
    return res.status(503).send('Postcards are temporarily unavailable.');
  }
};
