'use strict';

const accessName = '__Host-usps-access';
const refreshName = '__Host-usps-refresh';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const formats = ['postcard', 'envelope', 'telegram'];
const jsonLimit = 3600000;

function cookie(name, value, age) {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${age}; HttpOnly; Secure; SameSite=Strict`;
}

function readCookie(req, name) {
  const value = (req.headers.cookie || '').split(';').map(part => part.trim())
    .find(part => part.startsWith(name + '='));
  try {
    return value ? decodeURIComponent(value.slice(name.length + 1)) : '';
  } catch {
    return '';
  }
}

function isImage(value) {
  return typeof value === 'string' && value.length <= 490000 &&
    /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
}

function normalizeDraft(input) {
  if (!input || !formats.includes(input.format)) return null;
  const format = input.format;
  const message = input.message;
  if (!message) return null;
  const typed = message.style === 'typewriter' && typeof message.text === 'string' &&
    message.text.length <= 5000;
  const handwritten = message.style === 'handwritten' && (message.image === null || isImage(message.image));
  if ((!typed && !handwritten) || (format === 'telegram' && !typed)) return null;
  const output = {format, message: typed ? {style:'typewriter',text:message.text}
    : {style:'handwritten', image:message.image}};

  if (format === 'postcard') {
    const front = input.front;
    if (!front || !['landscape','portrait'].includes(front.orientation) ||
        !['cover','contain'].includes(front.fit) || !Array.isArray(front.position) ||
        front.position.length !== 2 || front.position.some(v => !Number.isInteger(v) || v < 0 || v > 100) ||
        !(front.image === null || isImage(front.image)) ||
        typeof input.postmark !== 'string' || input.postmark.length > 60) return null;
    output.front = {orientation:front.orientation,fit:front.fit,position:front.position,image:front.image};
    output.postmark = input.postmark;
  } else if (format === 'envelope') {
    if (!Array.isArray(input.photos) || input.photos.length > 8 || !input.photos.every(isImage)) return null;
    output.photos = input.photos;
  }
  return Buffer.byteLength(JSON.stringify(output)) <= jsonLimit ? output : null;
}

function backendError(res, status) {
  if (status === 401) return res.status(401).json({error:'Sign in to open the post office.'});
  if (status === 403) return res.status(403).json({error:'This mailbox is invitation only.'});
  return res.status(502).json({error:'The post office could not complete that request.'});
}

module.exports = async function usps(req, res) {
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  const url = process.env.USPS_SUPABASE_URL?.replace(/\/$/,'');
  const publicKey = process.env.USPS_SUPABASE_KEY;
  if (!url || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) || !publicKey) {
    return res.status(503).json({error:'The post office is still being set up.'});
  }
  if (!['GET','POST'].includes(req.method)) return res.status(405).end();
  if (req.method === 'POST' &&
      req.headers.origin !== (process.env.USPS_ORIGIN || 'https://www.capsunlocked.com')) {
    return res.status(403).json({error:'Open the post office from its main address.'});
  }
  if (req.method === 'POST' && Number(req.headers['content-length']) > 3650000) {
    return res.status(413).json({error:'The draft is too large.'});
  }

  const access = readCookie(req,accessName);
  const refresh = readCookie(req,refreshName);
  const action = req.query?.action;
  const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
  async function upstream(path, method = 'GET', value, token = access) {
    const headers = {apikey:publicKey, Accept:'application/json'};
    if (token) headers.Authorization = 'Bearer ' + token;
    if (value !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(url + path, {
      method, headers, body:value === undefined ? undefined : JSON.stringify(value),
      signal:AbortSignal.timeout(12000), redirect:'error',
    });
    return {status:response.status, ok:response.ok, data:await response.json().catch(() => null)};
  }

  try {
    if (req.method === 'POST' && ['signin','refresh'].includes(action)) {
      const signin = action === 'signin';
      if (signin && (typeof body.email !== 'string' || typeof body.password !== 'string' ||
          body.email.length > 254 || body.password.length > 256)) {
        return res.status(400).json({error:'Enter your email address and password.'});
      }
      if (!signin && !refresh) return backendError(res,401);
      const token = await upstream('/auth/v1/token?grant_type=' + (signin ? 'password' : 'refresh_token'),
        'POST', signin ? {email:body.email,password:body.password} : {refresh_token:refresh},'');
      if (!token.ok || !token.data?.access_token || !token.data?.refresh_token) {
        if (token.status === 429) return res.status(429).json({error:'Too many attempts. Try again shortly.'});
        return res.status(401).json({error:signin ? 'That sign-in did not match.' : 'Please sign in again.'});
      }
      const session = token.data;
      if (signin) {
        const membership = await upstream('/rest/v1/rpc/usps_mailbox','POST',{},session.access_token);
        if (!membership.ok) return backendError(res,membership.status);
      }
      res.setHeader('Set-Cookie',[cookie(accessName,session.access_token,session.expires_in),
        cookie(refreshName,session.refresh_token,7*24*60*60)]);
      return res.status(200).json({ok:true});
    }

    if (req.method === 'POST' && action === 'signout') {
      if (access) await upstream('/auth/v1/logout?scope=local','POST',undefined).catch(() => {});
      res.setHeader('Set-Cookie',[cookie(accessName,'',0),cookie(refreshName,'',0)]);
      return res.status(200).json({ok:true});
    }
    if (!access) return backendError(res,401);

    let result;
    if (req.method === 'GET' && action === 'mailbox') {
      result = await upstream('/rest/v1/rpc/usps_mailbox','POST',{});
    } else if (req.method === 'GET' && action === 'letter' && uuid.test(req.query?.id || '')) {
      result = await upstream('/rest/v1/usps_letters?select=id,draft,sent_at&id=eq.' + req.query.id);
      if (result.ok) {
        if (!result.data?.length) return res.status(404).json({error:'That letter was not found.'});
        return res.status(200).json(result.data[0]);
      }
    } else if (req.method === 'POST' && typeof body.id === 'string' && uuid.test(body.id)) {
      if (['save','send'].includes(action)) {
        const draft = normalizeDraft(body.draft);
        if (!draft) return res.status(400).json({error:'Check the draft format and image sizes.'});
        if (action === 'send' && !(draft.message.image || draft.message.text?.trim() ||
            draft.front?.image || draft.photos?.length)) {
          return res.status(400).json({error:'Add a photo or message first.'});
        }
        const path = action === 'send' ? 'usps_send' : 'usps_save_draft';
        result = await upstream('/rest/v1/rpc/' + path,'POST',{p_id:body.id,p_draft:draft});
      } else if (action === 'redeliver') {
        result = await upstream('/rest/v1/rpc/usps_deliver','POST',{p_id:body.id,p_again:true});
      } else if (['open','file'].includes(action)) {
        result = await upstream('/rest/v1/rpc/usps_receive','POST',{p_id:body.id,p_file:action==='file'});
      }
    }
    if (!result) return res.status(404).json({error:'That post office action was not found.'});
    if (!result.ok) return backendError(res,result.status);
    return res.status(200).json(result.data ?? {ok:true});
  } catch {
    return res.status(502).json({error:'The post office could not complete that request.'});
  }
};
