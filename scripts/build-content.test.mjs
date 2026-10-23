import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, cp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildContent } from './build-content.mjs';

const project = fileURLToPath(new URL('../', import.meta.url));
const read = (directory, file) => readFile(path.join(directory, file), 'utf8');
async function fixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'textin-content-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await Promise.all(['content', 'news', 'cases', 'images'].map(folder => mkdir(path.join(directory, folder))));
  await cp(path.join(project, 'templates'), path.join(directory, 'templates'), { recursive: true });
  await cp(path.join(project, 'content/catalog.schema.json'), path.join(directory, 'content/catalog.schema.json'));
  await writeFile(path.join(directory, 'docs.json'), JSON.stringify({ navigation: { groups: [{ group: 'Resources', pages: ['index'] }, { group: 'Journal', pages: [] }, { group: 'Customer stories', pages: [] }] } }));
  await writeFile(path.join(directory, 'images/cover.webp'), 'fixture');
  const article = '---\ntitle: "A new article"\ndescription: "An operator-written summary."\n---\n\n## Authored section\n\nKeep this body unchanged.\n\n<Card title="Learn more" href="https://www.textin.ai/xparse">Official component.</Card>\n';
  await writeFile(path.join(directory, 'news/new-article.mdx'), article);
  const catalog = { siteUrl: 'https://resources.example.com', news: [{ page: 'news/new-article', date: '2026-10-23', category: 'Guides', product: 'xParse', cover: '/images/cover.webp', readMinutes: 4 }], cases: [] };
  const save = () => writeFile(path.join(directory, 'content/catalog.json'), JSON.stringify(catalog));
  await save();
  return { directory, catalog, save, article };
}

test('new operator entry generates static list, home, navigation and native article chrome', async t => {
  const { directory } = await fixture(t);
  const result = await buildContent(directory);
  assert.equal(result.count, 1);
  assert.match(await read(directory, 'news/list.mdx'), /href="\/news\/new-article"/);
  assert.match(await read(directory, 'news/list.mdx'), /A new article/);
  assert.match(await read(directory, 'index.mdx'), /A new article/);
  assert.deepEqual(JSON.parse(await read(directory, 'docs.json')).navigation.groups[1].pages, ['news/new-article']);
  const article = await read(directory, 'news/new-article.mdx');
  assert.match(article, /Guides · xParse · Oct 23, 2026/);
  assert.match(article, /og:image: https:\/\/resources.example.com\/images\/cover.webp/);
  assert.match(article, /Keep this body unchanged\./);
  assert.match(article, /<Card title="Put document AI to work\."/);
  assert.doesNotMatch(article, /<time|<div|<section|<select/);
  assert.deepEqual((await buildContent(directory)).changed, []);
});

test('editing the native title updates both lists without replacing authored content', async t => {
  const { directory } = await fixture(t);
  await buildContent(directory);
  const article = await read(directory, 'news/new-article.mdx');
  await writeFile(path.join(directory, 'news/new-article.mdx'), article.replace('A new article', 'An updated title'));
  await assert.rejects(buildContent(directory, { check: true }), /out of date/);
  await buildContent(directory);
  assert.match(await read(directory, 'news/list.mdx'), /An updated title/);
  assert.match(await read(directory, 'index.mdx'), /An updated title/);
  assert.match(await read(directory, 'news/new-article.mdx'), /sidebarTitle: An updated title/);
  assert.match(await read(directory, 'news/new-article.mdx'), /Keep this body unchanged\./);
});

test('a customer story carries multiple scenarios and its reported metric into the list', async t => {
  const { directory, catalog, save, article } = await fixture(t);
  await writeFile(path.join(directory, 'cases/new-story.mdx'), article.replace('A new article', 'A new customer story'));
  catalog.cases.push({ page: 'cases/new-story', date: '2026-10-23', industry: 'Manufacturing', scenarios: ['Finance automation', 'Trade documentation'], product: 'DocFlow', cover: '/images/cover.webp', customer: 'Example company', metric: { value: '60%', label: 'reported improvement' }, featured: true });
  await save();
  await buildContent(directory);
  const list = await read(directory, 'cases/list.mdx');
  assert.match(list, /data-scenarios="Finance automation\|Trade documentation"/);
  assert.match(list, /data-category="Manufacturing"/);
  assert.match(list, /<strong>60%<\/strong>/);
  assert.match(list, /className="content-customer"><p>Example company<\/p>/);
  assert.ok(list.indexOf('Example company') < list.indexOf('className="content-meta"'));
  assert.deepEqual(JSON.parse(await read(directory, 'docs.json')).navigation.groups[2].pages, ['cases/new-story']);
  assert.match(await read(directory, 'cases/new-story.mdx'), /Back to customer stories/);
  catalog.cases[0].customerLogo = '/images/cover.webp';
  await save();
  await buildContent(directory);
  const withLogo = await read(directory, 'cases/list.mdx');
  assert.match(withLogo, /className="content-customer"><img src="\/images\/cover.webp" alt="" loading="lazy" \/><p>Example company<\/p>/);
  catalog.cases[0].customerLogo = '/images/missing.webp';
  await save();
  await assert.rejects(buildContent(directory), /customer logo image not found/);
  assert.equal(await read(directory, 'cases/list.mdx'), withLogo);
  catalog.cases[0].customerLogo = '/images/../cover.webp';
  await save();
  await assert.rejects(buildContent(directory), /customerLogo must stay inside images/);
});

test('invalid catalog changes never partially rewrite generated pages', async t => {
  const { directory, catalog, save } = await fixture(t);
  await buildContent(directory);
  const baseline = await read(directory, 'news/list.mdx');
  for (const [field, value, message] of [
    ['date', '2026-02-30', /format "date"/],
    ['cover', '/images/missing.webp', /image not found/],
    ['page', 'news/missing', /create the article/],
    ['page', 'cases/new-article', /place this entry/],
    ['page', 'news/../secret', /pattern/]
  ]) {
    const original = catalog.news[0][field];
    catalog.news[0][field] = value;
    await save();
    await assert.rejects(buildContent(directory), message);
    assert.equal(await read(directory, 'news/list.mdx'), baseline);
    catalog.news[0][field] = original;
  }
  catalog.news.push({ ...catalog.news[0] });
  await save();
  await assert.rejects(buildContent(directory), /Duplicate article/);
  assert.equal(await read(directory, 'news/list.mdx'), baseline);
});

test('a story using both products generates separate filter values and readable article metadata', async t => {
  const { directory, catalog, save, article } = await fixture(t);
  await writeFile(path.join(directory, 'cases/securities.mdx'), article);
  catalog.cases.push({ page: 'cases/securities', date: '2026-01-20', industry: 'Financial services', scenarios: ['Enterprise AI'], product: ['xParse', 'DocFlow'], cover: '/images/cover.webp', customer: 'Securities firm', metric: { value: '400+', label: 'AI workflows' } });
  await save();
  await buildContent(directory);
  const list = await read(directory, 'cases/list.mdx');
  assert.match(list, /data-product="xParse &amp; DocFlow" data-products="xParse\|DocFlow"/);
  assert.match(await read(directory, 'cases/securities.mdx'), /Financial services · xParse & DocFlow · Jan 20, 2026/);
  const news = await read(directory, 'news/list.mdx');
  assert.match(news, /data-product="xParse"/);
  assert.doesNotMatch(news, /data-products=/);
  for (const product of [[], ['xParse', 'xParse']]) {
    catalog.cases[0].product = product;
    await save();
    await assert.rejects(buildContent(directory), /content\/catalog.json/);
    assert.equal(await read(directory, 'cases/list.mdx'), list);
  }
});

test('catalog strings are escaped and removing an entry removes all listing references', async t => {
  const { directory, catalog, save } = await fixture(t);
  catalog.news[0].category = 'Guides <script>{danger}</script>';
  await save();
  await buildContent(directory);
  assert.match(await read(directory, 'news/list.mdx'), /&lt;script&gt;&#123;danger&#125;&lt;\/script&gt;/);
  catalog.news = [];
  await save();
  await buildContent(directory);
  assert.doesNotMatch(await read(directory, 'news/list.mdx'), /new-article/);
  assert.doesNotMatch(await read(directory, 'index.mdx'), /new-article/);
  assert.deepEqual(JSON.parse(await read(directory, 'docs.json')).navigation.groups[1].pages, []);
  assert.match(await read(directory, 'news/new-article.mdx'), /Keep this body unchanged\./);
});

test('case pages contain at most five cards and remove obsolete pages without changing news', async t => {
  const { directory, catalog, save, article } = await fixture(t);
  await buildContent(directory);
  const news = await read(directory, 'news/list.mdx');
  const home = await read(directory, 'index.mdx');
  for (let index = 1; index <= 15; index++) {
    const page = `cases/customer-${index}`;
    await writeFile(path.join(directory, `${page}.mdx`), article.replace('A new article', `Customer ${index} story`));
    catalog.cases.push({ page, date: '2026-10-23', industry: index > 9 ? 'Manufacturing' : 'Financial services', scenarios: ['Finance automation'], product: 'DocFlow', cover: '/images/cover.webp', customer: `Customer ${index}`, metric: { value: '60%', label: 'improvement' } });
  }
  await save();
  await buildContent(directory);
  const first = await read(directory, 'cases/list.mdx');
  const second = await read(directory, 'cases/list/2.mdx');
  const third = await read(directory, 'cases/list/3.mdx');
  assert.equal((first.match(/data-content-page=/g) || []).length, 5);
  assert.equal((second.match(/data-content-page=/g) || []).length, 5);
  assert.equal((third.match(/data-content-page=/g) || []).length, 5);
  assert.match(first, /data-content-page="cases\/customer-5"/);
  assert.doesNotMatch(first, /data-content-page="cases\/customer-6"/);
  assert.match(second, /data-content-page="cases\/customer-6"/);
  assert.doesNotMatch(second, /data-content-page="cases\/customer-5"/);
  assert.match(third, /data-content-page="cases\/customer-15"/);
  assert.match(second, /data-initial-page="2"/);
  assert.match(second, /6–10 of 15/);
  assert.match(third, /11–15 of 15/);
  assert.match(first, /Customer 15 story/); // Global search index includes unloaded stories.
  assert.doesNotMatch(first.match(/data-catalog-index="([^"]*)"/)[1], /cover\.webp/);
  assert.ok(JSON.parse(await read(directory, 'docs.json')).navigation.groups[0].pages.includes('cases/list/2'));
  assert.equal(await read(directory, 'news/list.mdx'), news);
  assert.equal(await read(directory, 'index.mdx'), home);
  assert.deepEqual((await buildContent(directory)).changed, []);
  catalog.cases = catalog.cases.slice(0, 5);
  await save();
  await assert.rejects(buildContent(directory, { check: true }), /cases\/list\/2.mdx/);
  await buildContent(directory);
  await assert.rejects(read(directory, 'cases/list/2.mdx'), { code: 'ENOENT' });
  await assert.rejects(read(directory, 'cases/list/3.mdx'), { code: 'ENOENT' });
  assert.ok(!JSON.parse(await read(directory, 'docs.json')).navigation.groups[0].pages.includes('cases/list/2'));
  assert.equal(await read(directory, 'news/list.mdx'), news);
  assert.deepEqual((await buildContent(directory, { check: true })).changed, []);
});

test('journal paginates at five articles, keeps a global index and cleans up reduced page counts', async t => {
  const { directory, catalog, save, article } = await fixture(t);
  await buildContent(directory);
  const cases = await read(directory, 'cases/list.mdx');
  const items = [];
  for (let index = 1; index <= 11; index++) {
    const page = `news/article-${index}`;
    await writeFile(path.join(directory, `${page}.mdx`), article.replace('A new article', `Journal article ${index}`));
    items.push({ page, date: '2026-10-23', category: index > 5 ? 'Research' : 'Guides', product: 'xParse', cover: '/images/cover.webp', readMinutes: 4 });
  }
  for (const count of [5, 6, 11]) {
    catalog.news = items.slice(0, count);
    await save();
    await buildContent(directory);
    const first = await read(directory, 'news/list.mdx');
    assert.equal((first.match(/data-content-page=/g) || []).length, 5);
    assert.doesNotMatch(first, /data-content-page="news\/article-6"/);
    assert.match(first, /aria-label="Journal pagination"/);
    assert.equal(/data-catalog-pagination hidden/.test(first), count === 5);
    const index = first.match(/data-catalog-index="([^"]*)"/)[1];
    assert.match(index, new RegExp(`Journal article ${count}`));
    assert.doesNotMatch(index, /cover\.webp/);
    const pages = JSON.parse(await read(directory, 'docs.json')).navigation.groups[0].pages;
    assert.equal(pages.includes('news/list/2'), count > 5);
    if (count > 5) {
      const second = await read(directory, 'news/list/2.mdx');
      assert.equal((second.match(/data-content-page=/g) || []).length, Math.min(count - 5, 5));
      assert.match(second, /data-content-page="news\/article-6"/);
      assert.doesNotMatch(second, /data-content-page="news\/article-1"/);
      assert.match(first, /Research/); // An unloaded page contributes its category to global filters.
    }
    if (count === 11) assert.equal((await read(directory, 'news/list/3.mdx')).match(/data-content-page=/g).length, 1);
    assert.equal(await read(directory, 'cases/list.mdx'), cases);
    assert.match(await read(directory, 'news/article-1.mdx'), /Keep this body unchanged\./);
    assert.deepEqual((await buildContent(directory, { check: true })).changed, []);
  }
  catalog.news = items.slice(0, 5);
  await save();
  await assert.rejects(buildContent(directory, { check: true }), /news\/list\/3.mdx/);
  await buildContent(directory);
  for (const page of [2, 3]) await assert.rejects(read(directory, `news/list/${page}.mdx`), { code: 'ENOENT' });
  const pages = JSON.parse(await read(directory, 'docs.json')).navigation.groups[0].pages;
  assert.ok(!pages.some(page => /^news\/list\/\d+$/.test(page)));
  catalog.news = [];
  await save();
  await buildContent(directory);
  assert.match(await read(directory, 'news/list.mdx'), /data-page-range>0–0 of 0/);
  assert.equal((await read(directory, 'news/list.mdx')).match(/data-content-page=/g), null);
  assert.deepEqual((await buildContent(directory, { check: true })).changed, []);
});
