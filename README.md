# Dripp_Clubb — сайт магазину

Статичний сайт на GitHub Pages: окрема сторінка для кожного товару й категорії,
sitemap, robots, фід для Google Merchant (`/feed.xml`), кошик і оформлення замовлення.

- `scripts/scrape.mjs` — забирає товари з публічного магазину (`data/`).
- `scripts/build.mjs` — генерує сайт у `dist/` (налаштування — `site.config.json`).
- `.github/workflows/update-catalog.yml` — двічі на день оновлює товари й публікує сайт.
  Вручну: **Actions → Build and deploy site → Run workflow**.
- `worker/` — сервер замовлень (Cloudflare Workers, безкоштовно): Telegram + оплата plata by mono.

## Підключення замовлень і monobank

1. Cloudflare: зареєструватись на dash.cloudflare.com (безкоштовно).
2. У терміналі в папці `worker/`:
   ```
   npx wrangler login
   npx wrangler deploy
   npx wrangler secret put TG_TOKEN     # токен бота з @BotFather
   npx wrangler secret put TG_CHAT      # ваш chat id
   npx wrangler secret put MONO_TOKEN   # токен plata by mono
   ```
3. Адресу воркера + `/order` вписати в `site.config.json` → `orderEndpoint` і запушити.

Поки `orderEndpoint` порожній, оформлення працює через SMS / дзвінок.
