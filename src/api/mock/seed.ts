// Initial data for the mock server, built from the sample data in src/data/mock.ts.
import {
  ACTIVITY, ADMIN_QUEUE, ADMIN_USERS, AREAS, COURSES, ENQUIRIES, PRODUCTS, PROVIDERS, REVIEWS, SEED_ORDERS,
  SKILL_CATEGORIES, TRADES, USERS,
} from '../../data/mock';
import { newOrderNotifications } from '../../lib/notifications';
import type { AdminProvider, AppNotification, Enquiry, Order, QueueItem, TrainerProgramme } from '../../types';
import type { DbUser, Tables } from './db';
import { buildBulk } from './bulk';
import { draftCentre, uniqueId } from './centres';

/** Demo accounts (u1–u3) merged with the admin user list, matched by email. */
function seedUsers(): DbUser[] {
  const byEmail = new Map(Object.values(USERS).map((u) => [u.email, u]));
  const phones: Record<string, string> = { a3: '055 812 3344', a4: '024 600 1122', a5: '026 441 9087', a6: '024 551 7788', a7: '024 771 2290', a9: '050 120 7781', a10: '020 811 4455' };
  const centres: Record<string, string> = { a4: 'madina-tailoring', a10: 'kaneshie-auto' };
  const users: DbUser[] = ADMIN_USERS.map((a) => {
    const demo = byEmail.get(a.email);
    return demo
      ? { ...a, id: demo.id, phone: demo.phone, centreId: demo.centreId, access: a.role === 'admin' ? 'super' : undefined }
      : { ...a, phone: phones[a.id] ?? '', centreId: centres[a.id] };
  });
  users.push(
    { id: 'a11', name: 'Kojo Annor', email: 'kojo@fliptech.com', role: 'admin', area: 'Osu', joined: '2025-09-14', status: 'Active', enquiries: 0, access: 'verification', phone: '' },
    { id: 'a12', name: 'Efua Sarpong', email: 'efua@fliptech.com', role: 'admin', area: 'Osu', joined: '2026-02-03', status: 'Active', enquiries: 0, access: 'support', phone: '' },
  );
  return users;
}

/** One notification per seller and admin for each recent order; only the newest per audience is unread. */
function seedNotifications(orders: Order[]): AppNotification[] {
  const since = orders.reduce((m, o) => (o.placedAt > m ? o.placedAt : m), '').slice(0, 10);
  const cutoff = new Date(Date.parse(since) - 14 * 864e5).toISOString().slice(0, 10);
  const list: AppNotification[] = orders.filter((o) => o.placedAt >= cutoff).flatMap((o) =>
    newOrderNotifications(o, PROVIDERS).map((n, i) => ({ ...n, id: `seed-${o.id}-${i}`, createdAt: o.placedAt, read: true })),
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const seen = new Set<string>();
  for (const n of list) {
    const key = JSON.stringify(n.audience);
    if (!seen.has(key)) { seen.add(key); n.read = false; }
  }
  return list;
}

const SPAM: Enquiry = {
  id: 'x1', providerId: 'spintex-hair', programme: 'Hairdressing – Certificate Programme', trainee: 'Unknown', phone: '020 000 0000',
  date: '2026-10-03', status: 'Sent', inboxStatus: 'New', centreUnread: true, flagged: true,
  thread: [{ from: 'trainee', text: 'CLICK HERE to win free phone!!! bit.ly/xxxx', at: '3 Oct, 02:14' }],
};

function seedProgrammes(): Record<string, TrainerProgramme[]> {
  const acw = PROVIDERS.find((p) => p.id === 'accra-central-welding');
  if (!acw) return {};
  return {
    [acw.id]: [
      ...acw.programmes.map((p) => ({ ...p, trade: 'welding', published: true })),
      { id: 'p4', name: 'Introduction to Welding Safety', trade: 'welding', type: 'Short course', fee: 250, months: 1, days: 'Sat', time: '9:00am – 1:00pm', intake: '2026-12-05', places: 20, published: false },
    ],
  };
}

/** Each sample application gets a pending centre record, so approving it publishes a real listing. */
function seedApplications(taken: Set<string>): { queue: QueueItem[]; centres: AdminProvider[] } {
  const centres: AdminProvider[] = [];
  const queue = ADMIN_QUEUE.map((q) => {
    const trade = TRADES.find((t) => t.id === q.trade);
    const id = uniqueId(q.name, taken);
    taken.add(id);
    const intake = new Date(Date.parse(q.submitted) + 45 * 864e5).toISOString().slice(0, 10);
    centres.push({
      ...draftCentre({
        id, name: q.name, area: q.area, trade: q.trade, phone: '024 000 0000', about: '', ctvet: q.docs.includes('CTVET certificate'), images: [q.img],
        programmes: [{ id: `${id}-p1`, name: `${trade?.name ?? 'Trade'} – Certificate Programme`, type: 'Certificate', fee: 1500, months: 6, days: 'Mon – Fri', time: '8:00am – 4:00pm', intake, places: 20 }],
      }),
      status: 'Pending',
      featured: false,
    });
    return { ...q, providerId: id };
  });
  return { queue, centres };
}

export function buildSeed(): Tables {
  const applications = seedApplications(new Set(PROVIDERS.map((p) => p.id)));
  const users = seedUsers();
  const providers: AdminProvider[] = [
    ...PROVIDERS.map((p, i): AdminProvider => ({
      ...p,
      ...(p.id === 'accra-central-welding' && { address: 'Opposite Kantamanto Market, Accra Central', email: p.email ?? 'info@accracentralwelding.com' }),
      status: i === 13 ? 'Suspended' : 'Published',
      featured: i < 3,
    })),
    ...applications.centres,
  ];
  const bulk = buildBulk({
    providers, courses: COURSES, products: PRODUCTS,
    takenEmails: new Set(users.map((u) => u.email)),
    managedCentres: new Set(users.flatMap((u) => (u.centreId ? [u.centreId] : []))),
  });
  const orders = [...SEED_ORDERS, ...bulk.orders].sort((a, b) => b.placedAt.localeCompare(a.placedAt));
  return {
    users: [...users, ...bulk.users],
    providers,
    trades: TRADES,
    areas: AREAS,
    categories: SKILL_CATEGORIES,
    reviews: REVIEWS,
    courses: COURSES,
    products: PRODUCTS,
    orders,
    enquiries: [...ENQUIRIES, SPAM, ...bulk.enquiries],
    notifications: seedNotifications(orders),
    prefs: {},
    progress: {},
    saved: { u1: ['accra-central-welding', 'madina-tailoring', 'tema-plumbing'] },
    programmes: seedProgrammes(),
    queue: applications.queue,
    activity: ACTIVITY,
    settings: {
      flags: { signups: true, trainerReg: true, autoPublish: false, sms: true, reviews: true, maintenance: false },
      supportPhone: '030 222 1100',
      supportEmail: 'hello@fliptech.com',
      announcement: 'October intakes now open across Greater Accra',
    },
    supportMessages: [],
    visitRequests: [],
    session: null,
    resetTokens: [],
    outbox: [],
    views: bulk.views,
  };
}
