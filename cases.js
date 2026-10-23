(() => {
  if (window.__textinContentInstalled) return;
  window.__textinContentInstalled = true;
  const listPaths = ['/cases/list', '/news/list'];
  let catalog;
  let cards = [];
  const normalize = value => value.toLocaleLowerCase('en-US').replace(/\s+/g, ' ').trim();
  const scenarios = card => (card.dataset.scenarios || '').split('|').filter(Boolean);
  const state = () => ({
    [catalog.dataset.filterKey]: catalog.querySelector('[data-category-filter][aria-pressed="true"]')?.dataset.categoryFilter || '',
    ...(catalog.querySelector('[data-scenario-filter]') ? { scenario: catalog.querySelector('[data-scenario-filter]').value } : {}),
    product: catalog.querySelector('[data-product-filter]').value,
    q: catalog.querySelector('[data-content-search]').value.trim(),
    sort: catalog.querySelector('[data-content-sort]').value
  });
  function safeReturn(value, fallback) {
    try {
      const url = new URL(value || fallback, location.origin);
      return url.origin === location.origin && listPaths.includes(url.pathname) ? url.pathname + url.search : fallback;
    } catch { return fallback; }
  }
  function closeDropdown(wrapper) {
    wrapper.querySelector('.catalog-select-trigger').setAttribute('aria-expanded', 'false');
    wrapper.querySelector('[role="listbox"]').hidden = true;
  }
  function syncDropdown(select) {
    const wrapper = select.nextElementSibling;
    if (!wrapper?.matches('.catalog-select')) return;
    const label = select.selectedOptions[0].textContent;
    const trigger = wrapper.querySelector('.catalog-select-trigger');
    trigger.textContent = label;
    trigger.setAttribute('aria-label', `${select.getAttribute('aria-label')}: ${label}`);
    wrapper.querySelectorAll('[role="option"]').forEach(option => option.setAttribute('aria-selected', String(option.dataset.value === select.value)));
  }
  // Keep native selects as the data source and no-JavaScript fallback.
  function enhanceDropdown(select, index) {
    const wrapper = document.createElement('div');
    wrapper.className = 'catalog-select';
    const trigger = document.createElement('button');
    trigger.type = 'button'; trigger.className = 'catalog-select-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    const menu = document.createElement('div');
    menu.id = `catalog-select-${index}`; menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-label', select.getAttribute('aria-label')); menu.hidden = true;
    trigger.setAttribute('aria-controls', menu.id);
    const options = [...select.options].map(item => {
      const option = document.createElement('button');
      option.type = 'button'; option.tabIndex = -1; option.setAttribute('role', 'option');
      option.setAttribute('aria-label', item.textContent);
      option.dataset.value = item.value; option.textContent = item.textContent;
      option.addEventListener('click', () => {
        select.value = item.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        closeDropdown(wrapper); trigger.focus();
      });
      menu.appendChild(option);
      return option;
    });
    const open = (index = select.selectedIndex) => {
      menu.hidden = false; trigger.setAttribute('aria-expanded', 'true'); options[index].focus();
    };
    trigger.addEventListener('click', () => menu.hidden ? open() : closeDropdown(wrapper));
    wrapper.addEventListener('keydown', event => {
      const current = options.indexOf(document.activeElement);
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : current < 0 ? select.selectedIndex : (current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
        open(next);
      } else if (event.key === 'Escape') {
        event.preventDefault(); closeDropdown(wrapper); trigger.focus();
      } else if (!menu.hidden && event.key.length === 1 && /\S/.test(event.key)) {
        const match = [...options.slice(current + 1), ...options.slice(0, current + 1)].find(option => option.textContent.toLowerCase().startsWith(event.key.toLowerCase()));
        if (match) {
          event.preventDefault(); match.focus();
        }
      }
    });
    wrapper.addEventListener('focusout', event => { if (!wrapper.contains(event.relatedTarget)) closeDropdown(wrapper); });
    wrapper.append(trigger, menu);
    select.after(wrapper); select.hidden = true;
    syncDropdown(select);
  }
  function filter(updateUrl = true) {
    if (!catalog?.isConnected) return;
    const current = state();
    catalog.querySelectorAll('[data-scenario-filter], [data-product-filter], [data-content-sort]').forEach(syncDropdown);
    const sorted = [...cards];
    if (current.sort !== 'recommended') sorted.sort((a, b) => (current.sort === 'oldest' ? 1 : -1) * a.dataset.date.localeCompare(b.dataset.date));
    let count = 0;
    for (const [index, card] of sorted.entries()) {
      card.hidden = Boolean((current[catalog.dataset.filterKey] && card.dataset.category !== current[catalog.dataset.filterKey]) || (current.scenario && !scenarios(card).includes(current.scenario)) || (current.product && card.dataset.product !== current.product) || (current.q && !normalize(`${card.textContent} ${card.dataset.product} ${card.dataset.category} ${scenarios(card).join(' ')}`).includes(normalize(current.q))));
      if (!card.hidden) count++;
      // Preserve React-owned DOM; layout ordering must not move card nodes.
      card.style.order = index;
    }
    catalog.dataset.filtered = String(Boolean(current[catalog.dataset.filterKey] || current.scenario || current.product || current.q || current.sort !== 'recommended'));
    const noun = catalog.dataset.kind === 'cases' ? (count === 1 ? 'story' : 'stories') : (count === 1 ? 'article' : 'articles');
    catalog.querySelector('[data-result-count]').textContent = `${count} ${noun}`;
    catalog.querySelector('[data-content-empty]').hidden = count !== 0;
    const url = new URL(location.href);
    for (const [key, value] of Object.entries(current)) {
      if (value && !(key === 'sort' && value === 'recommended')) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    if (updateUrl) history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    for (const card of cards) {
      const link = card.querySelector('.content-link');
      const target = new URL(link.href);
      target.searchParams.set('from', url.pathname + url.search);
      link.href = target.pathname + target.search;
    }
  }
  // Mirror DesktopV2: dark heroes stay transparent until a light surface
  // enters the header's blur sampling area. Article pages use the light variant.
  function syncHeader() {
    const header = document.querySelector('#navbar');
    if (!header) return;
    const bounds = header.getBoundingClientRect();
    const surfaces = '.home-body, .collection-body, #footer';
    const margin = location.pathname === '/' ? 45 : 15;
    const probe = document.elementFromPoint(window.innerWidth / 2, Math.min(window.innerHeight - 1, bounds.bottom + 2));
    let onLightContent = Boolean(probe?.closest(surfaces));
    if (location.pathname === '/' || window.innerWidth >= 1260) onLightContent ||= [...document.querySelectorAll(surfaces)].some(surface => {
      const rect = surface.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.top < bounds.bottom + margin && rect.bottom > bounds.top - margin;
    });
    document.documentElement.dataset.headerScrolled = String(window.scrollY > 0);
    document.documentElement.dataset.headerOnLight = String(onLightContent);
  }
  let headerFrame;
  function scheduleHeader() {
    if (headerFrame) return;
    headerFrame = requestAnimationFrame(() => { headerFrame = null; syncHeader(); });
  }
  window.addEventListener('scroll', scheduleHeader, { passive: true });
  window.addEventListener('resize', scheduleHeader, { passive: true });
  function init() {
    syncHeader();
    const footer = document.querySelector('#footer > div');
    if (footer && !footer.querySelector('.footer-copyright')) {
      const copyright = document.createElement('p');
      copyright.className = 'footer-copyright';
      copyright.textContent = `Copyright © ${new Date().getFullYear()} TextIn   All rights reserved.`;
      footer.append(copyright);
    }
    document.querySelectorAll('[data-content-back]').forEach(link => {
      link.href = safeReturn(new URLSearchParams(location.search).get('from'), link.getAttribute('href'));
    });
    catalog = document.querySelector('[data-content-catalog]');
    if (!catalog) return;
    cards = [...catalog.querySelectorAll('.content-card')];
    const params = new URLSearchParams(location.search);
    const filters = catalog.querySelector('[data-category-filters]');
    filters.querySelectorAll('button:not([data-category-filter=""])').forEach(button => button.remove());
    for (const value of new Set(cards.map(card => card.dataset.category))) {
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.categoryFilter = value; button.textContent = value;
      filters.appendChild(button);
    }
    const buttons = [...filters.querySelectorAll('button')];
    const requestedCategory = params.get(catalog.dataset.filterKey) ?? catalog.dataset.defaultCategory;
    const selectedCategory = buttons.some(button => button.dataset.categoryFilter === requestedCategory) ? requestedCategory : '';
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.categoryFilter === selectedCategory)));
    const scenario = catalog.querySelector('[data-scenario-filter]');
    if (scenario) {
      scenario.querySelectorAll('option:not([value=""])').forEach(option => option.remove());
      for (const value of new Set(cards.flatMap(scenarios))) scenario.add(new Option(value, value));
      const requestedScenario = params.get('scenario') ?? catalog.dataset.defaultScenario;
      scenario.value = [...scenario.options].some(option => option.value === requestedScenario) ? requestedScenario : '';
    }
    const product = catalog.querySelector('[data-product-filter]');
    product.querySelectorAll('option:not([value=""])').forEach(option => option.remove());
    for (const value of new Set(cards.map(card => card.dataset.product))) product.add(new Option(value, value));
    const requestedProduct = params.get('product') ?? catalog.dataset.defaultProduct;
    product.value = [...product.options].some(option => option.value === requestedProduct) ? requestedProduct : '';
    const sort = catalog.querySelector('[data-content-sort]');
    const requestedSort = params.get('sort') ?? catalog.dataset.defaultSort;
    sort.value = ['recommended', 'newest', 'oldest'].includes(requestedSort) ? requestedSort : 'recommended';
    catalog.querySelector('[data-content-search]').value = params.get('q') || '';
    catalog.querySelectorAll('.catalog-select').forEach(wrapper => wrapper.remove());
    catalog.querySelectorAll('[data-scenario-filter], [data-product-filter], [data-content-sort]').forEach(enhanceDropdown);
    filter(false);
  }
  // Mintlify links retain compiled hrefs. Use ordinary navigation for dynamic
  // return URLs and explicit list resets, while retaining modified-click behavior.
  document.addEventListener('click', event => {
    const link = event.target.closest('.content-link, [data-content-back], a[href="/cases/list"], a[href="/news/list"]');
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = new URL(link.href);
    if (link.matches('.content-link')) target.searchParams.set('from', location.pathname + location.search);
    else if (link.matches('[data-content-back]')) target.href = new URL(safeReturn(new URLSearchParams(location.search).get('from'), target.pathname), location.origin).href;
    if (target.origin !== location.origin) return;
    event.preventDefault(); event.stopImmediatePropagation();
    location.assign(target.pathname + target.search + target.hash);
  }, true);
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-category-filter], [data-content-reset]');
    if (!button || !catalog?.contains(button)) return;
    if (button.hasAttribute('data-content-reset')) {
      catalog.querySelector('[data-content-search]').value = '';
      catalog.querySelector('[data-product-filter]').value = '';
      catalog.querySelector('[data-content-sort]').value = 'recommended';
      const scenario = catalog.querySelector('[data-scenario-filter]');
      if (scenario) scenario.value = '';
    }
    const category = button.dataset.categoryFilter || '';
    catalog.querySelectorAll('[data-category-filter]').forEach(item => item.setAttribute('aria-pressed', String(item.dataset.categoryFilter === category)));
    filter();
  });
  document.addEventListener('input', event => { if (event.target.matches('[data-content-search]')) filter(); });
  document.addEventListener('change', event => { if (event.target.matches('[data-scenario-filter], [data-product-filter], [data-content-sort]')) filter(); });
  document.addEventListener('pointerdown', event => {
    document.querySelectorAll('.catalog-select').forEach(wrapper => { if (!wrapper.contains(event.target)) closeDropdown(wrapper); });
  });
  const mount = () => requestAnimationFrame(init);
  window.addEventListener('mintlify:navigate', mount);
  window.addEventListener('load', mount, { once: true });
  window.addEventListener('popstate', mount);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
