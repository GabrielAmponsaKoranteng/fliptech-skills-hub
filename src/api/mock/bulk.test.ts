import { describe, expect, it } from 'vitest';
import { cartTotals } from '../../lib/pricing';
import { buildSeed } from './seed';

describe('generated sample data', () => {
  const db = buildSeed();
  const users = new Map(db.users.map((u) => [u.id, u]));
  const providers = new Map(db.providers.map((p) => [p.id, p]));

  it('is the same every time', () => {
    // Only the generated tables: pending centres get a random map offset when they're drafted.
    const again = buildSeed();
    for (const k of ['users', 'enquiries', 'orders', 'notifications'] as const) expect(JSON.stringify(again[k]), k).toBe(JSON.stringify(db[k]));
  });

  it('has enough rows to fill the dashboards', () => {
    expect(db.users.filter((u) => u.role === 'trainee').length).toBeGreaterThan(150);
    expect(db.enquiries.length).toBeGreaterThan(300);
    expect(db.orders.length).toBeGreaterThan(80);
  });

  it('never reuses an id, email or order number', () => {
    const unique = (list: string[]) => expect(new Set(list).size).toBe(list.length);
    unique(db.users.map((u) => u.id));
    unique(db.users.map((u) => u.email).filter(Boolean));
    unique(db.enquiries.map((e) => e.id));
    unique(db.orders.map((o) => o.id));
  });

  it('gives every published centre a trainer account', () => {
    for (const p of db.providers.filter((x) => x.status === 'Published')) {
      expect(db.users.some((u) => u.role === 'trainer' && u.centreId === p.id), p.id).toBe(true);
    }
  });

  it('only links enquiries to real centres and accounts that existed at the time', () => {
    for (const e of db.enquiries) {
      expect(providers.has(e.providerId), e.id).toBe(true);
      if (e.userId?.startsWith('g-')) expect(users.get(e.userId)!.joined <= e.date, e.id).toBe(true);
      expect(e.status === 'Replied', e.id).toBe(e.thread.some((m) => m.from === 'trainer'));
      if (e.id.startsWith('g-')) {
        const times = e.thread.map((m) => Date.parse(m.sentAt!));
        expect(times, e.id).toEqual([...times].sort((a, b) => a - b));
        expect(times.at(-1)! <= Date.parse('2026-10-28T18:00:00'), e.id).toBe(true);
      }
    }
  });

  it('prices orders with the checkout rules', () => {
    for (const o of db.orders) {
      const { subtotal, delivery, total } = cartTotals(o.items, o.fulfilment);
      expect(o, o.id).toMatchObject({ subtotal, delivery, total });
      expect(Object.keys(o.sellerStatus).sort(), o.id).toEqual([...new Set(o.items.map((i) => i.sellerId))].sort());
      if (o.payment === 'free') expect(o.total).toBe(0);
    }
  });
});
