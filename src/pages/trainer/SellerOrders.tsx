import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useOrderParam } from '../../lib/useOrderParam';
import { ArrowRight, BookOpen, Check, MapPin, MessageCircle, Phone, StickyNote, Store, Truck, XCircle } from 'lucide-react';
import { useApp, useUser } from '../../context/AppContext';
import { PageTitle } from '../../components/DashboardLayout';
import { Drawer, Empty, Img, Modal, Stat, StatusBadge, rowAction, SIZES } from '../../components/ui';
import { ghs, orderDate, paymentLabel } from '../../lib/format';
import { IN_PROGRESS, canCancel, nextStep, sellerIdFor, sellerOrders, stepsFor, type SellerOrder } from '../../lib/orders';

/** This trainer's orders, newest first. */
export function useSellerOrders(): { sellerId: string; list: SellerOrder[] } {
  const { orders } = useApp();
  const user = useUser();
  const sellerId = sellerIdFor(user);
  const list = useMemo(() => sellerOrders(orders, sellerId).sort((a, b) => b.order.placedAt.localeCompare(a.order.placedAt)), [orders, sellerId]);
  return { sellerId, list };
}

type Tab = 'All' | 'New' | 'In progress' | 'Completed' | 'Cancelled';
const TABS: Tab[] = ['All', 'New', 'In progress', 'Completed', 'Cancelled'];
const inTab = (so: SellerOrder, t: Tab) =>
  t === 'All' || (t === 'In progress' ? IN_PROGRESS.includes(so.status) : so.status === t);

const itemsSummary = (so: SellerOrder) => so.items.map((i) => `${i.qty > 1 ? `${i.qty}× ` : ''}${i.title}`).join(', ');
const waLink = (phone: string) => `https://wa.me/233${phone.replace(/\s/g, '').slice(1)}`;

function Fulfilment({ so, long = false }: { so: SellerOrder; long?: boolean }) {
  const o = so.order;
  if (!so.physical) return <span className="meta"><BookOpen /> Online course{long && ' — access sent automatically'}</span>;
  if (o.fulfilment === 'pickup') return <span className="meta"><Store /> Pickup</span>;
  return <span className="meta"><Truck /> Delivery · {o.contact.area}</span>;
}

function PaymentState({ so }: { so: SellerOrder }) {
  const o = so.order;
  if (so.status === 'Cancelled') return <span className="badge">{o.status === 'Paid' ? 'Refunded' : 'Not charged'}</span>;
  if (o.status === 'Paid') return <span className="badge badge-success"><Check /> {o.payment === 'free' ? 'Free' : 'Paid'}</span>;
  return <span className="badge badge-warn">Collect {ghs(so.subtotal)}</span>;
}

function useAdvance() {
  const { updateSellerStatus, toast } = useApp();
  return (so: SellerOrder, sellerId: string) => {
    const step = nextStep(so);
    if (!step) return;
    updateSellerStatus(so.order.id, sellerId, step.status);
    const msg = {
      Confirmed: `Order ${so.order.id} confirmed — ${so.order.contact.name.split(' ')[0]} has been notified by SMS`,
      'Out for delivery': `Marked out for delivery. We’ve texted ${so.order.contact.phone}.`,
      'Ready for pickup': `Marked ready. We’ve texted ${so.order.contact.phone} to come and collect.`,
      Completed: so.order.payment === 'cod' ? `Order completed and ${ghs(so.subtotal)} recorded as paid` : 'Order completed',
    }[step.status as 'Confirmed' | 'Out for delivery' | 'Ready for pickup' | 'Completed'];
    toast(msg);
  };
}

function Progress({ so }: { so: SellerOrder }) {
  const steps = stepsFor(so);
  if (so.status === 'Cancelled') return <div className="notice warn"><XCircle size={18} /><div>You cancelled this order. The buyer was notified and any payment will be refunded.</div></div>;
  const at = steps.indexOf(so.status);
  return (
    <div className="stepper" aria-label="Order progress">
      {steps.map((s, i) => (
        <div key={s} className={`step ${i === at ? 'on' : ''} ${i < at || (i === at && s === 'Completed') ? 'done' : ''}`}>
          <span className="sn">{i < at || (i === at && s === 'Completed') ? <Check size={15} /> : i + 1}</span>
          <span className="lbl">{s}</span>
        </div>
      ))}
    </div>
  );
}

export function SellerOrders() {
  const { updateSellerStatus, toast } = useApp();
  const { sellerId, list } = useSellerOrders();
  const advance = useAdvance();
  const [tab, setTab] = useState<Tab>('All');
  const [selId, setSelId] = useOrderParam();
  const [cancelId, setCancelId] = useState<string | null>(null);

  const shown = list.filter((so) => inTab(so, tab));
  const sel = list.find((so) => so.order.id === selId);
  const toCancel = list.find((so) => so.order.id === cancelId);

  const active = list.filter((so) => so.status !== 'Cancelled');
  const newCount = list.filter((so) => so.status === 'New').length;
  const inProgress = list.filter((so) => IN_PROGRESS.includes(so.status)).length;
  const revenue = active.filter((so) => so.order.status === 'Paid').reduce((s, so) => s + so.subtotal, 0);
  const toCollect = active.filter((so) => so.order.status !== 'Paid').reduce((s, so) => s + so.subtotal, 0);

  return (
    <>
      <PageTitle title="Orders" sub="Courses and products buyers have ordered from your centre.">
        <Link to="/marketplace" className="btn btn-secondary">View marketplace</Link>
      </PageTitle>

      <div className="stats mb-6">
        <Stat icon="Inbox" tone="brand" label="New — confirm within 24h" value={newCount} />
        <Stat icon="Timer" tone="violet" label="In progress" value={inProgress} />
        <Stat icon="ShoppingBag" tone="success" label="Paid revenue" value={ghs(revenue)} />
        <Stat icon="CalendarClock" tone="accent" label="To collect on delivery" value={ghs(toCollect)} />
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="tabs" style={{ border: 0 }}>
            {TABS.map((t) => (
              <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)} style={{ padding: '6px 8px' }}>
                {t} <span className="count">{list.filter((so) => inTab(so, t)).length}</span>
              </button>
            ))}
          </div>
        </div>
        {shown.length === 0 ? (
          list.length === 0
            ? <Empty icon="ShoppingBag" title="No orders yet" text="When buyers order your courses or products, they’ll appear here." action={<Link to="/trainer/listings" className="btn btn-soft btn-sm">Manage your listings</Link>} />
            : <Empty icon="ShoppingBag" title={`No ${tab.toLowerCase()} orders`} text="Nothing in this stage right now." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Order</th><th>Buyer</th><th>Items</th><th>Fulfilment</th><th>Amount</th><th>Status</th><th /></tr></thead>
              <tbody>
                {shown.map((so) => {
                  const step = nextStep(so);
                  return (
                    <tr key={so.order.id} {...rowAction(() => setSelId(so.order.id))}>
                      <td style={{ whiteSpace: "nowrap" }}><div className="bold">{so.order.id}</div><div className="xs muted">{orderDate(so.order)}</div></td>
                      <td><div className="bold small">{so.order.contact.name}</div><div className="xs muted">{so.order.contact.phone}</div></td>
                      <td className="small" style={{ maxWidth: 220 }}><div className="ellipsis">{itemsSummary(so)}</div></td>
                      <td className="small"><Fulfilment so={so} /></td>
                      <td><div className="price">{ghs(so.subtotal)}</div><div className="mt-1"><PaymentState so={so} /></div></td>
                      <td><StatusBadge status={so.status} /></td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {step
                          ? <button className="btn btn-primary btn-sm" onClick={() => advance(so, sellerId)}>{step.label}</button>
                          : <button className="btn btn-ghost btn-sm" onClick={() => setSelId(so.order.id)}>View <ArrowRight size={14} /></button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Drawer
        open={!!sel}
        onClose={() => setSelId(null)}
        title={sel ? `Order ${sel.order.id}` : 'Order'}
        footer={sel && (() => {
          const step = nextStep(sel);
          return (
            <>
              {canCancel(sel) && <button className="btn btn-ghost" style={{ color: 'var(--danger)', marginRight: 'auto' }} onClick={() => setCancelId(sel.order.id)}><XCircle size={16} /> Cancel order</button>}
              {step ? <button className="btn btn-primary" onClick={() => advance(sel, sellerId)}>{step.label}</button> : <button className="btn btn-secondary" onClick={() => setSelId(null)}>Close</button>}
            </>
          );
        })()}
      >
        {sel && (
          <div className="stack">
            <div className="row-between wrap">
              <div className="small muted">Placed {orderDate(sel.order, true)}</div>
              <StatusBadge status={sel.status} />
            </div>
            <Progress so={sel} />

            <div className="card" style={{ padding: 16 }}>
              <h4 className="mb-2">Buyer</h4>
              <div className="row-between wrap">
                <div><div className="bold">{sel.order.contact.name}</div><div className="small muted">{sel.order.contact.phone}{sel.order.contact.email && ` · ${sel.order.contact.email}`}</div></div>
                <div className="row" style={{ gap: 6 }}>
                  <a href={`tel:${sel.order.contact.phone.replace(/\s/g, '')}`} className="btn btn-secondary btn-sm"><Phone size={14} /> Call</a>
                  <a href={waLink(sel.order.contact.phone)} target="_blank" rel="noreferrer" className="btn btn-success btn-sm"><MessageCircle size={14} /> WhatsApp</a>
                </div>
              </div>
            </div>

            {sel.physical && (
              <div className="card" style={{ padding: 16 }}>
                <h4 className="mb-2">{sel.order.fulfilment === 'pickup' ? 'Pickup' : 'Delivery'}</h4>
                {sel.order.fulfilment === 'pickup'
                  ? <div className="meta" style={{ fontSize: 14 }}><Store /> The buyer will collect from your centre. Call them to agree a time.</div>
                  : <div className="stack-sm">
                      <div className="meta" style={{ fontSize: 14 }}><MapPin /> {sel.order.contact.address}, {sel.order.contact.area}</div>
                      {sel.order.contact.notes && <div className="meta" style={{ fontSize: 14 }}><StickyNote /> “{sel.order.contact.notes}”</div>}
                    </div>}
              </div>
            )}

            <div>
              <h4 className="mb-2">Your items in this order</h4>
              <div className="sum-items">
                {sel.items.map((i) => (
                  <div key={i.id} className="sum-item">
                    <div className="sum-thumb"><Img src={i.img} alt="" sizes={SIZES.thumb} />{i.qty > 1 && <span>{i.qty}</span>}</div>
                    <div className="grow" style={{ minWidth: 0 }}><div className="small bold ellipsis">{i.title}</div><div className="xs muted">{i.kind === 'course' ? 'Online course' : `${ghs(i.price)} each`}</div></div>
                    <div className="small bold">{i.price === 0 ? 'Free' : ghs(i.price * i.qty)}</div>
                  </div>
                ))}
              </div>
              <hr className="divider" />
              <dl className="sum-lines">
                <div className="sum-total"><dt>Your total</dt><dd>{ghs(sel.subtotal)}</dd></div>
                <div><dt>Payment</dt><dd>{paymentLabel(sel.order)} · <PaymentState so={sel} /></dd></div>
              </dl>
              {sel.order.items.length > sel.items.length && <p className="xs muted mt-2">This order also includes items from other sellers, which they fulfil separately.</p>}
            </div>
            {!sel.physical && <Fulfilment so={sel} long />}
          </div>
        )}
      </Drawer>

      <Modal open={!!toCancel} onClose={() => setCancelId(null)} title="Cancel this order?"
        footer={<><button className="btn btn-secondary" onClick={() => setCancelId(null)}>Keep order</button><button className="btn btn-danger" onClick={() => {
          if (toCancel) { updateSellerStatus(toCancel.order.id, sellerId, 'Cancelled'); toast(`Order ${toCancel.order.id} cancelled — the buyer has been notified`); }
          setCancelId(null);
        }}>Cancel order</button></>}>
        <p className="muted">{toCancel?.order.contact.name} will get an SMS saying you can’t fulfil {toCancel ? itemsSummary(toCancel) : ''}. {toCancel?.order.status === 'Paid' && 'Their payment for your items will be refunded.'}</p>
      </Modal>
    </>
  );
}

/** Compact card for the trainer overview. */
export function LatestOrders() {
  const { list } = useSellerOrders();
  return (
    <div className="card">
      <div className="card-head"><h3>Latest orders</h3><Link to="/trainer/orders" className="small bold">All orders</Link></div>
      {list.length === 0 ? <Empty icon="ShoppingBag" title="No orders yet" text="Sell courses and products in the marketplace to see orders here." action={<Link to="/trainer/listings" className="btn btn-soft btn-sm">Add a listing</Link>} /> : list.slice(0, 4).map((so) => (
        <Link key={so.order.id} to="/trainer/orders" className="li" style={{ color: 'inherit' }}>
          <div className="sum-thumb"><Img src={so.items[0]?.img} alt="" sizes={SIZES.thumb} />{so.items.length > 1 && <span>{so.items.length}</span>}</div>
          <div className="grow" style={{ minWidth: 0 }}><div className="bold small ellipsis">{itemsSummary(so)}</div><div className="xs muted">{so.order.contact.name} · {orderDate(so.order)}</div></div>
          <div style={{ textAlign: 'right' }}><div className="small bold">{ghs(so.subtotal)}</div><div className="mt-1"><StatusBadge status={so.status} /></div></div>
        </Link>
      ))}
    </div>
  );
}
