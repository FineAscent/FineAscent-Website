(() => {
  // Chicago is on Central Standard Time for both confirmed event dates.
  const startsAt = Date.parse('2026-11-12T07:00:00-06:00');
  const endsAt = Date.parse('2026-11-13T14:00:00-06:00');
  const timer = document.querySelector('.live-countdown');
  if (!timer) return;
  const section = document.getElementById('section-5');
  const navDot = document.querySelector('.dot[data-target="#section-5"]');
  const status = document.getElementById('live-status');
  const fields = Object.fromEntries(['hours', 'minutes', 'seconds'].map(unit => [unit, timer.querySelector(`[data-countdown="${unit}"]`)]));
  const update = () => {
    const now = Date.now();
    const hidden = now < startsAt;
    if (section.hidden !== hidden) {
      section.hidden = hidden;
      if (navDot) navDot.hidden = hidden;
      document.dispatchEvent(new Event('revealvisibilitychange'));
    }
    // Hold the full 31-hour duration until the scheduled start; never go negative.
    const remaining = Math.max(0, Math.ceil((endsAt - Math.max(now, startsAt)) / 1000));
    const values = { hours: Math.floor(remaining / 3600), minutes: Math.floor(remaining / 60) % 60, seconds: remaining % 60 };
    for (const [unit, value] of Object.entries(values)) fields[unit].textContent = String(value).padStart(2, '0');
    status.textContent = now < startsAt ? 'Countdown begins November 12 at 7 AM CT.' : now < endsAt ? 'Until we go live.' : 'The countdown is complete.';
  };
  update();
  const interval = setInterval(update, 1000);
  document.addEventListener('visibilitychange', update);
  window.addEventListener('pageshow', update);
  window.addEventListener('pagehide', event => { if (!event.persisted) clearInterval(interval); });
})();
