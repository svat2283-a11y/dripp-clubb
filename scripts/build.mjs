// Generates the static site into dist/ from data/catalog.json + data/desc.json.
import { readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const cfg = JSON.parse(await readFile(new URL('site.config.json', root), 'utf8'));
const cat = JSON.parse(await readFile(new URL('data/catalog.json', root), 'utf8'));
const desc = JSON.parse(await readFile(new URL('data/desc.json', root), 'utf8'));

const SITE = cfg.siteUrl.replace(/\/$/, '');
const BASE = new URL(SITE + '/').pathname; // "/dripp-clubb/" or "/" on a custom domain
const OUT = new URL('dist/', root);
const VER = Date.now().toString(36);
const TITLE = 'Dripp_Clubb';

// ---------- helpers ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (p) => (p.priceFrom ? 'від ' : '') + Math.round(p.price).toLocaleString('uk-UA').replace(/[\u00a0,]/g, ' ') + ' ₴';
const thumb = (u, s = 320) => u.replace(/_w\d+_h\d+_/, `_w${s}_h${s}_`);
const plain = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s);
const TR = { а:'a',б:'b',в:'v',г:'h',ґ:'g',д:'d',е:'e',є:'ie',ж:'zh',з:'z',и:'y',і:'i',ї:'i',й:'i',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'shch',ь:'',ю:'iu',я:'ia',ы:'y',э:'e',ё:'e',ъ:'' };
const slugify = (s) => String(s).toLowerCase().split('').map((c) => TR[c] ?? c).join('')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70).replace(/-+$/, '');
const url = (p) => BASE + p; // site-relative href
const abs = (p) => SITE + '/' + p;
const arrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const BRANDS = ['Oakley', 'Crocs', 'Nike', 'Panasonic', 'Dynamic', 'Eternal Ink', 'Casio', 'Supreme', 'Stussy', 'Carhartt', 'Patagonia', 'Vivienne Westwood', 'Birkenstock', 'Ralph Lauren', 'C.P. Company', 'Skeace', 'Ed Hardy', 'Corteiz', 'Spirit', 'Ambition'];
const brandOf = (name) => BRANDS.find((b) => name.toLowerCase().includes(b.toLowerCase()));

// ---------- data shaping ----------
for (const g of cat.groups) g.path = `c/${g.slug}/`;
for (const p of cat.products) p.path = `p/${p.id}-${slugify(p.name)}/`;
const groupById = new Map(cat.groups.map((g) => [g.id, g]));
const byNew = [...cat.products].sort((a, b) => b.id.localeCompare(a.id));
const availFirst = (list) => [...list.filter((p) => p.avail), ...list.filter((p) => !p.avail)];
const availCount = cat.products.filter((p) => p.avail).length;

// ---------- templates ----------
const card = (p) => `
<a class="card" href="${url(p.path)}">
  <div class="card__img">
    <img src="${esc(thumb(p.imgs[0] || ''))}" alt="${esc(p.name)}" loading="lazy" width="320" height="320">
    ${p.imgs[1] ? `<img src="${esc(thumb(p.imgs[1]))}" alt="" loading="lazy" aria-hidden="true">` : ''}
    ${p.avail ? '' : '<span class="badge badge--out">Немає в наявності</span>'}
  </div>
  <div class="card__body">
    <div class="card__name">${esc(p.name)}</div>
    <div class="card__foot"><span class="price">${money(p)}</span><span class="card__go">${arrow}</span></div>
  </div>
</a>`;

function layout({ title, description, path, image, body, jsonld = [], noindex = false }) {
  const canonical = abs(path);
  const ld = [
    { '@context': 'https://schema.org', '@type': 'Organization', name: TITLE, url: SITE + '/', logo: abs('assets/logo.jpg'), telephone: cfg.phone, email: cfg.email,
      address: { '@type': 'PostalAddress', addressLocality: cfg.city, addressCountry: 'UA' } },
    ...jsonld,
  ];
  return `<!doctype html>
<html lang="uk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${esc(canonical)}">`}
<meta name="theme-color" content="#b86c48">
<meta property="og:site_name" content="${TITLE}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(image || abs('assets/hero.jpg'))}">
<meta property="og:locale" content="uk_UA">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${url('assets/icon-192.png')}">
<link rel="apple-touch-icon" href="${url('assets/icon-192.png')}">
<link rel="manifest" href="${url('manifest.webmanifest')}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://images.prom.ua">
<link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@500;700;800&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${url('assets/styles.css?v=' + VER)}">
${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('\n')}
<script>window.SITE=${JSON.stringify({ base: BASE, endpoint: cfg.orderEndpoint, mono: !!(cfg.orderEndpoint && cfg.monoEnabled), phone: cfg.phone, phoneText: cfg.phoneText })}</script>
</head>
<body>
<a class="skip" href="#main">До вмісту</a>
<header class="hdr" id="hdr">
  <div class="wrap hdr__in">
    <a class="brand" href="${url('')}" aria-label="${TITLE} — на головну"><img src="${url('assets/logo.jpg')}" alt="" width="40" height="40"><span>Dripp<em>_</em>Clubb</span></a>
    <nav class="nav" aria-label="Основне меню">
      <a href="${url('catalog/')}">Каталог</a>
      <a href="${url('catalog/?sort=new')}">Новинки</a>
      <a href="${url('info/')}">Доставка й оплата</a>
      <a href="${url('info/#faq')}">FAQ</a>
    </nav>
    <form class="search" action="${url('catalog/')}" role="search">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input name="q" type="search" placeholder="Пошук: oakley, crocs, CR2032…" aria-label="Пошук товарів" autocomplete="off">
    </form>
    <a class="btn btn--ghost hdr__tel" href="tel:${cfg.phone}">${esc(cfg.phoneText)}</a>
    <button class="cartbtn" type="button" data-cart-open aria-label="Кошик"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12l-1 13H7z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg><span class="cartbtn__n" data-cart-count hidden>0</span></button>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="ftr">
  <div class="wrap ftr__grid">
    <div>
      <a class="brand brand--light" href="${url('')}"><img src="${url('assets/logo.jpg')}" alt="" width="40" height="40"><span>Dripp<em>_</em>Clubb</span></a>
      <p class="muted">Окуляри, крокси, одяг, тату, вело. ${esc(cfg.city)} — відправляємо по всій Україні.</p>
    </div>
    <div>
      <h4>Каталог</h4>
      ${[...cat.groups].sort((a, b) => b.count - a.count).slice(0, 8).map((g) => `<a href="${url(g.path)}">${esc(g.name)}</a>`).join('')}
    </div>
    <div>
      <h4>Покупцям</h4>
      <a href="${url('info/')}">Доставка й оплата</a>
      <a href="${url('info/#returns')}">Повернення та обмін</a>
      <a href="${url('info/#faq')}">Питання та відповіді</a>
      <a href="${esc(cat.shop)}/ua/testimonials" target="_blank" rel="noopener">Відгуки покупців</a>
    </div>
    <div>
      <h4>Контакти</h4>
      <a href="tel:${cfg.phone}">${esc(cfg.phoneText)}</a>
      <a href="mailto:${esc(cfg.email)}">${esc(cfg.email)}</a>
      <span class="muted">${esc(cfg.city)}, Україна</span>
    </div>
  </div>
  <div class="wrap ftr__bottom muted">© ${new Date().getFullYear()} ${TITLE} · Каталог оновлено ${new Date(cat.updated).toLocaleDateString('uk-UA')}</div>
</footer>
<nav class="tabbar" aria-label="Мобільне меню">
  <a href="${url('')}" data-tab="home"><svg viewBox="0 0 24 24"><path d="M3 11 12 4l9 7v9H4z"/></svg>Головна</a>
  <a href="${url('catalog/')}" data-tab="catalog"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/></svg>Каталог</a>
  <button type="button" data-cart-open><svg viewBox="0 0 24 24"><path d="M6 7h12l-1 13H7z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>Кошик<span class="cartbtn__n" data-cart-count hidden>0</span></button>
  <a href="tel:${cfg.phone}"><svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/></svg>Дзвінок</a>
</nav>
<div class="drawer" id="cart" hidden>
  <div class="drawer__bg" data-cart-close></div>
  <aside class="drawer__panel" role="dialog" aria-modal="true" aria-labelledby="cartTitle">
    <div class="drawer__head"><h2 id="cartTitle">Кошик</h2><button class="x" type="button" data-cart-close aria-label="Закрити">×</button></div>
    <div class="drawer__body" id="cartBody"></div>
  </aside>
</div>
<script src="${url('assets/app.js?v=' + VER)}" defer></script>
</body>
</html>`;
}

const sec = (title, link, inner) => `
<section class="sec">
  <div class="sec__head"><h2>${title}</h2>${link || ''}</div>
  ${inner}
</section>`;

function homePage() {
  const groups = [...cat.groups].sort((a, b) => b.count - a.count);
  const tattoo = cat.products.filter((p) => p.avail && p.group === '148022537').slice(0, 10);
  const body = `
<div class="wrap">
  <section class="hero">
    <div class="hero__body">
      <span class="pill"><i></i>${esc(cfg.city)} · доставка по Україні</span>
      <h1>Dripp<span>_</span>Clubb</h1>
      <p>Окуляри Oakley, крокси, одяг, тату-фарби, вело та батарейки Panasonic для ключів авто. Понад ${Math.floor(availCount / 100) * 100} товарів у наявності.</p>
      <div class="hero__cta">
        <a class="btn btn--light" href="${url('catalog/')}">Перейти в каталог ${arrow}</a>
        <a class="btn btn--ghost btn--onclay" href="${url('catalog/?sort=new')}">Новинки</a>
      </div>
    </div>
  </section>
  <div class="stats">
    <div class="stat"><b>230+</b><span>відгуків покупців</span></div>
    <div class="stat"><b>${cat.products.length}</b><span>товарів у каталозі</span></div>
    <div class="stat"><b>Mono / Приват</b><span>оплата на картку</span></div>
    <div class="stat"><b>НП</b><span>доставка по всій Україні</span></div>
  </div>
  ${sec('Категорії', `<a href="${url('catalog/')}">Усі товари →</a>`, `<div class="cats">
    ${groups.map((g, i) => `<a class="cat ${i < 2 ? 'cat--big' : ''}" href="${url(g.path)}"><img src="${esc(g.img)}" alt="" loading="lazy"><span>${esc(g.name)} <small>${g.count}</small></span></a>`).join('')}
    <a class="cat cat--all" href="${url('catalog/')}"><b>Усі товари</b><small>${cat.products.length} позицій →</small></a>
  </div>`)}
  ${sec('Новинки', `<a href="${url('catalog/?sort=new')}">Дивитись усі →</a>`, `<div class="rail">${byNew.filter((p) => p.avail).slice(0, 12).map(card).join('')}</div>`)}
  <section class="sec"><div class="trust">
    <div class="tile tile--sage"><span class="ico">✓</span><div><h3>Підкажемо з вибором</h3><p>Допоможемо з розміром і моделлю, надішлемо додаткові фото.</p></div></div>
    <div class="tile tile--sky"><span class="ico">⚡</span><div><h3>Швидка відправка</h3><p>Новою Поштою або Укрпоштою після підтвердження замовлення. ТТН — одразу вам.</p></div></div>
    <div class="tile tile--cream"><span class="ico">★</span><div><h3>230+ відгуків</h3><p>Реальні відгуки наших покупців. <a href="${esc(cat.shop)}/ua/testimonials" target="_blank" rel="noopener" style="text-decoration:underline">Почитати</a></p></div></div>
  </div></section>
  ${tattoo.length ? sec('Для тату-майстрів', `<a href="${url(groupById.get('148022537').path)}">Усе для тату →</a>`, `<div class="rail">${tattoo.map(card).join('')}</div>`) : ''}
  <section class="band">
    <h2>Не знаєте, яка батарейка підійде до <span>ключа авто?</span></h2>
    <div class="band__cta">
      <a class="btn btn--clay" href="tel:${cfg.phone}">Зателефонувати</a>
      ${groupById.get('158039269') ? `<a class="btn btn--light" href="${url(groupById.get('158039269').path)}">Батарейки ${arrow}</a>` : ''}
    </div>
  </section>
</div>`;
  return layout({
    title: `${TITLE} — окуляри, крокси, одяг, тату, вело | ${cfg.city}`,
    description: `${TITLE} — інтернет-магазин зі Львова: окуляри Oakley, крокси, одяг, тату-фарби Dynamic та Eternal, вело, батарейки Panasonic для ключів авто. 230+ відгуків, доставка по Україні.`,
    path: '', body,
    jsonld: [{ '@context': 'https://schema.org', '@type': 'WebSite', name: TITLE, url: SITE + '/',
      potentialAction: { '@type': 'SearchAction', target: abs('catalog/?q={q}'), 'query-input': 'required name=q' } }],
  });
}

function listingPage({ title, h1, description, path, products, group, intro }) {
  const list = availFirst(products);
  const crumbs = [{ name: 'Головна', path: '' }, { name: 'Каталог', path: 'catalog/' }, ...(group ? [{ name: group.name, path: group.path }] : [])];
  const body = `
<div class="wrap">
  <nav class="crumbs" aria-label="Навігація">${crumbs.map((c, i) => i < crumbs.length - 1 ? `<a href="${url(c.path)}">${esc(c.name)}</a>` : `<span>${esc(c.name)}</span>`).join('<span>/</span>')}</nav>
  <div class="page-title"><h1>${esc(h1)}</h1>${intro ? `<p class="muted">${esc(intro)}</p>` : ''}</div>
  <div class="toolbar" data-catalog data-group="${group ? group.id : ''}">
    <div class="chips" role="group" aria-label="Категорії">
      <a class="chip" href="${url('catalog/')}" ${group ? '' : 'aria-current="page"'}>Усі</a>
      ${cat.groups.map((g) => `<a class="chip" href="${url(g.path)}" ${group && g.id === group.id ? 'aria-current="page"' : ''}>${esc(g.name)}</a>`).join('')}
    </div>
    <div class="filters">
      <select data-f="sort" aria-label="Сортування"><option value="pop">Популярні</option><option value="new">Спочатку нові</option><option value="asc">Дешевші</option><option value="desc">Дорожчі</option></select>
      <input data-f="min" type="number" inputmode="numeric" placeholder="Ціна від" aria-label="Ціна від">
      <input data-f="max" type="number" inputmode="numeric" placeholder="до" aria-label="Ціна до">
      <label class="toggle"><input data-f="stock" type="checkbox" checked> Тільки в наявності</label>
      <span class="count" data-count>${list.filter((p) => p.avail).length} товарів</span>
    </div>
  </div>
  <div class="grid" id="grid">${list.filter((p) => p.avail).slice(0, group ? 500 : 48).map(card).join('')}</div>
  <div class="more"><button class="btn btn--ink" id="more" type="button" hidden>Показати ще</button></div>
</div>`;
  return layout({
    title, description, path, body, image: group?.img,
    jsonld: [breadcrumbLd(crumbs), { '@context': 'https://schema.org', '@type': 'ItemList',
      itemListElement: list.slice(0, 50).map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(p.path) })) }],
  });
}

const breadcrumbLd = (crumbs) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: abs(c.path) })) });

const RETURN_POLICY = { '@type': 'MerchantReturnPolicy', applicableCountry: 'UA', returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted' };

function productPage(p) {
  const g = groupById.get(p.group);
  const d = desc[p.id] || '';
  const text = plain(d);
  const similar = cat.products.filter((x) => x.group === p.group && x.id !== p.id && x.avail).slice(0, 12);
  const crumbs = [{ name: 'Головна', path: '' }, { name: 'Каталог', path: 'catalog/' }, ...(g ? [{ name: g.name, path: g.path }] : []), { name: p.name, path: p.path }];
  const brand = brandOf(p.name);
  const item = { id: p.id, name: p.name, price: p.price, img: thumb(p.imgs[0] || '', 160), path: p.path };
  const body = `
<div class="wrap">
  <nav class="crumbs" aria-label="Навігація">${crumbs.slice(0, -1).map((c) => `<a href="${url(c.path)}">${esc(c.name)}</a>`).join('<span>/</span>')}</nav>
  <div class="pdp">
    <div class="gallery">
      <div class="gallery__main"><img id="mainImg" src="${esc(thumb(p.imgs[0] || '', 640))}" alt="${esc(p.name)}" width="640" height="640"></div>
      ${p.imgs.length > 1 ? `<div class="thumbs">${p.imgs.map((u, i) => `<button type="button" aria-label="Фото ${i + 1}" aria-current="${i === 0}" data-src="${esc(thumb(u, 640))}"><img src="${esc(thumb(u, 160))}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
    </div>
    <div class="pdp__info">
      <span class="${p.avail ? 'stock' : 'stock stock--out'}">${p.avail ? '● В наявності' : 'Немає в наявності'}</span>
      <h1>${esc(p.name)}</h1>
      <div class="pdp__price"><span class="price">${money(p)}</span></div>
      <div class="buy" data-product='${esc(JSON.stringify(item))}'>
        ${p.avail ? `<button class="btn btn--clay" type="button" data-buy-now>Купити в 1 клік ${arrow}</button>
        <button class="btn btn--ghost" type="button" data-add>Додати в кошик</button>` : `<a class="btn btn--ink" href="tel:${cfg.phone}">Уточнити наявність</a>`}
      </div>
      <div class="perks">
        <div class="perk"><b>🚚</b>Нова Пошта / Укрпошта по всій Україні</div>
        <div class="perk"><b>💳</b>Оплата на картку Mono / Приват</div>
        <div class="perk perk--warn"><b>⚠️</b>Повернення та обміну немає — перевіряйте товар на пошті</div>
      </div>
      ${d ? `<div class="desc"><h2 class="desc__t">Опис</h2>${d}</div>` : ''}
    </div>
  </div>
  ${similar.length ? sec('Схожі товари', g ? `<a href="${url(g.path)}">Усі →</a>` : '', `<div class="rail">${similar.map(card).join('')}</div>`) : ''}
</div>`;
  return layout({
    title: `${p.name} — купити за ${money(p)} | ${TITLE}`,
    description: clip(text || `${p.name}. Доставка по Україні.`, 155),
    path: p.path, image: thumb(p.imgs[0] || '', 640), body,
    jsonld: [breadcrumbLd(crumbs), {
      '@context': 'https://schema.org', '@type': 'Product', name: p.name, sku: p.id, image: p.imgs.map((u) => thumb(u, 640)),
      description: clip(text, 4900) || p.name, ...(brand ? { brand: { '@type': 'Brand', name: brand } } : {}),
      offers: { '@type': 'Offer', url: abs(p.path), priceCurrency: 'UAH', price: p.price.toFixed(2),
        availability: p.avail ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        seller: { '@type': 'Organization', name: TITLE }, hasMerchantReturnPolicy: RETURN_POLICY },
    }],
  });
}

const FAQ = [
  ['Як швидко ви відправляєте?', 'Одразу після підтвердження замовлення (і надходження оплати, якщо обрано оплату на картку). Номер ТТН повідомляємо вам.'],
  ['Як підібрати батарейку для ключа авто?', 'Відкрийте ключ і подивіться маркування старої батарейки — CR2032, CR2025, CR2016, CR1620 або CR1632. Або напишіть марку, модель і рік авто — підкажемо.'],
  ['Чи є оптові ціни?', 'Так, на частину товарів. Для великого замовлення зателефонуйте — розрахуємо індивідуально.'],
  ['Чи можна повернути або обміняти товар?', 'Ні, повернення та обміну немає. Будь ласка, ретельно перевіряйте товар на пошті під час отримання.'],
  ['Як оформити замовлення?', 'Додайте товар у кошик або натисніть «Купити в 1 клік», заповніть ім\'я, телефон і відділення Нової Пошти. Ми зв\'яжемося для підтвердження.'],
];

function infoPage() {
  const body = `
<div class="wrap">
  <div class="page-title"><h1>Доставка й оплата</h1></div>
  <div class="info">
    <div class="box"><h2>🚚 Доставка</h2><ul>
      <li><b>Нова Пошта</b> — у відділення, поштомат або кур'єром.</li>
      <li><b>Укрпошта</b> — по всій Україні.</li>
      <li>Відправляємо після підтвердження замовлення, номер ТТН надсилаємо вам.</li>
      <li>Вартість — за тарифами перевізника.</li></ul></div>
    <div class="box"><h2>💳 Оплата</h2><ul>
      ${cfg.monoEnabled && cfg.orderEndpoint ? '<li><b>Карткою онлайн на сайті</b> (monobank, Apple Pay, Google Pay) — +1,5% до суми замовлення.</li>' : ''}
      <li><b>Повна оплата на картку</b> — MonoBank <span class="cardnum">4441 1111 5893 0788</span> або ПриватБанк <span class="cardnum">5168 7451 1598 3550</span>, отримувач Жданов С. О.</li>
      <li><b>Передоплата від 150 грн</b> на картку.</li>
      <li><b>На рахунок (IBAN)</b> — з номером замовлення у призначенні.</li></ul></div>
    <div class="box"><h2>🛒 Як замовити</h2><ul>
      <li>Додайте товар у кошик або натисніть «Купити в 1 клік».</li>
      <li>Або зателефонуйте: <a href="tel:${cfg.phone}" class="link">${esc(cfg.phoneText)}</a>.</li></ul></div>
    <div class="box box--warn" id="returns"><h2>⚠️ Повернення та обмін</h2><p><b>Повернення та обміну немає.</b></p><p>Будь ласка, ретельно перевіряйте товар на пошті під час отримання — до того, як забрати посилку.</p></div>
  </div>
  <section class="sec faq" id="faq">
    <div class="sec__head"><h2>Питання та відповіді</h2></div>
    ${FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}
  </section>
</div>`;
  return layout({
    title: `Доставка, оплата та FAQ | ${TITLE}`,
    description: 'Доставка Новою Поштою та Укрпоштою по Україні, оплата на картку Mono або Приват. Повернення та обміну немає — перевіряйте товар на пошті.',
    path: 'info/', body,
    jsonld: [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }],
  });
}

function notFound() {
  const body = `<div class="wrap empty"><h1>Сторінку не знайдено</h1><p class="muted">Можливо, товар уже продали.</p><a class="btn btn--clay" href="${url('catalog/')}">До каталогу</a></div>`;
  return layout({ title: `Сторінку не знайдено | ${TITLE}`, description: 'Сторінку не знайдено', path: '404.html', body, noindex: true });
}

function merchantFeed() {
  const x = (s) => esc(s);
  const items = cat.products.map((p) => {
    const brand = brandOf(p.name);
    const d = clip(plain(desc[p.id]) || p.name, 4900);
    return `<item>
<g:id>${p.id}</g:id>
<g:title>${x(clip(p.name, 150))}</g:title>
<g:description>${x(d)}</g:description>
<g:link>${x(abs(p.path))}</g:link>
<g:image_link>${x(thumb(p.imgs[0] || '', 640))}</g:image_link>
${p.imgs.slice(1, 10).map((u) => `<g:additional_image_link>${x(thumb(u, 640))}</g:additional_image_link>`).join('\n')}
<g:availability>${p.avail ? 'in_stock' : 'out_of_stock'}</g:availability>
<g:price>${p.price.toFixed(2)} UAH</g:price>
<g:condition>new</g:condition>
${brand ? `<g:brand>${x(brand)}</g:brand>` : ''}
<g:identifier_exists>no</g:identifier_exists>
<g:product_type>${x(groupById.get(p.group)?.name || '')}</g:product_type>
</item>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel>
<title>${TITLE}</title><link>${SITE}/</link><description>${TITLE} — каталог товарів</description>
${items}
</channel></rss>`;
}

// ---------- write ----------
async function put(path, content) {
  const f = new URL(path, OUT);
  await mkdir(dirname(fileURLToPath(f)), { recursive: true });
  await writeFile(f, content);
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
await cp(new URL('assets/', root), new URL('assets/', OUT), { recursive: true });
await put('.nojekyll', '');

await put('index.html', homePage());
await put('catalog/index.html', listingPage({
  title: `Каталог товарів — ${cat.products.length} позицій | ${TITLE}`, h1: 'Каталог',
  description: `Каталог ${TITLE}: окуляри, крокси, одяг, взуття, тату, вело, годинники, батарейки для ключів авто. Доставка по Україні.`,
  path: 'catalog/', products: cat.products,
}));
for (const g of cat.groups) {
  const products = cat.products.filter((p) => p.group === g.id);
  const from = Math.min(...products.map((p) => p.price));
  await put(g.path + 'index.html', listingPage({
    title: `${g.name} — купити від ${Math.round(from)} ₴ | ${TITLE}`, h1: g.name,
    description: `${g.name} в ${TITLE}: ${products.length} товарів, ціни від ${Math.round(from)} ₴. Доставка Новою Поштою по всій Україні.`,
    path: g.path, products, group: g,
  }));
}
for (const p of cat.products) await put(p.path + 'index.html', productPage(p));
await put('info/index.html', infoPage());
await put('404.html', notFound());

// client data: lite catalogue with page paths
await put('data/catalog.json', JSON.stringify({
  updated: cat.updated,
  groups: cat.groups.map(({ id, name, path }) => ({ id, name, path })),
  products: cat.products.map(({ id, name, price, priceFrom, avail, imgs, group, path }) => ({ id, name, price, priceFrom, avail, img: imgs[0], img2: imgs[1], group, path })),
}));

const pages = ['', 'catalog/', 'info/', ...cat.groups.map((g) => g.path), ...cat.products.map((p) => p.path)];
const today = new Date(cat.updated).toISOString().slice(0, 10);
await put('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `<url><loc>${esc(abs(p))}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>`);
await put('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${abs('sitemap.xml')}\n`);
await put('feed.xml', merchantFeed());
await put('manifest.webmanifest', JSON.stringify({
  name: TITLE, short_name: TITLE, start_url: BASE, scope: BASE, display: 'standalone',
  background_color: '#faf6ef', theme_color: '#b86c48', lang: 'uk',
  icons: [{ src: url('assets/icon-192.png'), sizes: '192x192', type: 'image/png' }, { src: url('assets/icon-512.png'), sizes: '512x512', type: 'image/png' }],
}));

console.log(`built ${pages.length} pages → dist/`);
