/* ============================================================
   PodcastForge — Workspace Router
   Turns the workspace into deep-linkable pages (#/agent, #/miner …):
   one tool per view with an animated transition, instead of one long
   scroll. Landing/pricing keep their normal behaviour. Loaded last.
   ============================================================ */
(function () {
  'use strict';

  const ROUTES = ['generator', 'agent', 'discover', 'transcripts', 'studio', 'miner', 'tracker', 'music', 'templates'];
  const DEFAULT_ROUTE = 'generator';

  function parseRoute() {
    const h = location.hash || '';
    const m = h.match(/^#\/([a-z]+)/i);
    return m ? m[1].toLowerCase() : '';
  }

  function inWorkspace() {
    return document.body.classList.contains('workspace-active');
  }

  function setActiveNav(route) {
    document.querySelectorAll('.nav-route').forEach(a => {
      const r = (a.getAttribute('href') || '').replace('#/', '');
      a.classList.toggle('nav-active', r === route);
    });
  }

  function showPage(route) {
    const pages = document.querySelectorAll('.ws-page');
    if (!pages.length) return;
    if (!ROUTES.includes(route)) route = DEFAULT_ROUTE;

    let shown = false;
    pages.forEach(p => {
      const match = p.dataset.route === route;
      p.classList.toggle('ws-active', match);
      if (match) { p.classList.remove('ws-anim'); void p.offsetWidth; p.classList.add('ws-anim'); shown = true; }
    });
    if (!shown) {
      const fallback = document.querySelector(`.ws-page[data-route="${DEFAULT_ROUTE}"]`);
      if (fallback) fallback.classList.add('ws-active', 'ws-anim');
      route = DEFAULT_ROUTE;
    }
    setActiveNav(route);
    // scroll the page area to top (under the fixed nav)
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function onHashChange() {
    if (!inWorkspace()) return;          // landing/pricing handled normally
    const route = parseRoute();
    if (!route) { go(DEFAULT_ROUTE); return; }
    showPage(route);
  }

  // Public: navigate to a workspace route. Switch the page immediately (don't
  // wait for the async hashchange) and update the URL; the hashchange handler
  // re-runs showPage idempotently for back/forward navigation.
  function go(route) {
    const target = ROUTES.includes(route) ? route : DEFAULT_ROUTE;
    if (location.hash !== `#/${target}`) location.hash = `#/${target}`;
    showPage(target);
  }

  window.pfRouter = { go, showPage, DEFAULT_ROUTE };

  window.addEventListener('hashchange', onHashChange);

  // On first load, if we're already in the workspace (returning session),
  // honour the hash or fall back to the default page.
  function boot() {
    if (inWorkspace()) {
      const route = parseRoute() || DEFAULT_ROUTE;
      showPage(route);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
