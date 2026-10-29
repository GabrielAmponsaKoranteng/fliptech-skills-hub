# Fliptech Skills Hub — API

This is the contract between the frontend and the backend. The frontend talks to it only through
`src/api/contract.ts` (the `Api` interface). Two implementations exist:

| | File | Used when |
|---|---|---|
| **Mock** | `src/api/mock/` | default — runs in the browser on `localStorage`, enforces the rules below |
| **HTTP** | `src/api/http.ts` | `VITE_API_URL` is set — calls the REST routes in this document |

**The backend is done, as far as the frontend is concerned, when `http.ts` works against it without changes.**
Where this document and the mock disagree, the mock (`src/api/mock/server.ts`) is the reference.
It is short and readable, so it's worth reading when building an endpoint.

Shapes are TypeScript types from `src/types.ts` (`Order`, `Enquiry`, `Provider`, …) and input types from
`src/api/contract.ts` (`PlaceOrderInput`, `NewEnquiryInput`, …). They are not repeated here.

---

## Conventions

**Base URL.** Set it with `VITE_API_URL`, for example `https://api.fliptech.com/v1`. Every path below is relative to it.

**JSON.**
- Request and response bodies are JSON.
- A `204 No Content` response is read as `undefined`, so any `Promise<void>` method may return 204.

**Auth.**
- Sign-in, demo sign-in and both register endpoints return `{ "user": User, "token": "…" }`.
- The client stores the token in `localStorage['fsh.token']` and sends `Authorization: Bearer <token>` on every request.
- It also sends `credentials: 'include'`, so an HTTP-only session cookie works instead. If you use cookies, leave out `token` and set CORS `Access-Control-Allow-Credentials`.
- `GET /auth/me` returns the user or `null`. A `401` is also read as "signed out".

**The caller comes from the session, never from the request.** No endpoint takes a `userId` or `sellerId` that it trusts:
- A trainer acts for their own centre (`user.centreId`).
- A trainee sees only their own orders and enquiries.

**Ids.**
- The server creates ids.
- Exception: `PUT /listings/...` and `PUT /centre/programmes/:id` are upserts. An unknown id creates the item, an empty id asks the server to pick one, and the response holds the saved item with its final id.
- Order ids look like `FSH-XXXXXX`.

**Dates and money.**
- `placedAt` and `createdAt` are ISO 8601 timestamps; intake and visit dates are `YYYY-MM-DD`.
- Money is a whole number of Ghana cedis (`price: 120` means GH₵120).

**Errors.** Any non-2xx status has this body:

```json
{ "code": "validation", "message": "Please fix the highlighted fields", "fields": { "phone": "Enter a valid Ghana number" } }
```

| Status | `code` | Meaning | What the UI does |
|---|---|---|---|
| 400 / 422 | `validation` | bad input; `fields` maps form field → message | inline field errors + toast |
| 401 | `unauthenticated` | no or expired session | treated as signed out |
| 403 | `forbidden` | signed in but not allowed (wrong role, suspended, feature switched off) | toast |
| 404 | `not_found` | doesn't exist or caller can't see it (prefer 404 over 403 for other people's records) | error state |
| 409 | `conflict` | valid request, wrong state: out of stock, duplicate email, illegal status change | toast with `message` |
| 5xx | `server` | anything else | toast + retry |
| — | `network` | the request never got a response (client-side) | toast + retry |

- `message` is shown to people as written, so keep it short, friendly and specific (for example "Only 2 Leather apron left").
- If `code` is missing, the client derives it from the status.

---

## Endpoints

`T`, `R` and `A` mean the endpoint needs the trainee, trainer or admin role. `·` means any signed-in user, and `—` means no session is needed.

### Auth

| Method | Path | Who | Body | Returns |
|---|---|---|---|---|
| GET | `/auth/me` | — | | `User \| null` |
| POST | `/auth/sign-in` | — | `{ identifier, password }` (identifier is a phone number or an email) | `{ user, token }` |
| POST | `/auth/demo` | — | `{ role }` | `{ user, token }` — **demo only, delete in production** |
| POST | `/auth/sign-out` | · | | 204 |
| POST | `/auth/register/trainee` | — | `RegisterTraineeInput` | `{ user, token }` |
| POST | `/auth/register/centre` | — | `RegisterCentreInput` | `{ user, token }` |
| POST | `/auth/password-reset` | — | `{ identifier }` (phone or email) | 204, whether or not the account exists |
| POST | `/auth/password-reset/confirm` | — | `{ token, password }` | 204 — 409 if the link expired or was used, 422 if the password is too short |

- **Password reset.**
  - `/auth/password-reset` sends a link to `/reset-password?token=…` by email, or by SMS when the account has no email.
  - It **always returns 204**, so the form can't be used to find out who has an account.
  - Links are random, work once, and expire after 1 hour. Requesting a new link replaces the old one.
  - A successful reset should end the account's other sessions.
  - `POST /admin/users/:id/password-reset` sends the same link.
- **Sign-in** returns 403 for accounts that are `Suspended` or not yet `Active`, for example an admin who was invited but hasn't accepted.
- **Trainee registration** returns 403 when the `signups` setting is off. It returns 409 if the phone number (compared without spaces) or the email is already registered.
- **Centre registration** returns 403 when `trainerReg` is off.
  - It creates three things: a trainer account (with `centreId`), the centre's `Provider` record with status `Pending` (built from the form and its programmes), and an item in the verification queue (with `providerId`).
  - The centre isn't public until an admin approves it. Until then the trainer still sees and manages it, through `myCentre` in `/catalog`.
  - When the `autoPublish` setting is on, the centre is published and the queue item is `Approved` straight away.
  - Centre ids are slugs of the name, made unique (`dansoman-catering-school`, then `-2`).

### My account

| Method | Path | Who | Body | Returns |
|---|---|---|---|---|
| PATCH | `/me` | · | `ProfilePatch` | `User` |
| POST | `/me/password` | · | `{ current, next }` | 204 — 422 if `current` is wrong or `next` has fewer than 8 characters |
| POST | `/me/export` | · | | 204 — emails the data export (asynchronous) |
| DELETE | `/me` | · | | 204 — deletes the account and ends the session |
| GET | `/me/saved` | · | | `string[]` (ids of saved providers) |
| PUT | `/me/saved/:providerId` | · | `{}` | `string[]` |
| DELETE | `/me/saved/:providerId` | · | | `string[]` |

Saving a provider can create an intake reminder; see [Notifications](#notifications).

### Catalog (public reference data)

| Method | Path | Who | Returns |
|---|---|---|---|
| GET | `/catalog` | — | `{ providers: Provider[], trades: Trade[], areas: string[], categories: SkillCategory[], site: SiteInfo, myCentre?: Provider }` |
| GET | `/providers/:id/reviews` | — | `Review[]`, or `[]` while the `reviews` setting is off |
| POST | `/providers/:id/views` | — | 204. Counts one visit to the centre's public page |

- `/catalog` is loaded once at startup and again after an admin or trainer changes it.
- It contains **published** providers only: no suspended or unapproved ones, and no moderation fields (`status`, `featured`).
- **`site`** is the public part of the platform settings: `supportPhone`, `supportEmail`, `announcement`, and the `maintenance`, `signups`, `trainerReg` and `reviews` switches. The UI uses it for:
  - the maintenance banner shown on every page
  - the homepage announcement
  - the contact details on the contact and help pages
  - pausing the sign-up and registration forms
  - hiding the reviews tab

  Never include private settings such as `autoPublish` or `sms`.
- **`myCentre`** is sent only to a trainer whose own centre isn't published yet, so they can set it up while they wait. It is never listed in search.
- **The response depends on the session**, so the client reloads it after sign-in, sign-out and registration. Cache per user, or leave `myCentre` out of any shared cache.
- This response can be cached for a short time; keep it small.
- **Page views.** The public centre page posts `/providers/:id/views` once when it opens.
  - Don't count visits from that centre's own staff or from admins, and ignore centres that aren't published. These still return 204, so the page doesn't need to know.
  - Store counts per centre per day. A real backend should also filter out bots and repeat visits from the same person in a short time.

### Listings (marketplace courses and products)

| Method | Path | Who | Body | Returns |
|---|---|---|---|---|
| GET | `/listings` | — | | `{ courses: Course[], products: Product[] }` |
| PUT | `/listings/courses/:id` | R | `Course` | `Course` |
| PUT | `/listings/products/:id` | R | `Product` | `Product` |
| PATCH | `/listings/{courses\|products}/:id/status` | R | `{ status: 'Published' \| 'Hidden' }` | 204 |
| DELETE | `/listings/{courses\|products}/:id` | R | | 204 |

- **Visibility.**
  - Everyone gets the published listings. A trainer also gets their own hidden ones.
  - `sellerId` is set from the session, and editing another seller's listing returns 403.
  - Counts like `reviews` and `rating` are owned by the server; ignore them if a client sends them.
- **A course with learners can't be deleted.** If anyone has bought it in an order that isn't cancelled, the delete returns 409. The UI offers to hide the course instead, so learners keep their access.
- **Images.** These are URLs. The demo sends small JPEG `data:` URLs from the photo picker. A real backend should take uploads instead (see [Not done yet](#not-done-yet-backend-work-the-frontend-expects)).

### Orders

| Method | Path | Who | Body | Returns |
|---|---|---|---|---|
| GET | `/orders` | · | | `Order[]`, newest first |
| GET | `/orders/:id` | — / · | | `Order` |
| POST | `/orders` | — | `PlaceOrderInput` | `Order` |
| PATCH | `/orders/:id/sellers/:sellerId` | R, A | `{ status: SellerStatus }` | `Order` |
| POST | `/orders/:id/mark-paid` | A | | `Order` |
| POST | `/orders/:id/cancel` | A | | `Order` |

**Who sees which orders (`GET /orders`)**
- A trainee sees the orders they placed.
- A trainer sees every order with at least one of their items. Today the whole order is returned; see the redaction note below.
- An admin sees all orders.

**Reading one order (`GET /orders/:id`)** follows the same rules. Orders placed as a guest are readable by id so the confirmation page works. Replace that with a signed token (see [Not done yet](#not-done-yet-backend-work-the-frontend-expects)).

**Placing an order (`POST /orders`)**

The client sends only `{ id, kind, qty }` for each item. **The server prices the order from its own listings.** Use `cartTotals` in `src/lib/pricing.ts` as the reference:
- Delivery costs GH₵25, and is free over GH₵300.
- Delivery is charged only when there are products and `fulfilment` is `'delivery'`.

The server checks, in this order:
1. The cart isn't empty (422).
2. Every item is still published (409).
3. Every quantity is 1 or more (422).
4. There is enough stock (409 "Only N … left" or "… is sold out").
5. The contact details are valid: name, Ghana phone number, and an address for delivery (422 with `fields`).
6. The payment method fits the order:
   - An order that costs GH₵0 is always stored with `payment: 'free'`, whatever was sent. Sending `'free'` for an order that costs something returns 422.
   - `'cod'` (pay on delivery) is allowed only for delivered products with no paid courses.

When the order is valid, the server:
- Sets `status` to `'Awaiting payment'` for `cod`, and to `'Paid'` otherwise. See the payments note under [Not done yet](#not-done-yet-backend-work-the-frontend-expects).
- Sets each seller's `sellerStatus` to `'New'` for products, or `'Completed'` for courses (they are delivered instantly).
- **Decrements the product stock.**
- Sends `new_order` notifications to each seller and to the admins.

**Changing a seller's status (`PATCH /orders/:id/sellers/:sellerId`)**

A seller moves only their own part of the order, one step at a time:

```
New → Confirmed → Ready for pickup  → Completed     (fulfilment: pickup)
                → Out for delivery  → Completed     (fulfilment: delivery)
New | Confirmed → Cancelled
```

- Any other change returns 409. `nextStep()` and `canCancel()` in `src/lib/orders.ts` are the rules; the Admin role may set any status.
- Setting the status it already has does nothing and returns 200.
- Completing a `cod` order also sets the order's `status` to `'Paid'`.
- Cancelling **puts that seller's product stock back**.
- The buyer gets an `order_update` notification when signed in.

**Admin actions**
- `/mark-paid` sets `status` to `'Paid'`, for example when cash is reconciled.
- `/cancel` cancels every seller's part, puts the stock back, and notifies the sellers and the buyer. The buyer's message mentions a refund when the order was paid.

### Enquiries

| Method | Path | Who | Body | Returns |
|---|---|---|---|---|
| GET | `/enquiries` | · | | `Enquiry[]`, newest first |
| POST | `/enquiries` | — | `NewEnquiryInput` | `Enquiry` |
| POST | `/enquiries/:id/messages` | T, R | `{ text }` | `Enquiry` |
| PATCH | `/enquiries/:id` | R | `{ inboxStatus: InboxStatus }` | `Enquiry` |
| POST | `/enquiries/:id/read` | R | | 204 |
| PATCH | `/enquiries/:id/flag` | A | `{ flagged: boolean }` | `Enquiry` |
| DELETE | `/enquiries/:id` | A | | 204 |

- **Who sees which enquiries.**
  - A trainee sees their own enquiries.
  - A trainer sees their centre's enquiries, **except flagged ones**.
  - An admin sees all of them.
- **Guest enquiries.** Anyone can create an enquiry. A signed-in trainee gets `userId`, which lets them follow the thread in the app. A guest is answered by phone or SMS.
- **Spam screen.** On create, messages that match known spam patterns (`bit.ly` links, "click here", "win free") are given `flagged: true`. They go to admin moderation instead of the centre's inbox. "Not spam" (`flagged: false`) releases them to the centre.
- **One shared thread.**
  - The trainee and the centre read and write the same `thread`. The sender's side comes from the session.
  - Messages must be 1–2,000 characters.
  - A centre reply sets `status: 'Replied'` and notifies the trainee (`enquiry_reply`) if they have an account.
  - A trainee reply marks the enquiry unread for the centre.

### Notifications

| Method | Path | Who | Body | Returns |
|---|---|---|---|---|
| GET | `/notifications` | · | | `AppNotification[]` for the caller, newest first |
| POST | `/notifications/read` | · | `{ ids: string[] }` | 204 |
| GET | `/notifications/prefs` | · | | `NotificationPrefs` |
| PATCH | `/notifications/prefs` | · | `{ [pref]: boolean }` (one key) | `NotificationPrefs` |

- **Created by the server.** Notifications are made as a side effect of other actions; there is no `POST /notifications`. The rules for who receives what are in `src/lib/notifications.ts`, which is pure and can be reused on the server:
  - `newOrderNotifications`
  - `orderUpdateNotification`
  - `enquiryReplyNotification`
  - `intakeReminders`
- **Audience.** Each notification goes to one user, or to "every admin", or to "the trainer account for this seller".
- **Preferences.**
  - They are checked when the notification is created, so turning one off stops new notifications of that kind.
  - The keys are `newOrders`, `cancellations`, `orderUpdates`, `intakeReminders`, `enquiryReplies`, `news` and `sms`.
  - The defaults are in `DEFAULT_PREFS`.
- **Intake reminders.**
  - A trainee gets one when a saved provider's intake starts within 7 days.
  - Only one is sent per programme intake (`dedupeKey`).
  - The mock creates them lazily on `GET /notifications`; a real server can run a daily job instead.
- **Polling.** The client calls `/notifications`, `/orders` and `/enquiries` every 60 seconds and whenever the tab regains focus. Server-sent events or a WebSocket can replace this later without changing the contract.

### Learning (the trainee's course progress)

| Method | Path | Who | Body | Returns |
|---|---|---|---|---|
| GET | `/learning/progress` | T | | `Record<courseId, CourseProgress>` |
| PUT | `/learning/courses/:courseId/lessons/:lessonId` | T | `{ done: boolean }` | `CourseProgress` |
| PUT | `/learning/courses/:courseId/last-lesson` | T | `{ lessonId }` | `CourseProgress` |

The trainee must own the course, through an order for it that isn't cancelled. Otherwise these return 403.

### My centre (trainer)

| Method | Path | Who | Body | Returns |
|---|---|---|---|---|
| GET | `/centre/programmes` | R | | `TrainerProgramme[]` |
| PUT | `/centre/programmes/:id` | R | `TrainerProgramme` (an empty id creates one) | `TrainerProgramme` |
| DELETE | `/centre/programmes/:id` | R | | 204 |
| GET | `/centre/stats` | R | | `CentreStats` |
| PATCH | `/centre/profile` | R | `CentreProfilePatch` | `Provider` |
| POST | `/centre/visits` | R | `{ date, slot: 'morning' \| 'afternoon', notes? }` | 204 |

- **Dashboard stats.** `/centre/stats` powers the trainer overview. Each number covers the last 30 days and comes with the 30 days before, for the trend.
  - `views`: public page views (see Catalog).
  - `enquiries`: enquiries received, by the date they were sent. Flagged spam doesn't count.
  - `enrolled`: enquiries from the period that the centre has marked Enrolled.
  - `replyHours`: average hours from an enquiry's first message to the centre's first reply, or `null` when nothing in the period was answered. Messages carry `sentAt` (ISO time) for this.
  - `weekly`: 8 weeks of views and enquiries, starting on Mondays; the last week is the current one.
  - `enrolledByProgramme`: Enrolled enquiries per programme name over the last 90 days. The dashboard shows it against the places still open for each upcoming intake.
- **Programmes and the public listing.** Changing programmes updates the provider's public `programmes` and lowest `fee` from the published programmes.
  - A real backend should also update `months`, the next `intake` and `places` from them.
- **After saving.** The client reloads `/catalog` after saving, so the public page shows the change at once.

### Admin

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/admin/users` | | `AdminUser[]` |
| PATCH | `/admin/users/:id` | `{ role?, status? }` | `AdminUser` — 409 on your own account |
| POST | `/admin/invitations` | `InviteAdminInput` | `AdminUser` with `status: 'Invited'` — 409 if the email is already used |
| DELETE | `/admin/invitations/:userId` | | 204 — 409 if already accepted |
| POST | `/admin/invitations/:userId/resend` | | 204 |
| POST | `/admin/users/:id/password-reset` | | 204 |
| GET | `/admin/verification` | | `QueueItem[]` |
| POST | `/admin/verification/:id/decision` | `{ status: QueueStatus, message? }` | `QueueItem` |
| GET | `/admin/providers` | | `AdminProvider[]` (includes suspended, with `status` and `featured`) |
| PATCH | `/admin/providers/:id` | `ProviderModerationPatch` | `AdminProvider` |
| GET | `/admin/activity` | | `Activity[]`, newest first (up to 50) |
| GET | `/admin/stats?months=6` | | `AdminStats`: totals, a monthly series (1–24 months) and top providers |
| PUT | `/admin/trades/:id` | `Trade` (`new` or an unknown id creates one; the id comes from the name) | `Catalog` |
| PUT | `/admin/areas` | `{ areas: string[] }` (trimmed and de-duplicated; at least one) | `Catalog` |
| PUT | `/admin/categories` | `{ categories: SkillCategory[] }` | `Catalog` |
| GET | `/admin/settings` | | `PlatformSettings` |
| PATCH | `/admin/settings` | `Partial<PlatformSettings>` (`flags` is merged, not replaced) | `PlatformSettings` |

- **Stats.** `/admin/stats` powers the overview and its CSV export.
  - Totals count accounts that have accepted their invitation.
  - Flagged (spam) enquiries are left out.
  - `replyRate` is the share of a centre's enquiries that has at least one reply from the centre.
- **Role.** Every route above needs the Admin role.
- **Access levels.** Admins have `access`: `super`, `verification` or `support`. A missing value means `super`. `GET /auth/me` returns it, so the UI can hide what an admin can't use.
  - Each route also needs an *area*. The table is `ADMIN_AREAS` in `src/lib/access.ts`; the server, the admin menu and the page guards all use it.
  - Calls outside the admin's areas return 403.

  | Area | Routes | super | verification | support |
  |---|---|:-:|:-:|:-:|
  | verification | `/admin/verification*` | ✓ | ✓ | |
  | providers | `/admin/providers*` | ✓ | ✓ | |
  | users | `GET /admin/users`, `PATCH /admin/users/:id` (status), `/password-reset` | ✓ | | ✓ |
  | enquiries | all enquiries in `GET /enquiries`, `/enquiries/:id/flag`, `DELETE /enquiries/:id` | ✓ | | ✓ |
  | orders | all orders in `GET /orders`, admin status overrides, `/mark-paid`, `/cancel` | ✓ | | ✓ |
  | catalog | `/admin/trades`, `/admin/areas`, `/admin/categories` | ✓ | | |
  | settings | `/admin/settings`, `/admin/invitations*`, changing anyone's `role` | ✓ | | |

  - Without the orders or enquiries area, `GET /orders` and `GET /enquiries` return `[]` for an admin.
  - `/admin/activity` and the admin's own notifications are open to every admin.
- **Audit log.**
  - Suspending a user, inviting an admin and verification decisions add an entry to `/admin/activity`.
  - Add the rest (provider moderation, settings) on the server.
- **Rejection messages.** When an application is rejected, `message` holds the reason and the note to the applicant, ready to email.
- **What a decision does to the centre.** A decision also sets the status of the centre's `Provider` (the queue item's `providerId`):
  - `Approved` sets it to `Published`, so the centre appears in `/catalog`.
  - `Rejected` sets it to `Rejected`.
  - Any other stage sets it to `Pending`.

### Support

| Method | Path | Who | Body | Returns |
|---|---|---|---|---|
| POST | `/support/messages` | — | `{ name, email, topic, message }` | 204 — 422 with `fields` |

---

## Not done yet: backend work the frontend expects

These were simulated in the frontend because the scope so far was the frontend only. Each needs a real implementation behind the same endpoints.

- **Payments (Paystack or Hubtel: MoMo and card).**
  - Today `POST /orders` returns the order already `Paid`.
  - In production, `POST /orders` should return `status: 'Awaiting payment'` plus a payment reference or checkout URL. The provider's **webhook** then sets `status: 'Paid'` (or a failed status).
  - Notify sellers only once the order is paid, except for `cod` orders.
  - The checkout UI in `src/pages/public/Cart.tsx` already has the MoMo prompt and card redirect stages, so they can be wired to the provider's SDK.
- **Guest order access.**
  - Return a signed `accessToken` with a guest order, and require it on `GET /orders/:id?token=…`.
  - Today, anyone who has the order id can read the order.
- **Seller-scoped orders.**
  - A trainer currently receives the whole order, including other sellers' items and the buyer's full contact details.
  - Trim it to the trainer's own `items`, with only the contact details needed to fulfil them.
  - The UI already shows only the seller's own items (`sellerOrders()` in `src/lib/orders.ts`), so nothing changes visibly.
- **Uploads.**
  - Profile photos, listing photos and centre photos are currently small JPEG data URLs (resized in the browser by `src/lib/image.ts`). Verification documents are file names only.
  - `PATCH /me` accepts `avatar` (a URL; an empty string removes it).
  - Add an upload endpoint (for example a presigned URL to object storage) that returns a URL, and save only URLs in records.
- **Passwords and sessions.**
  - The mock accepts any password for the seeded accounts.
  - Hash passwords; add admin invitation acceptance and session expiry. The reset flow is specified above; the mock records the link instead of sending it, and the demo shows it on screen.
  - Remove `POST /auth/demo` and the demo buttons on `/signin`.
- **SMS and email.** Enquiry alerts to centres, guest replies, data exports, invitations and password resets all need a sender. Africa's Talking, Hubtel or Twilio would work for SMS. Check the `sms` setting and preference before sending.
- **Idempotency.** `POST /orders` and `POST /enquiries` can be retried by the client after a network error. Accept an `Idempotency-Key` header so that a retry doesn't create a duplicate.
- **Retry.** The client doesn't retry automatically: the person sees the error and tries again.
- **Link previews.**
  - WhatsApp, Facebook, X and LinkedIn build a link's preview from the HTML the server sends, without running the app. So today every shared link shows the site-wide preview in `index.html`.
  - For a centre, course or product to preview with its own name, summary and photo, the server (or a small edge function) should fill in `<title>`, `meta[name=description]` and `og:title`, `og:description`, `og:image`, `og:url` before sending `index.html` for these addresses:
    - `/providers/:id`: `{name}, {area} · Fliptech Skills Hub`, the blurb, and the first photo
    - `/courses/:id`: `{title} – online course · Fliptech Skills Hub`, the description, and the image
    - `/marketplace/:id`: `{title} · Fliptech Skills Hub`, the description, and the image
  - Use the same wording as the app (`usePageMeta` in `src/lib/pageMeta.ts`), so the tab title doesn't change once the app starts. Images should be about 1200×630.

---

## Working with the mock

**Data.**
- Data lives in `localStorage` under `fsh.db.v3.*`.
- It is seeded from `src/data/mock.ts` on first use, by `src/api/mock/seed.ts`.
- `src/api/mock/bulk.ts` adds generated volume on top: about 180 trainees, a trainer account for every published centre, 320 enquiries over 12 months, 90 marketplace orders over 6 months and 90 days of page views per centre. A fixed random seed and a fixed "today" (28 Oct 2026) make it the same on every machine. The demo accounts (u1–u3) keep only their hand-written data.
- Changing the seed? Bump the `fsh.db.vN.` prefix in `db.ts` so browsers that already have data pick up the new seed.
- Only `src/api/mock` may import `src/data/mock.ts`; app code reads everything through `api`.

**Simulating a slow or failing network.** Set these in `.env.local`:

```bash
VITE_MOCK_LATENCY=250     # ms per call (jittered), default 250
VITE_MOCK_FAIL_RATE=0     # 0–1, chance of a 503 on any call
```

Or change them at runtime from the browser console (development builds only):

```js
fshMock.set({ latency: 1500, failRate: 0.3 }) // slow and flaky
fshMock.set({ offline: true })                // every call fails with a network error
fshMock.clear()                               // back to the .env defaults
fshMock.reset()                               // restore the demo data and reload
```

**Switching to a real backend.** Set `VITE_API_URL` and restart `npm run dev`. Nothing else changes.

## Tests

`npm test` runs the Vitest suite. Most of it, in `src/api/mock/server.test.ts`, checks the mock server against the rules in this document: each test is a rule a real backend must enforce too, so it works as an acceptance checklist. `src/lib/rules.test.ts` covers the shared rules for pricing, order steps, listings and notifications, and `src/lib/search.test.ts` and `providerSearch.test.ts` cover search matching, ranking and the "did you mean" suggestions.

**Search runs in the browser.** Provider search filters `/catalog`, and the marketplace and courses filter `/listings`, so no search endpoint is needed at the current size. The filters live in the URL, which keeps them across Back and makes links shareable:

- `/search?q=&trade=&area=&fee=&verified=&sort=&view=&page=`
- `/marketplace` and `/courses`: `?q=&cat=&sort=&free=1`

If search moves to the server later, accept the same parameters so existing links keep working.

`npm run e2e` runs the Playwright tests in `e2e/`. They drive the production build in Chromium (desktop, plus a phone-sized project for the tests tagged `@mobile`), with the mock server's delay turned off. Each test starts from the seed data, because each one gets a fresh browser profile. They cover:

- **Public:** finding a centre and sending a guest enquiry, the not-found page, the skip link.
- **Accounts:** registering, signing out and in, the password-reset link (including that it works only once), and dashboards sending signed-out visitors to sign in.
- **Marketplace:** a trainee checks out with pay on delivery, then finds the order in their orders and in the seller's.
- **Centres and admins:** a trainer replies to an enquiry and the dashboard count goes up; an admin approves an application and the centre shows up in search; a support admin can't open the verification queue.
- **Accessibility:** dialog focus and Escape, keyboard-opened table rows, the phone sidebar menu, and no sideways scrolling on phones.

The mock doesn't check passwords yet (see "Not done yet"), so the sign-in tests check the flow, not the password. Once a real backend checks them, add a wrong-password case.
