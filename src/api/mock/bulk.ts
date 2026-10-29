// Generated sample data, so the dashboards look like a platform in use rather than a handful of rows.
// A seeded random generator makes it the same on every machine and every reset (and in tests).
// Dates count back from a fixed day that matches the hand-written seed in src/data/mock.ts.
import { cartTotals } from '../../lib/pricing';
import { messageTime } from '../../lib/format';
import type {
  AdminProvider, CartItem, Course, Enquiry, InboxStatus, Message, MomoNetwork, Order, PaymentMethod, Product, SellerStatus,
} from '../../types';
import type { DbUser } from './db';

const TODAY = Date.parse('2026-10-28T18:00:00');
const DAY = 864e5;

/** Deterministic PRNG (mulberry32). */
function random(seed: number) {
  let a = seed;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(next() * list.length)];
  const chance = (p: number) => next() < p;
  return { next, int, pick, chance };
}
type Rng = ReturnType<typeof random>;

const FIRST = ['Kwabena', 'Akua', 'Kofi', 'Ama', 'Yaw', 'Abena', 'Kwaku', 'Afua', 'Kwame', 'Adwoa', 'Kojo', 'Efua', 'Kwasi', 'Akosua', 'Nana', 'Esi',
  'Fiifi', 'Ekua', 'Selorm', 'Elikem', 'Mawuli', 'Dzifa', 'Nii', 'Naa', 'Tetteh', 'Korkor', 'Ibrahim', 'Fatima', 'Abdul', 'Rahina', 'Emmanuel',
  'Grace', 'Samuel', 'Comfort', 'Joseph', 'Mercy', 'Daniel', 'Gifty', 'Prince', 'Vida', 'Richmond', 'Linda', 'Bernard', 'Priscilla', 'Isaac', 'Dorcas'];
const LAST = ['Mensah', 'Owusu', 'Asante', 'Boateng', 'Osei', 'Agyeman', 'Appiah', 'Darko', 'Ofori', 'Addo', 'Quaye', 'Lamptey', 'Tetteh', 'Nartey',
  'Amoah', 'Antwi', 'Sarpong', 'Frimpong', 'Acheampong', 'Ansah', 'Kumah', 'Agbeko', 'Dzakpasu', 'Mohammed', 'Iddrisu', 'Abubakar', 'Annan', 'Aidoo',
  'Bonsu', 'Gyamfi', 'Kyei', 'Opoku', 'Wiredu', 'Adjei', 'Ocran', 'Arthur'];
const PREFIXES = ['024', '054', '055', '059', '020', '050', '026', '027', '057'];
const STREETS = ['near the Total filling station', 'behind the Methodist church', 'off the main road, second left', 'opposite the lorry station',
  'close to the market', 'by the police station', 'next to the pharmacy', 'two houses after the school'];

const ASK = [
  'Hello, I’m interested in the next intake. Can you share more details about fees and requirements?',
  'Is the next intake still open? How many places are left?',
  'Can I pay the fees in instalments?',
  'Do you accept complete beginners?',
  'What time do classes start and finish?',
  'Do you have a weekend or evening class? I work during the week.',
  'Is there an age limit? I am 34.',
  'Do I need to bring my own tools or materials?',
  'Will I get a certificate at the end, and is it recognised?',
  'Can I come and visit the centre before I register?',
  'Do you help trainees find work or apprenticeships after the course?',
  'Is there accommodation nearby for trainees from outside Accra?',
  'What documents do I need to register?',
  'My son finished JHS this year. Can he join?',
];
const REPLY = [
  'Yes, places are still available. Registration is GH₵100 and the rest can be paid in two instalments.',
  'Most of our trainees start as complete beginners, so you are welcome. Come for a visit any weekday between 9am and 3pm.',
  'Classes run Monday to Friday, 8am to 4pm. We also have a weekend group on Saturdays and Sundays.',
  'We provide the tools during training. You only need protective boots and overalls.',
  'Yes, our certificate is CTVET-recognised. Trainees also sit a practical assessment at the end.',
  'You are welcome to visit. Please call before you come so an instructor can show you around.',
  'Trainees must be 16 or older. There is no upper age limit.',
  'Please bring a Ghana Card or other valid ID, two passport photos and the registration fee.',
  'We place our best trainees with partner workshops for industrial attachment after the course.',
];
const FOLLOW = ['Thank you, I will come on Monday.', 'Great, see you at the intake!', 'Okay, I will call you tomorrow.', 'Thanks for the quick reply.',
  'I have paid the registration fee by MoMo.', 'Please save me a place.'];

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 19);
const atLabel = (ms: number) => messageTime(new Date(ms));
/** A moment `days` days before TODAY, during waking hours. */
const daysAgo = (r: Rng, days: number) => {
  const d = new Date(TODAY - days * DAY);
  d.setHours(r.int(7, 21), r.int(0, 59), 0, 0);
  // Never later than TODAY itself (today's rows land before the 6pm cut-off).
  return Math.min(d.getTime(), TODAY - r.int(10, 240) * 6e4);
};
/** Days back from TODAY, weighted towards recent dates so the charts show the platform growing. */
const recentDays = (r: Rng, maxDays: number, growth = 1.6) => Math.floor(maxDays * r.next() ** growth);

export interface BulkInput {
  /** Every centre, including pending applications; only Published ones get activity. */
  providers: AdminProvider[];
  courses: Course[];
  products: Product[];
  /** Emails already in use, so generated accounts never collide with the hand-written ones. */
  takenEmails: Set<string>;
  /** Centres that already have a trainer account. */
  managedCentres: Set<string>;
}

export interface BulkData { users: DbUser[]; enquiries: Enquiry[]; orders: Order[]; views: Record<string, Record<string, number>> }

export function buildBulk({ providers, courses, products, takenEmails, managedCentres }: BulkInput, seed = 20261028): BulkData {
  const r = random(seed);
  const phone = () => `${r.pick(PREFIXES)} ${r.int(100, 999)} ${String(r.int(0, 9999)).padStart(4, '0')}`;
  const email = (first: string, last: string, domain = 'example.com') => {
    const base = `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '');
    let e = `${base}@${domain}`;
    for (let n = 2; takenEmails.has(e); n++) e = `${base}${n}@${domain}`;
    takenEmails.add(e);
    return e;
  };
  const published = providers.filter((p) => p.status === 'Published');
  const areas = [...new Set(providers.map((p) => p.area))];

  // ---- Trainees: about 180 over the last 18 months, more each month ----
  const users: DbUser[] = [];
  for (let i = 1; i <= 180; i++) {
    const first = r.pick(FIRST);
    const last = r.pick(LAST);
    const joined = iso(daysAgo(r, recentDays(r, 540))).slice(0, 10);
    users.push({
      id: `g-u${i}`, role: 'trainee', name: `${first} ${last}`, email: r.chance(0.8) ? email(first, last) : '', phone: phone(),
      area: r.pick(areas), joined, status: r.chance(0.03) ? 'Suspended' : 'Active', enquiries: 0,
    });
  }

  // ---- One trainer account for each published centre that has none ----
  for (const p of published) {
    if (managedCentres.has(p.id)) continue;
    const first = r.pick(FIRST);
    const last = r.pick(LAST);
    users.push({
      id: `g-t-${p.id}`, role: 'trainer', name: `${first} ${last}`, email: email(first, last, `${p.id.replace(/-/g, '')}.com`), phone: p.phone,
      area: p.area, joined: iso(TODAY - r.int(240, 700) * DAY).slice(0, 10), status: 'Active', enquiries: 0, centreId: p.id,
    });
  }

  // ---- Enquiries: about 320 over the last 12 months ----
  const replyRate = new Map(published.map((p) => [p.id, 0.55 + r.next() * 0.43]));
  // Some centres answer within the hour, others take a day or two.
  const replySpeed = new Map(published.map((p) => [p.id, 0.3 + r.next() * 1.4]));
  const popularity = published.map((p) => ({ p, weight: p.reviews + 10 }));
  const totalWeight = popularity.reduce((s, x) => s + x.weight, 0);
  const pickProvider = () => {
    let n = r.next() * totalWeight;
    for (const x of popularity) if ((n -= x.weight) <= 0) return x.p;
    return popularity[0].p;
  };
  const trainees = users.filter((u) => u.role === 'trainee');
  const enquiries: Enquiry[] = [];
  for (let i = 1; i <= 320; i++) {
    const provider = pickProvider();
    const sent = daysAgo(r, recentDays(r, 365));
    const day = iso(sent).slice(0, 10);
    const eligible = trainees.filter((u) => u.joined <= day && u.status === 'Active');
    const account = eligible.length && r.chance(0.75) ? r.pick(eligible) : undefined;
    const name = account?.name ?? `${r.pick(FIRST)} ${r.pick(LAST)}`;
    if (account) account.enquiries++;
    const age = (TODAY - sent) / DAY;
    const msg = (from: Message['from'], text: string, ms: number): Message => ({ from, text, at: atLabel(ms), sentAt: new Date(ms).toISOString() });
    const thread: Message[] = [msg('trainee', r.pick(ASK), sent)];
    let inboxStatus: InboxStatus = 'New';
    // Brand-new enquiries are usually still waiting; older ones have mostly been answered.
    const replied = age > 1.5 ? r.chance(replyRate.get(provider.id) ?? 0.8) : age * 24 > 1 && r.chance(0.3);
    if (replied) {
      const hours = Math.min(age * 24 - 0.25, 0.25 + 24 * r.next() ** 2.5 * (replySpeed.get(provider.id) ?? 1));
      const replyAt = sent + Math.round(hours * 60) * 6e4;
      thread.push(msg('trainer', r.pick(REPLY), replyAt));
      if (r.chance(0.45)) thread.push(msg('trainee', r.pick(FOLLOW), Math.min(TODAY, replyAt + r.int(1, 20) * 36e5)));
      inboxStatus = age > 21 ? r.pick(['Enrolled', 'Closed', 'Closed', 'Replied'] as const) : r.pick(['Replied', 'Replied', 'Enrolled'] as const);
    }
    enquiries.push({
      id: `g-e${i}`, providerId: provider.id, userId: account?.id, programme: r.pick(provider.programmes).name, trainee: name,
      phone: account?.phone ?? phone(), date: day, status: replied ? 'Replied' : 'Sent', inboxStatus,
      centreUnread: !replied && age < 4, thread,
    });
  }
  enquiries.sort((a, b) => b.date.localeCompare(a.date));

  // ---- Marketplace orders: about 90 over the last 6 months ----
  const listings: (Course | Product)[] = [...courses, ...products].filter((l) => l.status === 'Published');
  const orders: Order[] = [];
  const codes = new Set<string>();
  const code = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let c: string;
    do c = `FSH-${Array.from({ length: 6 }, () => r.pick([...chars])).join('')}`; while (codes.has(c));
    codes.add(c);
    return c;
  };
  for (let i = 0; i < 90; i++) {
    const placed = daysAgo(r, recentDays(r, 180, 1.3));
    const day = iso(placed).slice(0, 10);
    const buyers = trainees.filter((u) => u.joined <= day && u.status === 'Active');
    if (!buyers.length) continue;
    const buyer = r.pick(buyers);
    const items: CartItem[] = [];
    for (let n = r.chance(0.7) ? 1 : r.int(2, 3); n > 0; n--) {
      const l = r.pick(listings);
      if (items.some((x) => x.id === l.id)) continue;
      const kind = 'stock' in l ? 'product' : 'course';
      items.push({ id: l.id, kind, title: l.title, by: l.by, sellerId: l.sellerId, price: l.price, img: l.img, qty: kind === 'product' && r.chance(0.25) ? 2 : 1 });
    }
    const hasProducts = items.some((x) => x.kind === 'product');
    const fulfilment = hasProducts ? (r.chance(0.7) ? 'delivery' : 'pickup') : null;
    const totals = cartTotals(items, fulfilment);
    const payment: PaymentMethod = totals.total === 0 ? 'free' : hasProducts && r.chance(0.3) ? 'cod' : r.chance(0.72) ? 'momo' : 'card';
    const age = (TODAY - placed) / DAY;
    const sellerStatus: Record<string, SellerStatus> = {};
    for (const sellerId of new Set(items.map((x) => x.sellerId))) {
      const physical = items.some((x) => x.sellerId === sellerId && x.kind === 'product');
      sellerStatus[sellerId] = !physical ? 'Completed'
        : age > 10 ? (r.chance(0.06) ? 'Cancelled' : 'Completed')
          : age > 2 ? r.pick(['Confirmed', fulfilment === 'pickup' ? 'Ready for pickup' : 'Out for delivery', 'Completed'] as const)
            : r.pick(['New', 'New', 'Confirmed'] as const);
    }
    // Cash on delivery is only paid once everything has been handed over.
    const handedOver = Object.values(sellerStatus).every((s) => s === 'Completed');
    orders.push({
      id: code(), placedAt: iso(placed), userId: buyer.id, items, subtotal: totals.subtotal, delivery: totals.delivery, total: totals.total, fulfilment,
      contact: {
        name: buyer.name, phone: buyer.phone, email: buyer.email, area: fulfilment === 'delivery' ? buyer.area : '',
        address: fulfilment === 'delivery' ? `${buyer.area}, ${r.pick(STREETS)}` : '', notes: '',
      },
      payment, momoNetwork: payment === 'momo' ? r.pick<MomoNetwork>(['MTN', 'MTN', 'MTN', 'Telecel', 'AirtelTigo']) : undefined,
      status: payment === 'cod' && !handedOver ? 'Awaiting payment' : 'Paid', sellerStatus,
    });
  }
  orders.sort((a, b) => b.placedAt.localeCompare(a.placedAt));

  // ---- Public page views: 90 days per published centre, busier for popular centres and on weekdays ----
  const views: Record<string, Record<string, number>> = {};
  for (const p of published) {
    const perDay = (p.reviews + 10) * (0.6 + r.next() * 0.6);
    views[p.id] = {};
    for (let d = 89; d >= 0; d--) {
      const date = new Date(TODAY - d * DAY);
      const weekend = date.getDay() === 0 || date.getDay() === 6 ? 0.7 : 1;
      const growth = 0.7 + 0.3 * (1 - d / 90);
      views[p.id][iso(date.getTime()).slice(0, 10)] = Math.round(perDay * weekend * growth * (0.75 + r.next() * 0.5));
    }
  }

  return { users, enquiries, orders, views };
}
