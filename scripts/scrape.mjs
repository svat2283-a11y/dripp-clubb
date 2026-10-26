// Builds data/catalog.json from the public Prom shop. Node 20+, no dependencies.
import { writeFile, mkdir } from 'node:fs/promises';

const BASE = 'https://cs4123958.prom.ua';
const UA = 'Mozilla/5.0 (compatible; DrippClubbSiteBot/1.0)';
const CONCURRENCY = 6;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(path, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(BASE + path, { headers: { 'user-agent': UA, 'accept-language': 'uk' } });
      if (r.status === 404) return null;
      if (r.ok) return await r.text();
    } catch {}
    await sleep(1500 * (i + 1));
  }
  throw new Error('fetch failed: ' + path);
}

const decode = (s) =>
  s.replace(/&#34;|&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&')
   .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim();

const num = (s) => {
  const v = parseFloat(String(s).replace(/[^\d,.]/g, '').replace(',', '.'));
  return Number.isFinite(v) ? v : null;
};

const img = (id, size = 640) => `https://images.prom.ua/${id}_w${size}_h${size}_dripp.jpg`;

function parseGroups(html) {
  const out = [];
  const re = /<a[^>]*class="b-product-groups-gallery__image-link"[^>]*href="\/ua\/g(\d+)-([^"]+)"[\s\S]*?<img[^>]*src="https:\/\/images\.prom\.ua\/(\d+)_[^"]*"[\s\S]*?class="b-product-groups-gallery__title"[^>]*>([^<]+)</g;
  let m;
  while ((m = re.exec(html))) out.push({ id: m[1], slug: m[2], img: img(m[3], 640), name: decode(m[4]) });
  if (out.length) return out;
  // fallback: titles only
  const re2 = /class="b-product-groups-gallery__title"[^>]*href="\/ua\/g(\d+)-([^"]+)"[^>]*>([^<]+)</g;
  while ((m = re2.exec(html))) out.push({ id: m[1], slug: m[2], img: null, name: decode(m[3]) });
  return out;
}

function parseCards(html) {
  const cards = [];
  const parts = html.split('data-qaid="product-block"').slice(1);
  for (const p of parts) {
    const id = (p.match(/data-product-id="(\d+)"/) || p.match(/\/p(\d+)-/) || [])[1];
    const href = (p.match(/href="(\/ua\/p\d+[^"]*\.html)"/) || [])[1];
    const name = (p.match(/class="b-product-gallery__title"[^>]*>([^<]+)</) || [])[1];
    const price = (p.match(/b-product-gallery__current-price">([^<]+)</) || [])[1];
    const old = (p.match(/b-product-gallery__old-price">([^<]+)</) || [])[1];
    const imgId = (p.match(/images\.prom\.ua\/(\d+)_/) || [])[1];
    const avail = /state_val_avail|state_val_order/.test(p);
    if (id && name) {
      cards.push({
        id, name: decode(name), url: BASE + href, price: num(price), priceFrom: /від|от/.test(price || ''),
        oldPrice: old ? num(old) : null, avail, imgs: imgId ? [imgId] : [],
      });
    }
  }
  return cards;
}

async function pool(items, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (i < items.length) { const k = i++; await fn(items[k], k); }
  }));
}

function cleanDesc(html) {
  return html
    .replace(/<(script|style|iframe)[\s\S]*?<\/\1>/gi, '')
    .replace(/<(\/?)(p|ul|ol|li|strong|b|em|br)\b[^>]*>/gi, '<$1$2>')
    .replace(/<(?!\/?(p|ul|ol|li|strong|b|em|br)>)[^>]+>/gi, '')
    .replace(/\s+/g, ' ').trim();
}

async function enrich(prod) {
  const html = await get(prod.url.replace(BASE, ''));
  if (!html) return;
  const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (ld) {
    try {
      const d = JSON.parse(ld[1]);
      if (d['@type'] === 'Product') {
        if (d.offers?.price) prod.price = num(d.offers.price);
        if (d.offers?.availability) prod.avail = /InStock|PreOrder/.test(d.offers.availability);
      }
    } catch {}
  }
  const main = prod.imgs[0];
  const thumbs = [...html.matchAll(/images\.prom\.ua\/(\d+)_w159_h159/g)].map((m) => m[1]);
  prod.imgs = [...new Set([main, ...thumbs].filter(Boolean))].slice(0, 8);
  const desc = html.match(/data-qaid="product_description">([\s\S]*?)<\/div>/);
  if (desc) prod.desc = cleanDesc(desc[1]).slice(0, 4000);
}

async function main() {
  const root = await get('/ua/product_list');
  const groups = parseGroups(root);
  if (!groups.length) throw new Error('no groups found');
  const products = new Map();

  for (const g of groups) {
    g.count = 0;
    for (let page = 1; page < 60; page++) {
      const html = await get(`/ua/g${g.id}-${g.slug}${page > 1 ? '/page_' + page : ''}`);
      if (!html) break;
      const cards = parseCards(html);
      if (!cards.length) break;
      let fresh = 0;
      for (const c of cards) {
        if (!products.has(c.id)) { products.set(c.id, { ...c, group: g.id }); fresh++; }
        g.count++;
      }
      if (!fresh) break;
      await sleep(300);
    }
    console.log(`${g.name}: ${g.count}`);
  }

  const list = [...products.values()];
  let done = 0;
  await pool(list, async (p) => { await enrich(p); if (++done % 50 === 0) console.log(`details ${done}/${list.length}`); });

  const desc = {};
  for (const p of list) {
    p.imgs = p.imgs.map((id) => img(id));
    if (p.desc) desc[p.id] = p.desc;
    delete p.desc;
  }
  const catalog = { updated: new Date().toISOString(), shop: BASE, groups, products: list };
  // sanity check: never overwrite a good catalog with an empty scrape
  if (list.length < 50) throw new Error('too few products: ' + list.length);
  await mkdir(new URL('../data/', import.meta.url), { recursive: true });
  await writeFile(new URL('../data/catalog.json', import.meta.url), JSON.stringify(catalog));
  await writeFile(new URL('../data/desc.json', import.meta.url), JSON.stringify(desc));
  console.log(`saved ${list.length} products, ${groups.length} groups`);
}

main().catch((e) => { console.error(e); process.exit(1); });
