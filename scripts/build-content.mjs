import { readFile, writeFile, access, mkdir, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { parseDocument } from 'yaml';

const root = fileURLToPath(new URL('../', import.meta.url));
const pageSize = 5;
const listPath = (kind, page) => `/${kind}/list${page === 1 ? '' : `/${page}`}`;
const metadataStart = '{/* content:metadata:start */}';
const metadataEnd = '{/* content:metadata:end */}';
const footerStart = '{/* content:footer:start */}';
const footerEnd = '{/* content:footer:end */}';
const escape = value => String(value).replace(/[&<>"'{}]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '{': '&#123;', '}': '&#125;' }[char]));
const markdown = value => String(value).replace(/[\\`*_[\]{}<>]/g, '\\$&');
const productNames = item => Array.isArray(item.product) ? item.product : [item.product];
const shortDate = date => new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));

export function validateCatalog(catalog, schema) {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const valid = ajv.compile(schema);
  if (!valid(catalog)) throw new Error(`content/catalog.json: ${ajv.errorsText(valid.errors, { separator: '\n' })}`);
  const pages = new Set();
  for (const kind of ['news', 'cases']) {
    if (catalog[kind].filter(item => item.featured).length > 1) throw new Error(`${kind}: only one article can have featured: true.`);
    for (const item of catalog[kind]) {
      if (!item.page.startsWith(`${kind}/`)) throw new Error(`${item.page}: place this entry in ${item.page.split('/')[0]}.`);
      if (pages.has(item.page)) throw new Error(`Duplicate article: ${item.page}`);
      pages.add(item.page);
      for (const field of ['cover', 'customerLogo']) {
        if (item[field]?.split('/').includes('..')) throw new Error(`${item.page}: ${field} must stay inside images/.`);
      }
      if (item.scenarios?.some(value => value.includes('|'))) throw new Error(`${item.page}: put each use case in its own array item; do not use |.`);
    }
  }
}

function renderCard(article, home = false) {
  const { item, title, description } = article;
  const kind = item.page.split('/')[0];
  const category = item.category || item.industry;
  const featured = item.featured && !home;
  const bottom = kind === 'news'
    ? `<span className="read-time">${item.readMinutes} min read</span>`
    : `<div className="content-metric"><strong>${escape(item.metric.value)}</strong><span>${escape(item.metric.label)}</span></div>`;
  return `<div role="article" className="content-card${featured ? ' content-card--featured' : ''}"${!home ? ` data-content-page="${item.page}"` : ''} data-category="${escape(category)}" data-product="${escape(productNames(item).join(' & '))}"${Array.isArray(item.product) ? ` data-products="${escape(item.product.join('|'))}"` : ''} data-date="${item.date}"${item.scenarios ? ` data-scenarios="${escape(item.scenarios.join('|'))}"` : ''}>
  <a className="${home ? 'home-article-link' : 'content-link'}" href="/${item.page}">
    <div className="content-visual"><img src="${escape(item.cover)}" alt="" loading="${featured ? 'eager' : 'lazy'}" /></div>
    <div className="content-copy">
      ${item.customer ? `<div className="content-customer">${item.customerLogo ? `<img src="${escape(item.customerLogo)}" alt="" loading="lazy" />` : ''}<p>${escape(item.customer)}</p></div>\n      ` : ''}<div className="content-meta"><span>${escape(category)}</span><span className="content-date">${shortDate(item.date)}</span></div>
      <h2>${escape(title)}</h2>
      <p className="content-summary">${escape(description)}</p>
      <div className="content-bottom">${bottom}</div>
    </div>
  </a>
</div>`;
}

function pagination(kind, page, total) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const link = (label, target, key) => `<a href="${listPath(kind, Math.max(1, Math.min(pages, target)))}#catalog" data-catalog-page="${key}"${target < 1 || target > pages ? ' aria-disabled="true" tabIndex="-1"' : ''}${key === String(page) ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<div role="navigation" className="catalog-pagination" aria-label="${kind === 'news' ? 'Journal' : 'Customer stories'} pagination" data-catalog-pagination${pages === 1 ? ' hidden' : ''}><p data-page-range>${total ? (page - 1) * pageSize + 1 : 0}–${Math.min(page * pageSize, total)} of ${total}</p><div>${link('Previous', page - 1, 'previous')}${Array.from({ length: pages }, (_, index) => link(String(index + 1), index + 1, String(index + 1))).join('')}${link('Next', page + 1, 'next')}</div></div>`;
}

async function readArticle(directory, item, siteUrl) {
  const file = `${item.page}.mdx`;
  let source;
  try { source = await readFile(path.join(directory, file), 'utf8'); }
  catch { throw new Error(`${file}: create the article in Mintlify before adding it to content/catalog.json.`); }
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error(`${file}: missing page frontmatter.`);
  const document = parseDocument(match[1]);
  if (document.errors.length) throw new Error(`${file}: ${document.errors[0].message}`);
  const data = document.toJS();
  for (const key of ['title', 'description']) {
    if (typeof data?.[key] !== 'string' || !data[key].trim()) throw new Error(`${file}: add a ${key} in the page editor.`);
  }
  try { await access(path.join(directory, item.cover.slice(1))); }
  catch { throw new Error(`${item.page}: cover image not found: ${item.cover}`); }
  if (item.customerLogo) {
    try { await access(path.join(directory, item.customerLogo.slice(1))); }
    catch { throw new Error(`${item.page}: customer logo image not found: ${item.customerLogo}`); }
  }
  const kind = item.page.split('/')[0];
  const label = kind === 'news' ? 'journal' : 'customer stories';
  const metadata = `${metadataStart}\n[Back to ${label}](/${kind}/list)\n\n${[item.category || item.industry, productNames(item).join(' & '), shortDate(item.date)].map(markdown).join(' · ')}\n${metadataEnd}`;
  let body = source.slice(match[0].length).trim();
  if (!body) throw new Error(`${file}: add the article body before listing it.`);
  const start = body.indexOf(metadataStart);
  const end = body.indexOf(metadataEnd);
  if ((start < 0) !== (end < 0) || (start >= 0 && end < start)) throw new Error(`${file}: damaged generated metadata markers.`);
  body = start < 0 ? `${metadata}\n\n${body}` : body.slice(0, start) + metadata + body.slice(end + metadataEnd.length);
  const footer = `${footerStart}\n[Back to ${label}](/${kind}/list)\n\n<Card title="Put document AI to work." href="https://www.textin.ai/contact" cta="Talk to our team" />\n${footerEnd}`;
  const footerIndex = body.indexOf(footerStart);
  const footerLast = body.indexOf(footerEnd);
  if ((footerIndex < 0) !== (footerLast < 0) || (footerIndex >= 0 && footerLast < footerIndex)) throw new Error(`${file}: damaged generated footer markers.`);
  body = footerIndex < 0 ? `${body}\n\n${footer}` : body.slice(0, footerIndex) + footer + body.slice(footerLast + footerEnd.length);
  // Only update generated fields. Preserve the author's YAML style and article body.
  document.set('mode', 'center');
  document.set('hideFooterPagination', true);
  document.set('timestamp', false);
  document.set('sidebarTitle', item.customer || data.title);
  document.set('og:image', new URL(item.cover, siteUrl).href);
  const updated = `---\n${document.toString({ lineWidth: 0 })}---\n\n${body}\n`;
  return { item, title: data.title, description: data.description, file, source: updated };
}

export async function buildContent(directory = root, { check = false } = {}) {
  const read = file => readFile(path.join(directory, file), 'utf8');
  const catalog = JSON.parse(await read('content/catalog.json'));
  const schema = JSON.parse(await read('content/catalog.schema.json'));
  validateCatalog(catalog, schema);
  const articles = {};
  for (const kind of ['news', 'cases']) articles[kind] = await Promise.all(catalog[kind].map(item => readArticle(directory, item, catalog.siteUrl)));
  const output = new Map();
  for (const kind of ['news', 'cases']) {
    const template = await read(`templates/${kind}-list.mdx`);
    if (!template.includes('{{CARDS}}') || !template.includes('{{COUNT}}')) throw new Error(`templates/${kind}-list.mdx: missing CARDS or COUNT placeholder.`);
    const entries = articles[kind].map(({ item, title, description }, index) => ({
      page: item.page, category: item.category || item.industry, products: productNames(item), scenarios: item.scenarios || [], date: item.date,
      search: [item.customer, item.category || item.industry, title, description, item.metric?.value, item.metric?.label, ...productNames(item), ...(item.scenarios || []), kind === 'news' ? `${item.readMinutes} min read` : ''].filter(value => value !== undefined && value !== '').join(' '),
      chunk: Math.floor(index / pageSize) + 1
    }));
    for (let page = 1; page <= Math.max(1, Math.ceil(entries.length / pageSize)); page++) {
      const file = page === 1 ? `${kind}/list.mdx` : `${kind}/list/${page}.mdx`;
      const source = template.replace('{{CARDS}}', articles[kind].slice((page - 1) * pageSize, page * pageSize).map(article => renderCard(article)).join('\n\n'))
        .replaceAll('{{COUNT}}', String(entries.length)).replace('{{INDEX}}', escape(JSON.stringify(entries)))
        .replace('{{PAGE_SIZE}}', String(pageSize)).replace('{{PAGE}}', String(page)).replace('{{PAGINATION}}', pagination(kind, page, entries.length));
      output.set(file, source);
    }
    for (const article of articles[kind]) output.set(article.file, article.source);
  }
  const latest = [...articles.news].sort((a, b) => b.item.date.localeCompare(a.item.date)).slice(0, 3);
  const home = await read('templates/index.mdx');
  if (!home.includes('{{CARDS}}')) throw new Error('templates/index.mdx: missing CARDS placeholder.');
  output.set('index.mdx', home.replace('{{CARDS}}', latest.map(article => renderCard(article, true)).join('\n\n')));
  const docs = JSON.parse(await read('docs.json'));
  const groups = docs.navigation?.groups;
  if (!Array.isArray(groups)) throw new Error('docs.json: navigation.groups is required.');
  for (const [kind, label] of [['news', 'Journal'], ['cases', 'Customer stories']]) {
    const group = groups.find(item => item.group === label);
    if (!group) throw new Error(`docs.json: missing ${label} navigation group.`);
    group.pages = articles[kind].map(article => article.item.page);
  }
  const resources = groups.find(item => item.group === 'Resources');
  resources.pages = resources.pages.filter(page => !/^(cases|news)\/list\/\d+$/.test(page));
  resources.pages.push(...[...output.keys()].filter(file => /^(cases|news)\/list\/\d+\.mdx$/.test(file)).map(file => file.slice(0, -4)));
  output.set('docs.json', JSON.stringify(docs, null, 2) + '\n');
  const changed = [];
  for (const [file, source] of output) {
    const original = await read(file).catch(() => '');
    if (original !== source) changed.push(file);
  }
  const stale = (await Promise.all(['news', 'cases'].map(async kind => (await readdir(path.join(directory, `${kind}/list`)).catch(() => [])).filter(file => /^\d+\.mdx$/.test(file) && !output.has(`${kind}/list/${file}`)).map(file => `${kind}/list/${file}`)))).flat();
  if (check && (changed.length || stale.length)) throw new Error(`Generated content is out of date. Run npm run content:build.\n${[...changed, ...stale].join('\n')}`);
  // Resolve and validate every input before changing any output.
  if (!check) {
    for (const file of changed) {
      await mkdir(path.dirname(path.join(directory, file)), { recursive: true });
      await writeFile(path.join(directory, file), output.get(file));
    }
    for (const file of stale) await unlink(path.join(directory, file));
  }
  return { changed: [...changed, ...stale], count: articles.news.length + articles.cases.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await buildContent(root, { check: process.argv.includes('--check') });
    console.log(`${result.count} articles checked; ${result.changed.length} generated files updated.`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
