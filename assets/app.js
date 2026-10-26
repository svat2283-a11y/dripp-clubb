(() => {
  const PHONE = '+380677325292';
  const PAGE = 24;
  const app = document.getElementById('app');
  let DB = null, DESC = null;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (p) => (p.priceFrom ? 'від ' : '') + Math.round(p.price).toLocaleString('uk-UA').replace(/,/g, ' ') + ' ₴';
  const thumb = (u, s = 320) => u.replace(/_w\d+_h\d+_/, `_w${s}_h${s}_`);
  const norm = (s) => String(s).toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-яіїєґ0-9]+/gi, ' ').trim();
  const arrow = '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  async function load() {
    if (DB) return DB;
    const r = await fetch('data/catalog.json', { cache: 'no-cache' });
    DB = await r.json();
    DB.byId = new Map(DB.products.map((p) => [p.id, p]));
    DB.groupById = new Map(DB.groups.map((g) => [g.id, g]));
    DB.products.forEach((p) => (p._s = norm(p.name)));
    const d = new Date(DB.updated);
    document.getElementById('updated').textContent =
      `© ${d.getFullYear()} Dripp_Clubb · Каталог оновлено ${d.toLocaleDateString('uk-UA')} · Оформлення замовлень — через Prom.ua`;
    return DB;
  }
  async function loadDesc() {
    if (!DESC) DESC = await fetch('data/desc.json').then((r) => r.json()).catch(() => ({}));
    return DESC;
  }

  const card = (p) => `
    <a class="card reveal" href="#/p/${p.id}">
      <div class="card__img">
        <img src="${thumb(p.imgs[0] || '')}" alt="${esc(p.name)}" loading="lazy" width="320" height="320">
        ${p.imgs[1] ? `<img src="${thumb(p.imgs[1])}" alt="" loading="lazy" aria-hidden="true">` : ''}
        ${p.avail ? '' : '<span class="badge badge--out">Немає в наявності</span>'}
      </div>
      <div class="card__body">
        <div class="card__name">${esc(p.name)}</div>
        <div class="card__foot"><span class="price">${money(p)}</span><span class="card__go">${arrow}</span></div>
      </div>
    </a>`;

  const skeleton = (n = 8) => `<div class="grid">${'<div class="sk" style="aspect-ratio:.78"></div>'.repeat(n)}</div>`;

  // ---------- pages ----------
  async function home() {
    const db = await load();
    const newest = [...db.products].filter((p) => p.avail).sort((a, b) => b.id.localeCompare(a.id)).slice(0, 12);
    const groups = [...db.groups].sort((a, b) => b.count - a.count);
    const tattoo = db.products.filter((p) => p.avail && p.group === '148022537').slice(0, 10);
    app.innerHTML = `
      <div class="wrap">
        <section class="hero">
          <div class="hero__body reveal">
            <span class="pill"><i></i>Львів · доставка по Україні</span>
            <h1>Тільки<br><span>оригінальні</span> речі</h1>
            <p>Окуляри Oakley, крокси, одяг, тату-фарби, вело та оригінальні батарейки Panasonic для ключів авто. Понад ${Math.floor(db.products.filter((p) => p.avail).length / 100) * 100} товарів у наявності.</p>
            <div class="hero__cta">
              <a class="btn btn--light" href="#/catalog">Перейти в каталог ${arrow}</a>
              <a class="btn btn--ghost" style="color:#fff;border-color:rgba(255,255,255,.5)" href="#/catalog?new=1">Новинки</a>
            </div>
          </div>
        </section>
        <div class="stats">
          <div class="stat"><b>230+</b><span>реальних відгуків</span></div>
          <div class="stat"><b>${db.products.length}</b><span>товарів у каталозі</span></div>
          <div class="stat"><b>100%</b><span>оригінал, без підробок</span></div>
          <div class="stat"><b>НП</b><span>доставка по всій Україні</span></div>
        </div>

        <section class="sec">
          <div class="sec__head"><h2>Категорії</h2><a href="#/catalog">Усі товари →</a></div>
          <div class="cats">
            ${groups.map((g, i) => `
              <a class="cat ${i < 2 ? 'cat--big' : ''} reveal" href="#/catalog?g=${g.id}">
                <img src="${esc(g.img)}" alt="" loading="lazy">
                <span>${esc(g.name)} <small>${g.count}</small></span>
              </a>`).join('')}
            <a class="cat cat--all reveal" href="#/catalog"><b>Усі товари</b><small>${db.products.length} позицій →</small></a>
          </div>
        </section>

        <section class="sec">
          <div class="sec__head"><h2>Новинки</h2><a href="#/catalog?new=1">Дивитись усі →</a></div>
          <div class="rail">${newest.map(card).join('')}</div>
        </section>

        <section class="sec">
          <div class="trust">
            <div class="tile tile--sage"><span class="ico">✓</span><div><h3>Тільки оригінал</h3><p>Працюємо з перевіреними постачальниками. Сумніваєтесь — надішлемо додаткові фото.</p></div></div>
            <div class="tile tile--sky"><span class="ico">⚡</span><div><h3>Швидка відправка</h3><p>Новою Поштою або Укрпоштою після підтвердження замовлення. ТТН — одразу в чат.</p></div></div>
            <div class="tile tile--cream"><span class="ico">★</span><div><h3>230+ відгуків</h3><p>Реальні покупці на Prom.ua. <a href="https://cs4123958.prom.ua/ua/testimonials" target="_blank" rel="noopener" style="text-decoration:underline">Почитати відгуки</a></p></div></div>
          </div>
        </section>

        ${tattoo.length ? `
        <section class="sec">
          <div class="sec__head"><h2>Для тату-майстрів</h2><a href="#/catalog?g=148022537">Усе для тату →</a></div>
          <div class="rail">${tattoo.map(card).join('')}</div>
        </section>` : ''}

        <section class="band">
          <h2>Не знаєте, яка батарейка підійде до <span>ключа авто?</span></h2>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <a class="btn btn--clay" href="tel:${PHONE}">Зателефонувати</a>
            <a class="btn btn--light" href="#/catalog?g=158039269">Батарейки ${arrow}</a>
          </div>
        </section>
      </div>`;
  }

  async function catalog(params) {
    app.innerHTML = `<div class="wrap"><div class="page-title"><h1>Каталог</h1></div>${skeleton()}</div>`;
    const db = await load();
    const st = {
      g: params.get('g') || '', q: params.get('q') || '', sort: params.get('sort') || (params.get('new') ? 'new' : 'pop'),
      stock: params.get('stock') !== '0', min: params.get('min') || '', max: params.get('max') || '',
    };
    const g = db.groupById.get(st.g);
    app.innerHTML = `
      <div class="wrap">
        <div class="page-title"><h1>${g ? esc(g.name) : st.sort === 'new' ? 'Новинки' : 'Каталог'}</h1></div>
        <div class="toolbar">
          <div class="chips" role="group" aria-label="Категорії">
            <button class="chip" data-g="" aria-pressed="${!st.g}">Усі</button>
            ${db.groups.map((x) => `<button class="chip" data-g="${x.id}" aria-pressed="${st.g === x.id}">${esc(x.name)}</button>`).join('')}
          </div>
          <div class="filters">
            <select id="sort" aria-label="Сортування">
              <option value="pop">Популярні</option><option value="new">Спочатку нові</option>
              <option value="asc">Дешевші</option><option value="desc">Дорожчі</option>
            </select>
            <input id="min" type="number" inputmode="numeric" placeholder="Ціна від" value="${esc(st.min)}" aria-label="Ціна від">
            <input id="max" type="number" inputmode="numeric" placeholder="до" value="${esc(st.max)}" aria-label="Ціна до">
            <label class="toggle"><input id="stock" type="checkbox" ${st.stock ? 'checked' : ''}> Тільки в наявності</label>
            <span class="count" id="count"></span>
          </div>
        </div>
        <div class="grid" id="grid"></div>
        <div class="more"><button class="btn btn--ink" id="more" hidden>Показати ще</button></div>
      </div>`;
    document.getElementById('sort').value = st.sort;
    const si = document.getElementById('searchInput');
    si.value = st.q;
    if (params.get('focus')) si.focus();

    const tokens = norm(st.q).split(' ').filter(Boolean);
    const min = +st.min || 0, max = +st.max || Infinity;
    let list = db.products.filter((p) =>
      (!st.g || p.group === st.g) && (!st.stock || p.avail) && p.price >= min && p.price <= max &&
      tokens.every((t) => p._s.includes(t)));
    if (st.sort === 'new') list.sort((a, b) => b.id.localeCompare(a.id));
    if (st.sort === 'asc') list.sort((a, b) => a.price - b.price);
    if (st.sort === 'desc') list.sort((a, b) => b.price - a.price);

    const grid = document.getElementById('grid'), more = document.getElementById('more');
    let shown = 0;
    const draw = () => {
      grid.insertAdjacentHTML('beforeend', list.slice(shown, shown + PAGE).map(card).join(''));
      shown = Math.min(shown + PAGE, list.length);
      more.hidden = shown >= list.length;
    };
    document.getElementById('count').textContent = `${list.length} товарів`;
    if (!list.length) grid.outerHTML = `<div class="empty"><h2>Нічого не знайшли</h2><p class="muted" style="margin:10px 0 20px">Спробуйте інший запит або напишіть нам — підберемо.</p><a class="btn btn--clay" href="#/catalog">Скинути фільтри</a></div>`;
    else draw();
    more.onclick = draw;
    new IntersectionObserver((e) => { if (e[0].isIntersecting && !more.hidden) draw(); }, { rootMargin: '600px' }).observe(more);

    const go = (patch) => {
      const p = new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(location.hash.split('?')[1] || '')), ...patch });
      for (const [k, v] of [...p]) if (v === '' || k === 'focus' || k === 'new') p.delete(k);
      if (patch.stock === '1') p.delete('stock');
      location.hash = '#/catalog' + (p.toString() ? '?' + p : '');
    };
    app.querySelectorAll('.chip').forEach((b) => (b.onclick = () => go({ g: b.dataset.g })));
    document.getElementById('sort').onchange = (e) => go({ sort: e.target.value });
    document.getElementById('stock').onchange = (e) => go({ stock: e.target.checked ? '1' : '0' });
    ['min', 'max'].forEach((id) => (document.getElementById(id).onchange = (e) => go({ [id]: e.target.value })));
  }

  async function product(id) {
    app.innerHTML = `<div class="wrap" style="padding-top:24px">${skeleton(2)}</div>`;
    const db = await load();
    const p = db.byId.get(id);
    if (!p) { app.innerHTML = `<div class="wrap empty"><h2>Товар не знайдено</h2><p class="muted" style="margin:10px 0 20px">Можливо, його вже продали.</p><a class="btn btn--clay" href="#/catalog">До каталогу</a></div>`; return; }
    const g = db.groupById.get(p.group);
    const similar = db.products.filter((x) => x.group === p.group && x.id !== p.id && x.avail).slice(0, 12);
    document.title = `${p.name} — Dripp_Clubb`;
    app.innerHTML = `
      <div class="wrap">
        <nav class="crumbs" aria-label="Навігація"><a href="#/">Головна</a>/<a href="#/catalog">Каталог</a>${g ? `/<a href="#/catalog?g=${g.id}">${esc(g.name)}</a>` : ''}</nav>
        <div class="pdp">
          <div class="gallery">
            <div class="gallery__main"><img id="mainImg" src="${thumb(p.imgs[0] || '', 640)}" alt="${esc(p.name)}"></div>
            ${p.imgs.length > 1 ? `<div class="thumbs">${p.imgs.map((u, i) => `<button aria-label="Фото ${i + 1}" aria-current="${i === 0}" data-src="${thumb(u, 640)}"><img src="${thumb(u, 160)}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
          </div>
          <div>
            <span class="${p.avail ? 'stock' : 'stock stock--out'}">${p.avail ? '● В наявності' : 'Немає в наявності'}</span>
            <h1 style="margin-top:14px">${esc(p.name)}</h1>
            <div class="pdp__price"><span class="price">${money(p)}</span></div>
            <div class="buy">
              <a class="btn btn--clay" href="${esc(p.url)}" target="_blank" rel="noopener">Купити через Prom ${arrow}</a>
              <a class="btn btn--ghost" href="tel:${PHONE}">Запитати по телефону</a>
            </div>
            <div class="perks">
              <div class="perk"><b>🚚</b>Нова Пошта / Укрпошта по всій Україні</div>
              <div class="perk"><b>🛡</b>Пром-оплата: гроші захищені до отримання</div>
              <div class="perk"><b>↩</b>Повернення та обмін за законом</div>
            </div>
            <div class="desc" id="desc"><div class="sk" style="height:120px"></div></div>
          </div>
        </div>
        ${similar.length ? `<section class="sec"><div class="sec__head"><h2>Схожі товари</h2>${g ? `<a href="#/catalog?g=${g.id}">Усі →</a>` : ''}</div><div class="rail">${similar.map(card).join('')}</div></section>` : ''}
      </div>`;
    const main = document.getElementById('mainImg');
    app.querySelectorAll('.thumbs button').forEach((b) => (b.onclick = () => {
      main.src = b.dataset.src;
      app.querySelectorAll('.thumbs button').forEach((x) => x.setAttribute('aria-current', x === b));
    }));
    const d = (await loadDesc())[id];
    // descriptions are pre-sanitised by the scraper to a tag allow-list without attributes
    document.getElementById('desc').innerHTML = d ? `<h3 style="font-size:18px;margin-bottom:12px">Опис</h3>${d}` : '<p class="muted">Опис уточнюйте у менеджера.</p>';
  }

  function info() {
    app.innerHTML = `
      <div class="wrap">
        <div class="page-title"><h1>Доставка й оплата</h1></div>
        <div class="info">
          <div class="box"><h3>🚚 Доставка</h3><ul>
            <li><b>Нова Пошта</b> — у відділення, поштомат або кур'єром.</li>
            <li><b>Укрпошта</b> — по всій Україні.</li>
            <li>Відправляємо після підтвердження замовлення, ТТН надсилаємо в чат.</li>
            <li>Вартість — за тарифами перевізника.</li></ul></div>
          <div class="box"><h3>💳 Оплата</h3><ul>
            <li><b>Пром-оплата</b> — карткою онлайн, гроші захищені Prom.ua.</li>
            <li><b>Повна оплата на картку</b> — MonoBank <span class="cardnum">4441 1111 5893 0788</span> або ПриватБанк <span class="cardnum">5168 7451 1598 3550</span>, отримувач Жданов С. О.</li>
            <li><b>Передоплата від 150 грн</b> на картку.</li>
            <li><b>На рахунок (IBAN)</b> — з номером замовлення у призначенні.</li></ul></div>
          <div class="box"><h3>🛒 Як замовити</h3><ul>
            <li>Оберіть товар і натисніть «Купити через Prom» — оформлення займе хвилину.</li>
            <li>Або зателефонуйте: <a href="tel:${PHONE}" style="color:var(--clay);font-weight:700">+380 (67) 732-52-92</a>.</li></ul></div>
          <div class="box"><h3>↩ Повернення</h3><p>Повернення та обмін — відповідно до Закону України «Про захист прав споживачів». Товар без слідів використання, в оригінальному пакуванні. Напишіть нам перед відправленням.</p></div>
        </div>
        <section class="sec faq" id="faq">
          <div class="sec__head"><h2>Питання та відповіді</h2></div>
          ${[
            ['Це оригінальні товари?', 'Так. Ми продаємо лише оригінальну продукцію від перевірених постачальників. Сумніваєтесь — надішлемо додаткові фото.'],
            ['Як швидко ви відправляєте?', 'Одразу після підтвердження замовлення (і надходження оплати, якщо обрано оплату на картку). Номер ТТН повідомляємо в чаті.'],
            ['Як підібрати батарейку для ключа авто?', 'Відкрийте ключ і подивіться маркування старої батарейки — CR2032, CR2025, CR2016, CR1620 або CR1632. Або напишіть марку, модель і рік авто — підкажемо.'],
            ['Чи є оптові ціни?', 'Так, на частину товарів. Для великого замовлення зателефонуйте — розрахуємо індивідуально.'],
            ['Чи можна повернути товар?', 'Так, згідно із законом про захист прав споживачів. Товар має бути без слідів використання.'],
          ].map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}
        </section>
      </div>`;
    if (location.hash.includes('#faq')) document.getElementById('faq').scrollIntoView();
  }

  // ---------- router ----------
  async function route() {
    const [path, query] = location.hash.slice(1).split('?');
    const params = new URLSearchParams(query || '');
    document.title = 'Dripp_Clubb — тільки оригінальні речі';
    if (path !== '/catalog') document.getElementById('searchInput').value = '';
    document.querySelectorAll('.nav a, .tabbar a').forEach((a) => {
      const h = a.getAttribute('href');
      a.toggleAttribute('aria-current', h === '#' + (path || '/') || (h.startsWith('#/catalog') && path === '/catalog' && !h.includes('?')));
    });
    try {
      if (path.startsWith('/p/')) await product(path.slice(3));
      else if (path === '/catalog') await catalog(params);
      else if (path.startsWith('/info')) info();
      else await home();
    } catch (e) {
      console.error(e);
      app.innerHTML = `<div class="wrap empty"><h2>Не вдалося завантажити</h2><p class="muted" style="margin:10px 0 20px">Перевірте інтернет і спробуйте ще раз.</p><button class="btn btn--clay" onclick="location.reload()">Оновити</button></div>`;
    }
    if (!path.startsWith('/catalog') || !params.get('focus')) window.scrollTo({ top: 0, behavior: 'instant' });
  }

  document.getElementById('searchForm').onsubmit = (e) => {
    e.preventDefault();
    const q = document.getElementById('searchInput').value.trim();
    location.hash = '#/catalog' + (q ? '?q=' + encodeURIComponent(q) : '');
  };
  const hdr = document.getElementById('hdr');
  addEventListener('scroll', () => hdr.classList.toggle('is-scrolled', scrollY > 8), { passive: true });
  addEventListener('hashchange', route);
  route();
})();
