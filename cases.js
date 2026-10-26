(() => {
  if (window.__textinContentInstalled) return;
  window.__textinContentInstalled = true;
  const listPaths = ['/cases/list', '/news/list'];
  let catalog;
  let catalogIndex;
  let cards = [];
  let entries = [];
  let currentPage = 1;
  let revision = 0;
  const cardCache = new Map();
  const chunkLoads = new Map();
  const listPath = (kind, page) => `/${kind}/list${page === 1 ? '' : `/${page}`}`;
  const normalize = value => value.toLocaleLowerCase('en-US').replace(/\s+/g, ' ').trim();
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
      return url.origin === location.origin && (listPaths.includes(url.pathname) || /^\/(cases|news)\/list\/(?:[2-9]|[1-9]\d+)$/.test(url.pathname)) ? url.pathname + url.search : fallback;
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
  async function loadChunk(kind, chunk) {
    if (!chunkLoads.has(chunk)) chunkLoads.set(chunk, (async () => {
      const response = await fetch(listPath(kind, chunk));
      if (!response.ok) throw new Error('Unable to load content');
      // A detached template keeps images inert until a selected card is mounted.
      const template = document.createElement('template');
      template.innerHTML = await response.text();
      const loaded = [...template.content.querySelectorAll('[data-catalog-initial] [data-content-page]')];
      if (!loaded.length) throw new Error('Missing content cards');
      for (const card of loaded) cardCache.set(card.dataset.contentPage, card);
    })().catch(error => { chunkLoads.delete(chunk); throw error; }));
    return chunkLoads.get(chunk);
  }
  async function filterCatalog(updateUrl, page) {
    const section = catalog;
    const request = ++revision;
    const current = state();
    const filtered = entries.filter(item => (!current[section.dataset.filterKey] || [item.category].flat().includes(current[section.dataset.filterKey]))
      && (!current.scenario || item.scenarios.includes(current.scenario))
      && (!current.product || item.products.includes(current.product))
      && (!current.q || normalize(item.search).includes(normalize(current.q))));
    if (current.sort !== 'recommended') filtered.sort((a, b) => (current.sort === 'oldest' ? 1 : -1) * a.date.localeCompare(b.date));
    const pageSize = Number(section.dataset.pageSize);
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    currentPage = Math.max(1, Math.min(pages, page));
    const selected = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const url = new URL(location.href);
    url.pathname = listPath(section.dataset.kind, currentPage);
    for (const [key, value] of Object.entries(current)) {
      if (value && !(key === 'sort' && value === 'recommended')) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    if (updateUrl || url.pathname !== location.pathname) history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    section.dataset.filtered = String(Boolean(current[section.dataset.filterKey] || current.scenario || current.product || current.q || current.sort !== 'recommended'));
    const noun = section.dataset.kind === 'cases' ? (filtered.length === 1 ? 'story' : 'stories') : (filtered.length === 1 ? 'article' : 'articles');
    section.querySelector('[data-result-count]').textContent = `${filtered.length} ${noun}`;
    section.querySelector('[data-content-empty]').hidden = filtered.length !== 0;
    const pagination = section.querySelector('[data-catalog-pagination]');
    pagination.hidden = pages <= 1;
    pagination.querySelector('[data-page-range]').textContent = `${filtered.length ? (currentPage - 1) * pageSize + 1 : 0}–${Math.min(currentPage * pageSize, filtered.length)} of ${filtered.length}`;
    pagination.querySelectorAll('[data-catalog-page]').forEach(link => {
      const kind = link.dataset.catalogPage;
      const target = kind === 'previous' ? currentPage - 1 : kind === 'next' ? currentPage + 1 : Number(kind);
      const disabled = target < 1 || target > pages;
      link.hidden = !['previous', 'next'].includes(kind) && target > pages;
      link.setAttribute('aria-disabled', String(disabled));
      link.tabIndex = disabled ? -1 : 0;
      if (kind === String(currentPage)) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
      link.href = listPath(section.dataset.kind, Math.max(1, Math.min(pages, target))) + url.search + '#catalog';
    });
    const initial = section.querySelector('[data-catalog-initial]');
    const results = section.querySelector('[data-catalog-results]');
    const error = section.querySelector('[data-catalog-error]');
    initial.hidden = true; results.hidden = true; error.hidden = true;
    section.setAttribute('aria-busy', 'true');
    try {
      await Promise.all([...new Set(selected.filter(item => !cardCache.has(item.page)).map(item => item.chunk))].map(chunk => loadChunk(section.dataset.kind, chunk)));
      if (request !== revision || catalog !== section || !section.isConnected) return;
      const original = selected.length === cards.length && selected.every((item, index) => item.page === cards[index].dataset.contentPage);
      if (original) initial.hidden = false;
      else {
        results.replaceChildren(...selected.map(item => {
          const source = cardCache.get(item.page);
          if (!source) throw new Error('Missing content card');
          return source.cloneNode(true);
        }));
        results.hidden = selected.length === 0;
      }
      for (const link of (original ? initial : results).querySelectorAll('.content-link')) {
        const target = new URL(link.getAttribute('href'), location.origin);
        target.searchParams.set('from', url.pathname + url.search);
        link.href = target.pathname + target.search;
      }
    } catch {
      if (request === revision && catalog === section && section.isConnected) error.hidden = false;
    } finally {
      if (request === revision && catalog === section) section.setAttribute('aria-busy', 'false');
    }
  }
  function filter(updateUrl = true, page = 1) {
    if (!catalog?.isConnected) return;
    catalog.querySelectorAll('[data-scenario-filter], [data-product-filter], [data-content-sort]').forEach(syncDropdown);
    return filterCatalog(updateUrl, page);
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
    // Article sources use Markdown and native components; apply the shared chrome here.
    const content = document.querySelector('#content');
    if (content) {
      const backLinks = [...content.querySelectorAll('a[href]')].filter(link => listPaths.includes(new URL(link.href).pathname) && /^(?:←\s*)?Back to (journal|customer stories)$/.test(link.textContent.trim()));
      backLinks.forEach((link, index) => {
        link.classList.add('article-back');
        link.setAttribute('data-content-back', '');
        const paragraph = link.closest('p, [data-as="p"]');
        if (index === 0) {
          paragraph?.classList.add('article-back-row');
          paragraph?.nextElementSibling?.classList.add('article-meta-line');
        } else paragraph?.classList.add('article-return');
      });
      const cta = content.querySelector('.card:has(a[href="https://www.textin.ai/contact"])');
      if (cta) {
        cta.classList.add('resource-cta', 'article-cta', 'not-prose');
        cta.querySelector('[data-component-part="card-cta"] button')?.classList.add('site-button');
      }
    }
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
    catalogIndex = catalog?.dataset.catalogIndex;
    revision++;
    if (!catalog) return;
    cards = [...catalog.querySelectorAll('[data-catalog-initial] .content-card')];
    entries = JSON.parse(catalog.dataset.catalogIndex || '[]');
    cardCache.clear(); chunkLoads.clear();
    for (const card of cards) if (card.dataset.contentPage) cardCache.set(card.dataset.contentPage, card);
    const params = new URLSearchParams(location.search);
    const filters = catalog.querySelector('[data-category-filters]');
    filters.querySelectorAll('button:not([data-category-filter=""])').forEach(button => button.remove());
    for (const value of new Set(entries.flatMap(item => item.category))) {
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
      for (const value of new Set(entries.flatMap(item => item.scenarios))) scenario.add(new Option(value, value));
      const requestedScenario = params.get('scenario') ?? catalog.dataset.defaultScenario;
      scenario.value = [...scenario.options].some(option => option.value === requestedScenario) ? requestedScenario : '';
    }
    const product = catalog.querySelector('[data-product-filter]');
    product.querySelectorAll('option:not([value=""])').forEach(option => option.remove());
    for (const value of new Set(entries.flatMap(item => item.products))) product.add(new Option(value, value));
    const requestedProduct = params.get('product') ?? catalog.dataset.defaultProduct;
    product.value = [...product.options].some(option => option.value === requestedProduct) ? requestedProduct : '';
    const sort = catalog.querySelector('[data-content-sort]');
    const requestedSort = params.get('sort') ?? catalog.dataset.defaultSort;
    sort.value = ['recommended', 'newest', 'oldest'].includes(requestedSort) ? requestedSort : 'recommended';
    catalog.querySelector('[data-content-search]').value = params.get('q') || '';
    catalog.querySelectorAll('.catalog-select').forEach(wrapper => wrapper.remove());
    catalog.querySelectorAll('[data-scenario-filter], [data-product-filter], [data-content-sort]').forEach(enhanceDropdown);
    filter(false, Number(location.pathname.match(/^\/(?:cases|news)\/list\/(\d+)$/)?.[1]) || 1);
  }
  // Mintlify links retain compiled hrefs. Use ordinary navigation for dynamic
  // return URLs and explicit list resets, while retaining modified-click behavior.
  document.addEventListener('click', event => {
    const link = event.target.closest('.content-link, [data-content-back], [data-catalog-page], a[href="/cases/list"], a[href="/news/list"]');
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (link.getAttribute('aria-disabled') === 'true') { event.preventDefault(); event.stopImmediatePropagation(); return; }
    const target = new URL(link.href);
    if (link.matches('.content-link')) target.searchParams.set('from', location.pathname + location.search);
    else if (link.matches('[data-content-back]')) target.href = new URL(safeReturn(new URLSearchParams(location.search).get('from'), target.pathname), location.origin).href;
    if (target.origin !== location.origin) return;
    event.preventDefault(); event.stopImmediatePropagation();
    location.assign(target.pathname + target.search + target.hash);
  }, true);
  document.addEventListener('click', event => {
    if (event.target.closest('[data-catalog-retry]')) { filter(false, currentPage); return; }
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
  let mountFrame;
  const mount = () => {
    if (mountFrame) return;
    mountFrame = requestAnimationFrame(() => { mountFrame = null; init(); });
  };
  // Local MDX hot updates can replace the catalog without a navigation event.
  new MutationObserver(() => {
    const next = document.querySelector('[data-content-catalog]');
    if (next !== catalog || next?.dataset.catalogIndex !== catalogIndex) mount();
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-catalog-index'] });
  window.addEventListener('mintlify:navigate', mount);
  window.addEventListener('load', mount, { once: true });
  window.addEventListener('popstate', mount);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
