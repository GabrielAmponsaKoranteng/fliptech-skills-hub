# Fliptech Skills Hub — Frontend

React + TypeScript + Vite frontend for a directory of practical skills training providers in Greater Accra, with three portals: **trainee**, **trainer (training centre)** and **super admin**.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-checks (tsc) then bundles
npm run typecheck
npm run lint     # ESLint, including React's rules of hooks; fails on any warning
npm test         # rules + mock server (Vitest)
npm run e2e      # end-to-end flows in a real browser (Playwright)
npm run perf     # page-weight and layout-shift budgets on a throttled phone (see e2e/perf.spec.ts)
npm run visual   # screenshots of 22 pages at laptop and phone size, compared with approved baselines
```

**Visual regression tests** (`e2e/visual/`) catch unintended layout and styling changes.
- To keep screenshots identical between runs, the clock is frozen at 28 Oct 2026, 10:00, photos are swapped for flat placeholders, and the web font and map tiles are blocked, so pages render in the fallback font. Toasts are hidden.
- When a test fails, Playwright saves the expected, actual and highlighted-difference images under `test-results/`. If the change was intended, run `npm run visual:update` and commit the new baselines with the change.
- Baselines are per operating system (`e2e/visual/__screenshots__/win32/…`) because fonts render differently. A Linux CI machine needs its own set, made once with `npm run visual:update` there.

**Performance.** Pictures are requested at the size they're shown (`<Img sizes=…>` builds a `srcset`), the code for the page you're on downloads alongside start-up, and the map library only loads when a map is shown. `npm run perf` fails if a page goes over its budget (200 KB JavaScript, 600 KB images, 100 KB fonts, layout shift under 0.1).

The first time you run the end-to-end tests, download the browser they use (about 90 MB): `npx playwright install chromium`.

TypeScript runs in `strict` mode (see `tsconfig.json`). `vite dev` does not type-check, so run `npm run typecheck` or rely on your editor while developing.

**Continuous integration.** `.github/workflows/ci.yml` runs on every push to `main` and every pull request: lint, type-check, unit tests, build and the end-to-end tests. Visual and performance checks run locally only (see below for why).

## Demo accounts

Go to **/signin** and use the "Explore the demo as" buttons (Trainee / Trainer / Super admin).

## Data and the backend

All data goes through one typed API (`src/api/contract.ts`). **[docs/API.md](docs/API.md)** documents every endpoint, its rules and its errors.

- **By default** the app runs on a mock server in the browser (`src/api/mock`). It stores data in `localStorage` (`fsh.db.v3.*`) and enforces the same rules a real backend should: pricing, stock, permissions, order status steps and notifications.
- **To use a real backend**, set `VITE_API_URL=https://…/v1` in `.env.local` and restart. The HTTP client is `src/api/http.ts`.

Pages show loading skeletons and error states with a retry button. Edits update the screen at once and roll back if the server refuses them. To try the slow and failing paths, use the dev console:

```js
fshMock.set({ latency: 1500, failRate: 0.3 })  // slow and flaky
fshMock.set({ offline: true })                 // no network
fshMock.clear()                                // back to normal
fshMock.reset()                                // restore demo data
```

## Routes

| Area | Routes |
|---|---|
| Public | `/`, `/search` (list · grid · map), `/courses`, `/courses/:id`, `/marketplace`, `/marketplace/:id`, `/cart`, `/checkout`, `/orders/:id`, `/contact`, `/providers/:id`, `/providers/:id/enquire`, `/signin`, `/signup`, `/trainer/register`, `/for-trainers`, `/about`, `/help`, `/privacy`, `/terms` |
| Trainee (`/app`) | dashboard, `courses` (My courses) and `courses/:id` (lesson player with saved progress), `saved` (with side-by-side compare), `enquiries` (threaded), `orders` (status filter, buy again), `settings` |
| Trainer (`/trainer`) | overview, `enquiries` (inbox + quick replies + status), `orders` (seller fulfilment: confirm → dispatch/pickup → complete, cancel), `listings` (create/edit/hide/delete courses and products, photo upload, lesson editor), `programmes` (CRUD drawer), `centre` (profile + photos + live preview), `verification`, `settings` |
| Super admin (`/admin`) | overview (KPIs, charts, activity), `verification` (review queue + approve/reject), `providers`, `users`, `enquiries` (spam moderation), `orders` (all orders, needs-attention flags, status overrides, mark paid, cancel, CSV export), `trades`, `settings` |

Dashboards are role-guarded in `src/components/DashboardLayout.tsx`.

## Structure

```
src/
  types.ts                domain types (Provider, Enquiry, User, Course…) — the shapes the API returns
  api/contract.ts         the API interface, input types and ApiError
  api/http.ts             REST client (VITE_API_URL)
  api/mock/               in-browser mock server: db.ts (tables), seed.ts, server.ts (rules)
  api/useApiQuery.ts      page-level data loading hook
  data/catalog.ts         reference data (providers, trades, areas, categories) loaded at startup
  data/mock.ts            seed data — imported only by api/mock
  lib/                    pure rules shared by UI and mock server (pricing, orders, listings, notifications)
  context/AppContext.tsx  session + cached data, optimistic actions, polling, cart, toasts (`useApp()`, `useUser()`)
  components/             layout, dashboard shell, cards, map, UI kit
  pages/public|trainee|trainer|admin/
  styles.css              design system (tokens, components, responsive)
```

## Before production

- Build the backend described in [docs/API.md](docs/API.md), including the "Not done yet" list (payment webhooks, guest order tokens, uploads, password auth, SMS), then set `VITE_API_URL`.
- Map tiles use the public OpenStreetMap server, which is fine for development but not for production traffic — switch to a tile provider (MapTiler, Stadia, Mapbox) in `src/components/MapView.tsx`.
- Enquiries are one shared conversation: the trainee's `My enquiries` and the centre's inbox read and write the same record (`POST /enquiries/:id/messages`). A centre reply notifies the trainee in-app if they sent the enquiry while signed in; guest enquiries are answered by phone/SMS.
- Notifications are in-app only (bell, unread count, tab title, arrival toast) and created by the server (the mock) when orders and enquiries change; the client polls every minute. Each role's notification settings (Settings → Notification preferences; admins: Platform settings → My notifications) are checked when a notification is created, so switching one off stops new ones of that kind. The SMS and news toggles are saved but nothing is sent until SMS/email is connected. Add SMS/push delivery on the backend; the rules for who gets what live in `src/lib/notifications.ts`.
- Checkout is simulated: Mobile Money shows an approval prompt, card shows a redirect, and the mock server marks the order paid. Connect a payment provider such as Paystack or Hubtel (MoMo + card) on the backend, with a webhook marking orders paid; the UI stages are in `src/pages/public/Cart.tsx`.
- Marketplace listings, stock and course progress are saved through the API (the mock keeps them in the browser). Seller photo uploads are resized to small JPEG data URLs; with a backend, upload them to file storage and save the URL. The course player shows a placeholder until lesson videos can be uploaded and streamed.
- Photos are Unsplash placeholders; replace with providers' own uploads.
