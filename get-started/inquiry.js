(() => {
  const form = document.getElementById('business-inquiry');
  const status = document.getElementById('inquiry-status');
  const panel = document.getElementById('inquiry-panel');
  const success = document.getElementById('inquiry-success');
  const button = form.querySelector('button[type="submit"]');
  const originalButton = button.innerHTML;
  const endpoint = 'https://pkofxkcbdyqcunwjrnnx.supabase.co/functions/v1/business-inquiry';
  let sending = false;
  let requestId;
  let previousPayload;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending || !form.reportValidity()) return;
    const data = new FormData(form);
    const value = key => String(data.get(key) || '').trim();
    const payload = Object.fromEntries(['name', 'email', 'company', 'interest', 'message', 'website'].map(key => [key, value(key)]));
    const snapshot = JSON.stringify(payload);
    if (snapshot !== previousPayload) {
      requestId = crypto.randomUUID();
      previousPayload = snapshot;
    }
    sending = true;
    status.hidden = true;
    form.setAttribute('aria-busy', 'true');
    button.textContent = 'Sending…';
    const controls = Array.from(form.elements);
    controls.forEach(control => { control.disabled = true; });
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, requestId }), signal: AbortSignal.timeout(45000),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok !== true) {
        const messages = {
          rate_limit: 'You’ve sent a few inquiries recently. Please try again later, or email us directly.',
          validation: 'Please check your details and try again.',
          sending: 'Your inquiry is still being processed. Please wait a minute before trying again.',
          expired: 'Please email us directly so we can confirm whether your inquiry arrived.',
        };
        throw new Error(messages[result.error] || 'Your inquiry couldn’t be sent. Please try again, or email us directly.');
      }
      panel.style.minHeight = Math.ceil(form.getBoundingClientRect().height) + 'px';
      form.classList.add('is-complete');
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        await new Promise(resolve => setTimeout(resolve, 240));
      }
      form.hidden = true;
      success.hidden = false;
      panel.style.minHeight = '320px';
      success.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      document.getElementById('success-title').focus({ preventScroll: true });
    } catch (error) {
      status.setAttribute('role', 'alert');
      status.textContent = error instanceof Error && error.name === 'Error' ? error.message
        : 'Your inquiry couldn’t be sent. Please try again, or email us directly.';
      status.hidden = false;
      status.focus({ preventScroll: true });
    } finally {
      sending = false;
      form.removeAttribute('aria-busy');
      controls.forEach(control => { control.disabled = false; });
      button.innerHTML = originalButton;
    }
  });
})();

// Reveal each thought once, keeping the reading order and page geometry intact.
(() => {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (motion.matches || !('IntersectionObserver' in window)) return;
  const elements = document.querySelectorAll(
    '.intro > *, .working-together > h2, .conversation-agenda > li, .inquiry-context, ' +
    '.inquiry-form > .field, .field-row, .inquiry-form > .form-note, ' +
    '.inquiry-form > .button, .inquiry-form > .privacy-note, .inquiry-follow-up'
  );
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-revealed');
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' });
  elements.forEach(element => {
    element.classList.add('scroll-reveal');
    observer.observe(element);
  });
  motion.addEventListener('change', event => {
    if (!event.matches) return;
    observer.disconnect();
    elements.forEach(element => element.classList.add('is-revealed'));
  });
})();
