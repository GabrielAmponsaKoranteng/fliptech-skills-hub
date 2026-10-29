import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, RotateCcw, ShoppingBag, Store, Truck } from 'lucide-react';
import { useApp, useUser } from '../../context/AppContext';
import { isDefined } from '../../lib/format';
import { isPublished } from '../../lib/listings';
import { PageTitle } from '../../components/DashboardLayout';
import { Empty, Img, StatusBadge, SIZES } from '../../components/ui';
import { ghs, orderDate, paymentLabel } from '../../lib/format';
import type { Order, OrderStatus, SellerStatus } from '../../types';

const PROGRESS: SellerStatus[] = ['New', 'Confirmed', 'Ready for pickup', 'Out for delivery', 'Completed'];

/** Delivery progress for the physical items, using the least-advanced seller when several are involved. */
function deliveryProgress(o: Order): SellerStatus | null {
  const sellers = [...new Set(o.items.filter((i) => i.kind === 'product').map((i) => i.sellerId))];
  if (sellers.length === 0) return null;
  const statuses = sellers.map((id) => o.sellerStatus?.[id] ?? 'New');
  if (statuses.every((st) => st === 'Cancelled')) return 'Cancelled';
  return statuses.filter((st) => st !== 'Cancelled').sort((a, b) => PROGRESS.indexOf(a) - PROGRESS.indexOf(b))[0];
}
const progressLabel: Record<SellerStatus, string> = {
  New: 'Waiting for seller', Confirmed: 'Confirmed by seller', 'Ready for pickup': 'Ready for pickup',
  'Out for delivery': 'Out for delivery', Completed: 'Delivered', Cancelled: 'Cancelled by seller',
};

/** Orders placed while signed in as the current user, newest first. */
export function useMyOrders(): Order[] {
  const { orders } = useApp();
  const user = useUser();
  return orders.filter((o) => o.userId === user.id);
}


const itemCount = (o: Order) => o.items.reduce((n, i) => n + i.qty, 0);

function fulfilmentSummary(o: Order) {
  if (o.fulfilment === 'delivery') return { icon: Truck, text: `Delivery to ${o.contact.area}` };
  if (o.fulfilment === 'pickup') return { icon: Store, text: 'Pick up from seller' };
  return { icon: BookOpen, text: 'Online courses — access sent by SMS' };
}

const PREVIEW = 3;

function OrderCard({ o }: { o: Order }) {
  const { addToCart, toast, courses, products } = useApp();
  const nav = useNavigate();
  const f = fulfilmentSummary(o);
  const progress = deliveryProgress(o);
  const extra = o.items.length - PREVIEW;

  const buyAgain = () => {
    const catalogue = [...courses, ...products].filter(isPublished);
    const found = o.items.map((i) => catalogue.find((c) => c.id === i.id)).filter(isDefined);
    if (found.length === 0) { toast('These items are no longer available', 'error'); return; }
    // Re-add each product at its original quantity; courses once.
    o.items.forEach((i) => {
      const item = found.find((c) => c.id === i.id);
      if (item) addToCart(item, { silent: true, qty: i.qty });
    });
    const missing = o.items.length - found.length;
    toast(missing ? `Added ${found.length} items — ${missing} no longer available` : 'Items added to your cart');
    nav('/cart');
  };

  return (
    <article className="card order-card">
      <header className="order-head">
        <div>
          <div className="bold">Order {o.id}</div>
          <div className="xs muted">{orderDate(o, true)} · {itemCount(o)} item{itemCount(o) === 1 ? '' : 's'}</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className="badge">{paymentLabel(o)}</span>
          <StatusBadge status={o.status} />
        </div>
      </header>
      <div className="order-items">
        {o.items.slice(0, PREVIEW).map((i) => (
          <div key={i.id} className="sum-item">
            <div className="sum-thumb"><Img src={i.img} alt="" sizes={SIZES.thumb} />{i.qty > 1 && <span>{i.qty}</span>}</div>
            <div className="grow" style={{ minWidth: 0 }}><div className="small bold ellipsis">{i.title}</div><div className="xs muted">{i.kind === 'course' ? 'Online course' : `By ${i.by}`}</div></div>
            <div className="small bold">{i.price === 0 ? 'Free' : ghs(i.price * i.qty)}</div>
          </div>
        ))}
        {extra > 0 && <div className="xs muted">+ {extra} more item{extra === 1 ? '' : 's'}</div>}
      </div>
      <footer className="order-foot">
        <div className="row wrap" style={{ gap: 10 }}>
          <div className="meta"><f.icon /> {f.text}</div>
          {progress && <span className={`badge ${progress === 'Completed' ? 'badge-success' : progress === 'Cancelled' ? 'badge-danger' : 'badge-violet'}`}><span className="dot" />{progress === 'Completed' && o.fulfilment === 'pickup' ? 'Collected' : progressLabel[progress]}</span>}
        </div>
        <div className="row wrap" style={{ gap: 8, marginLeft: 'auto' }}>
          <span className="order-total">{ghs(o.total)}</span>
          <button className="btn btn-secondary btn-sm" onClick={buyAgain}><RotateCcw size={14} /> Buy again</button>
          <Link to={`/orders/${o.id}`} className="btn btn-primary btn-sm">View details <ArrowRight size={14} /></Link>
        </div>
      </footer>
    </article>
  );
}

export function MyOrders() {
  const orders = useMyOrders();
  const [filter, setFilter] = useState<'All' | OrderStatus>('All');
  const list = orders.filter((o) => filter === 'All' || o.status === filter);
  const spent = orders.filter((o) => o.status === 'Paid').reduce((s, o) => s + o.total, 0);

  return (
    <>
      <PageTitle title="My orders" sub={orders.length ? `${orders.length} order${orders.length === 1 ? '' : 's'} · ${ghs(spent)} paid` : 'Courses and products you’ve bought on Fliptech.'}>
        <Link to="/marketplace" className="btn btn-secondary"><ShoppingBag size={16} /> Continue shopping</Link>
      </PageTitle>

      {orders.length === 0 ? (
        <div className="card">
          <Empty icon="ShoppingBag" title="No orders yet" text="When you buy a course or product, it will appear here with its delivery and payment status."
            action={<div className="row" style={{ justifyContent: 'center' }}><Link to="/courses" className="btn btn-primary">Browse courses</Link><Link to="/marketplace" className="btn btn-secondary">Shop products</Link></div>} />
        </div>
      ) : (
        <>
          <div className="seg-toggle mb-4">
            {(['All', 'Paid', 'Awaiting payment'] as const).map((f) => (
              <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
                {f} <span className="xs muted">({orders.filter((o) => f === 'All' || o.status === f).length})</span>
              </button>
            ))}
          </div>
          {list.length === 0
            ? <div className="card"><Empty icon="ShoppingBag" title={`No orders ${filter === 'Paid' ? 'paid yet' : 'awaiting payment'}`} /></div>
            : <div className="stack">{list.map((o) => <OrderCard key={o.id} o={o} />)}</div>}
        </>
      )}
    </>
  );
}

/** Compact list for the trainee dashboard. */
export function RecentOrders() {
  const orders = useMyOrders();
  return (
    <div className="card">
      <div className="card-head"><h3>Recent orders</h3><Link to="/app/orders" className="small bold">View all</Link></div>
      {orders.length === 0 ? (
        <Empty icon="ShoppingBag" title="No orders yet" text="Courses and products you buy will show up here." action={<Link to="/marketplace" className="btn btn-soft btn-sm">Visit the marketplace</Link>} />
      ) : orders.slice(0, 3).map((o) => (
        <Link key={o.id} to={`/orders/${o.id}`} className="li" style={{ color: 'inherit' }}>
          <div className="sum-thumb"><Img src={o.items[0]?.img} alt="" sizes={SIZES.thumb} />{o.items.length > 1 && <span>{o.items.length}</span>}</div>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="bold small ellipsis">{o.items.map((i) => i.title).join(', ')}</div>
            <div className="xs muted">{o.id} · {orderDate(o)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="small bold">{ghs(o.total)}</div>
            <div className="mt-1"><StatusBadge status={o.status} /></div>
          </div>
        </Link>
      ))}
    </div>
  );
}
