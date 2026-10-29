import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useOrderParam } from '../../lib/useOrderParam';
import { AlertTriangle, BookOpen, CheckCircle2, Download, MapPin, MessageCircle, Phone, Search, StickyNote, Store, Truck, XCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PageTitle } from '../../components/DashboardLayout';
import { Drawer, Empty, ErrorState, Img, Loading, Modal, PageSkeleton, Stat, StatusBadge, rowAction, SIZES } from '../../components/ui';
import { DataGate } from '../../components/DataGate';
import { ghs, orderDate, paymentLabel } from '../../lib/format';
import { downloadCsv } from '../../lib/csv';
import { attentionReasons, overallStatus, sellerName, sellerOrdersOf, sellersIn } from '../../lib/orders';
import type { Order, SellerStatus } from '../../types';

type Tab = 'All' | 'Needs attention' | 'In progress' | 'Completed' | 'Cancelled';
const TABS: Tab[] = ['All', 'Needs attention', 'In progress', 'Completed', 'Cancelled'];


function inTab(o: Order, t: Tab, now: number) {
  const st = overallStatus(o);
  switch (t) {
    case 'All': return true;
    case 'Needs attention': return attentionReasons(o, now).length > 0;
    case 'Completed': return st === 'Completed';
    case 'Cancelled': return st === 'Cancelled';
    case 'In progress': return st !== 'Completed' && st !== 'Cancelled';
  }
}

const fulfilmentText = (o: Order) =>
  o.fulfilment === 'delivery' ? `Delivery · ${o.contact.area}` : o.fulfilment === 'pickup' ? 'Pickup' : 'Online only';

function exportOrders(orders: Order[]) {
  downloadCsv('orders',
    ['Order', 'Placed', 'Buyer', 'Phone', 'Sellers', 'Items', 'Subtotal', 'Delivery', 'Total', 'Payment', 'Payment status', 'Fulfilment', 'Order status'],
    orders.map((o) => [
      o.id, o.placedAt, o.contact.name, o.contact.phone,
      sellersIn(o).map((id) => sellerName(o, id)).join('; '),
      o.items.map((i) => `${i.qty}x ${i.title}`).join('; '),
      o.subtotal, o.delivery, o.total, paymentLabel(o), o.status, fulfilmentText(o), overallStatus(o),
    ]));
}

const SELLER_STATUSES: SellerStatus[] = ['New', 'Confirmed', 'Ready for pickup', 'Out for delivery', 'Completed', 'Cancelled'];

/** Orders come from the shared app data, which may still be loading when the page opens. */
export function AdminOrders() {
  return <DataGate skeleton={<PageSkeleton label="Loading orders" />}><OrdersPage /></DataGate>;
}

function OrdersPage() {
  const { orders, updateSellerStatus, markOrderPaid, cancelOrder, toast } = useApp();
  const [now] = useState(() => Date.now());
  const [tab, setTab] = useState<Tab>('All');
  const [q, setQ] = useState('');
  const [seller, setSeller] = useState('');
  const [selId, setSelId] = useOrderParam();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const sorted = useMemo(() => [...orders].sort((a, b) => b.placedAt.localeCompare(a.placedAt)), [orders]);
  const allSellers = useMemo(() => {
    const m = new Map<string, string>();
    sorted.forEach((o) => sellersIn(o).forEach((id) => m.set(id, sellerName(o, id))));
    return [...m].sort((a, b) => a[1].localeCompare(b[1]));
  }, [sorted]);

  const matches = (o: Order) => {
    const needle = q.trim().toLowerCase();
    const text = `${o.id} ${o.contact.name} ${o.contact.phone} ${o.items.map((i) => i.title).join(' ')}`.toLowerCase();
    return (!needle || text.includes(needle)) && (!seller || sellersIn(o).includes(seller));
  };
  const filtered = sorted.filter(matches);
  const shown = filtered.filter((o) => inTab(o, tab, now));
  const sel = orders.find((o) => o.id === selId);

  const live = orders.filter((o) => overallStatus(o) !== 'Cancelled');
  const paidSales = live.filter((o) => o.status === 'Paid').reduce((s, o) => s + o.total, 0);
  const awaiting = live.filter((o) => o.status !== 'Paid').reduce((s, o) => s + o.total, 0);
  const attention = orders.filter((o) => attentionReasons(o, now).length > 0).length;

  return (
    <>
      <PageTitle title="Orders" sub="Every course and product order across the marketplace.">
        <button className="btn btn-secondary" onClick={() => { exportOrders(filtered); toast(`Exported ${filtered.length} orders`); }} disabled={filtered.length === 0}><Download size={16} /> Export CSV</button>
      </PageTitle>

      <div className="stats mb-6">
        <Stat icon="ShoppingBag" tone="brand" label="Orders" value={orders.length} />
        <Stat icon="Send" tone="success" label="Paid sales" value={ghs(paidSales)} />
        <Stat icon="CalendarClock" tone="accent" label="Awaiting payment" value={ghs(awaiting)} />
        <Stat icon="ShieldAlert" tone="danger" label="Need attention" value={attention} />
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="input-icon" style={{ flex: '1 1 240px' }}><Search size={16} /><input className="input" placeholder="Search order, buyer, phone or item…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search orders" /></div>
          <select className="select" style={{ width: 220 }} value={seller} onChange={(e) => setSeller(e.target.value)} aria-label="Seller">
            <option value="">All sellers</option>
            {allSellers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </div>
        <div className="toolbar" style={{ paddingTop: 0 }}>
          <div className="tabs" style={{ border: 0 }}>
            {TABS.map((t) => (
              <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)} style={{ padding: '6px 8px' }}>
                {t} <span className="count">{filtered.filter((o) => inTab(o, t, now)).length}</span>
              </button>
            ))}
          </div>
        </div>
        {shown.length === 0 ? (
          orders.length === 0
            ? <Empty icon="ShoppingBag" title="No orders yet" text="Orders from the marketplace will appear here as soon as buyers check out." />
            : <Empty icon="SearchX" title="No orders match" text="Try another search, seller or tab." action={<button className="btn btn-secondary btn-sm" onClick={() => { setQ(''); setSeller(''); setTab('All'); }}>Clear filters</button>} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Order</th><th>Buyer</th><th>Sellers</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead>
              <tbody>
                {shown.map((o) => {
                  const flags = attentionReasons(o, now);
                  return (
                    <tr key={o.id} {...rowAction(() => setSelId(o.id))} style={flags.length ? { background: 'var(--warn-50)' } : undefined}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div className="bold row" style={{ gap: 6 }}>{o.id}{flags.length > 0 && <AlertTriangle size={14} color="var(--warn)" aria-label={flags.join('; ')} />}</div>
                        <div className="xs muted">{orderDate(o)} · {fulfilmentText(o)}</div>
                      </td>
                      <td><div className="bold small">{o.contact.name}</div><div className="xs muted">{o.contact.phone}</div></td>
                      <td className="small" style={{ maxWidth: 240 }}>
                        <div className="stack-sm" style={{ gap: 4 }}>
                          {sellerOrdersOf(o).map((so) => (
                            <div key={so.items[0].sellerId} className="row" style={{ gap: 6 }}>
                              <span className="ellipsis" style={{ maxWidth: 140 }}>{sellerName(o, so.items[0].sellerId)}</span>
                              <StatusBadge status={so.status} />
                            </div>
                          ))}
                        </div>
                      </td>
                      <td><div className="price">{ghs(o.total)}</div><div className="xs muted">{o.items.reduce((n, i) => n + i.qty, 0)} item(s)</div></td>
                      <td><div className="small">{paymentLabel(o)}</div><div className="mt-1"><StatusBadge status={o.status} /></div></td>
                      <td><StatusBadge status={overallStatus(o)} /></td>
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
        title={sel ? `Order ${sel.id}` : 'Order'}
        footer={sel && (
          <>
            {overallStatus(sel) !== 'Cancelled' && <button className="btn btn-ghost" style={{ color: 'var(--danger)', marginRight: 'auto' }} onClick={() => setConfirmCancel(true)}><XCircle size={16} /> Cancel order</button>}
            {sel.status !== 'Paid' && overallStatus(sel) !== 'Cancelled' && <button className="btn btn-success" onClick={() => { markOrderPaid(sel.id); toast(`${sel.id} marked as paid`); }}><CheckCircle2 size={16} /> Mark as paid</button>}
            <button className="btn btn-secondary" onClick={() => setSelId(null)}>Close</button>
          </>
        )}
      >
        {sel && (
          <div className="stack">
            <div className="row-between wrap">
              <div className="small muted">Placed {orderDate(sel, true)}</div>
              <div className="row" style={{ gap: 6 }}><StatusBadge status={sel.status} /><StatusBadge status={overallStatus(sel)} /></div>
            </div>
            {attentionReasons(sel, now).map((r) => <div key={r} className="notice warn"><AlertTriangle size={18} /><div>{r}</div></div>)}

            <div className="card" style={{ padding: 16 }}>
              <h4 className="mb-2">Buyer</h4>
              <div className="row-between wrap">
                <div><div className="bold">{sel.contact.name}</div><div className="small muted">{sel.contact.phone}{sel.contact.email && ` · ${sel.contact.email}`}{!sel.userId && ' · Guest checkout'}</div></div>
                <div className="row" style={{ gap: 6 }}>
                  <a href={`tel:${sel.contact.phone.replace(/\s/g, '')}`} className="btn btn-secondary btn-sm"><Phone size={14} /> Call</a>
                  <a href={`https://wa.me/233${sel.contact.phone.replace(/\s/g, '').slice(1)}`} target="_blank" rel="noreferrer" className="btn btn-success btn-sm"><MessageCircle size={14} /> WhatsApp</a>
                </div>
              </div>
              {sel.fulfilment && (
                <div className="stack-sm mt-3">
                  {sel.fulfilment === 'delivery'
                    ? <div className="meta" style={{ fontSize: 14 }}><MapPin /> {sel.contact.address}, {sel.contact.area}</div>
                    : <div className="meta" style={{ fontSize: 14 }}><Store /> Buyer collects from the seller</div>}
                  {sel.contact.notes && <div className="meta" style={{ fontSize: 14 }}><StickyNote /> “{sel.contact.notes}”</div>}
                </div>
              )}
            </div>

            <div>
              <h4 className="mb-2">Sellers</h4>
              <div className="stack-sm" style={{ gap: 12 }}>
                {sellerOrdersOf(sel).map((so) => {
                  const id = so.items[0].sellerId;
                  return (
                    <div key={id} className="card" style={{ padding: 14 }}>
                      <div className="row-between wrap mb-2">
                        <div className="bold small row" style={{ gap: 6 }}>{so.physical ? <Truck size={15} /> : <BookOpen size={15} />} {sellerName(sel, id)}</div>
                        <select className="select" style={{ height: 32, width: 170, fontSize: 13 }} value={so.status} aria-label={`Status for ${sellerName(sel, id)}`}
                          onChange={(e) => { const st = e.target.value as SellerStatus; updateSellerStatus(sel.id, id, st); toast(`${sellerName(sel, id)}: ${st}`); }}>
                          {SELLER_STATUSES.filter((st) => so.physical || st === 'Completed' || st === 'Cancelled').map((st) => <option key={st}>{st}</option>)}
                        </select>
                      </div>
                      <div className="sum-items">
                        {so.items.map((i) => (
                          <div key={i.id} className="sum-item">
                            <div className="sum-thumb"><Img src={i.img} alt="" sizes={SIZES.thumb} />{i.qty > 1 && <span>{i.qty}</span>}</div>
                            <div className="grow" style={{ minWidth: 0 }}><div className="small bold ellipsis">{i.title}</div><div className="xs muted">{i.kind === 'course' ? 'Online course' : `${ghs(i.price)} each`}</div></div>
                            <div className="small bold">{i.price === 0 ? 'Free' : ghs(i.price * i.qty)}</div>
                          </div>
                        ))}
                      </div>
                      <div className="row-between xs muted mt-2"><span>Seller total</span><b style={{ color: 'var(--ink)' }}>{ghs(so.subtotal)}</b></div>
                    </div>
                  );
                })}
              </div>
              <p className="xs muted mt-2">Changing a seller’s status here overrides what they’ve set — use it to resolve disputes.</p>
            </div>

            <dl className="sum-lines">
              <div><dt>Subtotal</dt><dd>{ghs(sel.subtotal)}</dd></div>
              {sel.fulfilment === 'delivery' && <div><dt>Delivery</dt><dd>{sel.delivery ? ghs(sel.delivery) : 'Free'}</dd></div>}
              <div className="sum-total"><dt>Total</dt><dd>{ghs(sel.total)}</dd></div>
              <div><dt>Payment</dt><dd>{paymentLabel(sel)}</dd></div>
            </dl>
          </div>
        )}
      </Drawer>

      <Modal open={confirmCancel && !!sel} onClose={() => setConfirmCancel(false)} title={`Cancel ${sel?.id}?`}
        footer={<><button className="btn btn-secondary" onClick={() => setConfirmCancel(false)}>Keep order</button><button className="btn btn-danger" onClick={() => {
          if (sel) { cancelOrder(sel.id); toast(`${sel.id} cancelled — buyer and sellers notified`); }
          setConfirmCancel(false);
        }}>Cancel whole order</button></>}>
        <p className="muted">This cancels every seller’s part of the order and notifies {sel?.contact.name} and {sel ? sellersIn(sel).length : 0} seller(s). {sel?.status === 'Paid' && `${ghs(sel.total)} will be refunded to the buyer.`}</p>
      </Modal>
    </>
  );
}

/** Compact card for the admin overview. */
export function RecentPlatformOrders() {
  const { orders, dataStatus, dataError, retryData } = useApp();
  const [now] = useState(() => Date.now());
  const recent = [...orders].sort((a, b) => b.placedAt.localeCompare(a.placedAt)).slice(0, 5);
  return (
    <div className="card">
      <div className="card-head"><h3>Recent orders</h3><Link to="/admin/orders" className="small bold">All orders</Link></div>
      {dataStatus === 'loading' ? <Loading label="Loading orders" /> : dataStatus === 'error' ? <ErrorState error={dataError} onRetry={retryData} title="We couldn’t load orders" /> : recent.length === 0 ? <Empty icon="ShoppingBag" title="No orders yet" text="The latest marketplace orders will show here." /> : recent.map((o) => (
        <Link key={o.id} to="/admin/orders" className="li" style={{ color: 'inherit' }}>
          <div className="sum-thumb"><Img src={o.items[0]?.img} alt="" sizes={SIZES.thumb} />{o.items.length > 1 && <span>{o.items.length}</span>}</div>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="bold small row" style={{ gap: 6 }}>{o.id}{attentionReasons(o, now).length > 0 && <AlertTriangle size={13} color="var(--warn)" />}</div>
            <div className="xs muted ellipsis">{o.contact.name} · {sellersIn(o).map((id) => sellerName(o, id)).join(', ')}</div>
          </div>
          <div style={{ textAlign: 'right' }}><div className="small bold">{ghs(o.total)}</div><div className="mt-1"><StatusBadge status={overallStatus(o)} /></div></div>
        </Link>
      ))}
    </div>
  );
}
