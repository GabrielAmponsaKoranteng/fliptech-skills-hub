import { Link } from 'react-router-dom';
import { Heart, MapPin, Clock, CalendarDays, ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Img, Rating, TradeTag, VerifyBadges, SIZES } from './ui';
import { cedi, fmtDate } from '../lib/format';
import type { CSSProperties } from 'react';
import type { Provider } from '../types';

export function SaveButton({ id, style }: { id: string; style?: CSSProperties }) {
  const { saved, toggleSave } = useApp();
  const on = saved.includes(id);
  return (
    <button
      className={`save-btn ${on ? 'on' : ''}`}
      style={style}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSave(id); }}
      aria-label={on ? 'Remove from saved' : 'Save provider'}
      aria-pressed={on}
    >
      <Heart size={17} />
    </button>
  );
}

export function ProviderCard({ p, eager = false }: { p: Provider; eager?: boolean }) {
  return (
    <article className="card pcard">
      <Link to={`/providers/${p.id}`} className="pcard-media" aria-label={p.name}>
        <Img src={p.images[0]} alt={p.name} trade={p.trade} sizes={SIZES.card} loading={eager ? 'eager' : 'lazy'} />
        <SaveButton id={p.id} />
        <div className="media-badges"><span className="badge badge-dark">{p.places} places left</span></div>
      </Link>
      <div className="pcard-body">
        <div className="row-between">
          <TradeTag trade={p.trade} />
          <Rating p={p} />
        </div>
        <Link to={`/providers/${p.id}`} className="pcard-title">{p.name}</Link>
        <div className="meta"><MapPin /> {p.area}</div>
        <div className="row-between">
          <div><span className="xs muted">From </span><span className="price" style={{ fontSize: 19 }}>{cedi(p.fee)}</span></div>
          <div className="meta"><Clock /> {p.months} months</div>
        </div>
        <div className="meta"><CalendarDays /> Next intake: <b style={{ color: 'var(--ink)' }}>{fmtDate(p.intake, { day: 'numeric', month: 'short' })}</b></div>
        <div className="pcard-foot"><VerifyBadges p={p} compact /></div>
        <Link to={`/providers/${p.id}`} className="btn btn-soft btn-sm btn-block" style={{ marginTop: "auto" }}>View training <ArrowRight size={15} /></Link>
      </div>
    </article>
  );
}

export function ProviderRow({ p, eager = false }: { p: Provider; eager?: boolean }) {
  return (
    <article className="card prow">
      <Link to={`/providers/${p.id}`} className="prow-media" aria-label={p.name}>
        <Img src={p.images[0]} alt={p.name} trade={p.trade} sizes="(max-width: 820px) 120px, 200px" loading={eager ? 'eager' : 'lazy'} />
        <SaveButton id={p.id} style={{ position: 'absolute', top: 8, right: 8, width: 32, height: 32 }} />
      </Link>
      <div className="prow-main">
        <div className="row wrap" style={{ gap: 8 }}><TradeTag trade={p.trade} /><Rating p={p} /></div>
        <Link to={`/providers/${p.id}`} className="pcard-title" style={{ fontSize: 17 }}>{p.name}</Link>
        <div className="meta"><MapPin /> {p.area}, Greater Accra</div>
        <p className="small muted" style={{ maxWidth: 560 }}>{p.blurb}</p>
        <div className="facts mt-1">
          <div className="meta"><Clock /> {p.months} months</div>
          <div className="meta"><CalendarDays /> Next intake: {fmtDate(p.intake, { day: 'numeric', month: 'short', year: 'numeric' })}</div>
        </div>
        <div className="row wrap" style={{ gap: 6 }}><VerifyBadges p={p} /></div>
      </div>
      <div className="prow-side">
        <div style={{ textAlign: 'right' }}>
          <div className="xs muted">From</div>
          <div className="price" style={{ fontSize: 24 }}>{cedi(p.fee)}</div>
        </div>
        <Link to={`/providers/${p.id}`} className="btn btn-primary btn-sm">View training</Link>
      </div>
    </article>
  );
}
