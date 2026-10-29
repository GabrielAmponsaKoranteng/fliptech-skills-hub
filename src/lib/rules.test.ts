// Pure business rules shared by the UI and the mock server.
import { describe, expect, it } from 'vitest';
import { cartTotals, DELIVERY_FEE, FREE_DELIVERY_OVER } from './pricing';
import { canCancel, nextStep, sellerOrders, stepsFor } from './orders';
import { cartIssue, ownedCourseIds, unitsSold } from './listings';
import { enquiryReplyNotification, intakeReminders, prefFor } from './notifications';
import type { CartItem, Course, Enquiry, Order, Product, Provider, SellerStatus } from '../types';

const item = (p: Partial<CartItem>): CartItem => ({ id: 'x', kind: 'product', title: 'Thing', by: 'Seller', sellerId: 's1', price: 100, img: '', qty: 1, ...p });

const order = (p: Partial<Order>): Order => ({
  id: 'FSH-TEST01', placedAt: '2026-10-01T10:00:00.000Z', items: [item({})], subtotal: 100, delivery: 0, total: 100,
  fulfilment: 'delivery', contact: { name: 'A', phone: '024 123 4567', email: '', area: 'Madina', address: 'House 1', notes: '' },
  payment: 'momo', status: 'Paid', sellerStatus: { s1: 'New' }, ...p,
});

describe('cartTotals', () => {
  it('charges delivery for products under the threshold', () => {
    const t = cartTotals([item({ price: 100, qty: 2 })], 'delivery');
    expect(t).toMatchObject({ subtotal: 200, delivery: DELIVERY_FEE, total: 200 + DELIVERY_FEE, count: 2 });
  });

  it('makes delivery free at the threshold', () => {
    const t = cartTotals([item({ price: FREE_DELIVERY_OVER })], 'delivery');
    expect(t.delivery).toBe(0);
    expect(t.freeDelivery).toBe(true);
  });

  it('never charges delivery for pickup or courses-only carts', () => {
    expect(cartTotals([item({})], 'pickup').delivery).toBe(0);
    expect(cartTotals([item({ kind: 'course', price: 50 })], 'delivery').delivery).toBe(0);
  });

  it('counts only products toward free delivery', () => {
    const t = cartTotals([item({ kind: 'course', price: 400 }), item({ id: 'p', price: 50 })], 'delivery');
    expect(t.productSubtotal).toBe(50);
    expect(t.delivery).toBe(DELIVERY_FEE);
  });
});

describe('seller order steps', () => {
  const so = (status: SellerStatus, p: Partial<Order> = {}) => sellerOrders([order({ ...p, sellerStatus: { s1: status } })], 's1')[0];

  it('walks delivery orders New → Confirmed → Out for delivery → Completed', () => {
    expect(nextStep(so('New'))?.status).toBe('Confirmed');
    expect(nextStep(so('Confirmed'))?.status).toBe('Out for delivery');
    expect(nextStep(so('Out for delivery'))?.status).toBe('Completed');
    expect(nextStep(so('Completed'))).toBeNull();
    expect(stepsFor(so('New'))).toEqual(['New', 'Confirmed', 'Out for delivery', 'Completed']);
  });

  it('uses "Ready for pickup" for pickup orders', () => {
    expect(nextStep(so('Confirmed', { fulfilment: 'pickup' }))?.status).toBe('Ready for pickup');
  });

  it('labels the last step "& paid" for pay on delivery', () => {
    expect(nextStep(so('Out for delivery', { payment: 'cod' }))?.label).toMatch(/paid/i);
  });

  it('allows cancelling only before dispatch', () => {
    expect(canCancel(so('New'))).toBe(true);
    expect(canCancel(so('Confirmed'))).toBe(true);
    expect(canCancel(so('Out for delivery'))).toBe(false);
    expect(canCancel(so('Completed'))).toBe(false);
  });

  it('shows each seller only their own items', () => {
    const o = order({ items: [item({ id: 'a', sellerId: 's1' }), item({ id: 'b', sellerId: 's2', price: 30 })], sellerStatus: { s1: 'New', s2: 'New' } });
    const mine = sellerOrders([o], 's2')[0];
    expect(mine.items.map((i) => i.id)).toEqual(['b']);
    expect(mine.subtotal).toBe(30);
    expect(sellerOrders([o], 'nobody')).toEqual([]);
  });
});

describe('listings rules', () => {
  const course = { id: 'c1', kind: 'course' } as const;

  it('counts a course as owned unless the order was cancelled', () => {
    const owned = order({ userId: 'u1', items: [item({ ...course, sellerId: 's1' })], sellerStatus: { s1: 'Completed' } });
    const cancelled = order({ id: 'FSH-2', userId: 'u2', items: [item({ ...course, sellerId: 's1' })], sellerStatus: { s1: 'Cancelled' } });
    expect(ownedCourseIds([owned, cancelled], 'u1').has('c1')).toBe(true);
    expect(ownedCourseIds([owned, cancelled], 'u2').has('c1')).toBe(false);
    expect(ownedCourseIds([owned], undefined).size).toBe(0);
  });

  it('counts units sold, excluding cancelled orders', () => {
    const p = { id: 'm1', sellerId: 's1', curriculum: undefined } as unknown as Product;
    const orders = [order({ items: [item({ id: 'm1', qty: 3 })] }), order({ id: 'FSH-2', items: [item({ id: 'm1', qty: 5 })], sellerStatus: { s1: 'Cancelled' } })];
    expect(unitsSold(orders, p)).toBe(3);
  });

  it('flags cart items that are hidden, gone or over stock', () => {
    const product = { id: 'm1', status: 'Published', stock: 2 } as Product;
    expect(cartIssue(item({ id: 'm1', qty: 1 }), [], [product])).toBeNull();
    expect(cartIssue(item({ id: 'm1', qty: 3 }), [], [product])).not.toBeNull();
    expect(cartIssue(item({ id: 'm1' }), [], [{ ...product, status: 'Hidden' }])).not.toBeNull();
    expect(cartIssue(item({ id: 'gone' }), [] as Course[], [product])).not.toBeNull();
  });
});

describe('notification rules', () => {
  const provider = (intake: string) => ({ id: 'p1', name: 'Centre', programmes: [{ id: 'pr1', name: 'Welding', intake, fee: 100, places: 5 }] }) as unknown as Provider;
  const now = new Date('2026-10-01T09:00:00').getTime();

  it('reminds about intakes within 7 days, once per intake', () => {
    const soon = intakeReminders({ id: 'u1' }, [provider('2026-10-05')], now);
    expect(soon).toHaveLength(1);
    expect(soon[0].dedupeKey).toBe('intake:u1:p1:pr1:2026-10-05');
    expect(intakeReminders({ id: 'u1' }, [provider('2026-10-20')], now)).toHaveLength(0);
    expect(intakeReminders({ id: 'u1' }, [provider('2026-09-20')], now)).toHaveLength(0);
  });

  it('notifies trainees of replies only when they have an account', () => {
    const e = { id: 'e1', userId: 'u1' } as Enquiry;
    expect(enquiryReplyNotification(e, 'Hello', 'Centre')?.audience).toEqual({ role: 'trainee', userId: 'u1' });
    expect(enquiryReplyNotification({ ...e, userId: undefined }, 'Hello')).toBeNull();
    expect(enquiryReplyNotification(e, 'x'.repeat(500))!.body.length).toBeLessThan(150);
  });

  it('maps each notification to the preference that controls it', () => {
    expect(prefFor({ kind: 'enquiry_reply', audience: { role: 'trainee', userId: 'u1' } })).toBe('enquiryReplies');
    expect(prefFor({ kind: 'intake_reminder', audience: { role: 'trainee', userId: 'u1' } })).toBe('intakeReminders');
  });
});
