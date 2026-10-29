import type { CartItem, Course, Order, Product } from '../types';

export const isPublished = (x: Course | Product) => x.status === 'Published';

/** Units of a listing sold across all orders, ignoring sellers who cancelled their part. */
export function unitsSold(orders: Order[], listing: Course | Product): number {
  return orders.reduce((n, o) => {
    if (o.sellerStatus?.[listing.sellerId] === 'Cancelled') return n;
    return n + o.items.filter((i) => i.id === listing.id).reduce((m, i) => m + i.qty, 0);
  }, 0);
}

/** Course ids a user has bought or enrolled in (not cancelled). */
export function ownedCourseIds(orders: Order[], userId: string | undefined): Set<string> {
  const ids = new Set<string>();
  if (!userId) return ids;
  for (const o of orders) {
    if (o.userId !== userId) continue;
    for (const i of o.items) if (i.kind === 'course' && o.sellerStatus?.[i.sellerId] !== 'Cancelled') ids.add(i.id);
  }
  return ids;
}

/** Shown on cards and detail pages. Free courses get a "Free" badge even if the seller didn't set one. */
export const courseBadge = (c: Course): Course['badge'] => c.badge ?? (c.price === 0 ? 'Free' : undefined);

export const LOW_STOCK = 5;

/** Why a cart line can't be bought as it stands, or null if it's fine. */
export type CartIssue =
  | { kind: 'unavailable' }
  | { kind: 'sold_out' }
  | { kind: 'not_enough'; available: number };

export function cartIssue(item: CartItem, courses: Course[], products: Product[]): CartIssue | null {
  if (item.kind === 'course') {
    const c = courses.find((x) => x.id === item.id);
    return c && isPublished(c) ? null : { kind: 'unavailable' };
  }
  const p = products.find((x) => x.id === item.id);
  if (!p || !isPublished(p)) return { kind: 'unavailable' };
  if (p.stock <= 0) return { kind: 'sold_out' };
  if (item.qty > p.stock) return { kind: 'not_enough', available: p.stock };
  return null;
}

/** Lesson count and total hours (rounded to the nearest half hour), derived from the curriculum. */
export function courseStats(c: Pick<Course, 'curriculum'>) {
  const minutes = c.curriculum.reduce((s, l) => s + l.minutes, 0);
  return { lessons: c.curriculum.length, minutes, hours: Math.max(0.5, Math.round(minutes / 30) / 2) };
}
