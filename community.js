// Same content, styling and interaction as the overseas site's CommunityHelp.
(() => {
  if (window.__textinCommunityInstalled) return;
  window.__textinCommunityInstalled = true;
  const root = document.createElement('div');
  root.className = 'community-help';
  const icon = '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="/images/brand/discord.svg#discord-mark" /></svg>';
  const topics = [
    ['API & integration', 'm8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18'],
    ['Product questions', 'M9 9a3 3 0 1 1 4.5 2.6c-1 .6-1.5 1.4-1.5 2.4m0 3v.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'],
    ['Volume pricing', 'M3 8h18M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm2 11h4'],
    ['Partnerships', 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.9M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7-8a4 4 0 0 1 0 8']
  ];
  root.innerHTML = `<section class="community-panel" id="textin-community-help" role="dialog" aria-labelledby="textin-community-title" hidden>
    <header class="community-header"><div class="community-eyebrow">TEXTIN.AI COMMUNITY</div><button type="button" class="community-close" aria-label="Close help"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg></button><h2 id="textin-community-title">Talk to the team</h2><p>Real answers from the people who build TextIn — not a ticket queue.</p></header>
    <div class="community-content"><div class="community-community"><div class="community-communityInfo"><div class="community-communityTitle">${icon}<h3>TextIn on Discord</h3></div><p>1,000 credits on signup. Credits never expire.</p><a class="community-join" href="https://discord.gg/jMhEUyxEa3" target="_blank" rel="noopener noreferrer"><span>Join Discord</span><span class="community-joinArrow" aria-hidden="true">↗</span></a></div><div class="community-scan"><a href="https://discord.gg/pRabr4UjH" target="_blank" rel="noopener noreferrer" aria-label="Join TextIn on Discord"><img src="/images/community/discord-qr.webp" width="104" height="104" alt="Scan to join the TextIn Discord community" fetchpriority="low" /></a><span>Scan to join</span></div></div>
    <div class="community-resources"><h3>What people ask about</h3><ul class="community-topics">${topics.map(([label, path]) => `<li><span class="community-topicIcon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}" /></svg></span><span>${label}</span></li>`).join('')}</ul></div></div>
    <footer class="community-footer">Usually online 10am–6pm GMT+8 · No question too small</footer>
    </section><button type="button" class="community-trigger" aria-expanded="false" aria-haspopup="dialog">${icon}<span>Get help</span></button>`;
  const trigger = root.querySelector('.community-trigger');
  const panel = root.querySelector('.community-panel');
  const closeButton = root.querySelector('.community-close');
  let position;
  let gesture;
  let suppressClick = false;
  let frame;
  let path = location.pathname;
  const headerBottom = () => document.querySelector('#navbar')?.getBoundingClientRect().bottom || 0;
  const bound = ({ x, y }) => ({
    x: Math.max(12, Math.min(x, document.documentElement.clientWidth - trigger.offsetWidth - 12)),
    y: Math.max(headerBottom() + 12, Math.min(y, innerHeight - trigger.offsetHeight - 12))
  });
  function placePanel() {
    if (panel.hidden) return;
    const rect = trigger.getBoundingClientRect();
    const viewportTop = visualViewport?.offsetTop || 0;
    const viewportBottom = viewportTop + (visualViewport?.height || innerHeight);
    const above = Math.max(0, rect.top - Math.max(headerBottom(), viewportTop) - 28);
    const below = Math.max(0, viewportBottom - rect.bottom - 28);
    const height = panel.scrollHeight + panel.offsetHeight - panel.clientHeight;
    const opensAbove = above >= height || (below < height && above >= below);
    panel.dataset.placement = opensAbove ? 'above' : 'below';
    Object.assign(panel.style, {
      left: `${Math.max(16, Math.min(rect.right - panel.offsetWidth, document.documentElement.clientWidth - panel.offsetWidth - 16))}px`,
      top: opensAbove ? 'auto' : `${rect.bottom + 12}px`,
      bottom: opensAbove ? `${innerHeight - rect.top + 12}px` : 'auto',
      maxHeight: `${opensAbove ? above : below}px`
    });
  }
  function close(restoreFocus = false) {
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.removeAttribute('aria-controls');
    if (restoreFocus) trigger.focus({ preventScroll: true });
  }
  function syncSurface() {
    frame = null;
    const rect = trigger.getBoundingClientRect();
    const underneath = document.elementsFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2).find(element => !root.contains(element));
    root.dataset.surface = underneath?.closest('.home-hero, .collection-hero, .resource-cta') ? 'dark' : 'light';
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(syncSurface); };
  const move = value => {
    position = bound(value);
    Object.assign(root.style, { left: `${position.x}px`, top: `${position.y}px`, right: 'auto', bottom: 'auto' });
    schedule(); placePanel();
  };
  trigger.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    const rect = trigger.getBoundingClientRect();
    suppressClick = false;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, moved: false };
    trigger.setPointerCapture(event.pointerId);
  });
  trigger.addEventListener('pointermove', event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const x = event.clientX - gesture.x;
    const y = event.clientY - gesture.y;
    if (!gesture.moved) {
      if (Math.hypot(x, y) < 6) return;
      gesture.moved = suppressClick = true;
      close();
    }
    move({ x: gesture.left + x, y: gesture.top + y });
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) trigger.addEventListener(event, () => { gesture = null; });
  trigger.addEventListener('click', event => {
    if (suppressClick) { suppressClick = false; if (event.detail !== 0) return; }
    if (!panel.hidden) { close(event.detail === 0); return; }
    panel.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    trigger.setAttribute('aria-controls', panel.id);
    placePanel();
    if (event.detail === 0) closeButton.focus({ preventScroll: true });
  });
  closeButton.addEventListener('click', event => close(event.detail === 0));
  document.addEventListener('pointerdown', event => { if (!root.contains(event.target)) close(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) close(true); });
  let touchY = 0;
  panel.addEventListener('touchstart', event => { if (event.touches.length === 1) touchY = event.touches[0].clientY; }, { passive: true });
  panel.addEventListener('touchmove', event => {
    if (event.touches.length !== 1) return;
    event.stopPropagation();
    const delta = event.touches[0].clientY - touchY;
    touchY = event.touches[0].clientY;
    if ((delta > 0 && panel.scrollTop <= 0) || (delta < 0 && panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 1)) {
      if (event.cancelable) event.preventDefault();
    }
  }, { passive: false });
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', () => { gesture = null; if (position) move(position); else { schedule(); placePanel(); } });
  visualViewport?.addEventListener('resize', placePanel);
  visualViewport?.addEventListener('scroll', placePanel);
  const mount = () => {
    if (!document.body) return;
    if (!root.isConnected) document.body.append(root);
    if (path !== location.pathname) { path = location.pathname; close(); }
    schedule();
  };
  new MutationObserver(mount).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('mintlify:navigate', () => { close(); mount(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
