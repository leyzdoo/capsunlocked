'use strict';

const form = document.querySelector('#quinault-install');
const status = document.querySelector('#quinault-status');
const button = form.querySelector('button');

function asBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const [front, back] = ['front', 'back'].map(side => form.elements[side].files[0]);
  if (!front || !back || front.size > 750000 || back.size > 250000) {
    status.textContent = 'Choose the prepared front and back WebP files.';
    return;
  }

  button.disabled = true;
  status.textContent = 'Adding the postcard…';
  try {
    const response = await fetch('/postcards?install=quinault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ front: await asBase64(front), back: await asBase64(back) }),
    });
    if (!response.ok) {
      status.textContent = await response.text();
      return;
    }
    window.location.assign('/postcards');
  } catch {
    status.textContent = 'The upload did not finish. Check your connection and retry.';
  } finally {
    button.disabled = false;
  }
});
