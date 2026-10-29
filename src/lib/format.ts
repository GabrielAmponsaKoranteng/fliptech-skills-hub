// Formatting and small utilities shared across the app.
import type { Order } from '../types';

// toLocaleString() builds a new formatter on every call, which adds up in long lists and when
// generating sample data (~0.25 ms each). These are built once per format and reused.
const dateFormats = new Map<string, Intl.DateTimeFormat>();
const numberFormats = new Map<string, Intl.NumberFormat>();
export function dateFormat(locale: string, opts: Intl.DateTimeFormatOptions) {
  const key = locale + JSON.stringify(opts);
  let f = dateFormats.get(key);
  if (!f) { f = new Intl.DateTimeFormat(locale, opts); dateFormats.set(key, f); }
  return f;
}
export function numberFormat(locale: string, opts: Intl.NumberFormatOptions = {}) {
  const key = locale + JSON.stringify(opts);
  let f = numberFormats.get(key);
  if (!f) { f = new Intl.NumberFormat(locale, opts); numberFormats.set(key, f); }
  return f;
}

export const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  dateFormat('en-GB', opts).format(new Date(iso + 'T00:00:00'));

export const cedi = (n: number | string) => `GH₵${numberFormat('en-GH').format(Number(n))}`;

export const initials = (name = '') => name.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();

/** Timestamp shown on a chat message, e.g. "27 Oct, 14:05". */
export const messageTime = (d = new Date()) => dateFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d);

/** Type guard for filtering out missing lookups, e.g. `ids.map(providerById).filter(isDefined)`. */
export const isDefined = <T,>(x: T | null | undefined): x is T => x != null;

/** Prices in order and checkout screens, e.g. "GHS 1,250" */
export const ghs = (n: number) => `GHS ${numberFormat('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)}`;

export const paymentLabel = (o: Pick<Order, 'payment' | 'momoNetwork'>) =>
  ({ momo: `${o.momoNetwork ?? ''} Mobile Money`.trim(), card: 'Card', cod: 'Pay on delivery', free: 'Free enrolment' })[o.payment];

export const orderDate = (o: Order, withTime = false) =>
  dateFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) }).format(new Date(o.placedAt));
