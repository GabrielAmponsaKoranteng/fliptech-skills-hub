// In-browser implementation of the API contract. It behaves like the real server should:
// it checks the session and role on every call, owns all business rules (pricing, stock,
// order status changes, who gets notified), and returns only what the caller may see.
// Treat it as the reference implementation for the backend team.
import { ApiError, type Api, type PlaceOrderInput } from '../contract';
import { read, update, write, type DbUser, type OutboxMessage } from './db';
import { USERS } from '../../data/mock';
import { cartTotals } from '../../lib/pricing';
import { messageTime } from '../../lib/format';
import { isPublished, ownedCourseIds } from '../../lib/listings';
import { canCancel, nextStep, sellerOrders, sellersIn } from '../../lib/orders';
import { canAdmin, type AdminArea } from '../../lib/access';
import { draftCentre, uniqueId } from './centres';
import {
  DEFAULT_PREFS, audienceKey, enquiryReplyNotification, intakeReminders, newOrderNotifications, orderUpdateNotification,
  prefFor, type NewNotification,
} from '../../lib/notifications';
import type {
  AdminProvider, AdminStats, AdminUser, Audience, CartItem, CentreStats, Course, Enquiry, Message, NotificationPrefs, Order, Product, Provider, ProviderStatus, QueueItem,
  QueueStatus, SellerStatus, SiteInfo, Trade, TradeId, TrainerProgramme, User,
} from '../../types';

// ---------------------------------------------------------------- helpers

const PHONE_RE = /^0\d{2}\s?\d{3}\s?\d{4}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Sellers without their own centre record fall back to the demo centre. */
const DEMO_CENTRE = 'accra-central-welding';

const fail = (status: number, code: ApiError['code'], message: string, fields?: Record<string, string>): never => {
  throw new ApiError(status, code, message, fields);
};
const notFound = (what: string) => fail(404, 'not_found', `${what} not found`);
const today = () => new Date().toISOString().slice(0, 10);
const newId = (prefix: string) => `${prefix}${Date.now().toString(36).toUpperCase().slice(-5)}${Math.random().toString(36).slice(2, 3).toUpperCase()}`;
const normPhone = (p: string) => p.replace(/\s/g, '');
const isCourse = (x: Course | Product): x is Course => 'curriculum' in x;

const toUser = (u: DbUser): User => ({
  id: u.id, role: u.role, name: u.name, email: u.email, phone: u.phone, area: u.area || undefined, centreId: u.centreId, avatar: u.avatar,
  access: u.role === 'admin' ? u.access ?? 'super' : undefined,
});
const toAdminUser = ({ phone: _p, centreId: _c, avatar: _a, ...a }: DbUser): AdminUser => a;

const RESET_LINK_HOURS = 1;

/** Records a message instead of sending it (see OutboxMessage). */
function sendMessage(m: Omit<OutboxMessage, 'id' | 'at'>) {
  update('outbox', (l) => [{ ...m, id: newId('m-'), at: new Date().toISOString() }, ...l].slice(0, 50));
}

/** Creates a one-time reset link for the user and "sends" it. */
function issueResetLink(u: DbUser) {
  const token = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
  const expires = new Date(Date.now() + RESET_LINK_HOURS * 3600e3).toISOString();
  update('resetTokens', (l) => [...l.filter((t) => t.userId !== u.id), { token, userId: u.id, expires }]);
  sendMessage({ to: u.email || u.phone, kind: 'password_reset', subject: 'Reset your Fliptech password', link: `/reset-password?token=${token}` });
}

/** Months as YYYY-MM, oldest first, ending with the current month. */
/** When a message was sent. Older seed messages only have a label like "2 Oct, 10:14"; the year comes from the enquiry. */
function sentTime(e: Enquiry, m: Message): number {
  if (m.sentAt) return Date.parse(m.sentAt);
  const t = Date.parse(`${m.at.replace(',', '')} ${e.date.slice(0, 4)}`.replace(/^(\d+ \w+) (\d+:\d+) (\d{4})$/, '$1 $3 $2'));
  return Number.isNaN(t) ? Date.parse(e.date) : t;
}

/** Dashboard numbers for one centre: the last 30 days against the 30 before, plus 8 weeks of history. */
function centreStats(centreId: string, now = new Date()): CentreStats {
  const day = (offset: number) => new Date(now.getTime() - offset * 864e5).toISOString().slice(0, 10);
  const views = read('views')[centreId] ?? {};
  const enquiries = read('enquiries').filter((e) => e.providerId === centreId && !e.flagged);
  /** True for dates between `to` days ago (exclusive) and `from` days ago (inclusive). */
  const within = (date: string, from: number, to: number) => date > day(to) && date <= day(from);
  const sumViews = (from: number, to: number) => Object.entries(views).reduce((s, [d, n]) => s + (within(d, from, to) ? n : 0), 0);
  const inRange = (from: number, to: number) => enquiries.filter((e) => within(e.date, from, to));
  const replyHours = (list: Enquiry[]) => {
    const waits = list.flatMap((e) => {
      const reply = e.thread.find((m) => m.from === 'trainer');
      return reply ? [(sentTime(e, reply) - sentTime(e, e.thread[0])) / 36e5] : [];
    }).filter((h) => h >= 0);
    return waits.length ? Math.round((waits.reduce((a, b) => a + b, 0) / waits.length) * 10) / 10 : null;
  };
  const [current, previous] = [inRange(0, 30), inRange(30, 60)];

  // Weeks start on Monday; the last one is the current (partial) week.
  const monday = new Date(now);
  monday.setUTCHours(0, 0, 0, 0);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const weekly = Array.from({ length: 8 }, (_, i) => {
    const start = new Date(monday.getTime() - (7 - i) * 7 * 864e5).toISOString().slice(0, 10);
    const end = new Date(Date.parse(start) + 7 * 864e5).toISOString().slice(0, 10);
    const inWeek = (d: string) => d >= start && d < end;
    return {
      week: start,
      views: Object.entries(views).reduce((s, [d, n]) => s + (inWeek(d) ? n : 0), 0),
      enquiries: enquiries.filter((e) => inWeek(e.date)).length,
    };
  });

  const enrolledByProgramme: Record<string, number> = {};
  for (const e of inRange(0, 90)) if (e.inboxStatus === 'Enrolled') enrolledByProgramme[e.programme] = (enrolledByProgramme[e.programme] ?? 0) + 1;

  const enrolled = (list: Enquiry[]) => list.filter((e) => e.inboxStatus === 'Enrolled').length;
  return {
    views: { current: sumViews(0, 30), previous: sumViews(30, 60) },
    enquiries: { current: current.length, previous: previous.length },
    enrolled: { current: enrolled(current), previous: enrolled(previous) },
    replyHours: { current: replyHours(current), previous: replyHours(previous) },
    weekly,
    enrolledByProgramme,
  };
}

function lastMonths(n: number, now = new Date()): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
}

function currentUser(): DbUser | null {
  const s = read('session');
  const u = s && read('users').find((x) => x.id === s.userId);
  return u && u.status === 'Active' ? u : null;
}
function requireUser(...roles: User['role'][]): DbUser {
  const u = currentUser() ?? fail(401, 'unauthenticated', 'Please sign in to continue');
  if (roles.length && !roles.includes(u.role)) fail(403, 'forbidden', 'You don’t have access to this');
  return u;
}
/** An admin whose access level includes `area` (see lib/access). Without an area, any admin. */
function requireAdmin(area?: AdminArea): DbUser {
  const u = requireUser('admin');
  if (area && !canAdmin(u.access, area)) fail(403, 'forbidden', 'Your admin role doesn’t include this. Ask a super admin.');
  return u;
}
const sellerOf = (u: DbUser) => u.centreId ?? DEMO_CENTRE;
const audienceOfUser = (u: DbUser): Audience =>
  u.role === 'admin' ? { role: 'admin' } : u.role === 'trainer' ? { role: 'trainer', sellerId: sellerOf(u) } : { role: 'trainee', userId: u.id };

const providerNames = () => read('providers');
const publicProviders = (): Provider[] =>
  read('providers').filter((p) => p.status === 'Published').map(({ status: _s, featured: _f, ...p }) => p);

function addActivity(icon: string, tone: 'brand' | 'success' | 'warn' | 'danger' | 'violet' | 'accent', text: string, by: string) {
  update('activity', (a) => [{ icon, tone, text, by, at: messageTime() }, ...a].slice(0, 50));
}

/** Creates notifications, skipping any the recipient has switched off and any already sent (same dedupeKey). */
function notify(list: (NewNotification | null)[]) {
  const prefs = read('prefs');
  const at = new Date().toISOString();
  const existing = read('notifications');
  const sent = new Set(existing.map((n) => n.dedupeKey).filter(Boolean));
  const fresh = list
    .filter((n): n is NewNotification => n != null)
    .filter((n) => ({ ...DEFAULT_PREFS, ...prefs[audienceKey(n.audience)] })[prefFor(n)])
    .filter((n) => !n.dedupeKey || !sent.has(n.dedupeKey))
    .map((n, i) => ({ ...n, id: `n-${Date.now().toString(36)}-${i}-${Math.random().toString(36).slice(2, 6)}`, createdAt: at, read: false }));
  if (fresh.length) write('notifications', [...fresh, ...existing].slice(0, 500));
}

function visibleOrders(u: DbUser | null): Order[] {
  const all = read('orders');
  if (!u) return [];
  if (u.role === 'admin') return canAdmin(u.access, 'orders') ? all : [];
  if (u.role === 'trainer') return all.filter((o) => o.items.some((i) => i.sellerId === sellerOf(u)));
  return all.filter((o) => o.userId === u.id);
}

function visibleEnquiries(u: DbUser | null): Enquiry[] {
  const all = read('enquiries');
  if (!u) return [];
  if (u.role === 'admin') return canAdmin(u.access, 'enquiries') ? all : [];
  if (u.role === 'trainer') return all.filter((e) => e.providerId === sellerOf(u) && !e.flagged);
  return all.filter((e) => e.userId === u.id);
}

/** Puts back the products from the given sellers' parts of an order that weren't already cancelled. */
function restock(o: Order, sellerIds: string[]) {
  const back = o.items.filter((i) => i.kind === 'product' && sellerIds.includes(i.sellerId) && o.sellerStatus?.[i.sellerId] !== 'Cancelled');
  if (!back.length) return;
  update('products', (list) => list.map((p) => {
    const n = back.filter((i) => i.id === p.id).reduce((sum, i) => sum + i.qty, 0);
    return n ? { ...p, stock: p.stock + n } : p;
  }));
}

function replaceOrder(o: Order) { update('orders', (l) => l.map((x) => (x.id === o.id ? o : x))); return o; }
function replaceEnquiry(e: Enquiry) { update('enquiries', (l) => l.map((x) => (x.id === e.id ? e : x))); return e; }

/** Keeps a centre's public record in step with its published programmes. */
function syncCentre(centreId: string) {
  const published = (read('programmes')[centreId] ?? []).filter((p) => p.published);
  update('providers', (list) => list.map((p) => {
    if (p.id !== centreId || !published.length) return p;
    const programmes = published.map(({ trade: _t, published: _p, ...pr }) => pr);
    return { ...p, programmes, fee: Math.min(...programmes.map((x) => x.fee)) };
  }));
}

function siteInfo(): SiteInfo {
  const { flags, supportPhone, supportEmail, announcement } = read('settings');
  return { supportPhone, supportEmail, announcement, maintenance: flags.maintenance, signups: flags.signups, trainerReg: flags.trainerReg, reviews: flags.reviews };
}

/** Public reference data, plus a trainer's own centre while it awaits verification. */
function catalog() {
  const u = currentUser();
  const own = u?.role === 'trainer' && u.centreId ? read('providers').find((p) => p.id === u.centreId && p.status !== 'Published') : undefined;
  const myCentre = own ? (({ status: _s, featured: _f, ...p }: AdminProvider) => p)(own) : undefined;
  return { providers: publicProviders(), trades: read('trades'), areas: read('areas'), categories: read('categories'), site: siteInfo(), myCentre };
}

/** What a verification decision means for the centre's public record. */
/** Programmes must use one of the platform's trades (pages look trades up by id). */
const knownTrade = (id: string) => read('trades').some((t) => t.id === id);

const providerStatusFor = (s: QueueStatus): ProviderStatus => (s === 'Approved' ? 'Published' : s === 'Rejected' ? 'Rejected' : 'Pending');

function validateListing(item: Course | Product) {
  const f: Record<string, string> = {};
  if (item.title.trim().length < 4) f.title = 'Give it a clear title (at least 4 characters)';
  if (!(item.price >= 0)) f.price = 'Price can’t be negative';
  if (!isCourse(item) && !(item.price > 0)) f.price = 'Products need a price above 0';
  if (item.description.trim().length < 30) f.description = 'Describe it in at least 30 characters';
  if (!item.img) f.img = 'Add a photo';
  if (isCourse(item)) {
    if (item.curriculum.length === 0 || item.curriculum.some((l) => !l.title.trim() || !(l.minutes > 0))) f.lessons = 'Every lesson needs a title and a length';
    if (item.outcomes.length < 2) f.outcomes = 'List at least 2 outcomes';
  } else if (!(Number.isInteger(item.stock) && item.stock >= 0)) f.stock = 'Stock must be 0 or more';
  if (Object.keys(f).length) fail(422, 'validation', 'Please fix the highlighted fields', f);
}

/** Builds priced order lines from the server's own listings, checking availability and stock. */
function priceItems(input: PlaceOrderInput['items']): CartItem[] {
  if (!input.length) fail(422, 'validation', 'Your cart is empty');
  const courses = read('courses');
  const products = read('products');
  return input.map(({ id, kind, qty }) => {
    const listing = kind === 'course' ? courses.find((c) => c.id === id) : products.find((p) => p.id === id);
    if (!listing || !isPublished(listing)) return fail(409, 'conflict', `An item in your cart is no longer available`);
    const n = kind === 'course' ? 1 : Math.floor(qty);
    if (!isCourse(listing)) {
      if (!(n >= 1)) fail(422, 'validation', 'Quantities must be at least 1');
      if (listing.stock < n) fail(409, 'conflict', listing.stock ? `Only ${listing.stock} ${listing.title} left` : `${listing.title} is sold out`);
    }
    return { id, kind, title: listing.title, by: listing.by, sellerId: listing.sellerId, price: listing.price, img: listing.img, qty: n };
  });
}

// ---------------------------------------------------------------- the server

export function createMockServer(): Api {
  return {
    auth: {
      async me() {
        const u = currentUser();
        return u ? toUser(u) : null;
      },
      async signIn(identifier, password) {
        const id = identifier.trim();
        if (!id || !password) fail(422, 'validation', 'Enter your phone/email and password');
        const users = read('users');
        let u = users.find((x) => x.email.toLowerCase() === id.toLowerCase() || (x.phone && normPhone(x.phone) === normPhone(id)));
        // Demo: unknown identifiers sign in to a sample account chosen by the address. Real auth rejects them.
        if (!u) {
          const role = /fliptech\.com$/i.test(id) ? 'admin' : /centre|school|academy|works/i.test(id) ? 'trainer' : 'trainee';
          u = users.find((x) => x.id === USERS[role].id);
        }
        if (!u) return notFound('Account');
        if (u.status === 'Suspended') fail(403, 'forbidden', 'This account is suspended. Contact hello@fliptech.com.');
        if (u.status !== 'Active') fail(403, 'forbidden', 'This account isn’t active yet. Check your email for an invitation.');
        write('session', { userId: u.id });
        return toUser(u);
      },
      async demoSignIn(role) {
        const u = read('users').find((x) => x.id === USERS[role].id) ?? notFound('Demo account');
        write('session', { userId: u.id });
        return toUser(u);
      },
      async requestPasswordReset(identifier) {
        const id = identifier.trim();
        if (!id) fail(422, 'validation', 'Enter your phone number or email', { identifier: 'Required' });
        const u = read('users').find((x) => x.email.toLowerCase() === id.toLowerCase() || (x.phone && normPhone(x.phone) === normPhone(id)));
        // Same response either way, so the form can't be used to check who has an account.
        if (u && u.status === 'Active') issueResetLink(u);
      },
      async resetPassword(token, password) {
        const t = read('resetTokens').find((x) => x.token === token);
        if (!t || t.used || Date.parse(t.expires) < Date.now()) fail(409, 'conflict', 'This reset link has expired or was already used. Request a new one.');
        if (password.length < 8) fail(422, 'validation', 'Use at least 8 characters', { password: 'At least 8 characters' });
        // The mock doesn't store passwords; a real server hashes and saves it, and ends the user's other sessions.
        update('resetTokens', (l) => l.map((x) => (x.token === token ? { ...x, used: true } : x)));
      },
      async signOut() {
        write('session', null);
      },
      async registerTrainee(input) {
        if (!read('settings').flags.signups) fail(403, 'forbidden', 'New sign-ups are paused right now. Please try again later.');
        const f: Record<string, string> = {};
        if (!input.name.trim()) f.name = 'Please enter your name';
        if (!PHONE_RE.test(input.phone.trim())) f.phone = 'Enter a valid Ghana number';
        if (input.email && !EMAIL_RE.test(input.email)) f.email = 'Enter a valid email';
        if (input.password.length < 8) f.password = 'At least 8 characters';
        if (Object.keys(f).length) fail(422, 'validation', 'Please fix the highlighted fields', f);
        const users = read('users');
        if (users.some((u) => u.phone && normPhone(u.phone) === normPhone(input.phone))) fail(409, 'conflict', 'An account with this phone number already exists. Try signing in.');
        if (input.email && users.some((u) => u.email.toLowerCase() === input.email!.toLowerCase())) fail(409, 'conflict', 'An account with this email already exists. Try signing in.');
        const u: DbUser = { id: newId('u-'), role: 'trainee', name: input.name.trim(), email: input.email?.trim() || '', phone: input.phone.trim(), area: '', joined: today(), status: 'Active', enquiries: 0 };
        write('users', [...users, u]);
        write('session', { userId: u.id });
        return toUser(u);
      },
      async registerCentre(input) {
        if (!read('settings').flags.trainerReg) fail(403, 'forbidden', 'Centre registration is paused right now.');
        if (!input.centre.trim() || !PHONE_RE.test(input.phone.trim()) || !input.area || input.password.length < 8) fail(422, 'validation', 'Please complete the required fields');
        const users = read('users');
        if (users.some((u) => u.phone && normPhone(u.phone) === normPhone(input.phone))) fail(409, 'conflict', 'An account with this phone number already exists.');
        if (input.programmes.some((p) => !knownTrade(p.trade))) fail(422, 'validation', 'Choose a trade for every programme');
        const name = input.centre.trim();
        const centreId = uniqueId(name, new Set(read('providers').map((p) => p.id)));
        const u: DbUser = { id: newId('u-'), role: 'trainer', name: `${name} Admin`, email: input.email?.trim() || '', phone: input.phone.trim(), area: input.area, joined: today(), status: 'Active', enquiries: 0, centreId };
        write('users', [...users, u]);
        const tradeId = (input.programmes[0]?.trade ?? 'welding') as TradeId;
        const img = read('trades').find((t) => t.id === tradeId)?.img ?? '';
        const programmes: TrainerProgramme[] = input.programmes.filter((p) => p.name.trim()).map((p, i) => ({
          id: `${centreId}-p${i + 1}`, name: p.name.trim(), trade: p.trade, type: 'Certificate', fee: p.fee, months: p.months, days: p.days,
          time: '8:00am – 4:00pm', intake: p.intake ?? '', places: 20, published: true,
        }));
        // With auto-publish on, the centre skips the queue and goes live straight away.
        const autoPublish = read('settings').flags.autoPublish;
        const centre = draftCentre({
          id: centreId, name, area: input.area, trade: tradeId, phone: input.phone.trim(), email: input.email?.trim(), address: input.address?.trim(),
          about: input.description, ctvet: !!input.ctvetNo?.trim(), images: img ? [img] : [],
          programmes: programmes.map(({ trade: _t, published: _p, ...p }) => p),
        });
        update('providers', (l) => [...l, { ...centre, status: autoPublish ? 'Published' : 'Pending', featured: false }]);
        update('programmes', (all) => ({ ...all, [centreId]: programmes }));
        const item: QueueItem = {
          id: newId('q-'), name, owner: u.name, area: input.area, trade: tradeId, submitted: today(),
          docs: [input.documents.registration && 'Business registration', input.documents.ctvet && 'CTVET certificate', input.documents.photos.length ? 'Photos of workshop' : ''].filter(Boolean) as string[],
          status: autoPublish ? 'Approved' : 'Pending', img, providerId: centreId,
        };
        update('queue', (q) => [item, ...q]);
        addActivity('Building2', 'brand', autoPublish ? `${name} registered and auto-published` : `${name} submitted for verification`, u.name);
        write('session', { userId: u.id });
        return toUser(u);
      },
    },

    me: {
      async update(patch) {
        const u = requireUser();
        if (patch.name !== undefined && !patch.name.trim()) fail(422, 'validation', 'Name can’t be empty', { name: 'Name can’t be empty' });
        if (patch.phone !== undefined && !PHONE_RE.test(patch.phone.trim())) fail(422, 'validation', 'Enter a valid Ghana number', { phone: 'Enter a valid Ghana number' });
        if (patch.email && !EMAIL_RE.test(patch.email)) fail(422, 'validation', 'Enter a valid email', { email: 'Enter a valid email' });
        if (patch.avatar && !/^(data:image\/|https?:\/\/)/.test(patch.avatar)) fail(422, 'validation', 'That photo couldn’t be used', { avatar: 'Upload a JPG or PNG' });
        if (patch.avatar && patch.avatar.length > 400_000) fail(422, 'validation', 'That photo is too large', { avatar: 'Too large' });
        const next = { ...u, ...patch, avatar: patch.avatar === '' ? undefined : patch.avatar ?? u.avatar };
        update('users', (l) => l.map((x) => (x.id === u.id ? next : x)));
        return toUser(next);
      },
      async changePassword(current, next) {
        requireUser();
        if (!current) fail(422, 'validation', 'Enter your current password', { current: 'Required' });
        if (next.length < 8) fail(422, 'validation', 'New password must be at least 8 characters', { next: 'At least 8 characters' });
      },
      async requestDataExport() { requireUser(); },
      async deleteAccount() {
        const u = requireUser();
        update('users', (l) => l.filter((x) => x.id !== u.id));
        write('session', null);
      },
      async savedProviders() {
        const u = requireUser();
        return read('saved')[u.id] ?? [];
      },
      async setSaved(providerId, saved) {
        const u = requireUser();
        if (!read('providers').some((p) => p.id === providerId)) notFound('Training centre');
        const cur = read('saved')[u.id] ?? [];
        const next = saved ? [...new Set([...cur, providerId])] : cur.filter((x) => x !== providerId);
        update('saved', (s) => ({ ...s, [u.id]: next }));
        return next;
      },
    },

    catalog: {
      async get() { return catalog(); },
      async reviews(providerId) {
        if (!read('providers').some((p) => p.id === providerId)) notFound('Training centre');
        return read('settings').flags.reviews ? read('reviews') : [];
      },
      async trackView(providerId) {
        const u = currentUser();
        if (u?.role === 'admin' || (u?.role === 'trainer' && sellerOf(u) === providerId)) return;
        if (!publicProviders().some((p) => p.id === providerId)) return;
        const day = today();
        update('views', (all) => ({ ...all, [providerId]: { ...all[providerId], [day]: (all[providerId]?.[day] ?? 0) + 1 } }));
      },
    },

    listings: {
      async list() {
        const u = currentUser();
        const mine = (x: Course | Product) => isPublished(x) || (u?.role === 'trainer' && x.sellerId === sellerOf(u));
        return { courses: read('courses').filter(mine), products: read('products').filter(mine) };
      },
      async save(item) {
        const u = requireUser('trainer');
        const sellerId = sellerOf(u);
        const owned = (list: (Course | Product)[]) => list.find((x) => x.id === item.id);
        const existing = isCourse(item) ? owned(read('courses')) : owned(read('products'));
        if (existing && existing.sellerId !== sellerId) fail(403, 'forbidden', 'You can only edit your own listings');
        // Fields sellers can't set themselves come from the stored listing.
        const saved = { ...item, sellerId, rating: existing?.rating ?? 0, reviews: existing?.reviews ?? 0 } as Course | Product;
        validateListing(saved);
        const upsert = <T extends { id: string }>(list: T[], x: T) => (list.some((y) => y.id === x.id) ? list.map((y) => (y.id === x.id ? x : y)) : [x, ...list]);
        if (isCourse(saved)) update('courses', (l) => upsert(l, saved)); else update('products', (l) => upsert(l, saved));
        return saved;
      },
      async setStatus(kind, id, status) {
        const u = requireUser('trainer');
        const table = kind === 'course' ? 'courses' : 'products';
        const item = (read(table) as (Course | Product)[]).find((x) => x.id === id) ?? notFound('Listing');
        if (item.sellerId !== sellerOf(u)) fail(403, 'forbidden', 'You can only change your own listings');
        if (kind === 'course') update('courses', (l) => l.map((c) => (c.id === id ? { ...c, status } : c)));
        else update('products', (l) => l.map((p) => (p.id === id ? { ...p, status } : p)));
      },
      async remove(kind, id) {
        const u = requireUser('trainer');
        if (kind === 'course') {
          const c = read('courses').find((x) => x.id === id) ?? notFound('Course');
          if (c.sellerId !== sellerOf(u)) fail(403, 'forbidden', 'You can only delete your own listings');
          const learners = read('orders').some((o) => o.items.some((i) => i.id === id) && o.sellerStatus?.[c.sellerId] !== 'Cancelled');
          if (learners) fail(409, 'conflict', 'This course has learners, so it can’t be deleted. Hide it instead.');
          update('courses', (l) => l.filter((x) => x.id !== id));
        } else {
          const p = read('products').find((x) => x.id === id) ?? notFound('Product');
          if (p.sellerId !== sellerOf(u)) fail(403, 'forbidden', 'You can only delete your own listings');
          update('products', (l) => l.filter((x) => x.id !== id));
        }
      },
    },

    orders: {
      async list() {
        return [...visibleOrders(currentUser())].sort((a, b) => b.placedAt.localeCompare(a.placedAt));
      },
      async get(id) {
        const o = read('orders').find((x) => x.id === id) ?? notFound('Order');
        // Guest orders are readable by id (the real API should require a signed order token).
        if (o.userId && !visibleOrders(currentUser()).some((x) => x.id === id)) notFound('Order');
        return o;
      },
      async place(input) {
        const u = currentUser();
        const items = priceItems(input.items);
        const hasProducts = items.some((i) => i.kind === 'product');
        const fulfilment = hasProducts ? input.fulfilment : null;
        const c = input.contact;
        const f: Record<string, string> = {};
        if (!c.name.trim()) f.name = 'Enter your name';
        if (!PHONE_RE.test(c.phone.trim())) f.phone = 'Enter a valid Ghana number';
        if (c.email && !EMAIL_RE.test(c.email)) f.email = 'Enter a valid email';
        if (hasProducts && fulfilment !== 'delivery' && fulfilment !== 'pickup') f.fulfilment = 'Choose delivery or pickup';
        if (fulfilment === 'delivery' && !c.area) f.area = 'Choose your area';
        if (fulfilment === 'delivery' && c.address.trim().length < 4) f.address = 'Enter a street, house number or landmark';
        if (Object.keys(f).length) fail(422, 'validation', 'Please check your details', f);

        const totals = cartTotals(items, fulfilment);
        const hasPaidCourses = items.some((i) => i.kind === 'course' && i.price > 0);
        let payment = input.payment;
        if (totals.total === 0) payment = 'free';
        else if (payment === 'free') fail(422, 'validation', 'Choose a payment method');
        if (payment === 'cod' && !(hasProducts && fulfilment === 'delivery' && !hasPaidCourses)) fail(422, 'validation', 'Pay on delivery is only available for delivered products');

        const sellerStatus: Record<string, SellerStatus> = {};
        for (const sellerId of new Set(items.map((i) => i.sellerId))) {
          sellerStatus[sellerId] = items.some((i) => i.sellerId === sellerId && i.kind === 'product') ? 'New' : 'Completed';
        }
        const order: Order = {
          id: newId('FSH-'), placedAt: new Date().toISOString(), userId: u?.id, items,
          subtotal: totals.subtotal, delivery: totals.delivery, total: totals.total, fulfilment, contact: c,
          payment, momoNetwork: payment === 'momo' ? input.momoNetwork : undefined,
          // The mock treats MoMo and card payments as approved; a real server waits for the provider's webhook.
          status: payment === 'cod' ? 'Awaiting payment' : 'Paid', sellerStatus,
        };
        update('orders', (l) => [order, ...l]);
        update('products', (list) => list.map((p) => {
          const bought = items.filter((i) => i.id === p.id).reduce((n, i) => n + i.qty, 0);
          return bought ? { ...p, stock: Math.max(0, p.stock - bought) } : p;
        }));
        notify(newOrderNotifications(order, providerNames()));
        return order;
      },
      async setSellerStatus(orderId, sellerId, status) {
        const u = requireUser('trainer', 'admin');
        if (u.role === 'admin') requireAdmin('orders');
        const o = read('orders').find((x) => x.id === orderId) ?? notFound('Order');
        if (!o.items.some((i) => i.sellerId === sellerId)) notFound('Seller on this order');
        if (u.role === 'trainer') {
          if (sellerId !== sellerOf(u)) fail(403, 'forbidden', 'You can only update your own orders');
          const so = sellerOrders([o], sellerId)[0];
          const allowed = nextStep(so)?.status === status || (status === 'Cancelled' && canCancel(so));
          if (!allowed) fail(409, 'conflict', `This order can’t move from “${so.status}” to “${status}”`);
        }
        if (o.sellerStatus?.[sellerId] === status) return o;
        if (status === 'Cancelled') restock(o, [sellerId]);
        const next: Order = { ...o, status: status === 'Completed' && o.payment === 'cod' ? 'Paid' : o.status, sellerStatus: { ...o.sellerStatus, [sellerId]: status } };
        replaceOrder(next);
        notify([orderUpdateNotification(o, sellerId, status, providerNames())]);
        return next;
      },
      async markPaid(orderId) {
        requireAdmin('orders');
        const o = read('orders').find((x) => x.id === orderId) ?? notFound('Order');
        return replaceOrder({ ...o, status: 'Paid' });
      },
      async cancel(orderId) {
        requireAdmin('orders');
        const o = read('orders').find((x) => x.id === orderId) ?? notFound('Order');
        const sellers = sellersIn(o);
        restock(o, sellers);
        const next: Order = { ...o, sellerStatus: Object.fromEntries(sellers.map((id) => [id, 'Cancelled' as SellerStatus])) };
        replaceOrder(next);
        notify([
          ...sellers.map((sellerId): NewNotification => ({ kind: 'order_update', audience: { role: 'trainer', sellerId }, orderId, title: `Order ${orderId} cancelled`, body: 'Fliptech support cancelled this order. You don’t need to fulfil it.', link: `/trainer/orders?order=${orderId}` })),
          o.userId ? { kind: 'order_update', audience: { role: 'trainee', userId: o.userId }, orderId, title: `Order ${orderId} cancelled`, body: o.status === 'Paid' ? 'Your order was cancelled and your payment will be refunded.' : 'Your order was cancelled.', link: `/orders/${orderId}` } : null,
        ]);
        return next;
      },
    },

    enquiries: {
      async list() {
        return [...visibleEnquiries(currentUser())].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
      },
      async create(input) {
        const u = currentUser();
        if (!PHONE_RE.test(input.phone.trim())) fail(422, 'validation', 'Enter a valid Ghana number', { phone: 'Enter a valid Ghana number, e.g. 024 123 4567' });
        if (!publicProviders().some((p) => p.id === input.providerId)) notFound('Training centre');
        const text = input.message.trim() || `I’m interested in ${input.programme}. Please contact me.`;
        const e: Enquiry = {
          id: newId('e'), providerId: input.providerId, programme: input.programme, trainee: input.trainee.trim() || 'Anonymous', phone: input.phone.trim(),
          date: today(), userId: u?.id, status: 'Sent', inboxStatus: 'New', centreUnread: true,
          // Basic spam screen; flagged enquiries go to admin moderation instead of the centre's inbox.
          flagged: /bit\.ly|click here|win (a )?free/i.test(text) || undefined,
          thread: [{ from: 'trainee', text, at: messageTime(), sentAt: new Date().toISOString() }],
        };
        update('enquiries', (l) => [e, ...l]);
        return e;
      },
      async reply(id, text) {
        const u = requireUser('trainee', 'trainer');
        const body = text.trim();
        if (!body) fail(422, 'validation', 'Write a message first');
        if (body.length > 2000) fail(422, 'validation', 'Messages can be up to 2,000 characters');
        const e = visibleEnquiries(u).find((x) => x.id === id) ?? notFound('Conversation');
        const msg = { from: u.role === 'trainer' ? 'trainer' as const : 'trainee' as const, text: body, at: messageTime(), sentAt: new Date().toISOString() };
        const next: Enquiry = msg.from === 'trainer'
          ? { ...e, thread: [...e.thread, msg], status: 'Replied', inboxStatus: e.inboxStatus === 'New' ? 'Replied' : e.inboxStatus }
          // A trainee follow-up re-opens the conversation for the centre.
          : { ...e, thread: [...e.thread, msg], centreUnread: true, inboxStatus: e.inboxStatus === 'Closed' ? 'New' : e.inboxStatus };
        replaceEnquiry(next);
        if (msg.from === 'trainer') notify([enquiryReplyNotification(e, body, read('providers').find((p) => p.id === e.providerId)?.name)]);
        return next;
      },
      async setStatus(id, status) {
        const u = requireUser('trainer');
        const e = visibleEnquiries(u).find((x) => x.id === id) ?? notFound('Conversation');
        return replaceEnquiry({ ...e, inboxStatus: status });
      },
      async markRead(id) {
        const u = requireUser('trainer');
        const e = visibleEnquiries(u).find((x) => x.id === id) ?? notFound('Conversation');
        if (e.centreUnread) replaceEnquiry({ ...e, centreUnread: false });
      },
      async setFlagged(id, flagged) {
        requireAdmin('enquiries');
        const e = read('enquiries').find((x) => x.id === id) ?? notFound('Enquiry');
        return replaceEnquiry({ ...e, flagged: flagged || undefined });
      },
      async remove(id) {
        requireAdmin('enquiries');
        if (!read('enquiries').some((x) => x.id === id)) notFound('Enquiry');
        update('enquiries', (l) => l.filter((x) => x.id !== id));
      },
    },

    notifications: {
      async list() {
        const u = requireUser();
        // Intake reminders are generated lazily here; a real server would use a daily job.
        if (u.role === 'trainee') {
          const saved = read('saved')[u.id] ?? [];
          notify(intakeReminders(u, publicProviders().filter((p) => saved.includes(p.id))));
        }
        const key = audienceKey(audienceOfUser(u));
        return read('notifications').filter((n) => audienceKey(n.audience) === key).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      },
      async markRead(ids) {
        const u = requireUser();
        const key = audienceKey(audienceOfUser(u));
        const set = new Set(ids);
        update('notifications', (l) => l.map((n) => (set.has(n.id) && audienceKey(n.audience) === key && !n.read ? { ...n, read: true } : n)));
      },
      async prefs() {
        const u = requireUser();
        return { ...DEFAULT_PREFS, ...read('prefs')[audienceKey(audienceOfUser(u))] };
      },
      async setPref(pref, on) {
        const u = requireUser();
        if (!(pref in DEFAULT_PREFS)) fail(422, 'validation', 'Unknown preference');
        const key = audienceKey(audienceOfUser(u));
        const next = update('prefs', (p) => ({ ...p, [key]: { ...p[key], [pref]: on } }));
        return { ...DEFAULT_PREFS, ...next[key] } as NotificationPrefs;
      },
    },

    learning: {
      async progress() {
        const u = requireUser('trainee');
        const prefix = `${u.id}:`;
        return Object.fromEntries(Object.entries(read('progress')).filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k.slice(prefix.length), v]));
      },
      async setLessonDone(courseId, lessonId, done) {
        const u = requireUser('trainee');
        if (!ownedCourseIds(read('orders'), u.id).has(courseId)) fail(403, 'forbidden', 'Enrol in this course first');
        const course = read('courses').find((c) => c.id === courseId) ?? notFound('Course');
        if (!course.curriculum.some((l) => l.id === lessonId)) notFound('Lesson');
        const k = `${u.id}:${courseId}`;
        const cur = read('progress')[k] ?? { done: [] };
        const next = { ...cur, done: done ? [...new Set([...cur.done, lessonId])] : cur.done.filter((x) => x !== lessonId) };
        update('progress', (p) => ({ ...p, [k]: next }));
        return next;
      },
      async setLastLesson(courseId, lessonId) {
        const u = requireUser('trainee');
        if (!ownedCourseIds(read('orders'), u.id).has(courseId)) fail(403, 'forbidden', 'Enrol in this course first');
        const k = `${u.id}:${courseId}`;
        const next = { done: read('progress')[k]?.done ?? [], last: lessonId };
        update('progress', (p) => ({ ...p, [k]: next }));
        return next;
      },
    },

    centre: {
      async programmes() {
        const u = requireUser('trainer');
        return read('programmes')[sellerOf(u)] ?? [];
      },
      async saveProgramme(p) {
        const u = requireUser('trainer');
        const f: Record<string, string> = {};
        if (!p.name.trim()) f.name = 'Required';
        if (!(p.fee > 0)) f.fee = 'Enter a fee';
        if (!(p.months > 0)) f.months = 'Enter a duration';
        if (!knownTrade(p.trade)) f.trade = 'Choose a trade';
        if (Object.keys(f).length) fail(422, 'validation', 'Please fill in name, fee and duration', f);
        const centreId = sellerOf(u);
        const saved: TrainerProgramme = { ...p, id: p.id || newId('p-') };
        update('programmes', (all) => {
          const list = all[centreId] ?? [];
          return { ...all, [centreId]: list.some((x) => x.id === saved.id) ? list.map((x) => (x.id === saved.id ? saved : x)) : [...list, saved] };
        });
        syncCentre(centreId);
        return saved;
      },
      async deleteProgramme(id) {
        const u = requireUser('trainer');
        const centreId = sellerOf(u);
        update('programmes', (all) => ({ ...all, [centreId]: (all[centreId] ?? []).filter((x) => x.id !== id) }));
        syncCentre(centreId);
      },
      async updateProfile(patch) {
        const u = requireUser('trainer');
        const centreId = sellerOf(u);
        if (patch.name !== undefined && patch.name.trim().length < 3) fail(422, 'validation', 'Centre name is too short', { name: 'Too short' });
        if (patch.phone !== undefined && !PHONE_RE.test(patch.phone.trim())) fail(422, 'validation', 'Enter a valid Ghana number', { phone: 'Enter a valid Ghana number' });
        const fields = patch;
        const current = read('providers').find((p) => p.id === centreId) ?? notFound('Centre');
        const next = { ...current, ...fields };
        update('providers', (list) => list.map((p) => (p.id === centreId ? next : p)));
        const { status: _s, featured: _f, ...saved } = next;
        return saved;
      },
      async requestVisit(input) {
        const u = requireUser('trainer');
        if (!input.date) fail(422, 'validation', 'Choose a date');
        update('visitRequests', (l) => [...l, { at: new Date().toISOString(), centreId: sellerOf(u), ...input }]);
        addActivity('MapPin', 'violet', `Site visit requested by ${read('providers').find((p) => p.id === sellerOf(u))?.name ?? u.name}`, u.name);
      },
      async stats() {
        return centreStats(sellerOf(requireUser('trainer')));
      },
    },

    admin: {
      async users() {
        requireAdmin('users');
        return read('users').map(toAdminUser);
      },
      async updateUser(id, patch) {
        const me = requireAdmin('users');
        if (id === me.id) fail(409, 'conflict', 'You can’t change your own role or suspend yourself');
        if (patch.role !== undefined && !canAdmin(me.access, 'settings')) fail(403, 'forbidden', 'Only super admins can change roles');
        const u = read('users').find((x) => x.id === id) ?? notFound('User');
        const next = { ...u, ...patch };
        update('users', (l) => l.map((x) => (x.id === id ? next : x)));
        if (patch.status === 'Suspended') addActivity('UserX', 'warn', `User ${u.name} suspended`, me.name);
        return toAdminUser(next);
      },
      async inviteAdmin(input) {
        const me = requireAdmin('settings');
        const email = input.email.trim().toLowerCase();
        if (!input.name.trim()) fail(422, 'validation', 'Enter their full name', { name: 'Enter their full name' });
        if (!EMAIL_RE.test(email)) fail(422, 'validation', 'Enter a valid email address', { email: 'Enter a valid email address' });
        if (read('users').some((u) => u.email.toLowerCase() === email)) fail(409, 'conflict', 'This email already has an account or invitation', { email: 'This email already has an account or invitation' });
        const u: DbUser = { id: newId('a-'), name: input.name.trim(), email, role: 'admin', access: input.access, area: '—', joined: today(), status: 'Invited', enquiries: 0, phone: '' };
        update('users', (l) => [u, ...l]);
        addActivity('ShieldCheck', 'brand', `${u.name} invited as an administrator`, me.name);
        sendMessage({ to: email, kind: 'invitation', subject: 'You’re invited to Fliptech Skills Hub admin', link: '/signin' });
        return toAdminUser(u);
      },
      async revokeInvite(userId) {
        requireAdmin('settings');
        const u = read('users').find((x) => x.id === userId) ?? notFound('Invitation');
        if (u.status !== 'Invited') fail(409, 'conflict', 'Only pending invitations can be revoked');
        update('users', (l) => l.filter((x) => x.id !== userId));
      },
      async resendInvite(userId) {
        requireAdmin('settings');
        const u = read('users').find((x) => x.id === userId) ?? notFound('Invitation');
        if (u.status !== 'Invited') fail(409, 'conflict', 'This person has already accepted');
      },
      async sendPasswordReset(userId) {
        requireAdmin('users');
        const u = read('users').find((x) => x.id === userId) ?? notFound('User');
        issueResetLink(u);
      },
      async stats(months = 6) {
        requireAdmin();
        const users = read('users');
        const enquiries = read('enquiries').filter((e) => !e.flagged);
        const count = (role: User['role']) => users.filter((u) => u.role === role && u.status !== 'Invited').length;
        const monthOf = (iso: string) => iso.slice(0, 7);
        const byTrade = new Map<string, number>();
        const byProvider = new Map<string, { enquiries: number; replied: number }>();
        const providers = read('providers');
        for (const e of enquiries) {
          const trade = providers.find((p) => p.id === e.providerId)?.trade;
          if (trade) byTrade.set(trade, (byTrade.get(trade) ?? 0) + 1);
          const s = byProvider.get(e.providerId) ?? { enquiries: 0, replied: 0 };
          s.enquiries++;
          if (e.thread.some((m) => m.from === 'trainer')) s.replied++;
          byProvider.set(e.providerId, s);
        }
        const stats: AdminStats = {
          trainees: count('trainee'), trainers: count('trainer'), admins: count('admin'),
          providers: publicProviders().length, enquiries: enquiries.length,
          monthly: lastMonths(Math.min(24, Math.max(1, Math.floor(months)))).map((month) => ({
            month,
            signups: users.filter((u) => u.role === 'trainee' && monthOf(u.joined) === month).length,
            enquiries: enquiries.filter((e) => monthOf(e.date) === month).length,
          })),
          enquiriesByTrade: [...byTrade].map(([trade, n]) => ({ trade, count: n })).sort((a, b) => b.count - a.count),
          topProviders: [...byProvider].map(([providerId, s]) => ({ providerId, enquiries: s.enquiries, replyRate: s.replied / s.enquiries }))
            .sort((a, b) => b.enquiries - a.enquiries).slice(0, 5),
        };
        return stats;
      },
      async verificationQueue() {
        requireAdmin('verification');
        return read('queue');
      },
      async decide(id, status) {
        const me = requireAdmin('verification');
        const item = read('queue').find((x) => x.id === id) ?? notFound('Application');
        const next = { ...item, status };
        update('queue', (q) => q.map((x) => (x.id === id ? next : x)));
        if (item.providerId) update('providers', (l) => l.map((p) => (p.id === item.providerId ? { ...p, status: providerStatusFor(status) } : p)));
        const tone = status === 'Approved' ? 'success' : status === 'Rejected' ? 'danger' : 'violet';
        addActivity(status === 'Approved' ? 'BadgeCheck' : 'Flag', tone, `${item.name}: ${status.toLowerCase()}`, me.name);
        return next;
      },
      async providers() {
        requireAdmin('providers');
        return read('providers');
      },
      async updateProvider(id, patch) {
        requireAdmin('providers');
        const p = read('providers').find((x) => x.id === id) ?? notFound('Provider');
        const next = { ...p, ...patch };
        update('providers', (l) => l.map((x) => (x.id === id ? next : x)));
        return next;
      },
      async activity() {
        requireAdmin();
        return read('activity');
      },
      async saveTrade(trade) {
        requireAdmin('catalog');
        if (!trade.name.trim()) fail(422, 'validation', 'Enter a name');
        const id = trade.id || trade.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const saved = { ...trade, id } as Trade;
        update('trades', (l) => (l.some((t) => t.id === id) ? l.map((t) => (t.id === id ? saved : t)) : [...l, saved]));
        return catalog();
      },
      async setAreas(areas) {
        requireAdmin('catalog');
        const clean = [...new Set(areas.map((a) => a.trim()).filter(Boolean))];
        if (!clean.length) fail(422, 'validation', 'Keep at least one area');
        write('areas', clean);
        return catalog();
      },
      async saveCategories(categories) {
        requireAdmin('catalog');
        write('categories', categories);
        return catalog();
      },
      async settings() {
        requireAdmin('settings');
        return read('settings');
      },
      async saveSettings(patch) {
        requireAdmin('settings');
        return update('settings', (s) => ({ ...s, ...patch, flags: { ...s.flags, ...patch.flags } }));
      },
    },

    support: {
      async contact(input) {
        const f: Record<string, string> = {};
        if (!input.name.trim()) f.name = 'Please enter your name';
        if (!EMAIL_RE.test(input.email.trim())) f.email = 'Enter a valid email address';
        if (input.message.trim().length < 10) f.message = 'Please write at least 10 characters';
        if (Object.keys(f).length) fail(422, 'validation', 'Please check your message', f);
        update('supportMessages', (l) => [...l, { at: new Date().toISOString(), ...input }]);
      },
    },
  };
}
