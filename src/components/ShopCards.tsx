import { Link } from 'react-router-dom';
import { Star, ShoppingCart, Clock, PlayCircle, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { courseStats } from '../lib/listings';
import { LOW_STOCK, courseBadge } from '../lib/listings';
import { Img, SIZES } from './ui';
import type { Course, Product } from '../types';

import { ghs } from '../lib/format';
export { ghs };

function CartButton({ item }: { item: Course | Product }) {
  const { cart, addToCart } = useApp();
  const inCart = cart.some((x) => x.id === item.id);
  const soldOut = 'stock' in item && item.stock <= 0;
  return (
    <button
      className={`cart-btn ${inCart ? 'in' : ''}`}
      onClick={() => addToCart(item)}
      disabled={soldOut}
      aria-label={soldOut ? `${item.title} is sold out` : inCart ? `${item.title} is in your cart` : `Add ${item.title} to cart`}
      aria-pressed={inCart}
    >
      {inCart ? <Check size={17} /> : <ShoppingCart size={17} />}
    </button>
  );
}

export function Rating({ value, count }: { value: number; count: number }) {
  if (count === 0) return <div className="shop-rating"><span>New · no reviews yet</span></div>;
  return (
    <div className="shop-rating"><Star size={14} /> {value.toFixed(1)} <span>({count})</span></div>
  );
}

export const BADGE_TONES: Record<NonNullable<Course['badge']>, string> = { Bestseller: 'pink', Free: 'green', New: 'violet' };

/** `eager`: the card is in the first row on screen, so its photo shouldn't wait for lazy loading. */
export function CourseCard({ c, showMeta = false, owned = false, eager = false }: { c: Course; showMeta?: boolean; owned?: boolean; eager?: boolean }) {
  const badge = courseBadge(c);
  const stats = courseStats(c);
  return (
    <article className="shop-card">
      <Link to={`/courses/${c.id}`} className="shop-media" aria-label={c.title}>
        <Img src={c.img} alt="" sizes={SIZES.card} loading={eager ? 'eager' : 'lazy'} />
        {badge && <span className={`shop-badge ${BADGE_TONES[badge]}`}>{badge}</span>}
      </Link>
      <div className="shop-body">
        <Link to={`/courses/${c.id}`} className="shop-title">{c.title}</Link>
        <div className="shop-by">By {c.by}</div>
        <Rating value={c.rating} count={c.reviews} />
        {showMeta && <div className="shop-by row" style={{ gap: 12 }}><span className="row" style={{ gap: 4 }}><Clock size={13} /> {stats.hours}h</span><span className="row" style={{ gap: 4 }}><PlayCircle size={13} /> {stats.lessons} lessons</span></div>}
        <div className="shop-foot">
          <span className={`shop-price ${c.price === 0 ? 'free' : ''}`}>{c.price === 0 ? 'Free' : ghs(c.price)}</span>
          {owned ? <Link to={`/app/courses/${c.id}`} className="btn btn-soft btn-sm">Open</Link> : <CartButton item={c} />}
        </div>
      </div>
    </article>
  );
}

export function ProductCard({ p, eager = false }: { p: Product; eager?: boolean }) {
  return (
    <article className="shop-card">
      <Link to={`/marketplace/${p.id}`} className="shop-media" aria-label={p.title}>
        <Img src={p.img} alt="" sizes={SIZES.card} loading={eager ? 'eager' : 'lazy'} />
        {p.stock <= 0 ? <span className="shop-badge dark">Sold out</span> : p.stock <= LOW_STOCK && <span className="shop-badge amber">Only {p.stock} left</span>}
      </Link>
      <div className="shop-body">
        <Link to={`/marketplace/${p.id}`} className="shop-title">{p.title}</Link>
        <div className="shop-by">By {p.by}</div>
        <Rating value={p.rating} count={p.reviews} />
        <div className="shop-foot">
          <span className="shop-price">{ghs(p.price)}</span>
          <CartButton item={p} />
        </div>
      </div>
    </article>
  );
}
