import { PROVIDERS } from '../data/catalog';
import type { CartItem, Order, SellerStatus, User, Provider } from '../types';

/** The seller id a signed-in trainer sells under (their centre). */
export const sellerIdFor = (user: User) => user.centreId ?? PROVIDERS[0].id;

/** One seller's part of an order: only their items and their fulfilment status. */
export interface SellerOrder {
  order: Order;
  items: CartItem[];
  /** Sum of this seller's items; delivery fees are not included */
  subtotal: number;
  status: SellerStatus;
  /** True when this seller's part includes physical products to hand over */
  physical: boolean;
}

export function sellerOrders(orders: Order[], sellerId: string): SellerOrder[] {
  return orders.flatMap((order) => {
    const items = order.items.filter((i) => i.sellerId === sellerId);
    if (items.length === 0) return [];
    const physical = items.some((i) => i.kind === 'product');
    return [{
      order,
      items,
      subtotal: items.reduce((s, i) => s + i.price * i.qty, 0),
      status: order.sellerStatus?.[sellerId] ?? (physical ? 'New' : 'Completed'),
      physical,
    }];
  });
}

export const IN_PROGRESS: SellerStatus[] = ['Confirmed', 'Ready for pickup', 'Out for delivery'];

/** The next step a seller can take, with its button label; null when nothing is left to do. */
export function nextStep(so: SellerOrder): { status: SellerStatus; label: string } | null {
  const pickup = so.order.fulfilment === 'pickup';
  const cod = so.order.payment === 'cod';
  switch (so.status) {
    case 'New': return { status: 'Confirmed', label: 'Confirm order' };
    case 'Confirmed': return pickup ? { status: 'Ready for pickup', label: 'Mark ready for pickup' } : { status: 'Out for delivery', label: 'Mark out for delivery' };
    case 'Ready for pickup': return { status: 'Completed', label: cod ? 'Collected & paid' : 'Mark collected' };
    case 'Out for delivery': return { status: 'Completed', label: cod ? 'Delivered & paid' : 'Mark delivered' };
    default: return null;
  }
}

export const canCancel = (so: SellerOrder) => so.status === 'New' || so.status === 'Confirmed';

/** Ordered steps for the progress tracker, depending on how the order is fulfilled. */
export function stepsFor(so: SellerOrder): SellerStatus[] {
  if (!so.physical) return ['Completed'];
  return ['New', 'Confirmed', so.order.fulfilment === 'pickup' ? 'Ready for pickup' : 'Out for delivery', 'Completed'];
}

// ---- Platform-wide (admin) helpers ----

const PROGRESS_ORDER: SellerStatus[] = ['New', 'Confirmed', 'Ready for pickup', 'Out for delivery', 'Completed'];

/** Every seller involved in an order. */
export const sellersIn = (o: Order) => [...new Set(o.items.map((i) => i.sellerId))];

/** Display name for a seller: their centre's name, or the `by` name on their listings. */
export function sellerName(o: Order, sellerId: string, providers: Pick<Provider, 'id' | 'name'>[] = PROVIDERS) {
  return providers.find((p) => p.id === sellerId)?.name ?? o.items.find((i) => i.sellerId === sellerId)?.by ?? sellerId;
}

/** Whole-order status: Cancelled if every seller cancelled, otherwise the least-advanced active seller. */
export function overallStatus(o: Order): SellerStatus {
  const statuses = sellerOrdersOf(o).map((so) => so.status);
  const active = statuses.filter((s) => s !== 'Cancelled');
  if (active.length === 0) return 'Cancelled';
  return active.sort((a, b) => PROGRESS_ORDER.indexOf(a) - PROGRESS_ORDER.indexOf(b))[0];
}

/** Each seller's part of one order. */
export const sellerOrdersOf = (o: Order): SellerOrder[] => sellersIn(o).flatMap((id) => sellerOrders([o], id));

/** Hours a seller has to confirm a new order before it needs attention. */
export const CONFIRM_WITHIN_HOURS = 24;

/** Sellers who haven't confirmed within the deadline. `now` is injectable for tests. */
export function overdueSellers(o: Order, now = Date.now()): string[] {
  const age = (now - new Date(o.placedAt).getTime()) / 36e5;
  if (age < CONFIRM_WITHIN_HOURS) return [];
  return sellerOrdersOf(o).filter((so) => so.status === 'New').map((so) => so.items[0].sellerId);
}

/** Why an order needs an admin's attention: a seller is late to confirm, or pay-on-delivery is unpaid after completion. */
export function attentionReasons(o: Order, now = Date.now()): string[] {
  const reasons = overdueSellers(o, now).map((id) => `${sellerName(o, id)} hasn’t confirmed in ${CONFIRM_WITHIN_HOURS}h`);
  if (o.status !== 'Paid' && overallStatus(o) === 'Completed') reasons.push('Delivered but payment not recorded');
  return reasons;
}
