import { cedi, fmtDate } from './format';
import type { AppNotification, Audience, Enquiry, NotificationPrefs, Order, SellerStatus, User, Provider } from '../types';
import { sellerIdFor, sellerName, sellersIn } from './orders';
import { dateFormat, numberFormat } from './format';

export type NewNotification = Omit<AppNotification, 'id' | 'createdAt' | 'read'>;

const ghs = (n: number) => `GHS ${numberFormat('en-GH').format(n)}`;

/** Notifications fired when an order is placed: one per seller, plus one for admins. */
/** `providers` lets the server name centres from its own data; the app's catalog is the default. */
export function newOrderNotifications(o: Order, providers?: Pick<Provider, 'id' | 'name'>[]): NewNotification[] {
  const perSeller: NewNotification[] = sellersIn(o).map((sellerId) => {
    const items = o.items.filter((i) => i.sellerId === sellerId);
    const total = items.reduce((s, i) => s + i.price * i.qty, 0);
    const physical = items.some((i) => i.kind === 'product');
    const what = items.map((i) => `${i.qty > 1 ? `${i.qty}× ` : ''}${i.title}`).join(', ');
    return {
      kind: 'order_new',
      audience: { role: 'trainer', sellerId },
      orderId: o.id,
      title: physical ? `New order ${o.id}` : 'New course enrolment',
      body: `${o.contact.name} ${physical ? 'ordered' : 'enrolled in'} ${what} · ${total ? ghs(total) : 'Free'}${physical ? (o.payment === 'cod' ? ' · pay on delivery' : '') : ''}`,
      link: `/trainer/orders?order=${o.id}`,
    };
  });
  const sellers = sellersIn(o);
  return [
    ...perSeller,
    {
      kind: 'order_new',
      audience: { role: 'admin' },
      orderId: o.id,
      title: `New order ${o.id}`,
      body: `${o.contact.name} · ${ghs(o.total)} · ${sellers.length === 1 ? sellerName(o, sellers[0], providers) : `${sellers.length} sellers`}`,
      link: `/admin/orders?order=${o.id}`,
    },
  ];
}

const BUYER_MESSAGES: Partial<Record<SellerStatus, (seller: string, o: Order) => string>> = {
  Confirmed: (s) => `${s} confirmed your order and will be in touch to arrange it.`,
  'Ready for pickup': (s) => `Your order from ${s} is ready to collect.`,
  'Out for delivery': (s, o) => `Your order from ${s} is on its way to ${o.contact.area}.`,
  Completed: (s, o) => (o.fulfilment === 'pickup' ? `You collected your order from ${s}. Enjoy!` : `Your order from ${s} was delivered. Enjoy!`),
  Cancelled: (s) => `${s} couldn’t fulfil your order. Any payment for their items will be refunded.`,
};

/** Tells a signed-in buyer that a seller moved their order along (guest orders have no inbox). */
export function orderUpdateNotification(o: Order, sellerId: string, status: SellerStatus, providers?: Pick<Provider, 'id' | 'name'>[]): NewNotification | null {
  const msg = BUYER_MESSAGES[status];
  if (!o.userId || !msg) return null;
  return {
    kind: 'order_update',
    audience: { role: 'trainee', userId: o.userId },
    orderId: o.id,
    title: status === 'Cancelled' ? `Order ${o.id} cancelled` : `Order ${o.id}: ${status.toLowerCase()}`,
    body: msg(sellerName(o, sellerId, providers), o),
    link: `/orders/${o.id}`,
  };
}

export function isFor(n: AppNotification, user: User): boolean {
  const a = n.audience;
  if (a.role !== user.role) return false;
  if (a.role === 'trainer') return a.sellerId === sellerIdFor(user);
  if (a.role === 'trainee') return a.userId === user.id;
  return true;
}


export function timeAgo(iso: string, now = Date.now()): string {
  const mins = Math.round((now - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return dateFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(iso));
}

// ---- Preferences ----

export const DEFAULT_PREFS: NotificationPrefs = {
  newOrders: true, cancellations: true, orderUpdates: true, intakeReminders: true, enquiryReplies: true, news: false, sms: true,
};

/** Preferences are stored per audience, so every user of a centre shares its seller settings. */
export const audienceKey = (a: Audience) =>
  a.role === 'admin' ? 'admin' : a.role === 'trainer' ? `trainer:${a.sellerId}` : `trainee:${a.userId}`;

export const audienceOf = (user: User): Audience =>
  user.role === 'admin' ? { role: 'admin' } : user.role === 'trainer' ? { role: 'trainer', sellerId: sellerIdFor(user) } : { role: 'trainee', userId: user.id };

/** Which toggle controls a notification. */
export function prefFor(n: Pick<AppNotification, 'kind' | 'audience'>): keyof NotificationPrefs {
  if (n.kind === 'intake_reminder') return 'intakeReminders';
  if (n.kind === 'enquiry_reply') return 'enquiryReplies';
  if (n.kind === 'order_new') return 'newOrders';
  return n.audience.role === 'trainer' ? 'cancellations' : 'orderUpdates';
}

/** The toggles each role sees, in display order. `inApp` ones control the bell; the rest are stored for later channels. */
export const PREF_OPTIONS: Record<User['role'], { key: keyof NotificationPrefs; label: string; hint: string; inApp: boolean }[]> = {
  trainee: [
    { key: 'enquiryReplies', label: 'Replies to my enquiries', hint: 'When a training centre answers your question', inApp: true },
    { key: 'orderUpdates', label: 'Updates on my orders', hint: 'When a seller confirms, sends or cancels your order', inApp: true },
    { key: 'intakeReminders', label: 'Upcoming intake reminders', hint: 'A week before a saved provider’s next intake', inApp: true },
    { key: 'news', label: 'News and updates from Fliptech', hint: 'New trades, centres and tips — monthly', inApp: false },
    { key: 'sms', label: 'Also send by SMS', hint: 'For the alerts above that you have switched on', inApp: false },
  ],
  trainer: [
    { key: 'newOrders', label: 'New orders', hint: 'When a buyer orders your courses or products', inApp: true },
    { key: 'cancellations', label: 'Order cancellations', hint: 'When Fliptech support cancels one of your orders', inApp: true },
    { key: 'sms', label: 'Also send by SMS', hint: 'So you don’t miss an order when you’re in the workshop', inApp: false },
  ],
  admin: [
    { key: 'newOrders', label: 'New orders', hint: 'Every order placed on the marketplace', inApp: true },
    { key: 'sms', label: 'Also send by SMS', hint: 'For the alerts above that you have switched on', inApp: false },
  ],
};

// ---- Intake reminders ----

export const REMIND_DAYS_BEFORE = 7;

/** Reminders for saved providers whose next intake starts within the reminder window. One per programme intake. */
export function intakeReminders(user: Pick<User, 'id'>, savedProviders: Provider[], now = Date.now()): NewNotification[] {
  const horizon = now + REMIND_DAYS_BEFORE * 864e5;
  return savedProviders.flatMap((p) => p.programmes
    .filter((pr) => { const t = new Date(pr.intake + 'T08:00:00').getTime(); return t >= now && t <= horizon; })
    .map((pr): NewNotification => ({
      kind: 'intake_reminder',
      audience: { role: 'trainee', userId: user.id },
      dedupeKey: `intake:${user.id}:${p.id}:${pr.id}:${pr.intake}`,
      title: `Intake starts ${fmtDate(pr.intake, { day: 'numeric', month: 'short' })}`,
      body: `${pr.name} at ${p.name} — ${cedi(pr.fee)}, ${pr.places} places left. Enquire now to secure a spot.`,
      link: `/providers/${p.id}`,
    })));
}

// ---- Enquiry replies ----

const PREVIEW_CHARS = 140;

/** Tells a signed-in trainee that a centre replied. Guest enquiries have no inbox, so they get nothing here. */
export function enquiryReplyNotification(e: Enquiry, text: string, centreName = 'A training centre'): NewNotification | null {
  if (!e.userId) return null;
  const centre = centreName;
  const preview = text.length > PREVIEW_CHARS ? text.slice(0, PREVIEW_CHARS - 1).trimEnd() + '…' : text;
  return {
    kind: 'enquiry_reply',
    audience: { role: 'trainee', userId: e.userId },
    enquiryId: e.id,
    title: `${centre} replied`,
    body: `“${preview}”`,
    link: `/app/enquiries?enquiry=${e.id}`,
  };
}
