import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, BadgeCheck, BarChart3, Check, CheckCircle2, Clock, CreditCard, EyeOff, Lock, MapPin, Minus, Package,
  PlayCircle, Plus, ShoppingCart, Smartphone, Store, Truck,
} from 'lucide-react';
import { MAX_QTY, useApp } from '../../context/AppContext';
import { PROVIDERS, SKILL_CATEGORIES } from '../../data/catalog';
import { courseStats } from '../../lib/listings';
import { LOW_STOCK, courseBadge, isPublished, ownedCourseIds } from '../../lib/listings';
import { sellerIdFor } from '../../lib/orders';
import { Empty, Img, PageSkeleton, Stars, SIZES } from '../../components/ui';
import { DataGate } from '../../components/DataGate';
import { usePageMeta } from '../../lib/pageMeta';
import { BADGE_TONES, CourseCard, ProductCard, ghs } from '../../components/ShopCards';
import { DELIVERY_FEE, FREE_DELIVERY_OVER } from './Cart';
import type { Course, Product, User } from '../../types';
import { resized } from '../../assets/images';

const catName = (id: string) => SKILL_CATEGORIES.find((c) => c.id === id)?.name ?? 'Skills';

/** Sellers can preview their own hidden listings; everyone else sees "not available". */
function canView(item: Course | Product, user: User | null) {
  return isPublished(item) || (user?.role === 'trainer' && sellerIdFor(user) === item.sellerId);
}

function Unavailable({ kind }: { kind: 'course' | 'product' }) {
  return (
    <div className="container" style={{ paddingTop: 48 }}>
      <div className="card">
        <Empty icon="SearchX" title={`This ${kind} isn’t available`} text="It may have been removed or hidden by the seller."
          action={<Link to={kind === 'course' ? '/courses' : '/marketplace'} className="btn btn-primary">{kind === 'course' ? 'Browse courses' : 'Back to marketplace'}</Link>} />
      </div>
    </div>
  );
}

function HiddenBanner() {
  return <div className="notice warn mb-4"><EyeOff size={18} /><div>This listing is <b>hidden</b>. Only you can see this preview — publish it from <Link to="/trainer/listings">Listings</Link> to make it visible.</div></div>;
}

function SellerCard({ sellerId, by }: { sellerId: string; by: string }) {
  const centre = PROVIDERS.find((p) => p.id === sellerId);
  return (
    <div className="card card-pad">
      <div className="xs bold muted mb-2" style={{ textTransform: 'uppercase', letterSpacing: '.06em' }}>Sold by</div>
      <div className="row">
        <span className="avatar">{(centre?.name ?? by).split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="bold">{centre?.name ?? by}</div>
          <div className="xs muted">{centre ? `${centre.area} · Training centre` : 'Independent seller'}</div>
        </div>
      </div>
      {centre && (
        <>
          <div className="row wrap mt-3" style={{ gap: 6 }}>
            {centre.ctvet && <span className="badge badge-success"><BadgeCheck /> CTVET registered</span>}
            {centre.visited && <span className="badge badge-brand"><MapPin /> Visited {centre.visited}</span>}
          </div>
          <Link to={`/providers/${centre.id}`} className="btn btn-secondary btn-sm btn-block mt-4">View training centre</Link>
        </>
      )}
    </div>
  );
}

function Related({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="h-section">
      <div className="h-head"><h2>{title}</h2></div>
      <div className="shop-grid">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

export function CourseDetail() {
  return <DataGate skeleton={<div className="container" style={{ paddingTop: 32 }}><PageSkeleton kind="detail" label="Loading course" /></div>}><Course /></DataGate>;
}

function Course() {
  const { id } = useParams();
  const { courses, cart, orders, user, addToCart, progressFor } = useApp();
  const nav = useNavigate();
  const c = courses.find((x) => x.id === id);
  const visible = !!c && canView(c, user);
  usePageMeta(visible ? { title: `${c.title} – online course`, description: c.description, image: c.img } : { title: 'Course not available' });
  if (!c || !visible) return <Unavailable kind="course" />;

  const stats = courseStats(c);
  const badge = courseBadge(c);
  const owned = ownedCourseIds(orders, user?.id).has(c.id);
  const inCart = cart.some((i) => i.id === c.id);
  const done = owned ? progressFor(c.id).done.length : 0;
  const related = courses.filter((x) => isPublished(x) && x.id !== c.id && (x.cat === c.cat || x.sellerId === c.sellerId)).slice(0, 4);

  const buyNow = () => { if (!inCart) addToCart(c, { silent: true }); nav('/checkout'); };

  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <Link to="/courses" className="back-link"><ArrowLeft size={16} /> Online courses</Link>
      <div className="detail-grid mt-4">
        <div style={{ minWidth: 0 }}>
          {!isPublished(c) && <HiddenBanner />}
          <div className="row wrap" style={{ gap: 8 }}>
            <span className="badge badge-brand">{catName(c.cat)}</span>
            {badge && <span className={`shop-badge static ${BADGE_TONES[badge]}`}>{badge}</span>}
          </div>
          <h1 className="mt-2" style={{ fontSize: 'clamp(26px,3.4vw,36px)' }}>{c.title}</h1>
          <p className="muted mt-3" style={{ fontSize: 16, lineHeight: 1.65 }}>{c.description}</p>
          <div className="row wrap mt-4" style={{ gap: 16 }}>
            <span className="row" style={{ gap: 6 }}><b>{c.rating.toFixed(1)}</b><Stars value={c.rating} size={14} /><span className="small muted">({c.reviews} reviews)</span></span>
            <span className="small muted">By <b style={{ color: 'var(--ink)' }}>{c.by}</b></span>
          </div>
          <div className="facts mt-4">
            <span className="meta"><BarChart3 /> {c.level}</span>
            <span className="meta"><Clock /> {stats.hours} hours</span>
            <span className="meta"><PlayCircle /> {stats.lessons} lessons</span>
          </div>

          <div className="card card-pad mt-6">
            <h3>What you’ll learn</h3>
            <ul className="outcomes mt-4">{c.outcomes.map((o) => <li key={o}><Check size={17} /> {o}</li>)}</ul>
          </div>

          <div className="card mt-6">
            <div className="card-head"><h3>Course content</h3><span className="small muted">{stats.lessons} lessons · {stats.hours} h</span></div>
            <ol className="curriculum">
              {c.curriculum.map((l, i) => (
                <li key={l.id}>
                  <span className="cur-num">{i + 1}</span>
                  <span className="grow">{l.title}</span>
                  <span className="xs muted">{l.minutes} min</span>
                  {owned ? <PlayCircle size={16} color="var(--brand)" aria-label="Available" /> : <Lock size={15} color="var(--muted-2)" aria-label="Locked until you enrol" />}
                </li>
              ))}
            </ol>
          </div>
        </div>

        <aside className="sticky-card">
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ aspectRatio: '16/10' }}><Img src={c.img} alt="" sizes={SIZES.half} priority style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
            <div className="card-body stack-sm" style={{ gap: 12 }}>
              <div className="price-big" style={{ color: c.price === 0 ? 'var(--success)' : undefined }}>{c.price === 0 ? 'Free' : ghs(c.price)}</div>
              {owned ? (
                <>
                  <div className="notice success"><CheckCircle2 size={18} /><div>You own this course · {done}/{stats.lessons} lessons done</div></div>
                  <Link to={`/app/courses/${c.id}`} className="btn btn-primary btn-lg btn-block">{done ? 'Continue learning' : 'Start learning'}</Link>
                </>
              ) : c.price === 0 ? (
                <button className="btn btn-primary btn-lg btn-block" onClick={buyNow}>Enrol for free</button>
              ) : inCart ? (
                <>
                  <Link to="/checkout" className="btn btn-primary btn-lg btn-block">Go to checkout</Link>
                  <div className="xs muted" style={{ textAlign: 'center' }}><Check size={13} style={{ verticalAlign: -2 }} /> In your cart</div>
                </>
              ) : (
                <>
                  <button className="btn btn-primary btn-lg btn-block" onClick={buyNow}>Buy now</button>
                  <button className="btn btn-secondary btn-block" onClick={() => addToCart(c)}><ShoppingCart size={16} /> Add to cart</button>
                </>
              )}
              <ul className="includes">
                <li><PlayCircle size={15} /> {stats.lessons} video lessons · {stats.hours} h</li>
                <li><Smartphone size={15} /> Watch on your phone or laptop</li>
                <li><Clock size={15} /> Learn at your own pace</li>
              </ul>
            </div>
          </div>
          <div className="mt-4"><SellerCard sellerId={c.sellerId} by={c.by} /></div>
        </aside>
      </div>

      {related.length > 0 && <Related title="More courses you might like">{related.map((x) => <CourseCard key={x.id} c={x} showMeta />)}</Related>}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function ProductDetail() {
  return <DataGate skeleton={<div className="container" style={{ paddingTop: 32 }}><PageSkeleton kind="detail" label="Loading product" /></div>}><Product /></DataGate>;
}

function Product() {
  const { id } = useParams();
  const { products, cart, user, addToCart } = useApp();
  const nav = useNavigate();
  const [qty, setQty] = useState(1);
  const p = products.find((x) => x.id === id);
  const visible = !!p && canView(p, user);
  usePageMeta(visible ? { title: p.title, description: p.description, image: p.img } : { title: 'Product not available' });
  if (!p || !visible) return <Unavailable kind="product" />;

  const inCart = cart.find((i) => i.id === p.id)?.qty ?? 0;
  const canAdd = Math.max(0, Math.min(MAX_QTY, p.stock) - inCart);
  const q = Math.min(qty, Math.max(1, canAdd));
  const soldOut = p.stock <= 0;
  const fromSeller = products.filter((x) => isPublished(x) && x.id !== p.id && x.sellerId === p.sellerId);
  const related = (fromSeller.length ? fromSeller : products.filter((x) => isPublished(x) && x.id !== p.id && x.cat === p.cat)).slice(0, 4);

  const add = (thenCheckout: boolean) => {
    addToCart(p, { qty: q, silent: thenCheckout });
    setQty(1);
    if (thenCheckout) nav('/checkout');
  };

  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <Link to="/marketplace" className="back-link"><ArrowLeft size={16} /> Marketplace</Link>
      {!isPublished(p) && <div className="mt-4"><HiddenBanner /></div>}
      <div className="product-grid mt-4">
        <div className="product-media"><Img src={resized(p.img, 1200)} alt={p.title} sizes={SIZES.half} priority /></div>
        <div className="stack" style={{ gap: 14 }}>
          <span className="badge badge-brand" style={{ alignSelf: 'flex-start' }}>{catName(p.cat)}</span>
          <h1 style={{ fontSize: 'clamp(26px,3.2vw,34px)' }}>{p.title}</h1>
          <div className="row wrap" style={{ gap: 16 }}>
            <span className="row" style={{ gap: 6 }}><b>{p.rating.toFixed(1)}</b><Stars value={p.rating} size={14} /><span className="small muted">({p.reviews} reviews)</span></span>
            <span className="small muted">By <b style={{ color: 'var(--ink)' }}>{p.by}</b></span>
          </div>
          <div className="price-big">{ghs(p.price)}</div>
          <div className={`stock-line ${soldOut ? 'out' : p.stock <= LOW_STOCK ? 'low' : ''}`}>
            <Package size={16} /> {soldOut ? 'Sold out' : p.stock <= LOW_STOCK ? `Only ${p.stock} left in stock` : 'In stock'}
          </div>

          {!soldOut && (
            <div className="row wrap" style={{ gap: 10 }}>
              <div className="qty" role="group" aria-label="Quantity">
                <button type="button" onClick={() => setQty(Math.max(1, q - 1))} disabled={q <= 1} aria-label="Decrease quantity"><Minus size={15} /></button>
                <span aria-live="polite">{q}</span>
                <button type="button" onClick={() => setQty(q + 1)} disabled={q >= canAdd} aria-label="Increase quantity"><Plus size={15} /></button>
              </div>
              <button className="btn btn-primary btn-lg grow" onClick={() => add(false)} disabled={canAdd === 0}><ShoppingCart size={17} /> Add to cart</button>
              <button className="btn btn-secondary btn-lg" onClick={() => add(true)} disabled={canAdd === 0}>Buy now</button>
            </div>
          )}
          {inCart > 0 && <div className="xs muted"><Check size={13} style={{ verticalAlign: -2 }} /> {inCart} in your cart{canAdd === 0 && !soldOut && ' — that’s all the stock available'} · <Link to="/cart">View cart</Link></div>}

          <div className="card" style={{ padding: 16 }}>
            <ul className="includes" style={{ gap: 10 }}>
              <li><Truck size={16} /> Delivery in Greater Accra {ghs(DELIVERY_FEE)} — free on orders over {ghs(FREE_DELIVERY_OVER)}</li>
              <li><Store size={16} /> Or pick up from the seller for free</li>
              <li><CreditCard size={16} /> Pay with Mobile Money, card or on delivery</li>
            </ul>
          </div>

          <div>
            <h3 className="mb-2">About this product</h3>
            <p className="muted" style={{ lineHeight: 1.7 }}>{p.description}</p>
          </div>
          <SellerCard sellerId={p.sellerId} by={p.by} />
        </div>
      </div>

      {related.length > 0 && <Related title={fromSeller.length ? `More from ${p.by}` : 'You might also like'}>{related.map((x) => <ProductCard key={x.id} p={x} />)}</Related>}
    </div>
  );
}
