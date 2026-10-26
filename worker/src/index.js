// Cloudflare Worker: receives orders from the site, creates a plata by mono invoice,
// notifies the shop owner in Telegram and reports payment status from mono webhooks.
// Secrets (wrangler secret put): MONO_TOKEN, TG_TOKEN, TG_CHAT. Var: SITE_URL.

const MONO = 'https://api.monobank.ua/api/merchant';
const PAY_LABEL = { mono: 'Карткою онлайн (monobank)', card: 'Переказ на картку', prepay: 'Передоплата 150 грн' };

const json = (body, status = 200, origin = '*') =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': origin, 'access-control-allow-headers': 'content-type' },
  });

const clean = (s, n = 120) => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, n);
const fmt = (n) => Math.round(n).toLocaleString('uk-UA') + ' ₴';

async function telegram(env, text) {
  if (!env.TG_TOKEN || !env.TG_CHAT) return false;
  const r = await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: env.TG_CHAT, text, disable_web_page_preview: true }),
  });
  return r.ok;
}

let catalogCache = { at: 0, byId: null };
async function catalog(env) {
  if (catalogCache.byId && Date.now() - catalogCache.at < 10 * 60 * 1000) return catalogCache.byId;
  const data = await fetch(env.SITE_URL.replace(/\/$/, '') + '/data/catalog.json', { cf: { cacheTtl: 300 } }).then((r) => r.json());
  catalogCache = { at: Date.now(), byId: new Map(data.products.map((p) => [p.id, p])) };
  return catalogCache.byId;
}

async function createOrder(req, env, origin) {
  const o = await req.json().catch(() => null);
  if (!o || !Array.isArray(o.items) || !o.items.length || o.items.length > 30) return json({ ok: false, error: 'bad order' }, 400, origin);
  const phone = clean(o.phone, 20).replace(/[^\d+]/g, '');
  if (!clean(o.name) || !/^\+?\d{10,13}$/.test(phone) || !clean(o.city) || !clean(o.np)) return json({ ok: false, error: 'bad contact' }, 400, origin);

  // prices always come from the published catalogue, never from the browser
  const byId = await catalog(env);
  const items = [];
  for (const it of o.items) {
    const p = byId.get(String(it.id));
    const qty = Math.min(Math.max(parseInt(it.qty, 10) || 1, 1), 20);
    if (!p || !p.avail) return json({ ok: false, error: 'unavailable: ' + it.id }, 409, origin);
    items.push({ id: p.id, name: p.name, price: p.price, qty, img: p.img, url: env.SITE_URL.replace(/\/$/, '') + '/' + p.path });
  }
  const total = items.reduce((a, i) => a + i.price * i.qty, 0);
  const pay = ['mono', 'card', 'prepay'].includes(o.pay) ? o.pay : 'card';
  const orderId = 'DC' + Date.now().toString(36).toUpperCase().slice(-6);

  let payUrl = null;
  if (pay === 'mono' && env.MONO_TOKEN) {
    const r = await fetch(MONO + '/invoice/create', {
      method: 'POST',
      headers: { 'X-Token': env.MONO_TOKEN, 'content-type': 'application/json' },
      body: JSON.stringify({
        amount: Math.round(total * 100),
        ccy: 980,
        merchantPaymInfo: {
          reference: orderId,
          destination: `Замовлення ${orderId} — Dripp_Clubb`,
          basketOrder: items.map((i) => ({ name: i.name.slice(0, 120), qty: i.qty, sum: Math.round(i.price * 100), icon: i.img, unit: 'шт.', code: i.id })),
        },
        redirectUrl: env.SITE_URL.replace(/\/$/, '') + '/?order=' + orderId,
        webHookUrl: new URL('/mono-webhook', req.url).toString(),
        validity: 60 * 60 * 24,
      }),
    });
    const inv = await r.json().catch(() => ({}));
    if (!r.ok || !inv.pageUrl) {
      await telegram(env, `⚠️ Не вдалося створити рахунок mono для ${orderId}: ${JSON.stringify(inv).slice(0, 300)}`);
    } else payUrl = inv.pageUrl;
  }

  const delivered = await telegram(env, [
    `🛒 Нове замовлення ${orderId}`,
    ...items.map((i) => `• ${i.name} ×${i.qty} — ${fmt(i.price * i.qty)}\n  ${i.url}`),
    `Разом: ${fmt(total)}`,
    '',
    `👤 ${clean(o.name)}`,
    `📞 ${phone}`,
    `📦 ${clean(o.city)}, ${clean(o.np)}`,
    `💳 ${PAY_LABEL[pay]}${pay === 'mono' ? (payUrl ? ' — очікуємо оплату' : ' — рахунок НЕ створено') : ''}`,
    o.comment ? `💬 ${clean(o.comment, 300)}` : '',
  ].filter(Boolean).join('\n'));
  // never report success for an order the shop did not receive — the site then falls back to SMS/phone
  if (!delivered) return json({ ok: false, error: 'notify failed' }, 502, origin);

  return json({ ok: true, orderId, payUrl }, 200, origin);
}

async function monoWebhook(req, env) {
  const body = await req.json().catch(() => ({}));
  if (!body.invoiceId) return new Response('ok');
  // trust nothing in the webhook body: re-read the status from mono with our token
  const r = await fetch(`${MONO}/invoice/status?invoiceId=${encodeURIComponent(body.invoiceId)}`, { headers: { 'X-Token': env.MONO_TOKEN } });
  const s = await r.json().catch(() => ({}));
  const label = { success: '✅ ОПЛАЧЕНО', failure: '❌ Оплата не пройшла', expired: '⌛ Рахунок прострочено', reversed: '↩️ Повернення коштів' }[s.status];
  if (label) await telegram(env, `${label}: замовлення ${s.reference || ''} — ${fmt((s.amount || 0) / 100)}`);
  return new Response('ok');
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const site = new URL(env.SITE_URL).origin;
    const origin = site;
    if (req.method === 'OPTIONS') return json({}, 204, origin);
    if (req.method === 'POST' && url.pathname === '/order') {
      if (req.headers.get('origin') && req.headers.get('origin') !== site) return json({ ok: false, error: 'forbidden' }, 403, origin);
      try { return await createOrder(req, env, origin); }
      catch (e) { await telegram(env, '⚠️ Помилка замовлення: ' + e.message); return json({ ok: false, error: 'server' }, 500, origin); }
    }
    if (req.method === 'POST' && url.pathname === '/mono-webhook') return monoWebhook(req, env);
    // one-time setup helper: shows who wrote to the bot, until TG_CHAT is configured
    if (url.pathname === '/tg-chats' && env.TG_TOKEN && !env.TG_CHAT) {
      const u = await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/getUpdates`).then((r) => r.json());
      const chats = [...new Map((u.result || []).map((x) => x.message?.chat).filter(Boolean).map((c) => [c.id, { id: c.id, name: [c.first_name, c.last_name].filter(Boolean).join(' '), username: c.username }])).values()];
      const me = await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/getMe`).then((r) => r.json());
      const wh = await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/getWebhookInfo`).then((r) => r.json());
      return json({ chats, telegram: u.ok ? 'ok' : u.description, updates: (u.result || []).length, bot: me.result?.username, webhook: wh.result?.url || '', pending: wh.result?.pending_update_count });
    }
    return new Response('Dripp_Clubb orders API', { status: 200 });
  },
};
