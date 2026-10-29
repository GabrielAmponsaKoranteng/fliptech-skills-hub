import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Clock, CreditCard, Lock, MapPin, Minus, Package, Plus,
  ShoppingBag, Smartphone, Store, Trash2, Truck, Wallet,
} from 'lucide-react';
import { MAX_QTY, useApp } from '../../context/AppContext';
import { AREAS } from '../../data/catalog';
import { Empty, ErrorState, Img, Loading, Modal, SIZES } from '../../components/ui';
import { homeFor } from '../../components/Layout';
import { cartIssue, type CartIssue } from '../../lib/listings';
import { ApiError, api } from '../../api';
import { useApiQuery } from '../../api/useApiQuery';
import { DELIVERY_FEE, FREE_DELIVERY_OVER, cartTotals } from '../../lib/pricing';
import type { CartItem, FieldEvent, Fulfilment, MomoNetwork, OrderContact, PaymentMethod } from '../../types';

const PHONE_RE = /^0\d{2}\s?\d{3}\s?\d{4}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NETWORKS: MomoNetwork[] = ['MTN', 'Telecel', 'AirtelTigo'];

import { ghs } from '../../lib/format';

export { DELIVERY_FEE, FREE_DELIVERY_OVER, cartTotals } from '../../lib/pricing';

function QtyStepper({ item }: { item: CartItem }) {
  const { setQty } = useApp();
  if (item.kind === 'course') return <span className="badge badge-brand"><BookOpen /> Online course</span>;
  return (
    <div className="qty" role="group" aria-label={`Quantity of ${item.title}`}>
      <button type="button" onClick={() => setQty(item.id, item.qty - 1)} disabled={item.qty <= 1} aria-label="Decrease quantity"><Minus size={15} /></button>
      <span aria-live="polite">{item.qty}</span>
      <button type="button" onClick={() => setQty(item.id, item.qty + 1)} disabled={item.qty >= MAX_QTY} aria-label="Increase quantity"><Plus size={15} /></button>
    </div>
  );
}

function SummaryLines({ subtotal, delivery, total, showDelivery, deliveryLabel, count }: {
  subtotal: number; delivery: number; total: number; showDelivery: boolean; deliveryLabel?: ReactNode; count: number;
}) {
  return (
    <dl className="sum-lines">
      <div><dt>Subtotal ({count} item{count === 1 ? '' : 's'})</dt><dd>{ghs(subtotal)}</dd></div>
      {showDelivery && <div><dt>Delivery</dt><dd>{deliveryLabel ?? (delivery ? ghs(delivery) : 'Free')}</dd></div>}
      <div className="sum-total"><dt>Total</dt><dd>{ghs(total)}</dd></div>
    </dl>
  );
}

/* ------------------------------------------------------------------ */
/* Cart                                                                */
/* ------------------------------------------------------------------ */

const issueText = (i: CartIssue) =>
  i.kind === 'unavailable' ? 'No longer available — please remove it'
    : i.kind === 'sold_out' ? 'Sold out — please remove it'
      : `Only ${i.available} left in stock`;

/** Cart lines that can't be bought as they are (hidden, deleted, sold out or over stock). */
function useCartIssues() {
  const { cart, courses, products, dataStatus } = useApp();
  // Until listings arrive every item would look deleted; report nothing rather than a false alarm.
  if (dataStatus !== 'ready') return new Map<string, NonNullable<ReturnType<typeof cartIssue>>>();
  return new Map(cart.flatMap((i) => { const issue = cartIssue(i, courses, products); return issue ? [[i.id, issue] as const] : []; }));
}

export function Cart() {
  const { cart, removeFromCart, clearCart, setQty, toast, dataStatus } = useApp();
  const issues = useCartIssues();
  const checking = dataStatus === 'loading';
  const t = cartTotals(cart, 'delivery');
  const toFree = FREE_DELIVERY_OVER - t.productSubtotal;

  if (cart.length === 0) {
    return (
      <div className="container" style={{ paddingTop: 48, maxWidth: 760 }}>
        <h1 className="sr-only">Your cart</h1>
        <div className="card">
          <Empty icon="ShoppingCart" title="Your cart is empty" text="Browse online courses or shop products made by skilled professionals."
            action={<div className="row" style={{ justifyContent: 'center' }}><Link to="/courses" className="btn btn-primary">Browse courses</Link><Link to="/marketplace" className="btn btn-secondary">Shop products</Link></div>} />
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: 32 }}>
      <Link to="/marketplace" className="back-link"><ArrowLeft size={16} /> Continue shopping</Link>
      <div className="row-between mt-4 mb-6 wrap">
        <h1>Your cart</h1>
        <button className="btn btn-ghost btn-sm" onClick={() => { clearCart(); toast('Cart cleared'); }}><Trash2 size={15} /> Clear cart</button>
      </div>

      <div className="checkout-grid">
        <div className="card">
          {cart.map((i) => (
            <div key={i.id} className={`cart-row ${issues.has(i.id) ? 'has-issue' : ''}`}>
              <div className="cart-thumb"><Img src={i.img} alt="" sizes={SIZES.thumb} /></div>
              <div className="cart-info">
                <div className="bold">{i.title}</div>
                <div className="xs muted">By {i.by}</div>
                <div className="mt-2"><QtyStepper item={i} /></div>
                {(() => {
                  const issue = issues.get(i.id);
                  if (!issue) return null;
                  return (
                    <div className="cart-issue">
                      {issueText(issue)}
                      {issue.kind === 'not_enough' && <button className="btn btn-ghost btn-sm" onClick={() => { setQty(i.id, issue.available); toast(`Quantity changed to ${issue.available}`); }}>Change to {issue.available}</button>}
                    </div>
                  );
                })()}
              </div>
              <div className="cart-price">
                <div className="price">{i.price === 0 ? <span style={{ color: 'var(--success)' }}>Free</span> : ghs(i.price * i.qty)}</div>
                {i.qty > 1 && <div className="xs muted">{ghs(i.price)} each</div>}
                <button className="btn btn-ghost btn-sm mt-2" onClick={() => { removeFromCart(i.id); toast(`${i.title} removed`); }} aria-label={`Remove ${i.title}`}><Trash2 size={14} /> Remove</button>
              </div>
            </div>
          ))}
        </div>

        <aside className="sticky-card">
          <div className="card card-pad">
            <h3 className="mb-4">Order summary</h3>
            <SummaryLines subtotal={t.subtotal} delivery={0} total={t.subtotal} count={t.count} showDelivery={t.hasProducts} deliveryLabel={t.freeDelivery ? 'Free' : 'Calculated at checkout'} />
            {t.hasProducts && !t.freeDelivery && (
              <div className="mt-4">
                <div className="xs muted mb-2">Add <b style={{ color: 'var(--ink)' }}>{ghs(toFree)}</b> of products for free delivery in Greater Accra</div>
                <div className="progress"><div style={{ width: `${Math.min(100, (t.productSubtotal / FREE_DELIVERY_OVER) * 100)}%` }} /></div>
              </div>
            )}
            {issues.size > 0 && <div className="notice warn mt-4"><span>Some items need your attention before you can check out.</span></div>}
            {checking
              ? <button className="btn btn-primary btn-lg btn-block mt-6" disabled><span className="spinner" /> Checking prices and stock…</button>
              : issues.size > 0
              ? <button className="btn btn-primary btn-lg btn-block mt-6" disabled>Checkout <ArrowRight size={17} /></button>
              : <Link to="/checkout" className="btn btn-primary btn-lg btn-block mt-6">Checkout <ArrowRight size={17} /></Link>}
            <div className="row xs muted mt-3" style={{ justifyContent: 'center', gap: 6 }}><Lock size={13} /> Secure checkout · Mobile Money & cards</div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Checkout                                                            */
/* ------------------------------------------------------------------ */

/** form → (momo prompt | card redirect) → placing → done */
type Stage = 'form' | 'momo' | 'card' | 'placing' | 'done';

export function Checkout() {
  const issues = useCartIssues();
  const { cart, user, placeOrder } = useApp();
  const nav = useNavigate();
  const [contact, setContact] = useState<OrderContact>({
    name: user?.name ?? '', phone: user?.phone ?? '', email: user?.email && user.email.includes('@') ? user.email : '',
    area: user?.area ?? '', address: '', notes: '',
  });
  const [fulfilment, setFulfilment] = useState<Fulfilment>('delivery');
  const [payment, setPayment] = useState<PaymentMethod>('momo');
  const [network, setNetwork] = useState<MomoNetwork>('MTN');
  const [momoPhone, setMomoPhone] = useState(user?.phone ?? '');
  const [touched, setTouched] = useState(false);
  const [stage, setStage] = useState<Stage>('form');

  const t = cartTotals(cart, fulfilment);
  const hasPaidCourses = cart.some((i) => i.kind === 'course' && i.price > 0);
  const isFree = t.total === 0;
  // Pay on delivery only makes sense when everything paid-for is delivered.
  const codAllowed = t.hasProducts && fulfilment === 'delivery' && !hasPaidCourses;
  const method: PaymentMethod = isFree ? 'free' : payment === 'cod' && !codAllowed ? 'momo' : payment;

  // Send people back to the cart if it's empty or something in it can no longer be bought.
  if ((cart.length === 0 || issues.size > 0) && stage === 'form') return <Navigate to="/cart" replace />;

  const set = (k: keyof OrderContact) => (e: FieldEvent) => setContact((c) => ({ ...c, [k]: e.target.value }));
  const errors = {
    name: !contact.name.trim() && 'Enter your name',
    phone: !PHONE_RE.test(contact.phone.trim()) && 'Enter a valid Ghana number, e.g. 024 123 4567',
    email: contact.email.trim() !== '' && !EMAIL_RE.test(contact.email.trim()) && 'Enter a valid email or leave it blank',
    area: t.hasProducts && fulfilment === 'delivery' && !contact.area && 'Choose your area',
    address: t.hasProducts && fulfilment === 'delivery' && contact.address.trim().length < 4 && 'Enter a street, house number or landmark',
    momo: method === 'momo' && !PHONE_RE.test(momoPhone.trim()) && 'Enter the Mobile Money number to charge',
  };
  const valid = !Object.values(errors).some(Boolean);
  const err = (k: keyof typeof errors) => touched && errors[k] && <span className="error-text">{errors[k]}</span>;

  /** Sends the order; the server re-prices it and decides whether it's paid. */
  const finish = async () => {
    setStage('placing'); // also stops the empty-cart redirect from firing as the cart is cleared
    const order = await placeOrder({
      items: cart.map(({ id, kind, qty }) => ({ id, kind, qty })),
      fulfilment: t.hasProducts ? fulfilment : null, contact, payment: method,
      momoNetwork: method === 'momo' ? network : undefined,
    });
    if (!order) { setStage('form'); return; } // error already shown; stock problems send them back to the cart
    setStage('done');
    nav(`/orders/${order.id}`, { replace: true });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) { document.querySelector('.error-text')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    if (method === 'free' || method === 'cod') void finish();
    else if (method === 'momo') setStage('momo');
    else {
      setStage('card');
      setTimeout(() => void finish(), 1600);
    }
  };

  const cta = isFree ? 'Complete enrolment' : method === 'cod' ? 'Place order' : `Pay ${ghs(t.total)}`;

  return (
    <div className="container" style={{ paddingTop: 32 }}>
      <Link to="/cart" className="back-link"><ArrowLeft size={16} /> Back to cart</Link>
      <h1 className="mt-4 mb-6">Checkout</h1>

      <form className="checkout-grid" onSubmit={submit} noValidate>
        <div className="stack" style={{ gap: 20 }}>
          <section className="card card-pad">
            <h3 className="co-step"><span>1</span> Your details</h3>
            <div className="form-grid mt-4">
              <div className="field">
                <label className="label" htmlFor="co-name">Full name <span className="req">*</span></label>
                <input id="co-name" className={`input ${touched && errors.name ? 'invalid' : ''}`} value={contact.name} onChange={set('name')} autoComplete="name" />
                {err('name')}
              </div>
              <div className="field">
                <label className="label" htmlFor="co-phone">Phone number <span className="req">*</span></label>
                <input id="co-phone" className={`input ${touched && errors.phone ? 'invalid' : ''}`} inputMode="tel" placeholder="e.g. 024 123 4567" value={contact.phone} onChange={set('phone')} autoComplete="tel" />
                {err('phone')}
              </div>
              <div className="field span-2">
                <label className="label" htmlFor="co-email">Email <span className="muted" style={{ fontWeight: 500 }}>(optional — for your receipt{cart.some((i) => i.kind === 'course') ? ' and course access' : ''})</span></label>
                <input id="co-email" type="email" className={`input ${touched && errors.email ? 'invalid' : ''}`} value={contact.email} onChange={set('email')} autoComplete="email" />
                {err('email')}
              </div>
            </div>
          </section>

          {t.hasProducts && (
            <section className="card card-pad">
              <h3 className="co-step"><span>2</span> Delivery</h3>
              <div className="pay-options mt-4" role="radiogroup" aria-label="Delivery method">
                <label className={`pay-option ${fulfilment === 'delivery' ? 'on' : ''}`}>
                  <input type="radio" name="fulfilment" checked={fulfilment === 'delivery'} onChange={() => setFulfilment('delivery')} />
                  <Truck size={20} />
                  <span className="grow"><b>Delivery in Greater Accra</b><small>1–3 working days</small></span>
                  <span className="bold">{t.freeDelivery ? 'Free' : ghs(DELIVERY_FEE)}</span>
                </label>
                <label className={`pay-option ${fulfilment === 'pickup' ? 'on' : ''}`}>
                  <input type="radio" name="fulfilment" checked={fulfilment === 'pickup'} onChange={() => setFulfilment('pickup')} />
                  <Store size={20} />
                  <span className="grow"><b>Pick up from the seller</b><small>The seller will call you to arrange a time</small></span>
                  <span className="bold">Free</span>
                </label>
              </div>
              {fulfilment === 'delivery' && (
                <div className="form-grid mt-4">
                  <div className="field">
                    <label className="label" htmlFor="co-area">Area <span className="req">*</span></label>
                    <select id="co-area" className="select" value={contact.area} onChange={set('area')}>
                      <option value="">Select your area</option>
                      {AREAS.map((a) => <option key={a}>{a}</option>)}
                    </select>
                    {err('area')}
                  </div>
                  <div className="field">
                    <label className="label" htmlFor="co-addr">Street, house no. or landmark <span className="req">*</span></label>
                    <div className="input-icon"><MapPin size={17} /><input id="co-addr" className={`input ${touched && errors.address ? 'invalid' : ''}`} placeholder="e.g. GA-123-4567 or behind Madina Market" value={contact.address} onChange={set('address')} autoComplete="street-address" /></div>
                    {err('address')}
                  </div>
                  <div className="field span-2">
                    <label className="label" htmlFor="co-notes">Delivery notes <span className="muted" style={{ fontWeight: 500 }}>(optional)</span></label>
                    <input id="co-notes" className="input" placeholder="e.g. Call when you reach the junction" value={contact.notes} onChange={set('notes')} />
                  </div>
                </div>
              )}
            </section>
          )}

          <section className="card card-pad">
            <h3 className="co-step"><span>{t.hasProducts ? 3 : 2}</span> Payment</h3>
            {isFree ? (
              <div className="notice success mt-4"><CheckCircle2 size={18} /><div>Everything in your cart is free — no payment needed.</div></div>
            ) : (
              <>
                <div className="pay-options mt-4" role="radiogroup" aria-label="Payment method">
                  <label className={`pay-option ${method === 'momo' ? 'on' : ''}`}>
                    <input type="radio" name="payment" checked={method === 'momo'} onChange={() => setPayment('momo')} />
                    <Smartphone size={20} />
                    <span className="grow"><b>Mobile Money</b><small>MTN MoMo, Telecel Cash, AirtelTigo Money</small></span>
                  </label>
                  <label className={`pay-option ${method === 'card' ? 'on' : ''}`}>
                    <input type="radio" name="payment" checked={method === 'card'} onChange={() => setPayment('card')} />
                    <CreditCard size={20} />
                    <span className="grow"><b>Debit or credit card</b><small>Visa or Mastercard, on our payment partner’s secure page</small></span>
                  </label>
                  {codAllowed && (
                    <label className={`pay-option ${method === 'cod' ? 'on' : ''}`}>
                      <input type="radio" name="payment" checked={method === 'cod'} onChange={() => setPayment('cod')} />
                      <Wallet size={20} />
                      <span className="grow"><b>Pay on delivery</b><small>Cash or MoMo when your order arrives</small></span>
                    </label>
                  )}
                </div>
                {method === 'momo' && (
                  <div className="form-grid mt-4">
                    <div className="field">
                      <label className="label" htmlFor="co-net">Network</label>
                      <select id="co-net" className="select" value={network} onChange={(e) => setNetwork(e.target.value as MomoNetwork)}>
                        {NETWORKS.map((n) => <option key={n}>{n}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label className="label" htmlFor="co-momo">Mobile Money number <span className="req">*</span></label>
                      <input id="co-momo" className={`input ${touched && errors.momo ? 'invalid' : ''}`} inputMode="tel" placeholder="e.g. 024 123 4567" value={momoPhone} onChange={(e) => setMomoPhone(e.target.value)} />
                      {err('momo')}
                    </div>
                  </div>
                )}
                {method === 'card' && <div className="notice info mt-4"><Lock size={18} /><div>You’ll enter your card details on our payment partner’s secure page. Fliptech never sees or stores your card number.</div></div>}
              </>
            )}
          </section>
        </div>

        <aside className="sticky-card">
          <div className="card card-pad">
            <h3 className="mb-4">Order summary</h3>
            <div className="sum-items">
              {cart.map((i) => (
                <div key={i.id} className="sum-item">
                  <div className="sum-thumb"><Img src={i.img} alt="" sizes={SIZES.thumb} />{i.qty > 1 && <span>{i.qty}</span>}</div>
                  <div className="grow" style={{ minWidth: 0 }}><div className="small bold ellipsis">{i.title}</div><div className="xs muted">{i.kind === 'course' ? 'Online course' : `Qty ${i.qty}`}</div></div>
                  <div className="small bold">{i.price === 0 ? 'Free' : ghs(i.price * i.qty)}</div>
                </div>
              ))}
            </div>
            <hr className="divider" />
            <SummaryLines subtotal={t.subtotal} delivery={t.delivery} total={t.total} count={t.count} showDelivery={t.hasProducts} />
            <button className="btn btn-primary btn-lg btn-block mt-6" disabled={stage !== 'form'}>{stage === 'card' ? 'Redirecting to secure payment…' : stage === 'placing' || stage === 'done' ? <><span className="spinner" /> Placing your order…</> : <>{cta} <ArrowRight size={17} /></>}</button>
            <p className="xs muted mt-3" style={{ textAlign: 'center' }}>By placing this order you agree to our <Link to="/terms">Terms</Link>.</p>
          </div>
        </aside>
      </form>

      <Modal open={stage === 'momo'} onClose={() => setStage('form')} title="Approve the payment on your phone"
        footer={<><button className="btn btn-secondary" onClick={() => setStage('form')}>Cancel</button><button className="btn btn-primary" onClick={() => void finish()}><CheckCircle2 size={16} /> I’ve approved it</button></>}>
        <div className="momo-prompt">
          <div className="momo-phone"><Smartphone size={34} /><span className="pulse" /></div>
          <p>We’ve sent a {network} Mobile Money prompt for <b>{ghs(t.total)}</b> to <b>{momoPhone}</b>.</p>
          <p className="small muted mt-2">Enter your MoMo PIN on your phone to approve it. Didn’t get a prompt? Dial your network’s MoMo menu and check “Approvals”.</p>
        </div>
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Order confirmation                                                  */
/* ------------------------------------------------------------------ */

export function OrderConfirmation() {
  const { id } = useParams();
  const { orders, user } = useApp();
  const cached = orders.find((o) => o.id === id);
  // Not in the session cache (e.g. a guest reloading the page): ask the API.
  const q = useApiQuery(() => (cached ? Promise.resolve(cached) : api.orders.get(id ?? '')), [id, !!cached]);
  const order = cached ?? q.data;

  if (!order) {
    return (
      <div className="container" style={{ paddingTop: 48 }}>
        <div className="card">
          {q.loading ? <Loading label="Loading your order" />
            : q.error instanceof ApiError && q.error.code !== 'not_found' ? <ErrorState error={q.error} onRetry={() => void q.reload()} />
              : <Empty icon="SearchX" title="Order not found" text="We couldn’t find that order. If you just placed it, check the SMS we sent you." action={<Link to="/marketplace" className="btn btn-primary">Go to marketplace</Link>} />}
        </div>
      </div>
    );
  }

  const courses = order.items.filter((i) => i.kind === 'course');
  const products = order.items.filter((i) => i.kind === 'product');
  const paidLabel = { momo: `Paid with ${order.momoNetwork} Mobile Money`, card: 'Paid by card', cod: 'Pay on delivery', free: 'Free enrolment' }[order.payment];

  return (
    <div className="container" style={{ paddingTop: 40, maxWidth: 820 }}>
      <div className="card card-pad fade-in" style={{ textAlign: 'center', padding: 36 }}>
        <div className="empty-ico" style={{ background: 'var(--success-50)', color: 'var(--success)', width: 76, height: 76, borderRadius: 24 }}><CheckCircle2 size={38} /></div>
        <h1 className="as-h2">{order.status === 'Paid' ? 'Thank you — your order is confirmed!' : 'Order placed!'}</h1>
        <p className="muted mt-2">Order <b style={{ color: 'var(--ink)' }}>{order.id}</b> · {new Date(order.placedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
        <div className="row mt-4" style={{ justifyContent: 'center', gap: 8 }}>
          <span className={`badge ${order.status === 'Paid' ? 'badge-success' : 'badge-warn'}`}><span className="dot" />{order.status}</span>
          <span className="badge">{paidLabel}</span>
        </div>
      </div>

      <div className="grid-2 mt-6" style={{ alignItems: 'start' }}>
        <div className="card card-pad">
          <h3 className="mb-4">What happens next</h3>
          <div className="timeline">
            {courses.length > 0 && (
              <div className="timeline-item"><div className="timeline-dot"><BookOpen /></div><div><div className="bold small">Course access sent</div><div className="xs muted">We’ve texted a link for {courses.length === 1 ? courses[0].title : `${courses.length} courses`} to {order.contact.phone}{order.contact.email && ` and emailed ${order.contact.email}`}.</div>{user?.role === 'trainee' && order.userId === user.id && <Link to={courses.length === 1 ? `/app/courses/${courses[0].id}` : '/app/courses'} className="btn btn-primary btn-sm mt-2">Start learning</Link>}</div></div>
            )}
            {products.length > 0 && (
              <>
                <div className="timeline-item"><div className="timeline-dot"><Package /></div><div><div className="bold small">Seller confirms your order</div><div className="xs muted">They’ll call {order.contact.phone} within one working day.</div></div></div>
                <div className="timeline-item"><div className="timeline-dot" style={{ background: 'var(--line-2)', color: 'var(--muted)' }}>{order.fulfilment === 'delivery' ? <Truck /> : <Store />}</div><div><div className="bold small">{order.fulfilment === 'delivery' ? `Delivery to ${order.contact.area}` : 'Pick up from the seller'}</div><div className="xs muted">{order.fulfilment === 'delivery' ? `${order.contact.address} · usually 1–3 working days` : 'The seller will arrange a pickup time with you.'}</div></div></div>
              </>
            )}
            {order.status === 'Awaiting payment' && (
              <div className="timeline-item"><div className="timeline-dot" style={{ background: 'var(--warn-50)', color: 'var(--warn)' }}><Clock /></div><div><div className="bold small">Pay {ghs(order.total)} on delivery</div><div className="xs muted">Cash or Mobile Money when your order arrives.</div></div></div>
            )}
          </div>
        </div>
        <div className="card card-pad">
          <h3 className="mb-4">Order details</h3>
          <div className="sum-items">
            {order.items.map((i) => (
              <div key={i.id} className="sum-item">
                <div className="sum-thumb"><Img src={i.img} alt="" sizes={SIZES.thumb} />{i.qty > 1 && <span>{i.qty}</span>}</div>
                <div className="grow" style={{ minWidth: 0 }}><div className="small bold ellipsis">{i.title}</div><div className="xs muted">By {i.by}</div></div>
                <div className="small bold">{i.price === 0 ? 'Free' : ghs(i.price * i.qty)}</div>
              </div>
            ))}
          </div>
          <hr className="divider" />
          <SummaryLines subtotal={order.subtotal} delivery={order.delivery} total={order.total} count={order.items.reduce((s, i) => s + i.qty, 0)} showDelivery={order.fulfilment != null} />
        </div>
      </div>

      <div className="row mt-6 wrap" style={{ justifyContent: 'center' }}>
        <Link to="/marketplace" className="btn btn-secondary"><ShoppingBag size={16} /> Continue shopping</Link>
        <Link to="/courses" className="btn btn-secondary"><BookOpen size={16} /> Browse courses</Link>
        {user?.role === 'trainee'
          ? <Link to="/app/orders" className="btn btn-primary">View my orders</Link>
          : user && <Link to={homeFor(user.role)} className="btn btn-primary">Go to my dashboard</Link>}
      </div>
    </div>
  );
}
