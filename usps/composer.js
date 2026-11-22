'use strict';

const byId = id => document.getElementById(id);
const read = id => byId(id).value;
const form = byId('composer');
const files = { photo: null, scan: null, photos: [] };
const formats = { postcard: 'Postcard', envelope: 'Photo envelope', telegram: 'Telegram' };
const pages = { inbox: 'Mailbox', drafts: 'Drafts', sent: 'Sent', basket: 'Basket', compose: 'Compose' };
let mailbox;
let page = 'inbox';
let draftId;
let dirty = false;
let busy = false;
let pendingImages = 0;
let recovery;

function element(tag, text = '', className = '') {
  const item = document.createElement(tag);
  item.textContent = text;
  if (className) item.className = className;
  return item;
}

function message(text = '') {
  byId('notice').textContent = text;
}

function isImage(value) {
  return typeof value === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
}

function attachImage(container, src, alt, position, fit) {
  if (!isImage(src)) return false;
  const img = element('img');
  img.src = src;
  img.alt = alt;
  if (position) img.style.objectPosition = position.map(value => value + '%').join(' ');
  if (fit) img.style.objectFit = fit;
  container.append(img);
  return true;
}

async function request(action, body, id, retry = true) {
  const params = new URLSearchParams({action});
  if (id) params.set('id',id);
  const response = await fetch('/api/usps?' + params, {
    method:body === undefined ? 'GET' : 'POST',
    headers:body === undefined ? {} : {'Content-Type':'application/json'},
    body:body === undefined ? undefined : JSON.stringify(body),
    credentials:'same-origin',
  });
  if (response.status === 401 && retry && !['signin','refresh','signout'].includes(action)) {
    if (!recovery) recovery = request('refresh',{},null,false).finally(() => { recovery = null; });
    try {
      await recovery;
    } catch {
      resetOffice();
      throw Error('Sign in to open the post office.');
    }
    return request(action,body,id,false);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(data.error || 'The post office could not complete that request.');
  return data;
}

function draft() {
  const format = read('format');
  const typed = format === 'telegram' || read('writingMode') === 'typewriter';
  const value = {format, message:typed ? {style:'typewriter',text:read('message')} : {style:'handwritten',image:files.scan}};
  if (format === 'postcard') {
    value.front = {orientation:read('orientation'),fit:read('fit'),
      position:[Number(read('horizontal')),Number(read('vertical'))],image:files.photo};
    value.postmark = read('postmark').trim();
  }
  if (format === 'envelope') value.photos = files.photos;
  return value;
}

function renderLetter(item, target, recipient) {
  const card = element('div','','mock-card');
  if (item.format === 'postcard') {
    const front = item.front || {};
    const art = element('div','','front ' + (front.orientation === 'portrait' ? 'portrait' : 'landscape'));
    const position = Array.isArray(front.position) && front.position.length === 2 &&
      front.position.every(Number.isInteger) ? front.position : null;
    if (!attachImage(art,front.image,'Postcard front',position,front.fit === 'contain' ? 'contain' : 'cover')) {
      art.append(element('span','Choose a front image'));
    }
    card.append(art);
  } else if (item.format === 'envelope') {
    card.append(element('div',recipient ? 'To ' + recipient : 'Photo envelope','envelope'));
  }
  const telegram = item.format === 'telegram';
  const paper = element('div','',telegram ? 'telegram' : 'paper');
  const writing = element('div');
  if (telegram) {
    writing.append(element('h3','TELEGRAM'));
    if (recipient) writing.append(element('p','TO ' + recipient,'writing'));
  }
  const note = item.message || {};
  if (!attachImage(writing,note.image,'Handwritten note')) {
    writing.append(element('p',typeof note.text === 'string' && note.text ? note.text : 'Your message','writing'));
  }
  paper.append(writing);
  if (typeof item.postmark === 'string' && item.postmark) paper.append(element('div',item.postmark,'mark'));
  card.append(paper);
  if (Array.isArray(item.photos) && item.photos.length) {
    const prints = element('div','','prints');
    item.photos.slice(0,8).forEach((photo,index) => attachImage(prints,photo,'Enclosed photo ' + (index+1)));
    card.append(prints);
  }
  target.replaceChildren(card);
}

function renderDraft() {
  const item = draft();
  byId('frontFields').hidden = item.format !== 'postcard';
  byId('positionFields').hidden = !item.front?.image;
  byId('envelopeFields').hidden = item.format !== 'envelope';
  byId('writingChoice').hidden = item.format === 'telegram';
  byId('typedFields').hidden = item.message.style !== 'typewriter';
  byId('scanFields').hidden = item.message.style !== 'handwritten';
  byId('postmarkFields').hidden = item.format !== 'postcard';
  renderLetter(item,byId('preview'),mailbox?.recipient);
}

function loadDraft(item = {},id = crypto.randomUUID()) {
  form.reset();
  draftId = id;
  files.photo = item.front?.image || null;
  files.scan = item.message?.image || null;
  files.photos = item.photos || [];
  byId('format').value = item.format || 'postcard';
  byId('writingMode').value = item.message?.style || 'typewriter';
  byId('message').value = item.message?.text || '';
  byId('orientation').value = item.front?.orientation || 'landscape';
  byId('fit').value = item.front?.fit || 'cover';
  byId('horizontal').value = item.front?.position?.[0] ?? 50;
  byId('vertical').value = item.front?.position?.[1] ?? 50;
  byId('postmark').value = item.postmark || '';
  byId('status').textContent = '';
  dirty = false;
  renderDraft();
}

function choosePage(next) {
  page = next;
  byId('reader').hidden = true;
  byId('reader').querySelector('#read-preview').replaceChildren();
  byId('compose-panel').hidden = next !== 'compose';
  byId('mail-panel').hidden = next === 'compose';
  for (const tab of document.querySelectorAll('[data-page]')) {
    tab.toggleAttribute('aria-current',tab.dataset.page === next);
  }
  if (next === 'compose') renderDraft();
  else renderRows();
}

function actionButton(label,onClick) {
  const button = element('button',label);
  button.type = 'button';
  button.addEventListener('click',() => perform(onClick,button));
  return button;
}

function renderRows() {
  if (!mailbox) return;
  byId('mail-heading').textContent = pages[page];
  const received = page === 'inbox' || page === 'basket';
  const rows = received ? mailbox.deliveries.filter(row => page === 'basket' ? row.filed : !row.filed)
    : mailbox.letters.filter(row => page === 'sent' ? row.sent : !row.sent);
  const list = byId('mail-list');
  if (!rows.length) {
    const empty = { inbox:'No mail in your mailbox.', basket:'Your basket is empty.',
      drafts:'No drafts saved.', sent:'No letters sent.' };
    list.replaceChildren(element('p',empty[page],'hint'));
    return;
  }
  list.replaceChildren(...rows.map(row => {
    const line = element('div','','mail-row');
    const detail = element('div');
    detail.append(element('strong',formats[row.format] || 'Letter'));
    const date = row.delivered || row.sent || row.updated;
    detail.append(element('p',new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(date)),'hint'));
    if (received && !row.opened) detail.append(element('span','New mail','badge'));
    if (page === 'sent' && row.unread) detail.append(element('span','In mailbox','badge'));
    line.append(detail,actionButton(page === 'drafts' ? 'Edit draft' : 'Open',() => openRow(row,received)));
    return line;
  }));
}

async function updateMailbox() {
  mailbox = await request('mailbox');
  const unread = mailbox.deliveries.filter(row => !row.opened).length;
  byId('new-count').textContent = unread ? '('+unread+')' : '';
  byId('account').textContent = 'Signed in as ' + mailbox.me;
  byId('recipient').textContent = 'To ' + mailbox.recipient;
}

async function openRow(row,received) {
  const item = await request('letter',undefined,received ? row.letter : row.id);
  if (page === 'drafts') {
    if (dirty && !confirm('Replace the unsaved draft in the composer?')) return;
    loadDraft(item.draft,item.id);
    choosePage('compose');
    return;
  }
  if (received) {
    await request('open',{id:row.id});
    await updateMailbox();
    renderRows();
  }
  byId('reader').hidden = false;
  byId('reader-title').textContent = formats[row.format] || 'Letter';
  renderLetter(item.draft,byId('read-preview'),received ? mailbox.me : mailbox.recipient);
  const actions = byId('read-actions');
  actions.replaceChildren();
  if (received && !row.filed) {
    actions.append(actionButton('Put in basket',async () => {
      await request('file',{id:row.id});
      await updateMailbox();
      choosePage('inbox');
      message('Letter saved in your basket.');
    }));
  }
  if (!received && !row.unread) {
    actions.append(actionButton('Put back as new mail',async () => {
      if (!confirm('Put this letter back in ' + mailbox.recipient + '’s mailbox as new mail?')) return;
      await request('redeliver',{id:row.id});
      await updateMailbox();
      choosePage('sent');
      message('Letter is back in the mailbox as new mail.');
    }));
  }
  byId('reader-title').scrollIntoView({block:'nearest'});
}

function resetOffice() {
  mailbox = null;
  byId('post-office').hidden = true;
  byId('signout').hidden = true;
  byId('login').hidden = false;
  byId('account').textContent = '';
  byId('mail-list').replaceChildren();
  byId('read-preview').replaceChildren();
  loadDraft();
}

async function showOffice() {
  await updateMailbox();
  byId('login').hidden = true;
  byId('post-office').hidden = false;
  byId('signout').hidden = false;
  loadDraft();
  choosePage('inbox');
}

async function perform(action,button) {
  if (busy) return;
  busy = true;
  const lockComposer = ['save','send'].includes(button?.id);
  if (lockComposer) form.inert = true;
  if (button) button.disabled = true;
  message();
  try {
    await action();
  } catch (error) {
    message(error.message);
  } finally {
    busy = false;
    if (button) button.disabled = false;
    if (lockComposer) form.inert = false;
  }
}

byId('login').addEventListener('submit',event => {
  event.preventDefault();
  perform(async () => {
    const password = read('password');
    byId('password').value = '';
    await request('signin',{email:read('email').trim(),password});
    await showOffice();
  },event.submitter);
});
byId('signout').addEventListener('click',event => perform(async () => {
  await request('signout',{});
  resetOffice();
},event.currentTarget));
for (const tab of document.querySelectorAll('[data-page]')) {
  tab.addEventListener('click',() => perform(async () => {
    await updateMailbox();
    choosePage(tab.dataset.page);
  },tab));
}

form.addEventListener('submit',event => event.preventDefault());
form.addEventListener('input',() => { dirty = true; renderDraft(); });

async function resize(source) {
  const img = new Image();
  img.src = source;
  await img.decode();
  const ratio = Math.min(1,1600 / Math.max(img.naturalWidth,img.naturalHeight));
  const canvas = element('canvas');
  canvas.width = Math.max(1,Math.round(img.naturalWidth * ratio));
  canvas.height = Math.max(1,Math.round(img.naturalHeight * ratio));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(img,0,0,canvas.width,canvas.height);
  for (const quality of [.82,.67,.5,.35]) {
    const jpeg = canvas.toDataURL('image/jpeg',quality);
    if (jpeg.length <= 365000 && isImage(jpeg)) return jpeg;
  }
  throw Error('That image is too large. Choose a smaller copy.');
}

async function localFile(file) {
  if (file.size > 30_000_000 || !file.type.startsWith('image/')) throw Error('Choose an image under 30 MB.');
  const url = URL.createObjectURL(file);
  try { return await resize(url); } finally { URL.revokeObjectURL(url); }
}

for (const id of Object.keys(files)) {
  byId(id).addEventListener('change',async event => {
    const selected = [...event.target.files].slice(0,id === 'photos' ? 8 : 1);
    const currentDraft = draftId;
    const input = event.currentTarget;
    pendingImages++;
    input.disabled = true;
    try {
      const images = [];
      for (const file of selected) images.push(await localFile(file));
      if (currentDraft !== draftId) return;
      files[id] = id === 'photos' ? images : images[0] || null;
      dirty = true;
      renderDraft();
      byId('status').textContent = '';
    } catch {
      byId('status').textContent = 'Could not read that image. Try a smaller JPEG or PNG.';
      input.value = '';
    } finally {
      input.disabled = false;
      pendingImages--;
    }
  });
}

byId('import').addEventListener('change',event => {
  const file = event.currentTarget.files[0];
  event.currentTarget.value = '';
  if (!file || busy) return;
  pendingImages++;
  void perform(async () => {
    try {
      if (dirty && !confirm('Replace the unsaved draft in the composer?')) return;
      if (file.size > 34_000_000) throw Error('Choose a smaller composer draft.');
      const raw = JSON.parse(await file.text());
      if (raw.version !== 1 || !Object.hasOwn(formats,raw.format)) throw Error('Choose a draft exported by Postcards Composer.');
      async function importImage(item) {
        if (!item || typeof item.data !== 'string' || !/^data:image\/(?:jpeg|png|webp|gif|avif|heic);base64,/i.test(item.data)) return null;
        return resize(item.data);
      }
      const photos = [];
      if (raw.format === 'envelope' && Array.isArray(raw.photos)) {
        for (const image of raw.photos.slice(0,8)) {
          const imported = await importImage(image);
          if (imported) photos.push(imported);
        }
      }
      const front = raw.front || {};
      const position = Array.isArray(front.position) && front.position.length === 2 &&
        front.position.every(v => Number.isInteger(v) && v >= 0 && v <= 100) ? front.position : [50,50];
      const item = {
        format:raw.format, photos,
        front:{image:await importImage(front.image),position,
          orientation:front.orientation === 'portrait' ? 'portrait' : 'landscape',
          fit:front.fit === 'contain' ? 'contain' : 'cover'},
        message:raw.message?.style === 'handwritten'
          ? {style:'handwritten',image:await importImage(raw.message.image)}
          : {style:'typewriter',text:String(raw.message?.text || '').slice(0,5000)},
        postmark:String(raw.postmark || '').slice(0,60),
      };
      loadDraft(item);
      dirty = true;
      message('Draft imported.');
    } finally {
      pendingImages--;
    }
  });
});

byId('new-draft').addEventListener('click',() => {
  if (!busy && (!dirty || confirm('Discard the unsaved changes in the composer?'))) loadDraft();
});
byId('save').addEventListener('click',event => perform(async () => {
  if (pendingImages) throw Error('Wait for the images to finish loading.');
  await request('save',{id:draftId,draft:draft()});
  dirty = false;
  message('Draft saved.');
},event.currentTarget));
byId('send').addEventListener('click',event => perform(async () => {
  if (pendingImages) throw Error('Wait for the images to finish loading.');
  const item = draft();
  const hasMessage = item.message.image || item.message.text?.trim();
  if (!(hasMessage || item.front?.image || item.photos?.length)) throw Error('Add a photo or message first.');
  if (!confirm('Send this letter to ' + mailbox.recipient + '?')) return;
  await request('send',{id:draftId,draft:item});
  loadDraft();
  await updateMailbox();
  choosePage('sent');
  message('Letter sent.');
},event.currentTarget));

void perform(showOffice);
