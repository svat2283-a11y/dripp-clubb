(() => {
  const S = window.SITE || { base: '/', endpoint: '', phone: '', phoneText: '' };
  const PAGE = 24;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => Math.round(n).toLocaleString('uk-UA').replace(/[ ,]/g, ' ') + ' ₴';
  const CARD_FEE = 0.015; // must match worker/src/index.js
  const fmt2 = (n) => n.toFixed(2).replace('.', ',') + ' ₴';
  const money = (p) => (p.priceFrom ? 'від ' : '') + fmt(p.price);
  const thumb = (u, s = 320) => String(u || '').replace(/_w\d+_h\d+_/, `_w${s}_h${s}_`);
  const norm = (s) => String(s).toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-яіїєґ0-9]+/gi, ' ').trim();
  const arrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  let DB = null;
  const load = async () => {
    if (DB) return DB;
    DB = await fetch(S.base + 'data/catalog.json').then((r) => r.json());
    DB.byId = new Map(DB.products.map((p) => [p.id, p]));
    DB.products.forEach((p) => (p._s = norm(p.name)));
    return DB;
  };

  // old #/ links from the first version of the site
  if (location.hash.startsWith('#/')) {
    const [path, q] = location.hash.slice(2).split('?');
    if (path.startsWith('p/')) load().then((db) => { const p = db.byId.get(path.slice(2)); location.replace(S.base + (p ? p.path : 'catalog/')); });
    else if (path.startsWith('catalog')) location.replace(S.base + 'catalog/' + (q ? '?' + q : ''));
    else if (path.startsWith('info')) location.replace(S.base + 'info/');
    else history.replaceState(null, '', location.pathname);
  }

  // header + tab bar
  const hdr = $('#hdr');
  addEventListener('scroll', () => hdr.classList.toggle('is-scrolled', scrollY > 8), { passive: true });
  const here = location.pathname.replace(S.base, '');
  $$('.tabbar [data-tab]').forEach((a) => a.toggleAttribute('aria-current', (a.dataset.tab === 'home' && here === '') || (a.dataset.tab === 'catalog' && /^(catalog|c\/)/.test(here))));
  const qs = new URLSearchParams(location.search);
  $$('.search input').forEach((i) => (i.value = qs.get('q') || ''));

  // ---------- product gallery ----------
  const main = $('#mainImg');
  $$('.thumbs button').forEach((b) => (b.onclick = () => {
    main.src = b.dataset.src;
    $$('.thumbs button').forEach((x) => x.setAttribute('aria-current', x === b));
  }));

  // ---------- catalogue filtering ----------
  const tb = $('[data-catalog]');
  if (tb) {
    const grid = $('#grid'), more = $('#more'), count = $('[data-count]');
    const f = Object.fromEntries($$('[data-f]', tb).map((el) => [el.dataset.f, el]));
    const group = tb.dataset.group;
    f.sort.value = qs.get('sort') || 'pop';
    f.min.value = qs.get('min') || '';
    f.max.value = qs.get('max') || '';
    f.stock.checked = qs.get('stock') !== '0';
    let list = [], shown = 0;
    const card = (p) => `<a class="card" href="${S.base + p.path}"><div class="card__img"><img src="${esc(thumb(p.img))}" alt="${esc(p.name)}" loading="lazy" width="320" height="320">${p.img2 ? `<img src="${esc(thumb(p.img2))}" alt="" loading="lazy" aria-hidden="true">` : ''}${p.avail ? '' : '<span class="badge badge--out">Немає в наявності</span>'}</div><div class="card__body"><div class="card__name">${esc(p.name)}</div><div class="card__foot"><span class="price">${money(p)}</span><span class="card__go">${arrow}</span></div></div></a>`;
    const draw = () => {
      grid.insertAdjacentHTML('beforeend', list.slice(shown, shown + PAGE).map(card).join(''));
      shown = Math.min(shown + PAGE, list.length);
      more.hidden = shown >= list.length;
    };
    const apply = async (push) => {
      const db = await load();
      const q = qs.get('q') || '';
      const tokens = norm(q).split(' ').filter(Boolean);
      const min = +f.min.value || 0, max = +f.max.value || Infinity;
      list = db.products.filter((p) => (!group || p.group === group) && (!f.stock.checked || p.avail) && p.price >= min && p.price <= max && tokens.every((t) => p._s.includes(t)));
      const s = f.sort.value;
      if (s === 'new') list.sort((a, b) => b.id.localeCompare(a.id));
      if (s === 'asc') list.sort((a, b) => a.price - b.price);
      if (s === 'desc') list.sort((a, b) => b.price - a.price);
      grid.innerHTML = list.length ? '' : `<div class="empty" style="grid-column:1/-1"><h2>Нічого не знайшли</h2><p class="muted">Спробуйте інший запит або зателефонуйте — підберемо.</p></div>`;
      shown = 0;
      if (list.length) draw(); else more.hidden = true;
      count.textContent = `${list.length} товарів`;
      if (q) $('.page-title h1').textContent = `Пошук: ${q}`;
      if (push) {
        const p = new URLSearchParams();
        if (q) p.set('q', q);
        if (s !== 'pop') p.set('sort', s);
        if (f.min.value) p.set('min', f.min.value);
        if (f.max.value) p.set('max', f.max.value);
        if (!f.stock.checked) p.set('stock', '0');
        history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : ''));
      }
    };
    Object.values(f).forEach((el) => el.addEventListener('change', () => apply(true)));
    more.onclick = draw;
    new IntersectionObserver((e) => { if (e[0].isIntersecting && !more.hidden) draw(); }, { rootMargin: '800px' }).observe(more);
    // static HTML already shows the default view; re-render only when the URL asks for something else
    if (location.search) apply(false);
    else load().then((db) => {
      list = db.products.filter((p) => (!group || p.group === group) && p.avail);
      shown = grid.children.length;
      more.hidden = shown >= list.length;
    });
  }

  // ---------- cart ----------
  let cart = store.get('dc_cart', []);
  const save = () => { store.set('dc_cart', cart); badge(); };
  const badge = () => {
    const n = cart.reduce((a, i) => a + i.qty, 0);
    $$('[data-cart-count]').forEach((b) => { b.textContent = n; b.hidden = !n; });
  };
  const total = (items) => items.reduce((a, i) => a + i.price * i.qty, 0);
  const drawer = $('#cart'), body = $('#cartBody');
  const open = () => { drawer.hidden = false; document.body.style.overflow = 'hidden'; render(); setTimeout(() => $('.x', drawer).focus(), 30); };
  const close = () => { drawer.hidden = true; document.body.style.overflow = ''; };
  $$('[data-cart-open]').forEach((b) => (b.onclick = open));
  drawer.addEventListener('click', (e) => { if (e.target.closest('[data-cart-close]')) close(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !drawer.hidden) close(); });

  let checkoutItems = null; // null → whole cart, array → "buy in 1 click"
  function render() {
    const items = checkoutItems || cart;
    if (!items.length) {
      body.innerHTML = `<div class="empty"><p class="muted">Кошик порожній</p><a class="btn btn--clay" href="${S.base}catalog/">До каталогу</a></div>`;
      return;
    }
    body.innerHTML = `
      <ul class="lines">${items.map((i) => `
        <li class="line" data-id="${esc(i.id)}">
          <img src="${esc(i.img)}" alt="" width="64" height="64">
          <div><a href="${S.base + i.path}">${esc(i.name)}</a><b>${fmt(i.price)}</b></div>
          ${checkoutItems ? '' : `<div class="qty"><button type="button" data-q="-1" aria-label="Менше">−</button><span>${i.qty}</span><button type="button" data-q="1" aria-label="Більше">+</button></div>`}
          <label class="variant">${i.sized ? 'Розмір <em>*</em>' : 'Колір / варіант (якщо є)'}<input data-variant maxlength="40" value="${esc(i.variant || '')}" placeholder="${i.sized ? 'Напр. M, 42, 27 см' : 'Напр. чорний'}"></label>
        </li>`).join('')}</ul>
      <div class="sum"><span>Разом</span><b>${fmt(total(items))}</b></div>
      <form class="order" id="orderForm" novalidate>
        <h3>Оформлення</h3>
        <label>Ім'я та прізвище<input name="name" required autocomplete="name" maxlength="80"></label>
        <label>Телефон<input name="phone" required type="tel" inputmode="tel" autocomplete="tel" placeholder="+380" maxlength="20"></label>
        <fieldset><legend>Доставка</legend>
          <div class="seg"><label><input type="radio" name="carrier" value="np" checked><span>Нова Пошта</span></label><label><input type="radio" name="carrier" value="up"><span>Укрпошта</span></label></div>
        </fieldset>
        <div class="ac"><label>Місто<input name="city" required autocomplete="off" maxlength="60" placeholder="Почніть вводити, напр. Льв…" role="combobox" aria-autocomplete="list" aria-expanded="false"></label><ul class="ac__list" id="cityList" role="listbox" hidden></ul></div>
        <div class="ac" id="npBox"><label>Відділення / поштомат<input name="np" autocomplete="off" maxlength="120" placeholder="Спершу оберіть місто" role="combobox" aria-autocomplete="list" aria-expanded="false"></label><ul class="ac__list" id="npList" role="listbox" hidden></ul></div>
        <label id="upBox" hidden>Індекс відділення Укрпошти<input name="upIndex" inputmode="numeric" maxlength="5" placeholder="Напр. 79000"></label>
        <fieldset><legend>Оплата</legend>
          ${S.mono ? '<label class="radio"><input type="radio" name="pay" value="mono" checked> Карткою онлайн (monobank, Apple Pay, Google Pay) <small class="fee">+1,5%</small></label>' : ''}
          <label class="radio"><input type="radio" name="pay" value="iban" ${S.mono ? '' : 'checked'}> Оплата за реквізитами (повна сума)</label>
          <label class="radio"><input type="radio" name="pay" value="prepay"> Передоплата ${S.prepay || 150} грн за реквізитами, решта при отриманні</label>
        </fieldset>
        <label>Коментар до замовлення<textarea name="comment" rows="2" maxlength="300" placeholder="Побажання, зручний час для дзвінка тощо"></textarea></label>
        <p class="feeline" id="feeLine" hidden></p>
        <p class="note">⚠️ Повернення та обміну немає — перевіряйте товар на пошті.</p>
        <p class="err" id="orderErr" role="alert" hidden></p>
        <button class="btn btn--clay btn--block" type="submit" id="orderBtn">Підтвердити замовлення · ${fmt(total(items))}</button>
      </form>`;
    const sum = total(items), feeLine = $('#feeLine'), orderBtn = $('#orderBtn');
    const updFee = () => {
      const mono = $('input[name=pay]:checked', body)?.value === 'mono';
      const fee = mono ? Math.round(sum * CARD_FEE * 100) / 100 : 0;
      feeLine.hidden = !mono;
      if (mono) feeLine.innerHTML = `Комісія за оплату карткою 1,5%: <b>${fmt2(fee)}</b><br>До оплати: <b>${fmt2(sum + fee)}</b>`;
      orderBtn.textContent = mono ? `Перейти до оплати · ${fmt2(sum + fee)}` : `Підтвердити замовлення · ${fmt(sum)}`;
    };
    $$('input[name=pay]', body).forEach((r) => r.addEventListener('change', updFee));
    updFee();
    setupDelivery();
    $$('[data-q]', body).forEach((b) => (b.onclick = () => {
      const id = b.closest('.line').dataset.id, it = cart.find((x) => x.id === id);
      it.qty += +b.dataset.q;
      if (it.qty < 1) cart = cart.filter((x) => x !== it);
      save(); render();
    }));
    $$('[data-variant]', body).forEach((inp) => inp.addEventListener('input', () => {
      const id = inp.closest('.line').dataset.id;
      const it = (checkoutItems || cart).find((x) => x.id === id);
      if (it) { it.variant = inp.value; if (!checkoutItems) store.set('dc_cart', cart); }
    }));
    $('#orderForm').onsubmit = submit;
  }

  async function submit(e) {
    e.preventDefault();
    const form = e.target, err = $('#orderErr'), btn = $('button[type=submit]', form);
    const d = Object.fromEntries(new FormData(form));
    const phone = d.phone.replace(/[^\d+]/g, '');
    const bad = !d.name.trim() ? 'Вкажіть ім\'я' : !/^\+?\d{10,13}$/.test(phone) ? 'Перевірте номер телефону' : !d.city.trim() ? 'Вкажіть місто' : d.carrier === 'up' ? (!/^\d{5}$/.test(d.upIndex || '') ? 'Вкажіть індекс відділення Укрпошти (5 цифр)' : '') : !d.np.trim() ? 'Оберіть відділення Нової Пошти' : '';
    const noSize = (checkoutItems || cart).find((i) => i.sized && !String(i.variant || '').trim());
    if (!bad && noSize) {
      err.textContent = `Вкажіть розмір для «${noSize.name.slice(0, 40)}…»`; err.hidden = false;
      $(`.line[data-id="${noSize.id}"] [data-variant]`, body)?.focus();
      return;
    }
    if (bad) { err.textContent = bad; err.hidden = false; return; }
    err.hidden = true;
    const items = (checkoutItems || cart).map(({ id, name, price, qty, path, variant }) => ({ id, name, price, qty, variant: String(variant || '').trim(), url: location.origin + S.base + path }));
    const order = { ...d, phone, items, total: total(items), page: location.href };
    btn.disabled = true; btn.textContent = 'Надсилаємо…';
    if (S.endpoint) {
      try {
        const r = await fetch(S.endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(order) });
        const res = await r.json();
        if (!r.ok || !res.ok) throw new Error(res.error || 'error');
        done(order, res);
        if (res.payUrl) location.href = res.payUrl;
        return;
      } catch {
        // backend unavailable: fall through to SMS / phone so the order is never lost
      }
    }
    // no backend (or it failed): hand the order over by SMS / phone
    const text = `Замовлення Dripp_Clubb\n${items.map((i) => `${i.name}${i.variant ? ` [${i.variant}]` : ''} ×${i.qty} — ${fmt(i.price * i.qty)}`).join('\n')}\nРазом: ${fmt(order.total)}\n${d.name}, ${phone}\n${d.carrier === 'up' ? `Укрпошта: ${d.city}, ${d.upIndex}` : `Нова Пошта: ${d.city}, ${d.np}`}\nОплата: ${{ iban: 'за реквізитами', prepay: 'передоплата', mono: 'карткою онлайн' }[d.pay] || d.pay}${d.comment ? '\n' + d.comment : ''}`;
    body.innerHTML = `<div class="done"><h3>Залишився один крок</h3><p class="muted">Надішліть замовлення SMS — текст уже готовий — або зателефонуйте нам.</p>
      <a class="btn btn--clay btn--block" href="sms:${S.phone}?&body=${encodeURIComponent(text)}">Надіслати SMS</a>
      <a class="btn btn--ghost btn--block" href="tel:${S.phone}">Зателефонувати ${esc(S.phoneText)}</a>
      <button class="btn btn--ghost btn--block" type="button" id="copyOrder">Скопіювати замовлення</button></div>`;
    $('#copyOrder').onclick = (ev) => navigator.clipboard?.writeText(text).then(() => (ev.target.textContent = 'Скопійовано ✓'));
  }

  function done(order, res) {
    if (!checkoutItems) { cart = []; save(); }
    const id = res.orderId || '';
    let html = `<div class="done"><h3>Дякуємо! Замовлення №${esc(id)} прийнято</h3>
      <p class="muted">${res.payUrl ? 'Переходимо до оплати…' : 'Ми зв\'яжемося з вами для підтвердження.'}</p></div>`;
    if ((order.pay === 'iban' || order.pay === 'prepay') && S.req) {
      const R = S.req;
      const amount = order.pay === 'prepay' ? (S.prepay || 150) : order.total;
      const cut = (t, n) => (t.length > n ? t.slice(0, n).replace(/[\s,|/-]+\S*$/, '') : t);
      const first = order.items[0];
      const what = cut(first.name, order.items.length === 1 ? 70 : 45) + (first.variant ? ` (${first.variant})` : '') + (order.items.length > 1 ? ` та ще ${order.items.length - 1} тов.` : '');
      const purpose = `${order.pay === 'prepay' ? 'Передоплата' : 'Оплата'} за товар ${what}, згідно замовлення №${id}. Без ПДВ`;
      const rows = [
        ['Сума', fmt2(amount), String(amount)],
        ['Отримувач', R.receiver, R.receiver],
        ['IBAN', R.iban, R.iban],
        ['ІПН / ЄДРПОУ', R.code, R.code],
        ['Банк', R.bank, R.bank],
        ['МФО', R.mfo, R.mfo],
        ['ЄДРПОУ банку', R.bankCode, R.bankCode],
        ['Призначення платежу', purpose, purpose],
      ];
      const all = `Отримувач: ${R.receiver}\nIBAN: ${R.iban}\nІПН/ЄДРПОУ: ${R.code}\nБанк: ${R.bank}\nМФО: ${R.mfo}\nЄДРПОУ банку: ${R.bankCode}\nСума: ${amount} грн\nПризначення платежу: ${purpose}`;
      html += `<div class="pay">
        <h3>${order.pay === 'prepay' ? `Передоплата ${amount} грн` : 'Оплата за реквізитами'}</h3>
        <p class="muted">Скопіюйте дані у свій банк. Відправимо після надходження оплати.</p>
        ${rows.map(([k, v, c]) => `<div class="pay__row"><span>${k}</span><b>${esc(v)}</b><button type="button" class="copy" data-copy="${esc(c)}">Скопіювати</button></div>`).join('')}
        <button type="button" class="btn btn--clay btn--block copy" data-copy="${esc(all)}">Скопіювати всі реквізити</button>
        ${R.card ? `<p class="muted pay__card">Або переказ на картку ФОП: <b>${esc(R.card.replace(/(\d{4})(?=\d)/g, '$1 '))}</b> <button type="button" class="copy" data-copy="${esc(R.card)}">Скопіювати</button><br>У коментарі вкажіть №${esc(id)}.</p>` : ''}
        <p class="note">Після оплати, будь ласка, надішліть квитанцію на ${esc(S.phoneText)}.</p>
      </div>`;
    }
    body.innerHTML = html;
    $$('.copy', body).forEach((b) => (b.onclick = () => {
      const t = b.dataset.copy;
      const ok = () => { const old = b.textContent; b.textContent = 'Скопійовано ✓'; setTimeout(() => (b.textContent = old), 1500); };
      if (navigator.clipboard) navigator.clipboard.writeText(t).then(ok, () => fallbackCopy(t, ok)); else fallbackCopy(t, ok);
    }));
  }
  function fallbackCopy(t, ok) {
    const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); ok(); } catch {}
    ta.remove();
  }

  // ---------- city / branch autocomplete (Nova Poshta via our worker) ----------
  function setupDelivery() {
    const api = S.endpoint ? S.endpoint.replace(/\/order$/, '') : '';
    const form = $('#orderForm'), city = form.city, np = form.np, cityList = $('#cityList'), npList = $('#npList');
    let cityRef = '', branches = [], t = 0;
    const show = (list, items, pick) => {
      list.innerHTML = items.map((x, i) => `<li role="option" data-i="${i}">${esc(x.label || x.name)}</li>`).join('');
      list.hidden = !items.length;
      list.previousElementSibling.querySelector('input').setAttribute('aria-expanded', String(!!items.length));
      list.onmousedown = (e) => { const li = e.target.closest('li'); if (li) { e.preventDefault(); pick(items[+li.dataset.i]); list.hidden = true; } };
    };
    const carrier = () => $('input[name=carrier]:checked', form).value;
    $$('input[name=carrier]', form).forEach((r) => r.addEventListener('change', () => {
      const up = carrier() === 'up';
      $('#npBox').hidden = up; $('#upBox').hidden = !up;
    }));
    const pickCity = (c) => {
      city.value = c.name; cityRef = c.ref; np.value = ''; branches = [];
      np.placeholder = 'Завантажуємо відділення…';
      fetch(`${api}/np/branches?ref=${encodeURIComponent(c.ref)}`).then((r) => r.json()).then((b) => {
        branches = b.sort((x, y) => x.n - y.n);
        np.placeholder = branches.length ? 'Номер або вулиця, напр. 12' : 'Відділень не знайдено — впишіть вручну';
        if (carrier() === 'np') np.focus();
      }).catch(() => (np.placeholder = 'Впишіть номер відділення'));
    };
    city.addEventListener('input', () => {
      cityRef = '';
      clearTimeout(t);
      const q = city.value.trim();
      if (q.length < 2 || !api) { cityList.hidden = true; return; }
      t = setTimeout(() => fetch(`${api}/np/cities?q=${encodeURIComponent(q)}`).then((r) => r.json()).then((c) => show(cityList, c, pickCity)).catch(() => {}), 250);
    });
    const filterNp = () => {
      const q = np.value.trim().toLowerCase();
      const num = q.replace(/\D/g, '');
      const list = (q ? branches.filter((b) => (num && String(b.n) === num) || b.name.toLowerCase().includes(q))
        .sort((a, b) => (String(b.n) === num) - (String(a.n) === num)) : branches).slice(0, 40);
      show(npList, list, (b) => (np.value = b.name));
    };
    np.addEventListener('input', filterNp);
    np.addEventListener('focus', () => { if (branches.length) filterNp(); });
    [city, np].forEach((el) => el.addEventListener('blur', () => setTimeout(() => { cityList.hidden = npList.hidden = true; }, 150)));
  }

  // product buttons
  const buy = $('[data-product]');
  if (buy) {
    const item = JSON.parse(buy.dataset.product);
    const add = $('[data-add]', buy), now = $('[data-buy-now]', buy);
    if (add) add.onclick = () => {
      const it = cart.find((x) => x.id === item.id);
      if (it) it.qty++; else cart.push({ ...item, qty: 1 });
      save(); checkoutItems = null; open();
    };
    if (now) now.onclick = () => { checkoutItems = [{ ...item, qty: 1 }]; open(); };
  }
  $$('[data-cart-open]').forEach((b) => b.addEventListener('click', () => { checkoutItems = null; render(); }));
  badge();

  // returning from the monobank payment page (the real payment status reaches us via webhook)
  if (qs.get('order')) {
    open();
    body.innerHTML = `<div class="done"><h3>Дякуємо за замовлення №${esc(qs.get('order'))}</h3><p class="muted">Щойно оплата підтвердиться, ми надішлемо номер ТТН.</p></div>`;
  }
})();
