import { Fragment, lazy, Suspense, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Heart, Share2, MapPin, Hammer, GraduationCap, Clock, CalendarDays, Timer, Wallet, Users, CalendarClock,
  Phone, BadgeCheck, ShieldCheck, Images, X, ChevronLeft, ChevronRight, Star, Navigation, Info, CheckCircle2, CircleDashed,
} from 'lucide-react';
import { PROVIDERS, SITE, providerById, tradeById } from '../../data/catalog';
import { cedi, fmtDate } from '../../lib/format';
import { api } from '../../api';
import { useApiQuery } from '../../api/useApiQuery';
import { usePageMeta } from '../../lib/pageMeta';
import { useApp } from '../../context/AppContext';
import { Empty, ErrorState, Img, Loading, Rating, Stars, TradeTag, VerifyBadges, SIZES } from '../../components/ui';
import { ProviderCard } from '../../components/ProviderCard';
import type { LucideIcon } from 'lucide-react';
import { resized } from '../../assets/images';

// The map library (Leaflet, ~45 KB) only downloads when a map is actually shown.
const MapView = lazy(() => import('../../components/MapView'));

const TABS = ['Overview', 'Training', 'Schedule', 'Verification', 'Gallery', 'Reviews', 'Location'];

/** The last page view sent, so a quick double run (React's development mode, a re-render) isn't counted twice. */
let lastView = { id: '', at: 0 };
function trackViewOnce(id: string) {
  if (lastView.id === id && Date.now() - lastView.at < 5000) return;
  lastView = { id, at: Date.now() };
  api.catalog.trackView(id).catch(() => {});
}

export default function ProviderDetail() {
  const { id } = useParams();
  const p = providerById(id);
  const { saved, toggleSave, toast } = useApp();
  const [tab, setTab] = useState('Overview');
  const [prog, setProg] = useState(p?.programmes[0].id);
  /** Index of the photo open in the lightbox, or null when closed */
  const [lb, setLb] = useState<number | null>(null);
  const [more, setMore] = useState(false);
  const nav = useNavigate();

  // Reset the tab and chosen programme only when opening a different centre, not when its data refreshes.
  useEffect(() => { setTab('Overview'); setProg(p?.programmes[0].id); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Counts towards the centre's profile views. Not worth bothering the visitor if it fails.
  useEffect(() => { if (p) trackViewOnce(p.id); }, [p?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (lb == null || !p) return;
    const n = p.images.length;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLb(null);
      if (e.key === 'ArrowRight') setLb((i) => (i == null ? i : (i + 1) % n));
      if (e.key === 'ArrowLeft') setLb((i) => (i == null ? i : (i - 1 + n) % n));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lb, p]);

  usePageMeta(p ? { title: `${p.name}, ${p.area}`, description: p.blurb, image: p.images[0] } : { title: 'Provider not found' });

  if (!p) return <div className="container"><Empty icon="SearchX" title="Provider not found" text="This listing may have been removed." action={<Link className="btn btn-primary" to="/search">Back to search</Link>} /></div>;

  const t = tradeById(p.trade);
  const pr = p.programmes.find((x) => x.id === prog) || p.programmes[0];
  const isSaved = saved.includes(p.id);
  const similar = PROVIDERS.filter((x) => x.trade === p.trade && x.id !== p.id).slice(0, 4);

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: p.name, url: location.href });
      else { await navigator.clipboard.writeText(location.href); toast('Link copied to clipboard'); }
    } catch { /* user cancelled */ }
  };

  const facts: [LucideIcon, string, string][] = [
    [Hammer, 'Trade', t.name],
    [GraduationCap, 'Programme type', pr.type],
    [Clock, 'Duration', `${pr.months} months`],
    [CalendarDays, 'Training days', pr.days],
    [Timer, 'Training time', pr.time],
    [Wallet, 'Payment options', p.payment],
  ];

  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <button className="back-link btn-ghost" style={{ border: 0, background: 'none', padding: 0 }} onClick={() => (history.length > 2 ? nav(-1) : nav('/search'))}><ArrowLeft size={16} /> Back to search</button>

      <div className="gallery mt-4">
        {[0, 1, 2, 3, 4].map((i) => p.images[i % p.images.length]).map((src, i) => (
          <div key={i} onClick={() => setLb(i % p.images.length)} role="button" tabIndex={0} aria-label={`Open photo ${i + 1}`} onKeyDown={(e) => e.key === 'Enter' && setLb(i % p.images.length)}>
            <Img src={src} alt={`${p.name} photo ${i + 1}`} trade={p.trade} sizes={i === 0 ? SIZES.half : '(max-width: 960px) 50vw, 25vw'} priority={i === 0} />
            {(i === 4 || i === 2) && <div className={i === 2 ? "more more-m" : "more"}><div><Images size={22} style={{ margin: '0 auto 6px' }} />{p.images.length === 1 ? '1 photo' : `All ${p.images.length} photos`}</div></div>}
          </div>
        ))}
      </div>

      <div className="detail-grid mt-6">
        <div style={{ minWidth: 0 }}>
          <div className="row-between wrap" style={{ alignItems: 'flex-start' }}>
            <div>
              <div className="row" style={{ gap: 8 }}><TradeTag trade={p.trade} /><Rating p={p} /></div>
              <h1 className="mt-2" style={{ fontSize: 'clamp(26px,3.4vw,34px)' }}>{p.name}</h1>
              <div className="meta mt-2" style={{ fontSize: 14 }}><MapPin /> {p.area}, Greater Accra · Est. {p.founded}</div>
            </div>
            <div className="row">
              <button className={`btn btn-secondary btn-sm ${isSaved ? 'on' : ''}`} onClick={() => toggleSave(p.id)} style={isSaved ? { color: 'var(--danger)', borderColor: '#fecaca' } : undefined}>
                <Heart size={15} fill={isSaved ? 'currentColor' : 'none'} /> {isSaved ? 'Saved' : 'Save'}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={share}><Share2 size={15} /> Share</button>
            </div>
          </div>
          <div className="row wrap mt-4" style={{ gap: 8 }}><VerifyBadges p={p} /></div>

          <div className="tabs mt-6" role="tablist">
            {TABS.filter((x) => x !== 'Reviews' || SITE.reviews).map((x) => (
              <button key={x} role="tab" aria-selected={tab === x} className={tab === x ? 'on' : ''} onClick={() => setTab(x)}>
                {x}{x === 'Training' && <span className="count">{p.programmes.length}</span>}{x === 'Reviews' && <span className="count">{p.reviews}</span>}
              </button>
            ))}
          </div>

          <div className="mt-6 fade-in" key={tab}>
            {tab === 'Overview' && (
              <div className="stack" style={{ gap: 28 }}>
                <div>
                  <h3>{pr.name}</h3>
                  <p className="muted mt-2">{p.blurb}</p>
                  <dl className="kv mt-4">
                    {facts.map(([I, k, v]) => (<Fragment key={k}><dt><I /> {k}</dt><dd>{v}</dd></Fragment>))}
                  </dl>
                </div>
                <hr className="divider" />
                <div>
                  <h3>About this provider</h3>
                  <p className="muted mt-2" style={{ lineHeight: 1.75 }}>
                    {more ? p.about : p.about.slice(0, 180) + (p.about.length > 180 ? '…' : '')}
                  </p>
                  {p.about.length > 180 && <button className="btn btn-ghost btn-sm mt-2" style={{ color: 'var(--brand)', paddingLeft: 0 }} onClick={() => setMore((m) => !m)}>{more ? 'Show less' : 'Read more'}</button>}
                </div>
                <div className="grid-3">
                  {([[Users, `${p.students}+`, 'Trainees trained'], [Star, p.rating.toFixed(1), `${p.reviews} reviews`], [CalendarClock, `${2026 - p.founded} yrs`, 'In operation']] as const).map(([I, v, l]) => (
                    <div key={l} className="card" style={{ padding: 18, display: 'flex', gap: 14, alignItems: 'center' }}>
                      <div className="stat-ico tone-brand"><I size={19} /></div>
                      <div><div className="bold" style={{ fontSize: 20 }}>{v}</div><div className="xs muted">{l}</div></div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'Training' && (
              <div className="stack">
                <p className="muted">Select a programme to see its details and enquire.</p>
                {p.programmes.map((x) => (
                  <div key={x.id} className={`programme ${prog === x.id ? 'on' : ''}`} onClick={() => setProg(x.id)} role="radio" aria-checked={prog === x.id} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setProg(x.id)}>
                    <div>
                      <div className="row" style={{ gap: 8 }}><h4>{x.name}</h4><span className="badge">{x.type}</span></div>
                      <div className="facts mt-2">
                        <span className="meta"><Clock /> {x.months} months</span>
                        <span className="meta"><CalendarDays /> {x.days}</span>
                        <span className="meta"><Timer /> {x.time}</span>
                        <span className="meta"><Users /> {x.places} places left</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="price" style={{ fontSize: 20 }}>{cedi(x.fee)}</div>
                      <div className="xs muted">Intake {fmtDate(x.intake, { day: 'numeric', month: 'short' })}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'Schedule' && (
              <div className="card">
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Programme</th><th>Intake</th><th>Days</th><th>Time</th><th>Places</th></tr></thead>
                    <tbody>
                      {p.programmes.map((x) => (
                        <tr key={x.id}><td className="bold">{x.name}</td><td>{fmtDate(x.intake)}</td><td>{x.days}</td><td>{x.time}</td><td><span className={`badge ${x.places < 10 ? 'badge-warn' : 'badge-success'}`}>{x.places} left</span></td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === 'Verification' && (
              <div className="stack">
                <div className="notice info"><Info size={18} /><div>Fliptech checks every listing. Badges show what has been confirmed — not a guarantee of training quality.</div></div>
                <div className="timeline">
                  {([
                    [true, 'Business details checked', 'Registered business name and phone number confirmed.'],
                    [p.ctvet, 'CTVET registration', p.ctvet ? 'Registration number confirmed with the Commission for TVET.' : 'This centre has not provided a CTVET registration.'],
                    [!!p.visited, 'Fliptech site visit', p.visited ? `Our field team visited the workshop in ${p.visited} and confirmed equipment and instructors.` : 'A visit has not been scheduled yet.'],
                    [true, 'Fees confirmed', 'Published fees were confirmed with the centre this quarter.'],
                  ] as [ok: boolean, title: string, text: string][]).map(([ok, title, text]) => (
                    <div className="timeline-item" key={title}>
                      <div className="timeline-dot" style={ok ? undefined : { background: 'var(--line-2)', color: 'var(--muted)' }}>{ok ? <CheckCircle2 /> : <CircleDashed />}</div>
                      <div><div className="bold">{title}</div><div className="small muted">{text}</div></div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'Gallery' && (
              <div className="pgrid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12 }}>
                {p.images.map((src, i) => (
                  <button key={i} onClick={() => setLb(i)} style={{ border: 0, padding: 0, borderRadius: 14, overflow: 'hidden', aspectRatio: '4/3' }} aria-label={`Open photo ${i + 1}`}>
                    <Img src={src} alt="" trade={p.trade} sizes={SIZES.card} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </button>
                ))}
              </div>
            )}

            {tab === 'Reviews' && (
              <div>
                <div className="card" style={{ padding: 20, display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div><div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1 }}>{p.rating.toFixed(1)}</div><Stars value={p.rating} /><div className="xs muted mt-1">{p.reviews} reviews</div></div>
                  <div className="grow stack-sm" style={{ minWidth: 200 }}>
                    {[5, 4, 3, 2, 1].map((s, i) => (
                      <div key={s} className="row" style={{ gap: 10 }}><span className="xs bold" style={{ width: 10 }}>{s}</span><div className="progress grow"><div style={{ width: `${[72, 20, 6, 2, 0][i]}%` }} /></div></div>
                    ))}
                  </div>
                </div>
                <div className="mt-4"><ReviewList providerId={p.id} /></div>
              </div>
            )}

            {tab === 'Location' && (
              <div className="stack">
                <div className="card" style={{ height: 340, overflow: 'hidden' }}><Suspense fallback={<div className="skeleton" style={{ width: '100%', height: '100%', borderRadius: 0 }} role="status" aria-label="Loading map" />}><MapView providers={[p]} single /></Suspense></div>
                <div className="row-between wrap">
                  <div className="meta" style={{ fontSize: 14 }}><MapPin /> {p.area}, Greater Accra · {p.hours}</div>
                  <a className="btn btn-secondary btn-sm" href={`https://www.google.com/maps/dir/?api=1&destination=${p.coords.join(',')}`} target="_blank" rel="noreferrer"><Navigation size={15} /> Get directions</a>
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="sticky-card">
          <div className="card card-pad">
            <div className="xs muted bold" style={{ textTransform: 'uppercase', letterSpacing: '.06em' }}>From</div>
            <div className="price-big">{cedi(pr.fee)}</div>
            <div className="small muted">{pr.name}</div>
            <hr className="divider" />
            <div className="stack-sm" style={{ gap: 12 }}>
              <div className="meta" style={{ fontSize: 14 }}><Clock /> {pr.months} months</div>
              <div className="meta" style={{ fontSize: 14 }}><CalendarDays /> Next intake: <b style={{ color: 'var(--ink)' }}>{fmtDate(pr.intake)}</b></div>
              <div className="meta" style={{ fontSize: 14 }}><Users /> <span><b style={{ color: pr.places < 10 ? 'var(--warn)' : 'var(--ink)' }}>{pr.places} places</b> remaining</span></div>
            </div>
            {p.programmes.length > 1 && (
              <div className="field mt-4">
                <label className="label" htmlFor="prog">Programme</label>
                <select id="prog" className="select" value={prog} onChange={(e) => setProg(e.target.value)}>
                  {p.programmes.map((x) => <option key={x.id} value={x.id}>{x.name} — {cedi(x.fee)}</option>)}
                </select>
              </div>
            )}
            <Link to={`/providers/${p.id}/enquire?programme=${pr.id}`} className="btn btn-primary btn-lg btn-block mt-4">Enquire now</Link>
            <a href={`tel:${p.phone.replace(/\s/g, '')}`} className="btn btn-secondary btn-block mt-2"><Phone size={16} /> Call {p.phone}</a>
            <p className="xs muted mt-3" style={{ textAlign: 'center' }}>Free to enquire · Usually replies within 1 day</p>
          </div>
          <div className="card mt-4" style={{ padding: 18 }}>
            <div className="row"><div className="stat-ico tone-success"><ShieldCheck size={19} /></div><div><div className="bold small">Trust & safety</div><div className="xs muted">Never pay before visiting the centre in person.</div></div></div>
            {p.ctvet && <div className="row mt-3"><div className="stat-ico tone-brand"><BadgeCheck size={19} /></div><div><div className="bold small">CTVET registered</div><div className="xs muted">Recognised by the national TVET regulator.</div></div></div>}
          </div>
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="section">
          <div className="section-head"><h2>Similar {t.name.toLowerCase()} providers</h2><Link to={`/search?trade=${p.trade}`} className="btn btn-ghost">See all</Link></div>
          <div className="pgrid">{similar.map((x) => <ProviderCard key={x.id} p={x} />)}</div>
        </section>
      )}

      {lb != null && (
        <div className="lightbox" onClick={() => setLb(null)}>
          <button className="btn btn-white btn-icon lb-close" aria-label="Close" onClick={() => setLb(null)}><X size={20} /></button>
          <button className="btn btn-white btn-icon lb-nav lb-prev" aria-label="Previous" onClick={(e) => { e.stopPropagation(); setLb((lb - 1 + p.images.length) % p.images.length); }}><ChevronLeft size={20} /></button>
          <Img src={resized(p.images[lb], 1600)} alt="" trade={p.trade} sizes={SIZES.full} priority onClick={(e) => e.stopPropagation()} />
          <button className="btn btn-white btn-icon lb-nav lb-next" aria-label="Next" onClick={(e) => { e.stopPropagation(); setLb((lb + 1) % p.images.length); }}><ChevronRight size={20} /></button>
          <div style={{ position: 'absolute', bottom: 20, color: '#fff' }} className="small">{lb + 1} / {p.images.length}</div>
        </div>
      )}
    </div>
  );
}

/** Reviews load only when the tab is opened. */
function ReviewList({ providerId }: { providerId: string }) {
  const q = useApiQuery(() => api.catalog.reviews(providerId), [providerId]);
  if (q.loading && !q.data) return <Loading label="Loading reviews" />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.reload()} title="We couldn’t load reviews" />;
  if (!q.data?.length) return <Empty icon="MessageSquare" title="No reviews yet" text="Reviews from trainees will appear here." />;
  return (
    <>
      {q.data.map((r) => (
        <div className="review" key={r.name}>
          <div className="row-between"><div className="row"><span className="avatar" style={{ width: 34, height: 34 }}>{r.name.split(' ').map((w) => w[0]).join('')}</span><div><div className="bold">{r.name}</div><div className="xs muted">{r.date} · Verified trainee</div></div></div><Stars value={r.rating} size={13} /></div>
          <p className="mt-3 muted">{r.text}</p>
        </div>
      ))}
    </>
  );
}
