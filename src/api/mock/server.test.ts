// The mock server is the reference implementation of docs/API.md, so these tests double as the
// backend's acceptance checklist: each one is a rule a real server must also enforce.
import { beforeEach, describe, expect, it } from 'vitest';
import { createMockServer } from './server';
import { read, resetDb, update } from './db';
import { ApiError, type Api, type PlaceOrderInput } from '../contract';
import { DELIVERY_FEE } from '../../lib/pricing';
import type { Role } from '../../types';

let api: Api;

beforeEach(() => {
  resetDb();
  api = createMockServer();
});

const as = (role: Role) => api.auth.demoSignIn(role);

/** Asserts the call fails with the given error code (and returns the error for further checks). */
async function rejects(p: Promise<unknown>, code: ApiError['code']): Promise<ApiError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).code).toBe(code);
    return e as ApiError;
  }
  throw new Error(`Expected the call to fail with "${code}", but it succeeded`);
}

const contact = { name: 'Kwame Mensah', phone: '024 123 4567', email: '', area: 'Madina', address: 'House 12, Main St', notes: '' };
const orderOf = (items: PlaceOrderInput['items'], p: Partial<PlaceOrderInput> = {}): PlaceOrderInput =>
  ({ items, fulfilment: 'delivery', contact, payment: 'momo', momoNetwork: 'MTN', ...p });
const stockOf = (id: string) => read('products').find((p) => p.id === id)!.stock;

// ---------------------------------------------------------------- auth & sessions

describe('auth', () => {
  it('has no user until someone signs in, and forgets them on sign-out', async () => {
    expect(await api.auth.me()).toBeNull();
    const u = await as('trainee');
    expect((await api.auth.me())?.id).toBe(u.id);
    await api.auth.signOut();
    expect(await api.auth.me()).toBeNull();
  });

  it('signs in by phone number regardless of spacing', async () => {
    const u = await api.auth.signIn('0241234567', 'any-password');
    expect(u.name).toBe('Kwame Mensah');
  });

  it('refuses suspended accounts', async () => {
    const suspended = read('users').find((u) => u.status === 'Suspended')!;
    await rejects(api.auth.signIn(suspended.email, 'x'), 'forbidden');
  });

  it('rejects a second account with the same phone number', async () => {
    const e = await rejects(api.auth.registerTrainee({ name: 'Copy', phone: '024 1234567', password: 'password1' }), 'conflict');
    expect(e.status).toBe(409);
  });

  it('returns field errors for invalid registrations', async () => {
    const e = await rejects(api.auth.registerTrainee({ name: '', phone: '123', password: 'short' }), 'validation');
    expect(Object.keys(e.fields ?? {})).toEqual(expect.arrayContaining(['name', 'phone', 'password']));
  });

  it('honours the sign-up and centre-registration switches', async () => {
    await as('admin');
    const s = await api.admin.settings();
    await api.admin.saveSettings({ flags: { ...s.flags, signups: false, trainerReg: false } });
    await api.auth.signOut();
    await rejects(api.auth.registerTrainee({ name: 'New', phone: '055 000 1111', password: 'password1' }), 'forbidden');
    await rejects(api.auth.registerCentre({
      centre: 'New Centre', description: '', phone: '055 000 2222', area: 'Madina', password: 'password1', programmes: [], documents: { registration: 'x.pdf', photos: [] },
    }), 'forbidden');
  });

  it('queues a newly registered centre for verification', async () => {
    const before = read('queue').length;
    const u = await api.auth.registerCentre({
      centre: 'Tema Tailoring Hub', description: 'Tailoring', phone: '055 000 3333', area: 'Tema', password: 'password1',
      programmes: [{ name: 'Tailoring', trade: 'tailoring', fee: 900, months: 6, days: 'Mon – Fri' }], documents: { registration: 'reg.pdf', photos: ['a.jpg'] },
    });
    expect(u.role).toBe('trainer');
    expect(read('queue')).toHaveLength(before + 1);
    expect(read('queue')[0]).toMatchObject({ name: 'Tema Tailoring Hub', status: 'Pending', trade: 'tailoring' });
  });
});

// ---------------------------------------------------------------- permissions & scoping

describe('permissions', () => {
  it('requires a session (401) and the right role (403)', async () => {
    await rejects(api.admin.users(), 'unauthenticated');
    await as('trainee');
    await rejects(api.admin.users(), 'forbidden');
    await rejects(api.centre.programmes(), 'forbidden');
    await rejects(api.listings.save({} as never), 'forbidden');
  });

  it('scopes order lists by role', async () => {
    const all = read('orders');
    await as('trainee');
    const mine = await api.orders.list();
    expect(mine.every((o) => o.userId === 'u1')).toBe(true);

    await as('trainer');
    const centre = await api.orders.list();
    expect(centre.length).toBeGreaterThan(0);
    expect(centre.every((o) => o.items.some((i) => i.sellerId === 'accra-central-welding'))).toBe(true);

    await as('admin');
    expect(await api.orders.list()).toHaveLength(all.length);
  });

  it('hides other people’s orders (404, not 403)', async () => {
    const theirs = read('orders').find((o) => o.userId && o.userId !== 'u1')!;
    await as('trainee');
    await rejects(api.orders.get(theirs.id), 'not_found');
  });

  it('lets a guest read their own order by id', async () => {
    const o = await api.orders.place(orderOf([{ id: 'm2', kind: 'product', qty: 1 }]));
    expect(o.userId).toBeUndefined();
    expect((await api.orders.get(o.id)).id).toBe(o.id);
  });
});

// ---------------------------------------------------------------- orders

describe('placing orders', () => {
  it('prices the order on the server and takes stock', async () => {
    const before = stockOf('m2'); // GH₵35 soap
    const o = await api.orders.place(orderOf([{ id: 'm2', kind: 'product', qty: 2 }]));
    expect(o).toMatchObject({ subtotal: 70, delivery: DELIVERY_FEE, total: 70 + DELIVERY_FEE, status: 'Paid' });
    expect(o.items[0]).toMatchObject({ title: 'Natural Herbal Soap', price: 35, sellerId: 'freshcare' });
    expect(stockOf('m2')).toBe(before - 2);
  });

  it('refuses more than is in stock, and hidden listings', async () => {
    const e = await rejects(api.orders.place(orderOf([{ id: 'm5', kind: 'product', qty: 99 }])), 'conflict');
    expect(e.message).toMatch(/Only \d+ .* left/);
    update('products', (l) => l.map((p) => (p.id === 'm2' ? { ...p, status: 'Hidden' } : p)));
    await rejects(api.orders.place(orderOf([{ id: 'm2', kind: 'product', qty: 1 }])), 'conflict');
  });

  it('validates contact details and delivery address', async () => {
    const e = await rejects(api.orders.place(orderOf([{ id: 'm2', kind: 'product', qty: 1 }], { contact: { ...contact, phone: '123', address: '' } })), 'validation');
    expect(e.fields).toMatchObject({ phone: expect.any(String), address: expect.any(String) });
  });

  it('allows pay on delivery only for delivered products', async () => {
    await rejects(api.orders.place(orderOf([{ id: 'm2', kind: 'product', qty: 1 }], { fulfilment: 'pickup', payment: 'cod' })), 'validation');
    const o = await api.orders.place(orderOf([{ id: 'm2', kind: 'product', qty: 1 }], { payment: 'cod' }));
    expect(o.status).toBe('Awaiting payment');
  });

  it('stores free orders as free, whatever payment was sent', async () => {
    const free = read('courses').find((c) => c.price === 0 && c.status === 'Published')!;
    const o = await api.orders.place(orderOf([{ id: free.id, kind: 'course', qty: 1 }], { payment: 'card' }));
    expect(o).toMatchObject({ payment: 'free', total: 0, fulfilment: null });
    expect(o.sellerStatus[free.sellerId]).toBe('Completed');
  });

  it('notifies each seller and the admins', async () => {
    const o = await api.orders.place(orderOf([{ id: 'm2', kind: 'product', qty: 1 }, { id: 'm9', kind: 'product', qty: 1 }]));
    const forOrder = read('notifications').filter((n) => n.orderId === o.id);
    const audiences = forOrder.map((n) => JSON.stringify(n.audience));
    expect(audiences).toEqual(expect.arrayContaining([
      JSON.stringify({ role: 'trainer', sellerId: 'freshcare' }),
      JSON.stringify({ role: 'trainer', sellerId: 'accra-central-welding' }),
      JSON.stringify({ role: 'admin' }),
    ]));
  });

  it('respects a seller who switched off new-order notifications', async () => {
    await as('trainer');
    await api.notifications.setPref('newOrders', false);
    await api.auth.signOut();
    const o = await api.orders.place(orderOf([{ id: 'm9', kind: 'product', qty: 1 }]));
    const toCentre = read('notifications').filter((n) => n.orderId === o.id && n.audience.role === 'trainer');
    expect(toCentre).toHaveLength(0);
  });
});

describe('order fulfilment', () => {
  const placeToolkit = async (p: Partial<PlaceOrderInput> = {}) => {
    await as('trainee');
    const o = await api.orders.place(orderOf([{ id: 'm9', kind: 'product', qty: 2 }], p));
    await as('trainer');
    return o;
  };

  it('moves one step at a time', async () => {
    const o = await placeToolkit();
    await rejects(api.orders.setSellerStatus(o.id, 'accra-central-welding', 'Completed'), 'conflict');
    await api.orders.setSellerStatus(o.id, 'accra-central-welding', 'Confirmed');
    const next = await api.orders.setSellerStatus(o.id, 'accra-central-welding', 'Out for delivery');
    expect(next.sellerStatus['accra-central-welding']).toBe('Out for delivery');
    await rejects(api.orders.setSellerStatus(o.id, 'accra-central-welding', 'Cancelled'), 'conflict');
  });

  it('only lets a seller change their own part', async () => {
    await as('trainee');
    const o = await api.orders.place(orderOf([{ id: 'm2', kind: 'product', qty: 1 }, { id: 'm9', kind: 'product', qty: 1 }]));
    await as('trainer');
    await rejects(api.orders.setSellerStatus(o.id, 'freshcare', 'Confirmed'), 'forbidden');
  });

  it('marks pay-on-delivery orders paid when completed', async () => {
    const o = await placeToolkit({ payment: 'cod' });
    for (const s of ['Confirmed', 'Out for delivery', 'Completed'] as const) await api.orders.setSellerStatus(o.id, 'accra-central-welding', s);
    expect((await api.orders.get(o.id)).status).toBe('Paid');
  });

  it('tells the buyer about each update', async () => {
    const o = await placeToolkit();
    await api.orders.setSellerStatus(o.id, 'accra-central-welding', 'Confirmed');
    const toBuyer = read('notifications').filter((n) => n.orderId === o.id && n.audience.role === 'trainee');
    expect(toBuyer).toHaveLength(1);
  });

  it('puts stock back when a seller cancels — once', async () => {
    const before = stockOf('m9');
    const o = await placeToolkit();
    expect(stockOf('m9')).toBe(before - 2);
    await api.orders.setSellerStatus(o.id, 'accra-central-welding', 'Cancelled');
    expect(stockOf('m9')).toBe(before);
    await as('admin');
    await api.orders.cancel(o.id); // already cancelled: no double restock
    expect(stockOf('m9')).toBe(before);
  });

  it('lets admins cancel a whole order, restock it and notify everyone', async () => {
    const before = stockOf('m9');
    const o = await placeToolkit();
    await as('admin');
    const cancelled = await api.orders.cancel(o.id);
    expect(Object.values(cancelled.sellerStatus)).toEqual(['Cancelled']);
    expect(stockOf('m9')).toBe(before);
    const buyer = read('notifications').find((n) => n.orderId === o.id && n.audience.role === 'trainee' && /cancelled/i.test(n.title));
    expect(buyer?.body).toMatch(/refunded/);
  });
});

// ---------------------------------------------------------------- listings

describe('listings', () => {
  const baseProduct = () => ({ ...read('products').find((p) => p.id === 'm9')!, id: 'new-1', title: 'Welding Gloves', stock: 10 });

  it('always saves listings under the caller’s own centre', async () => {
    await as('trainer');
    const saved = await api.listings.save({ ...baseProduct(), sellerId: 'someone-else', rating: 5, reviews: 999 });
    expect(saved).toMatchObject({ sellerId: 'accra-central-welding', rating: 0, reviews: 0 });
  });

  it('refuses edits to another seller’s listing', async () => {
    await as('trainer');
    const theirs = read('products').find((p) => p.id === 'm1')!;
    await rejects(api.listings.save({ ...theirs, title: 'Mine now' }), 'forbidden');
    await rejects(api.listings.remove('product', 'm1'), 'forbidden');
  });

  it('validates listings', async () => {
    await as('trainer');
    const e = await rejects(api.listings.save({ ...baseProduct(), title: 'X', price: 0, stock: -1 }), 'validation');
    expect(Object.keys(e.fields ?? {})).toEqual(expect.arrayContaining(['title', 'price', 'stock']));
  });

  it('shows hidden listings only to their seller', async () => {
    await as('trainer');
    await api.listings.setStatus('product', 'm9', 'Hidden');
    expect((await api.listings.list()).products.some((p) => p.id === 'm9')).toBe(true);
    await as('trainee');
    expect((await api.listings.list()).products.some((p) => p.id === 'm9')).toBe(false);
  });

  it('won’t delete a course that has learners', async () => {
    await as('trainer');
    await rejects(api.listings.remove('course', 'c3'), 'conflict');
  });
});

// ---------------------------------------------------------------- enquiries

describe('enquiries', () => {
  const enquiry = (message: string) => ({ providerId: 'accra-central-welding', programme: 'Welding – Certificate Programme', trainee: 'Kwame Mensah', phone: '024 123 4567', message });

  it('works for guests and links signed-in trainees', async () => {
    const guest = await api.enquiries.create(enquiry('Is there a morning class?'));
    expect(guest.userId).toBeUndefined();
    await as('trainee');
    const mine = await api.enquiries.create(enquiry('What does it cost?'));
    expect(mine.userId).toBe('u1');
    expect((await api.enquiries.list()).some((e) => e.id === mine.id)).toBe(true);
  });

  it('holds spam back from the centre until an admin releases it', async () => {
    const spam = await api.enquiries.create(enquiry('CLICK HERE to win free phone bit.ly/x'));
    expect(spam.flagged).toBe(true);
    await as('trainer');
    expect((await api.enquiries.list()).some((e) => e.id === spam.id)).toBe(false);
    await as('admin');
    await api.enquiries.setFlagged(spam.id, false);
    await as('trainer');
    expect((await api.enquiries.list()).some((e) => e.id === spam.id)).toBe(true);
  });

  it('notifies the trainee when the centre replies', async () => {
    await as('trainee');
    const e = await api.enquiries.create(enquiry('Do you have places?'));
    await as('trainer');
    const replied = await api.enquiries.reply(e.id, 'Yes, 5 places left.');
    expect(replied).toMatchObject({ status: 'Replied', inboxStatus: 'Replied' });
    const n = read('notifications').find((x) => x.enquiryId === e.id);
    expect(n).toMatchObject({ kind: 'enquiry_reply', audience: { role: 'trainee', userId: 'u1' } });
  });

  it('reopens a closed conversation when the trainee follows up', async () => {
    await as('trainee');
    const e = await api.enquiries.create(enquiry('Hello'));
    await as('trainer');
    await api.enquiries.setStatus(e.id, 'Closed');
    await api.enquiries.markRead(e.id);
    await as('trainee');
    const next = await api.enquiries.reply(e.id, 'One more question');
    expect(next).toMatchObject({ inboxStatus: 'New', centreUnread: true });
  });

  it('rejects empty and very long messages', async () => {
    await as('trainee');
    const e = await api.enquiries.create(enquiry('Hello'));
    await rejects(api.enquiries.reply(e.id, '   '), 'validation');
    await rejects(api.enquiries.reply(e.id, 'x'.repeat(2001)), 'validation');
  });
});

// ---------------------------------------------------------------- notifications & learning

describe('notifications', () => {
  it('only lists and marks the caller’s own notifications', async () => {
    await as('trainee');
    const mine = await api.notifications.list();
    expect(mine.every((n) => n.audience.role === 'trainee' && (n.audience as { userId: string }).userId === 'u1')).toBe(true);

    const adminNote = read('notifications').find((n) => n.audience.role === 'admin' && !n.read)!;
    await api.notifications.markRead([adminNote.id]);
    expect(read('notifications').find((n) => n.id === adminNote.id)!.read).toBe(false);
  });

  it('sends each intake reminder only once', async () => {
    const soon = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
    update('providers', (l) => l.map((p) => (p.id === 'accra-central-welding' ? { ...p, programmes: p.programmes.map((pr, i) => (i === 0 ? { ...pr, intake: soon } : pr)) } : p)));
    await as('trainee');
    await api.me.setSaved('accra-central-welding', true);
    const count = () => read('notifications').filter((n) => n.kind === 'intake_reminder' && n.dedupeKey?.includes(soon)).length;
    await api.notifications.list();
    await api.notifications.list();
    expect(count()).toBe(1);
  });
});

describe('learning', () => {
  it('requires owning the course', async () => {
    await as('trainee');
    const notOwned = read('courses').find((c) => c.price > 0 && !read('orders').some((o) => o.userId === 'u1' && o.items.some((i) => i.id === c.id)))!;
    await rejects(api.learning.setLessonDone(notOwned.id, notOwned.curriculum[0].id, true), 'forbidden');
  });

  it('records progress for an owned course', async () => {
    await as('trainee');
    const owned = read('orders').find((o) => o.userId === 'u1' && o.items.some((i) => i.kind === 'course'))!.items.find((i) => i.kind === 'course')!;
    const lesson = read('courses').find((c) => c.id === owned.id)!.curriculum[0].id;
    const p = await api.learning.setLessonDone(owned.id, lesson, true);
    expect(p.done).toContain(lesson);
    expect((await api.learning.progress())[owned.id].done).toContain(lesson);
  });
});

// ---------------------------------------------------------------- centre & admin

describe('centre', () => {
  it('keeps the public listing in step with published programmes', async () => {
    await as('trainer');
    await api.centre.saveProgramme({ id: '', name: 'Evening Welding', trade: 'welding', type: 'Short course', fee: 99, months: 1, days: 'Evenings', time: '6pm – 8pm', intake: '', places: 10, published: true });
    const c = (await api.catalog.get()).providers.find((p) => p.id === 'accra-central-welding')!;
    expect(c.fee).toBe(99);
    expect(c.programmes.some((p) => p.name === 'Evening Welding')).toBe(true);
  });
});

describe('admin', () => {
  beforeEach(async () => { await as('admin'); });

  it('can’t change their own account', async () => {
    await rejects(api.admin.updateUser('u3', { status: 'Suspended' }), 'conflict');
  });

  it('removes suspended providers from the public catalog', async () => {
    await api.admin.updateProvider('accra-central-welding', { status: 'Suspended' });
    expect((await api.catalog.get()).providers.some((p) => p.id === 'accra-central-welding')).toBe(false);
    expect((await api.admin.providers()).some((p) => p.id === 'accra-central-welding')).toBe(true);
  });

  it('rejects invitations to emails already in use', async () => {
    const invited = await api.admin.inviteAdmin({ name: 'Yaw', email: 'Yaw@Fliptech.com', access: 'support' });
    expect(invited).toMatchObject({ status: 'Invited', email: 'yaw@fliptech.com' });
    await rejects(api.admin.inviteAdmin({ name: 'Yaw 2', email: 'yaw@fliptech.com', access: 'support' }), 'conflict');
    await api.admin.revokeInvite(invited.id);
    await rejects(api.admin.revokeInvite('u1'), 'conflict'); // an active account, not a pending invite
    await rejects(api.admin.revokeInvite('nobody'), 'not_found');
  });

  it('cleans up the area list', async () => {
    const c = await api.admin.setAreas([' Madina ', 'Madina', '', 'Tema']);
    expect(c.areas).toEqual(['Madina', 'Tema']);
    await rejects(api.admin.setAreas(['  ']), 'validation');
  });

  it('hides reviews when the setting is off', async () => {
    const s = await api.admin.settings();
    expect((await api.catalog.reviews('accra-central-welding')).length).toBeGreaterThan(0);
    await api.admin.saveSettings({ flags: { ...s.flags, reviews: false } });
    expect(await api.catalog.reviews('accra-central-welding')).toEqual([]);
  });

  it('logs decisions in the activity feed', async () => {
    const item = (await api.admin.verificationQueue())[0];
    await api.admin.decide(item.id, 'Approved');
    expect((await api.admin.activity())[0].text).toContain(item.name);
  });
});

// ---------------------------------------------------------------- centre lifecycle

describe('centre registration and approval', () => {
  const register = () => api.auth.registerCentre({
    centre: 'Dansoman Catering School', description: 'Catering and pastry', phone: '055 000 4444', area: 'Dansoman', password: 'password1',
    programmes: [{ name: 'Catering Certificate', trade: 'welding', fee: 800, months: 4, days: 'Mon – Fri', intake: '2027-01-11' }],
    documents: { registration: 'reg.pdf', photos: ['a.jpg'] },
  });

  it('creates a pending centre the trainer can manage but the public can’t see', async () => {
    const u = await register();
    expect(u.centreId).toBe('dansoman-catering-school');
    const c = await api.catalog.get();
    expect(c.providers.some((p) => p.id === u.centreId)).toBe(false);
    expect(c.myCentre).toMatchObject({ id: u.centreId, fee: 800, intake: '2027-01-11' });
    expect(await api.centre.programmes()).toHaveLength(1);
    await api.auth.signOut();
    expect((await api.catalog.get()).myCentre).toBeUndefined();
  });

  it('publishes the centre when the application is approved', async () => {
    const u = await register();
    await as('admin');
    const item = (await api.admin.verificationQueue()).find((q) => q.providerId === u.centreId)!;
    await api.admin.decide(item.id, 'Approved');
    expect((await api.catalog.get()).providers.some((p) => p.id === u.centreId)).toBe(true);
    await api.admin.decide(item.id, 'Rejected');
    expect((await api.catalog.get()).providers.some((p) => p.id === u.centreId)).toBe(false);
    expect((await api.admin.providers()).find((p) => p.id === u.centreId)?.status).toBe('Rejected');
  });

  it('publishes seeded applications too', async () => {
    await as('admin');
    const item = (await api.admin.verificationQueue())[0];
    expect(item.providerId).toBeTruthy();
    await api.admin.decide(item.id, 'Approved');
    expect((await api.catalog.get()).providers.find((p) => p.id === item.providerId)?.name).toBe(item.name);
  });

  it('skips the queue when auto-publish is on', async () => {
    await as('admin');
    const s = await api.admin.settings();
    await api.admin.saveSettings({ flags: { ...s.flags, autoPublish: true } });
    await api.auth.signOut();
    const u = await register();
    expect((await api.catalog.get()).providers.some((p) => p.id === u.centreId)).toBe(true);
    expect(read('queue').find((q) => q.providerId === u.centreId)?.status).toBe('Approved');
  });

  it('rejects programmes with an unknown trade', async () => {
    await rejects(api.auth.registerCentre({
      centre: 'Bad Trade Centre', description: '', phone: '055 000 6666', area: 'Osu', password: 'password1',
      programmes: [{ name: 'Pastry', trade: 'not-a-trade', fee: 100, months: 1, days: 'Sat' }], documents: { registration: 'r.pdf', photos: [] },
    }), 'validation');
  });

  it('gives each centre a unique id', async () => {
    const a = await register();
    await api.auth.signOut();
    const b = await api.auth.registerCentre({
      centre: 'Dansoman Catering School', description: '', phone: '055 000 5555', area: 'Dansoman', password: 'password1', programmes: [], documents: { registration: 'r.pdf', photos: [] },
    });
    expect(b.centreId).not.toBe(a.centreId);
  });
});

// ---------------------------------------------------------------- admin access levels

describe('admin access levels', () => {
  const signInAs = (email: string) => api.auth.signIn(email, 'x');

  it('reports each admin’s access level', async () => {
    expect((await as('admin')).access).toBe('super');
    expect((await signInAs('kojo@fliptech.com')).access).toBe('verification');
    expect((await signInAs('efua@fliptech.com')).access).toBe('support');
  });

  it('limits verification officers to the queue and providers', async () => {
    await signInAs('kojo@fliptech.com');
    await expect(api.admin.verificationQueue()).resolves.toBeDefined();
    await expect(api.admin.providers()).resolves.toBeDefined();
    await rejects(api.admin.users(), 'forbidden');
    await rejects(api.admin.settings(), 'forbidden');
    await rejects(api.orders.markPaid(read('orders')[0].id), 'forbidden');
    expect(await api.orders.list()).toEqual([]);
    expect(await api.enquiries.list()).toEqual([]);
  });

  it('limits support to users, enquiries and orders', async () => {
    await signInAs('efua@fliptech.com');
    await expect(api.admin.users()).resolves.toBeDefined();
    expect((await api.orders.list()).length).toBeGreaterThan(0);
    await rejects(api.admin.verificationQueue(), 'forbidden');
    await rejects(api.admin.setAreas(['Tema']), 'forbidden');
    await rejects(api.admin.inviteAdmin({ name: 'X', email: 'x@fliptech.com', access: 'support' }), 'forbidden');
    // Support can suspend people but not change their role.
    await expect(api.admin.updateUser('a3', { status: 'Suspended' })).resolves.toMatchObject({ status: 'Suspended' });
    await rejects(api.admin.updateUser('a3', { role: 'admin' }), 'forbidden');
  });
});

// ---------------------------------------------------------------- public site info

describe('site info', () => {
  it('publishes maintenance, the announcement and contacts with the catalog', async () => {
    expect((await api.catalog.get()).site).toMatchObject({ maintenance: false, signups: true, supportPhone: '030 222 1100' });
    await as('admin');
    const s = await api.admin.settings();
    await api.admin.saveSettings({ flags: { ...s.flags, maintenance: true }, announcement: 'Closed for Christmas', supportPhone: '030 000 0000' });
    await api.auth.signOut();
    expect((await api.catalog.get()).site).toMatchObject({ maintenance: true, announcement: 'Closed for Christmas', supportPhone: '030 000 0000' });
  });

  it('keeps private settings out of the public copy', async () => {
    const site = (await api.catalog.get()).site as unknown as Record<string, unknown>;
    expect(site).not.toHaveProperty('autoPublish');
    expect(site).not.toHaveProperty('sms');
  });
});

// ---------------------------------------------------------------- password reset, profile photo, stats

describe('password reset', () => {
  const linkToken = () => read('outbox').find((m) => m.kind === 'password_reset')!.link.split('token=')[1];

  it('sends a one-time link that expires after use', async () => {
    await api.auth.requestPasswordReset('024 123 4567');
    const token = linkToken();
    await rejects(api.auth.resetPassword(token, 'short'), 'validation');
    await api.auth.resetPassword(token, 'new-password-1');
    await rejects(api.auth.resetPassword(token, 'new-password-2'), 'conflict');
  });

  it('answers the same way for unknown accounts, without sending anything', async () => {
    await expect(api.auth.requestPasswordReset('nobody@example.com')).resolves.toBeUndefined();
    expect(read('outbox')).toHaveLength(0);
  });

  it('rejects expired and made-up tokens', async () => {
    await api.auth.requestPasswordReset('kwame@example.com');
    update('resetTokens', (l) => l.map((t) => ({ ...t, expires: new Date(Date.now() - 1000).toISOString() })));
    await rejects(api.auth.resetPassword(linkToken(), 'new-password-1'), 'conflict');
    await rejects(api.auth.resetPassword('made-up', 'new-password-1'), 'conflict');
  });

  it('lets support send a reset link for a user', async () => {
    await api.auth.signIn('efua@fliptech.com', 'x');
    await api.admin.sendPasswordReset('u1');
    expect(read('outbox')[0]).toMatchObject({ kind: 'password_reset', to: 'kwame@example.com' });
  });
});

describe('profile photo', () => {
  it('saves, validates and removes the avatar', async () => {
    await as('trainee');
    const photo = 'data:image/jpeg;base64,AAAA';
    expect((await api.me.update({ avatar: photo })).avatar).toBe(photo);
    expect((await api.auth.me())?.avatar).toBe(photo);
    await rejects(api.me.update({ avatar: 'javascript:alert(1)' }), 'validation');
    expect((await api.me.update({ name: 'Kwame M.' })).avatar).toBe(photo); // other edits keep it
    expect((await api.me.update({ avatar: '' })).avatar).toBeUndefined();
  });
});

describe('admin stats', () => {
  it('counts users, centres and enquiries from the data', async () => {
    await as('admin');
    const s = await api.admin.stats(6);
    const users = read('users');
    expect(s.trainees).toBe(users.filter((u) => u.role === 'trainee').length);
    expect(s.providers).toBe((await api.catalog.get()).providers.length);
    expect(s.enquiries).toBe(read('enquiries').filter((e) => !e.flagged).length); // spam isn't counted
    expect(s.monthly).toHaveLength(6);
    expect(s.enquiriesByTrade.reduce((n, t) => n + t.count, 0)).toBe(s.enquiries);
  });

  it('includes this month’s new enquiries', async () => {
    await as('admin');
    const before = (await api.admin.stats(1)).monthly[0].enquiries;
    await api.enquiries.create({ providerId: 'madina-tailoring', programme: 'Tailoring', trainee: 'Ama', phone: '024 555 1212', message: 'Hello there' });
    expect((await api.admin.stats(1)).monthly[0].enquiries).toBe(before + 1);
  });
});

describe('centre dashboard stats', () => {
  const centre = 'accra-central-welding';
  const day = () => new Date().toISOString().slice(0, 10);

  it('counts public page views, but not the centre’s own staff or admins', async () => {
    update('views', () => ({}));
    await api.catalog.trackView(centre);
    await api.catalog.trackView(centre);
    await as('trainer');
    await api.catalog.trackView(centre);
    await api.auth.signOut();
    await as('admin');
    await api.catalog.trackView(centre);
    expect(read('views')[centre]).toEqual({ [day()]: 2 });
  });

  it('compares the last 30 days with the 30 before', async () => {
    const ago = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
    update('views', () => ({ [centre]: { [ago(1)]: 10, [ago(29)]: 5, [ago(31)]: 4, [ago(70)]: 100 } }));
    await as('trainer');
    const s = await api.centre.stats();
    expect(s.views).toEqual({ current: 15, previous: 4 });
    expect(s.weekly).toHaveLength(8);
    expect(s.weekly.at(-1)!.week <= day()).toBe(true);
  });

  it('measures reply time from the enquiry to the centre’s first answer', async () => {
    await as('trainee');
    const e = await api.enquiries.create({ providerId: centre, programme: 'Welding – Certificate Programme', trainee: 'Kwame Mensah', phone: '024 123 4567', message: 'Hello' });
    // Pretend it arrived three hours ago.
    update('enquiries', (l) => l.map((x) => (x.id === e.id ? { ...x, thread: [{ ...x.thread[0], sentAt: new Date(Date.now() - 3 * 36e5).toISOString() }] } : x)));
    update('enquiries', (l) => l.filter((x) => x.id === e.id));
    await api.auth.signOut();
    await as('trainer');
    expect((await api.centre.stats()).replyHours.current).toBeNull();
    await api.enquiries.reply(e.id, 'Yes, places are open.');
    await api.enquiries.setStatus(e.id, 'Enrolled');
    const s = await api.centre.stats();
    expect(s.replyHours.current).toBeCloseTo(3, 1);
    expect(s.enquiries.current).toBe(1);
    expect(s.enrolled.current).toBe(1);
    expect(s.enrolledByProgramme).toEqual({ 'Welding – Certificate Programme': 1 });
  });

  it('is only for trainers', async () => {
    await rejects(api.centre.stats(), 'unauthenticated');
    await as('trainee');
    await rejects(api.centre.stats(), 'forbidden');
  });
});
