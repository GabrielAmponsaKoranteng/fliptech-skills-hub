import { useEffect, useRef, useState, type CSSProperties, type ImgHTMLAttributes, type ReactNode, type RefObject, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  BadgeCheck, BookOpen, Building2, Store, CalendarClock, CalendarDays, Car, ChefHat, Circle, Eye, Flag, Flame, GraduationCap, Hammer, Heart, Inbox, Laptop, LayoutDashboard, LifeBuoy, MapPin, MapPinOff, MessageCircleReply, MessageSquare, MessagesSquare, Paintbrush, Scissors, Search, SearchX, Send, Settings, Shapes, ShieldAlert, ShoppingBag, ShoppingCart, ShieldCheck, Sparkles, Timer, UserCheck, UserRound, UserX, Users, Wrench, Zap,
  type LucideProps,
} from 'lucide-react';
import { CircleSlash, MapPinned, Star, X, TrendingUp, TrendingDown } from 'lucide-react';
import { tradeById } from '../data/catalog';
import { initials } from '../lib/format';
import { resized, srcSetFor } from '../assets/images';
import type { Provider, Tone } from '../types';

const Icons = { BadgeCheck, BookOpen, Building2, Store, CalendarClock, CalendarDays, Car, ChefHat, Circle, Eye, Flag, Flame, GraduationCap, Hammer, Heart, Inbox, Laptop, LayoutDashboard, LifeBuoy, MapPin, MapPinOff, MessageCircleReply, MessageSquare, MessagesSquare, Paintbrush, Scissors, Search, SearchX, Send, Settings, Shapes, ShieldAlert, ShoppingBag, ShoppingCart, ShieldCheck, Sparkles, Timer, UserCheck, UserRound, UserX, Users, Wrench, Zap };

export type IconName = keyof typeof Icons;

/** Renders a lucide icon by name. Names come from data (trades, nav config), so unknown names fall back to a circle. */
export function Icon({ name, ...props }: { name: string } & LucideProps) {
  const C = Icons[name as IconName] ?? Circle;
  return <C {...props} />;
}

type ImgProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src?: string;
  /** Trade id used to colour the fallback tile */
  trade?: string;
  /**
   * How wide the image is drawn, as for the `sizes` attribute (e.g. "48px" or "(max-width: 640px) 100vw, 300px").
   * With it, the browser downloads a file that size instead of the full-width original.
   */
  sizes?: string;
  /** The page's main image (e.g. a hero): load it straight away and ahead of other images. */
  priority?: boolean;
};

/** Common `sizes` for images in the shared layouts. */
export const SIZES = {
  /** Order and cart thumbnails, list icons */
  thumb: '96px',
  /** Cards in a responsive grid: one column on phones, two on tablets */
  card: '(max-width: 560px) 100vw, (max-width: 960px) 50vw, 320px',
  /** Half the page on desktop, full width on phones */
  half: '(max-width: 820px) 100vw, 50vw',
  full: '100vw',
};

/** Image with a branded gradient fallback when the remote photo fails to load. */
export function Img({ src, alt = '', trade, className, style, sizes, priority, ...rest }: ImgProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  if (failed || !src) {
    const t = trade ? tradeById(trade) : undefined;
    return (
      <div className={`img-fallback ${className || ''}`} style={{ background: `linear-gradient(135deg, ${t?.color || '#7c3aed'}, #160f3a)`, ...style }} role="img" aria-label={alt}>
        <Icon name={t?.icon || 'GraduationCap'} size={32} />
      </div>
    );
  }
  const srcSet = sizes ? srcSetFor(src) : undefined;
  return (
    <img src={src} srcSet={srcSet} sizes={srcSet ? sizes : undefined} alt={alt} decoding="async"
      loading={priority ? 'eager' : 'lazy'} {...(priority && { fetchpriority: 'high' })}
      onError={() => setFailed(true)} className={className} style={style} {...rest} />
  );
}

/** Official Fliptech Skills Hub logo. `light` swaps to the white-ink version for dark backgrounds. */
export function Logo({ light, to = '/' }: { light?: boolean; to?: string }) {
  return (
    <Link to={to} className={`logo ${light ? 'light' : ''}`} aria-label="Fliptech Skills Hub home">
      <img src={light ? '/brand/fliptech-logo-light.png' : '/brand/fliptech-logo.png'} alt="Fliptech Skills Hub"
        width={600} height={215} className="logo-img" decoding="async" />
    </Link>
  );
}

export function TradeTag({ trade }: { trade: string }) {
  const t = tradeById(trade);
  if (!t) return null;
  // Trade colours are bright accents; darken the text so it stays readable on its own tint.
  return <span className="trade-tag" style={{ background: t.bg, color: `color-mix(in srgb, ${t.color} 62%, #000)` }}>{t.name}</span>;
}

export function VerifyBadges({ p, compact }: { p: Pick<Provider, 'ctvet' | 'visited'>; compact?: boolean }) {
  return (
    <>
      {p.ctvet
        ? <span className="badge badge-success"><BadgeCheck /> CTVET registered</span>
        : <span className="badge"><CircleSlash /> {compact ? 'Not CTVET' : 'CTVET: not registered'}</span>}
      {p.visited
        ? <span className="badge badge-brand"><ShieldCheck /> Visited {p.visited}</span>
        : <span className="badge"><MapPinned /> {compact ? 'Not visited' : 'Fliptech not yet visited'}</span>}
    </>
  );
}

export function Stars({ value = 5, size = 15 }: { value?: number; size?: number }) {
  return (
    <span className="stars" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} size={size} className={i <= Math.round(value) ? '' : 'off'} />)}
    </span>
  );
}

export function Rating({ p }: { p: Pick<Provider, 'rating' | 'reviews'> }) {
  return <span className="rating"><Star /> {p.rating.toFixed(1)} <span className="muted" style={{ fontWeight: 500 }}>({p.reviews})</span></span>;
}

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  footer?: ReactNode;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Open dialogs, innermost last: only the top one responds to Escape and Tab (e.g. a modal opened from a drawer). */
const openDialogs: HTMLElement[] = [];

/**
 * Keyboard and focus behaviour for Modal and Drawer, following the WAI-ARIA dialog pattern:
 * focus moves into the dialog (its first field, or the dialog itself so a confirmation's
 * buttons aren't pressed by accident), Tab stays inside, Escape closes, the page behind is
 * inert and doesn't scroll, and focus returns to whatever opened the dialog.
 */
function useDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLElement>(null);
  // Callers usually pass an inline function; keep the latest without re-running the effect.
  const close = useRef(onClose);
  close.current = onClose;
  // Remember what had focus in the render where the dialog opens: by the time effects run, an
  // `autoFocus` field inside the dialog has already taken it.
  const opener = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  if (open && !wasOpen.current) opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  wasOpen.current = open;

  useEffect(() => {
    const node = ref.current;
    if (!open || !node) return;
    const returnTo = opener.current;
    const visible = () => [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);
    const field = node.querySelector<HTMLElement>('.modal-body, .drawer-body')?.querySelector<HTMLElement>('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])');
    (field ?? node).focus();

    openDialogs.push(node);
    const root = document.getElementById('root');
    root?.setAttribute('inert', '');
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (openDialogs[openDialogs.length - 1] !== node) return;
      if (e.key === 'Escape') { e.preventDefault(); close.current(); return; }
      if (e.key !== 'Tab') return;
      const items = visible();
      if (!items.length) { e.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === node)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (active === last || !node.contains(active))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      openDialogs.splice(openDialogs.indexOf(node), 1);
      if (!openDialogs.length) {
        root?.removeAttribute('inert');
        document.body.style.overflow = overflow;
      }
      if (returnTo?.isConnected) returnTo.focus();
    };
  }, [open]);

  return ref;
}

export function Modal({ open, onClose, title, children, footer, width }: OverlayProps & { width?: CSSProperties['maxWidth'] }) {
  const ref = useDialog(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref as RefObject<HTMLDivElement>} tabIndex={-1} className="modal" role="dialog" aria-modal="true" aria-label={title} style={width ? { maxWidth: width } : undefined}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({ open, onClose, title, children, footer }: OverlayProps) {
  const ref = useDialog(open, onClose);
  if (!open) return null;
  return createPortal(
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside ref={ref} tabIndex={-1} className="drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="modal-foot" style={{ borderRadius: 0 }}>{footer}</div>}
      </aside>
    </>,
    document.body,
  );
}

export function Empty({ icon = 'Inbox', title, text, action }: { icon?: string; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-ico"><Icon name={icon} size={28} /></div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

interface StatProps {
  icon: string;
  tone?: Tone;
  label: string;
  value: ReactNode;
  /** Percent change; positive shows green, negative red */
  trend?: number;
  /** For numbers where going down is good, like reply time: flips the colours */
  lowerIsBetter?: boolean;
}

export function Stat({ icon, tone = 'brand', label, value, trend, lowerIsBetter }: StatProps) {
  return (
    <div className="card stat">
      <div className="stat-top">
        <div className={`stat-ico tone-${tone}`}><Icon name={icon} size={20} /></div>
        {trend != null && (
          <span className={`trend ${trend >= 0 !== !!lowerIsBetter ? 'up' : 'down'}`} title="Compared with the 30 days before">
            {trend >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{Math.abs(trend)}%
          </span>
        )}
      </div>
      <div>
        <div className="stat-val">{value}</div>
        <div className="stat-label mt-1">{label}</div>
      </div>
    </div>
  );
}

const STATUS_TONES: Record<string, Tone | ''> = {
  Sent: 'brand', Replied: 'success', New: 'brand', Enrolled: 'violet', Closed: '', Active: 'success', Pending: 'warn',
  Suspended: 'danger', 'Needs info': 'danger', 'Visit scheduled': 'violet', Verified: 'success', Rejected: 'danger',
  Published: 'success', Draft: '', Invited: 'violet', Paid: 'success', 'Awaiting payment': 'warn',
  Confirmed: 'violet', 'Ready for pickup': 'accent', 'Out for delivery': 'accent', Completed: 'success', Cancelled: 'danger', Full: 'warn', Approved: 'success', 'Under review': 'warn', Missing: 'danger',
};
export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONES[status] ?? '';
  return <span className={`badge ${tone ? 'badge-' + tone : ''}`}><span className="dot" />{status}</span>;
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <label className="switch" aria-label={label}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </label>
  );
}

/** Placeholder rows while data loads. */
/** A grey placeholder block with a shimmer. */
export function Skeleton({ w = '100%', h = 12, r = 8, style }: { w?: CSSProperties['width']; h?: CSSProperties['height']; r?: number; style?: CSSProperties }) {
  return <div className="skeleton" aria-hidden="true" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

/** Placeholder course/product cards, shaped like ShopCards, for grids that are still loading. */
export function CardGridSkeleton({ count = 6, className = 'shop-grid' }: { count?: number; className?: string }) {
  return (
    <div className={className} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="shop-card">
          <Skeleton h={150} r={0} />
          <div className="stack-sm" style={{ padding: 14, gap: 10 }}>
            <Skeleton w="85%" h={14} />
            <Skeleton w="50%" h={11} />
            <Skeleton w="35%" h={16} style={{ marginTop: 6 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export type PageSkeletonKind = 'dashboard' | 'list' | 'detail';

/**
 * A whole page's worth of placeholders, roughly the shape of what's coming, so the layout
 * doesn't jump when data arrives: a dashboard (title, stat tiles, cards), a list (title and
 * rows) or a detail page (photo and text).
 */
export function PageSkeleton({ kind = 'list', label = 'Loading…' }: { kind?: PageSkeletonKind; label?: string }) {
  const title = (
    <div className="stack-sm mb-6" style={{ gap: 10 }}>
      <Skeleton w={260} h={26} style={{ maxWidth: '70%' }} />
      <Skeleton w={380} h={13} style={{ maxWidth: '90%' }} />
    </div>
  );
  return (
    <div className="page-skeleton" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {kind === 'detail' ? (
        <div className="grid-2" style={{ alignItems: 'start' }}>
          <Skeleton h={320} r={14} />
          <div className="stack-sm" style={{ gap: 12 }}>
            <Skeleton w="40%" h={12} />
            <Skeleton w="80%" h={28} />
            <Skeleton w="30%" h={22} style={{ marginTop: 6 }} />
            <Skeleton h={12} style={{ marginTop: 14 }} />
            <Skeleton w="92%" h={12} />
            <Skeleton w="70%" h={12} />
            <Skeleton w={180} h={44} r={10} style={{ marginTop: 14 }} />
          </div>
        </div>
      ) : kind === 'dashboard' ? (
        <>
          {title}
          <div className="stats">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="card stat"><Skeleton w={40} h={40} r={10} /><Skeleton w="45%" h={24} /><Skeleton w="70%" h={11} /></div>
            ))}
          </div>
          <div className="grid-3-1 mt-6">
            <div className="card card-pad"><Skeleton w="30%" h={16} /><Skeleton h={180} r={10} style={{ marginTop: 18 }} /></div>
            <div className="card"><Loading rows={3} label="" /></div>
          </div>
        </>
      ) : (
        <>
          {title}
          <div className="card"><Loading rows={5} label="" /></div>
        </>
      )}
    </div>
  );
}

export function Loading({ label = 'Loading…', rows = 3 }: { label?: string; rows?: number }) {
  return (
    // An empty label means it sits inside another placeholder that already announces itself.
    <div className="loading-block" {...(label ? { role: 'status', 'aria-live': 'polite' as const } : { 'aria-hidden': true })}>
      {label && <span className="sr-only">{label}</span>}
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="loading-row">
          <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 10 }} />
          <div className="grow stack-sm" style={{ gap: 8 }}>
            <div className="skeleton" style={{ height: 12, width: `${70 - i * 12}%` }} />
            <div className="skeleton" style={{ height: 10, width: `${45 - i * 6}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Shown when a request failed; offers a retry. */
export function ErrorState({ error, onRetry, title = 'We couldn’t load this' }: { error: unknown; onRetry?: () => void; title?: string }) {
  const message = error instanceof Error && error.message ? error.message : 'Something went wrong. Please try again.';
  return (
    <div className="empty" role="alert">
      <div className="empty-ico" style={{ background: 'var(--danger-50)', color: 'var(--danger)' }}><Icon name="ShieldAlert" size={28} /></div>
      <h3>{title}</h3>
      <p>{message}</p>
      {onRetry && <button className="btn btn-primary mt-4" onClick={onRetry}>Try again</button>}
    </div>
  );
}

/** A person's profile photo, or their initials when they haven't added one. */
export function Avatar({ name, src, size = 'md' }: { name: string; src?: string; size?: 'sm' | 'md' | 'lg' }) {
  const style = size === 'sm' ? { width: 32, height: 32, fontSize: 12 } : undefined;
  return (
    <span className={`avatar ${size === 'lg' ? 'avatar-lg' : ''}`} style={style}>
      {src ? <img src={resized(src, 96)} alt="" loading="lazy" decoding="async" /> : initials(name)}
    </span>
  );
}

/**
 * Props for a table row that opens details: clickable, focusable with Tab, and opened with Enter or
 * Space. Keys pressed on buttons inside the row are left to those buttons.
 */
export function rowAction(open: () => void) {
  return {
    className: 'clickable',
    tabIndex: 0,
    onClick: open,
    onKeyDown: (e: ReactKeyboardEvent<HTMLElement>) => {
      if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      open();
    },
  };
}

/**
 * Gives every cell in the `.table`s under `ref` a `data-label` from its column heading, so the CSS
 * can stack rows into labelled cards on phones. Explicit table roles keep screen readers treating
 * them as tables after the CSS changes their display. Rows added later are labelled too.
 */
export function useStackableTables(ref: RefObject<HTMLElement>) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const label = () => {
      for (const table of root.querySelectorAll<HTMLTableElement>('table.table')) {
        const headings = [...table.querySelectorAll('thead th')].map((th) => th.textContent?.trim() ?? '');
        table.setAttribute('role', 'table');
        table.querySelectorAll('tr').forEach((tr) => tr.setAttribute('role', 'row'));
        table.querySelectorAll('thead th').forEach((th) => th.setAttribute('role', 'columnheader'));
        for (const tr of table.querySelectorAll('tbody tr')) {
          [...tr.children].forEach((td, i) => {
            td.setAttribute('role', 'cell');
            if (td.getAttribute('data-label') !== headings[i]) td.setAttribute('data-label', headings[i] ?? '');
          });
        }
      }
    };
    label();
    const observer = new MutationObserver(label);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  });
}

/**
 * Ref callback that makes an element `inert` (not focusable or clickable, hidden from screen readers),
 * e.g. for live previews of cards. React 18 doesn't type the attribute yet.
 */
export const inertRef = (el: HTMLElement | null) => el?.setAttribute('inert', '');
