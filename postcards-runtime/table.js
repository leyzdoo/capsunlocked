    const stage = document.querySelector('.stage');
    const card = stage.querySelector('.postcard');
    const front = card.querySelector('.front');
    const back = card.querySelector('.back');
    const envelope = card.querySelector('.envelope');
    const envelopeRecipient = card.querySelector('.envelope-recipient');
    const envelopePostmark = card.querySelector('.envelope-postmark');
    const hint = stage.querySelector('.hint');
    const deposit = stage.querySelector('.deposit');
    const returnToMailbox = stage.querySelector('.return-mail');
    const tabletop = document.querySelector('.tabletop');
    const tableDialog = document.querySelector('.table-dialog');
    const status = document.querySelector('.status');
    const mailbox = document.querySelector('.mailbox');
    const mailboxCount = mailbox.querySelector('.mailbox-count');
    const inbox = document.querySelector('.inbox');
    const basket = document.querySelector('.basket');
    const basketImage = basket.querySelector('img');
    const archive = document.querySelector('.archive');
    const empty = archive.querySelector('.empty');
    const list = archive.querySelector('.mail-list');
    const photos = document.querySelector('.photos');
    const photoList = photos.querySelector('.photo-list');

    function loadIds(key) {
      try {
        const ids = JSON.parse(localStorage.getItem(key) || '[]');
        return new Set(Array.isArray(ids) ? ids : []);
      } catch {
        return new Set();
      }
    }

    function storeIds(key, ids) {
      try {
        localStorage.setItem(key, JSON.stringify([...ids]));
      } catch {
        // Keep the state in memory when browser storage is unavailable.
      }
    }

    const placementKey = 'capsunlocked.postcards.placement.v1';
    const locations = new Set(['mailbox', 'table', 'basket']);

    function loadPlacement() {
      try {
        const stored = localStorage.getItem(placementKey);
        if (stored) {
          const placements = JSON.parse(stored);
          return new Map(mail.flatMap(item => locations.has(placements?.[item.id])
            ? [[item.id, placements[item.id]]] : []));
        }
      } catch {
        // Continue with the previous browser-local filing history.
      }
      const filed = loadIds(basketKey);
      return new Map(mail.filter(item => filed.has(item.id)).map(item => [item.id, 'basket']));
    }

    let placements = loadPlacement();
    let opened = loadIds(openedKey);

    function locationOf(item) {
      return placements.get(item.id) || 'mailbox';
    }

    function move(item, location) {
      placements.set(item.id, location);
      try {
        localStorage.setItem(placementKey, JSON.stringify(Object.fromEntries(placements)));
      } catch {
        // The current view still works if browser storage is unavailable.
      }
    }

    let current;
    let turns = 0;
    let filing = false;

    function setArtwork(image, src, alt, crop, scanSize, portrait = false) {
      image.alt = alt;
      image.removeAttribute('style');
      image.style.width = '100%';
      image.style.height = '100%';
      if (crop) {
        const [x, y, width, height] = crop;
        const [scanWidth, scanHeight] = scanSize;
        if (portrait) {
          image.style.width = `${100 * scanWidth / height}%`;
          image.style.height = `${100 * scanHeight / width}%`;
          image.style.left = `${100 * (y + height) / height}%`;
          image.style.top = `${-100 * x / width}%`;
          image.style.transformOrigin = 'top left';
          image.style.transform = 'rotate(90deg)';
        } else {
          image.style.width = `${100 * scanWidth / width}%`;
          image.style.height = `${100 * scanHeight / height}%`;
          image.style.left = `${-100 * x / width}%`;
          image.style.top = `${-100 * y / height}%`;
        }
      }
      image.src = src;
    }

    function renderPostalLayers(layers = []) {
      back.querySelectorAll('.postal-layer').forEach(layer => layer.remove());
      for (const layer of layers) {
        const stamp = document.createElement('span');
        stamp.className = 'postal-layer ' + layer.kind;
        stamp.style.left = `${layer.left}%`;
        stamp.style.top = `${layer.top}%`;
        stamp.style.width = `${layer.width}%`;
        stamp.style.setProperty('--stamp-angle', `${layer.angle || 0}deg`);
        stamp.setAttribute('aria-hidden', 'true');

        if (layer.kind === 'tracking') {
          const bars = document.createElement('span');
          bars.className = 'tracking-bars';
          stamp.append(bars, layer.label);
        } else if (layer.kind === 'cancellation') {
          const ring = document.createElement('span');
          ring.className = 'cancellation-ring';
          ring.textContent = layer.label;
          const bars = document.createElement('span');
          bars.className = 'cancellation-bars';
          stamp.append(ring, bars);
        } else {
          const image = new Image();
          image.src = layer.src;
          image.alt = '';
          image.draggable = false;
          stamp.append(image);
        }
        back.append(stamp);
      }
    }

    function unfiledMail() {
      return mail.filter(item => locationOf(item) === 'mailbox');
    }

    function refreshMailbox() {
      const unread = unfiledMail().filter(item => !opened.has(item.id)).length;
      const onTable = mail.filter(item => locationOf(item) === 'table').length;
      tabletop.hidden = onTable === 0;
      tabletop.textContent = `On the table (${onTable})`;
      mailboxCount.hidden = unread === 0;
      mailboxCount.textContent = unread;
      mailbox.classList.toggle('has-new', unread > 0);
      mailbox.setAttribute('aria-label', unread ? `Check mail, ${unread} new` : 'Check mail');
    }

    function renderMail(item) {
      current = item;
      stage.hidden = !item;
      status.hidden = Boolean(item);
      status.textContent = unfiledMail().length
        ? 'Check the mailbox for your postcards.'
        : mail.some(item => locationOf(item) === 'table')
          ? 'Choose a postcard from the table.'
          : 'Open the basket to reread your postcards.';
      if (!item) return;

      opened.add(item.id);
      storeIds(openedKey, opened);
      refreshMailbox();

      const isEnvelope = item.kind === 'envelope';
      turns = 0;
      card.classList.remove('is-close');
      card.classList.toggle('portrait-view', Boolean(item.portraitCover));
      card.classList.toggle('portrait-postcard', Boolean(item.portraitCover));
      card.classList.toggle('conference-envelope', Boolean(item.envelopeArt));
      card.style.removeProperty('--turn');
      card.setAttribute('aria-label', item.title + (item.contents ? '. Open envelope' : '. Bring closer'));
      front.hidden = isEnvelope;
      front.setAttribute('aria-hidden', String(isEnvelope));
      if (!isEnvelope) {
        setArtwork(front.querySelector('img'), item.cover, item.title, item.coverCrop, item.scanSize, item.portraitCover);
      }
      back.hidden = isEnvelope;
      back.setAttribute('aria-hidden', 'true');
      if (!isEnvelope) {
        const description = item.backAlt || 'Handwritten postcard from ' + item.location;
        setArtwork(back.querySelector('img'), item.back, description, item.backCrop, item.scanSize);
        renderPostalLayers(item.postalLayers);
      }
      envelope.hidden = !isEnvelope;
      if (isEnvelope) {
        envelopeRecipient.src = item.envelopeArt ? item.cover : recipient;
        envelopePostmark.hidden = !item.postmark;
        if (item.postmark) envelopePostmark.src = item.postmark;
      }
      hint.textContent = item.contents ? 'Open envelope' : 'Bring closer';
      deposit.hidden = false;
      returnToMailbox.hidden = false;
    }

    function openPhotos(item) {
      photoList.className = 'photo-list';
      photos.querySelector('h1').textContent = 'Photos';
      photos.querySelector('form button').textContent = 'Close';
      photoList.replaceChildren(...item.photos.map(photo => {
        const image = new Image();
        image.src = photo.src;
        image.alt = photo.alt;
        return image;
      }));
      photos.showModal();
    }

    function openEnclosures(item) {
      const heading = photos.querySelector('h1');
      const close = photos.querySelector('form button');
      function showContents(focusIndex) {
        heading.textContent = 'Inside the envelope';
        close.textContent = 'Back to envelope';
        photoList.className = 'photo-list enclosures';
        photoList.replaceChildren(...item.contents.map((entry, index) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'enclosure-button';
          const preview = new Image();
          preview.src = entry.src;
          preview.alt = '';
          button.append(preview, entry.title);
          button.addEventListener('click', () => {
            heading.textContent = entry.title;
            photoList.className = 'photo-list enclosure-detail';
            const backToContents = document.createElement('button');
            backToContents.type = 'button';
            backToContents.className = 'action';
            backToContents.textContent = 'Back to contents';
            backToContents.addEventListener('click', () => showContents(index));
            const page = new Image();
            page.src = entry.src;
            page.alt = entry.title;
            photoList.replaceChildren(backToContents, page);
            photos.scrollTop = 0;
            backToContents.focus();
          });
          return button;
        }));
        if (focusIndex !== undefined) photoList.children[focusIndex].focus();
      }
      showContents();
      photos.showModal();
    }

    card.addEventListener('click', () => {
      if (filing || !current) return;
      if (current.contents) {
        openEnclosures(current);
        return;
      }
      const isEnvelope = current.kind === 'envelope';
      if (!card.classList.contains('is-close')) {
        card.classList.add('is-close');
        hint.textContent = isEnvelope ? 'Open envelope' : 'Flip to read';
        card.setAttribute('aria-label', current.title + '. ' + hint.textContent);
        deposit.hidden = false;
        return;
      }

      if (isEnvelope) {
        openPhotos(current);
        return;
      }

      turns += 1;
      const showBack = turns % 2 === 1;
      card.classList.toggle('portrait-view', Boolean(current.portraitCover) && !showBack);
      card.style.setProperty('--turn', `${180 * turns}deg`);
      front.setAttribute('aria-hidden', String(showBack));
      back.setAttribute('aria-hidden', String(!showBack));
      hint.textContent = showBack ? 'Flip to front' : 'Flip to read';
      card.setAttribute('aria-label', (showBack ? 'Postcard back. ' : 'Postcard front. ') + hint.textContent);
    });

    async function flyToBasket() {
      if (reduceMotion.matches || !card.animate) return;
      const from = card.getBoundingClientRect();
      const target = basketImage.getBoundingClientRect();
      const dx = target.left + target.width * .5 - (from.left + from.width * .5);
      const dy = target.top + target.height * .52 - (from.top + from.height * .5);
      const scale = Math.min(.3, target.width * .65 / card.offsetWidth);
      const movement = card.animate([
        { transform: getComputedStyle(card).transform, opacity: 1 },
        { transform: `translate(${dx * .8}px, ${dy - target.height * .34}px) rotate(-11deg) scale(${scale * 1.25})`,
          opacity: 1, offset: .75 },
        { transform: `translate(${dx}px, ${dy + target.height * .17}px) rotate(-7deg) scale(${scale})`, opacity: 0 },
      ], { duration: 790, easing: 'cubic-bezier(.27,.65,.36,1)', fill: 'forwards' });
      try {
        await movement.finished;
      } catch {
        // Filing is already recorded if the browser interrupts the animation.
      } finally {
        stage.hidden = true;
        movement.cancel();
      }
    }

    returnToMailbox.addEventListener('click', () => {
      if (filing || !current) return;
      move(current, 'mailbox');
      opened.delete(current.id);
      storeIds(openedKey, opened);
      const url = new URL(location.href);
      if (url.searchParams.get('mail') === current.id) {
        url.searchParams.delete('mail');
        history.replaceState(history.state, '', url);
      }
      renderMail();
      refreshMailbox();
      status.textContent = 'Postcard returned to the mailbox.';
      mailbox.focus();
    });

    deposit.addEventListener('click', async () => {
      if (filing || !current) return;
      filing = true;
      move(current, 'basket');

      returnToMailbox.disabled = true;
      deposit.disabled = true;
      basket.disabled = true;
      mailbox.disabled = true;
      try {
        await flyToBasket();
      } finally {
        filing = false;
        deposit.disabled = false;
        returnToMailbox.disabled = false;
        basket.disabled = false;
        mailbox.disabled = false;
        refreshMailbox();
        renderMail();
        if (unfiledMail().length) {
          mailbox.focus();
        } else {
          basket.focus();
        }
      }
    });

    function mailRow(item, dialog, unread) {
      const row = document.createElement('li');
      const button = document.createElement('button');
      button.className = 'mail-row';
      button.type = 'button';
      const thumbnail = document.createElement('span');
      thumbnail.className = item.portraitCover ? 'mail-thumbnail portrait-view' : 'mail-thumbnail';
      thumbnail.classList.toggle('portrait-postcard', Boolean(item.portraitCover));
      const image = new Image();
      image.loading = 'lazy';
      setArtwork(image, item.cover, '', item.coverCrop, item.scanSize, item.portraitCover);
      thumbnail.append(image);
      const details = document.createElement('span');
      const title = document.createElement('strong');
      title.textContent = item.title;
      const date = document.createElement('time');
      date.dateTime = item.date;
      date.textContent = formatter.format(new Date(item.date));
      const location = document.createElement('span');
      location.className = 'location';
      location.textContent = item.location;
      const open = document.createElement('span');
      open.className = 'open-label';
      open.textContent = unread ? 'New' : 'Open';
      open.classList.toggle('unread', unread);
      details.append(title, date, location);
      button.append(thumbnail, details, open);
      button.addEventListener('click', () => {
        dialog.close();
        move(item, 'table');
        renderMail(item);
        card.focus();
      });
      row.append(button);
      return row;
    }

    mailbox.addEventListener('click', () => {
      const waiting = unfiledMail();
      inbox.querySelector('.empty').hidden = waiting.length !== 0;
      inbox.querySelector('.mail-list').replaceChildren(
        ...waiting.map(item => mailRow(item, inbox, !opened.has(item.id)))
      );
      inbox.showModal();
    });

    basket.addEventListener('click', () => {
      const filed = mail.filter(item => locationOf(item) === 'basket');
      empty.hidden = filed.length !== 0;
      list.replaceChildren(...filed.map(item => mailRow(item, archive, false)));
      archive.showModal();
    });

    tabletop.addEventListener('click', () => {
      const cards = mail.filter(item => locationOf(item) === 'table');
      tableDialog.querySelector('.mail-list').replaceChildren(
        ...cards.map(item => mailRow(item, tableDialog, false)));
      tableDialog.showModal();
    });

    window.addEventListener('storage', event => {
      if (event.key !== null && event.key !== placementKey && event.key !== openedKey) return;
      placements = loadPlacement();
      opened = loadIds(openedKey);
      if (current && locationOf(current) !== 'table') renderMail();
      refreshMailbox();
    });

    const requested = new URLSearchParams(location.search).get('mail');
    const requestedItem = mail.find(item => item.id === requested);
    if (requestedItem) move(requestedItem, 'table');
    renderMail(requestedItem || mail.find(item => locationOf(item) === 'table'));
    refreshMailbox();
