'use strict';

const form = document.querySelector('#conference-install');
const status = document.querySelector('#conference-status');
const button = form.querySelector('button');

form.addEventListener('submit', async event => {
  event.preventDefault();
  const [file] = form.querySelector('input').files;
  if (!file || file.size > 1400000) {
    status.textContent = 'Choose the prepared mail file.';
    return;
  }
  button.disabled = true;
  status.textContent = 'Adding the mail…';
  try {
    const response = await fetch(window.location.href, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: await file.text(),
    });
    if (response.ok) window.location.assign('/postcards');
    else status.textContent = await response.text();
  } catch {
    status.textContent = 'The upload did not finish. Check your connection and retry.';
  } finally {
    button.disabled = false;
  }
});
