// Preserve ordinary links, keyboard activation, and opening in a new tab.
(() => {
  let leaving = false;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  window.addEventListener('pageshow', () => {
    leaving = false;
    document.body.classList.remove('news-leaving');
  });
  document.addEventListener('click', event => {
    const link = event.target.closest('a.news-card-link, a.news-home');
    if (!link || event.defaultPrevented || event.button !== 0
      || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
      || link.hasAttribute('download') || (link.target && link.target !== '_self')
      || reducedMotion.matches) return;
    event.preventDefault();
    if (leaving) return;
    leaving = true;
    let navigated = false;
    const navigate = () => {
      if (navigated) return;
      navigated = true;
      window.location.assign(link.href);
    };
    document.body.addEventListener('transitionend', event => {
      if (event.target === document.body && event.propertyName === 'opacity') navigate();
    });
    document.body.classList.add('news-leaving');
    window.setTimeout(navigate, 280);
  });
})();
