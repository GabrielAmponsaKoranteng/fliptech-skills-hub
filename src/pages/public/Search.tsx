import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search as SearchIcon, X, List, LayoutGrid, Map as MapIcon, ChevronLeft, ChevronRight, MapPin, Clock, CalendarDays, SlidersHorizontal, History, Lightbulb } from 'lucide-react';
import { AREAS, PROVIDERS, TRADES, tradeById } from '../../data/catalog';
import { cedi, fmtDate } from '../../lib/format';
import { FILTER_KEYS, filterProviders, noResultHelp, readFilters, type FilterKey, type SortKey } from '../../lib/providerSearch';
import { score } from '../../lib/search';
import { isPublished } from '../../lib/listings';
import { useApp } from '../../context/AppContext';
import { ProviderCard, ProviderRow } from '../../components/ProviderCard';
import { Empty, Img, TradeTag, SIZES } from '../../components/ui';
import type { Course, Product } from '../../types';

// The map library (Leaflet, ~45 KB) only downloads when a map is actually shown.
const MapView = lazy(() => import('../../components/MapView'));

type Option = [value: string, label: string];
type View = 'list' | 'grid' | 'map';

const FEES: Option[] = [['', 'Any amount'], ['700', '≤ GH₵700'], ['1000', '≤ GH₵1,000'], ['1500', '≤ GH₵1,500']];
const VERIFIED: Option[] = [['', 'Any'], ['ctvet', 'CTVET registered'], ['visited', 'Fliptech visited'], ['both', 'Both']];
const SORTS: [SortKey, string][] = [['relevance', 'Most relevant'], ['fee', 'Lowest fee'], ['intake', 'Soonest intake'], ['rating', 'Highest rated'], ['duration', 'Shortest course']];
const PER_PAGE = 8;

// Per-device conveniences: the preferred view and the last few searches. Storage can be unavailable
// (private mode, blocked), in which case the page simply doesn't remember.
const VIEW_KEY = 'fsh.search.view';
const RECENT_KEY = 'fsh.search.recent';
const MAX_RECENT = 5;
const load = <T,>(key: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(key) ?? '') as T; } catch { return fallback; } };
const save = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* not remembered */ } };

/** Just the filters, in a stable order, e.g. "q=welding&area=Tema" — used to remember searches. */
function filterQuery(params: URLSearchParams) {
  const out = new URLSearchParams();
  for (const k of FILTER_KEYS) { const v = params.get(k); if (v) out.set(k, v); }
  return out.toString();
}

/** Human labels for the active filters, e.g. [['q', '“welding”'], ['area', 'Tema']]. */
function filterLabels(params: URLSearchParams): [key: FilterKey, label: string][] {
  const labels: [FilterKey, string][] = [];
  const v = (k: FilterKey) => params.get(k);
  if (v('q')) labels.push(['q', `“${v('q')}”`]);
  if (v('trade')) labels.push(['trade', tradeById(v('trade')!)?.name ?? v('trade')!]);
  if (v('area')) labels.push(['area', v('area')!]);
  if (v('fee')) labels.push(['fee', `Max fee: ≤ ${cedi(v('fee')!)}`]);
  if (v('verified')) labels.push(['verified', VERIFIED.find((o) => o[0] === v('verified'))?.[1] ?? v('verified')!]);
  return labels;
}

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params);
  // PROVIDERS is replaced when the catalog reloads (sign-in, an approved centre), which bumps catalogVersion.
  const { catalogVersion } = useApp();
  const results = useMemo(() => filterProviders(PROVIDERS, filters), [params, catalogVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const view = (params.get('view') as View) || load<View>(VIEW_KEY, 'list');
  const pages = Math.max(1, Math.ceil(results.length / PER_PAGE));
  // A page number from an old link may be past the end once results change.
  const page = Math.min(pages, Math.max(1, Number(params.get('page')) || 1));
  const [qDraft, setQDraft] = useState(filters.q);
  const [hl, setHl] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>(() => load<string[]>(RECENT_KEY, []));

  // Keep the box in step with the URL (Back/Forward, chips, suggestions).
  useEffect(() => { setQDraft(filters.q); }, [filters.q]);

  // Remember searches that found something, newest first.
  const current = filterQuery(params);
  useEffect(() => {
    if (!current || results.length === 0) return;
    setRecent((r) => {
      const next = [current, ...r.filter((x) => x !== current)].slice(0, MAX_RECENT);
      save(RECENT_KEY, next);
      return next;
    });
  }, [current]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (changes: Record<string, string>, push = false) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) { if (v) next.set(k, v); else next.delete(k); }
    if (!('page' in changes)) next.delete('page');
    setParams(next, { replace: !push });
  };
  const set = (k: string, v: string) => update({ [k]: v });
  const setView = (v: View) => { save(VIEW_KEY, v); update({ view: v === 'list' ? '' : v }, true); };
  const clearAll = () => { setQDraft(''); const next = new URLSearchParams(); if (params.get('view')) next.set('view', params.get('view')!); setParams(next); };

  const chips = filterLabels(params);
  const activeCount = chips.filter(([k]) => k !== 'q').length;
  const shown = results.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const chipRow = chips.length > 0 && (
    <div className="active-filters">
      <span className="small muted bold"><SlidersHorizontal size={14} style={{ verticalAlign: -2 }} /> Active filters:</span>
      {chips.map(([k, label]) => (
        <span key={k} className="chip">{label}<button type="button" onClick={() => set(k, '')} aria-label={`Remove ${label}`}><X size={14} /></button></span>
      ))}
      <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto', color: 'var(--brand)' }} onClick={clearAll}>Clear all</button>
    </div>
  );

  const filterBar = (
    <form className={`card filters ${filtersOpen ? 'open' : ''}`} role="search" onSubmit={(e) => { e.preventDefault(); set('q', qDraft.trim()); }}>
      <div className="field">
        <label className="label" htmlFor="fq">Skill or provider</label>
        <div className="row" style={{ gap: 8 }}>
          <div className="input-icon grow">
            <SearchIcon size={17} />
            <input id="fq" type="search" className="input" value={qDraft} onChange={(e) => setQDraft(e.target.value)} placeholder="Search skills or providers…" enterKeyHint="search" />
          </div>
          <button className="btn btn-primary" type="submit">Search</button>
        </div>
        {/* Phones: the other filters fold away behind this button. */}
        <button type="button" className="btn btn-secondary btn-sm filters-toggle mt-3" aria-expanded={filtersOpen} aria-controls="more-filters" onClick={() => setFiltersOpen((o) => !o)}>
          <SlidersHorizontal size={15} /> {filtersOpen ? 'Hide filters' : `Filters${activeCount ? ` (${activeCount})` : ''}`}
        </button>
      </div>
      <div id="more-filters" className="filters-more">
        <div className="field">
          <label className="label" htmlFor="ft">Trade</label>
          <select id="ft" className="select" value={filters.trade} onChange={(e) => set('trade', e.target.value)}>
            <option value="">Any trade</option>
            {TRADES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="fa">Location</label>
          <select id="fa" className="select" value={filters.area} onChange={(e) => set('area', e.target.value)}>
            <option value="">Any area</option>
            {AREAS.map((a) => <option key={a}>{a}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="ff">Max fee</label>
          <select id="ff" className="select" value={params.get('fee') || ''} onChange={(e) => set('fee', e.target.value)}>
            {FEES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="fv">Verified</label>
          <select id="fv" className="select" value={filters.verified} onChange={(e) => set('verified', e.target.value)}>
            {VERIFIED.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="fs">Sort by</label>
          <select id="fs" className="select" value={filters.sort} onChange={(e) => set('sort', e.target.value === 'relevance' ? '' : e.target.value)}>
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
    </form>
  );

  const viewToggle = (
    <div className="seg-toggle" role="group" aria-label="View">
      {([['list', List, 'List'], ['grid', LayoutGrid, 'Grid'], ['map', MapIcon, 'Map']] as const).map(([v, I, label]) => (
        <button key={v} type="button" className={view === v ? 'on' : ''} aria-pressed={view === v} onClick={() => setView(v)}><I size={15} /> {label}</button>
      ))}
    </div>
  );

  const noResults = <NoResults params={params} onClear={clearAll} onSet={update} />;

  if (view === 'map') {
    return (
      <div className="map-layout">
        <div className="map-list">
          <div className="map-list-head">
            <h1 className="as-h3" aria-live="polite">{results.length} provider{results.length === 1 ? '' : 's'} in Greater Accra</h1>
            <div className="row mt-3" style={{ gap: 8 }}>
              <select className="select" style={{ height: 38 }} value={filters.trade} onChange={(e) => set('trade', e.target.value)} aria-label="Trade">
                <option value="">Any trade</option>
                {TRADES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <select className="select" style={{ height: 38 }} value={params.get('fee') || ''} onChange={(e) => set('fee', e.target.value)} aria-label="Max fee">
                {FEES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            {/* The map has room for two filters; show any others that are still applied. */}
            {chipRow}
            <div className="mt-3">{viewToggle}</div>
          </div>
          {results.length === 0 && noResults}
          {results.map((p, i) => (
            <Link key={p.id} to={`/providers/${p.id}`} className={`map-item ${hl === p.id ? 'hl' : ''}`} style={{ color: 'inherit' }}
              onMouseEnter={() => setHl(p.id)} onMouseLeave={() => setHl(null)} onFocus={() => setHl(p.id)} onBlur={() => setHl(null)}>
              <div className="mi-img"><Img src={p.images[0]} alt="" trade={p.trade} sizes={SIZES.thumb} /></div>
              <div className="stack-sm" style={{ gap: 4, minWidth: 0 }}>
                <div className="row" style={{ gap: 8 }}><span className="badge badge-brand" style={{ height: 20, padding: '0 7px' }}>{i + 1}</span><TradeTag trade={p.trade} /></div>
                <div className="bold ellipsis">{p.name}</div>
                <div className="meta"><MapPin /> {p.area}</div>
                <div className="row-between">
                  <span className="price">From {cedi(p.fee)}</span>
                  <span className="meta"><Clock /> {p.months} mo</span>
                </div>
                <div className="meta xs"><CalendarDays /> Next intake: {fmtDate(p.intake, { day: 'numeric', month: 'short' })}</div>
              </div>
            </Link>
          ))}
        </div>
        <div className="map-canvas">
          <Suspense fallback={<div className="skeleton" style={{ width: '100%', height: '100%', borderRadius: 0 }} role="status" aria-label="Loading map" />}>
            <MapView providers={results} highlight={hl} onSelect={setHl} />
          </Suspense>
          <div className="map-pill"><MapPin size={15} color="var(--brand)" /> {results.length} provider locations</div>
        </div>
      </div>
    );
  }

  const others = recent.filter((r) => r !== current);
  return (
    <div className="container">
      <div className="page-head">
        <h1>Find training providers</h1>
        <p className="muted mt-2">Use the filters to find the right training for you.</p>
      </div>
      {filterBar}
      {chipRow}
      {!current && others.length > 0 && (
        <div className="active-filters">
          <span className="small muted bold"><History size={14} style={{ verticalAlign: -2 }} /> Recent searches:</span>
          {others.map((r) => (
            <Link key={r} to={`/search?${r}`} className="h-chip">{filterLabels(new URLSearchParams(r)).map(([, l]) => l).join(' · ')}</Link>
          ))}
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => { setRecent([]); save(RECENT_KEY, []); }}>Clear history</button>
        </div>
      )}

      <div className="row-between mt-8 mb-4 wrap">
        <div aria-live="polite">
          <h2 className="as-h3">{results.length} provider{results.length === 1 ? '' : 's'} {current ? 'match your filters' : 'in Greater Accra'}</h2>
          {results.length > 0 && <div className="small muted">Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, results.length)} of {results.length}{filters.sort === 'relevance' && filters.q ? ', best matches first' : ''}</div>}
        </div>
        {viewToggle}
      </div>

      {results.length === 0 ? noResults
        : view === 'grid' ? <div className="pgrid">{shown.map((p, i) => <ProviderCard key={p.id} p={p} eager={i < 3} />)}</div>
          : <div className="stack">{shown.map((p, i) => <ProviderRow key={p.id} p={p} eager={i < 2} />)}</div>}

      {pages > 1 && (
        <nav className="pager" aria-label="Pagination">
          <button disabled={page === 1} onClick={() => update({ page: String(page - 1) }, true)}><ChevronLeft size={16} /> Previous</button>
          {Array.from({ length: pages }, (_, i) => (
            <button key={i} className={page === i + 1 ? 'on' : ''} onClick={() => update({ page: String(i + 1) }, true)} aria-current={page === i + 1 ? 'page' : undefined}>{i + 1}</button>
          ))}
          <button disabled={page === pages} onClick={() => update({ page: String(page + 1) }, true)}>Next <ChevronRight size={16} /></button>
        </nav>
      )}

      <div className="notice info mt-8">
        <MapPin size={18} />
        <div>Can’t find your area? <Link to="/help" className="bold">Tell us</Link> and we’ll prioritise visiting centres near you.</div>
      </div>
    </div>
  );
}

/**
 * Empty results with a way forward: the spelling we think they meant, which single filter to
 * drop (and how many centres that would show), and online courses or products matching the words.
 */
function NoResults({ params, onClear, onSet }: { params: URLSearchParams; onClear: () => void; onSet: (changes: Record<string, string>) => void }) {
  const { courses, products } = useApp();
  const filters = readFilters(params);
  const { relax, spelling } = noResultHelp(PROVIDERS, filters);
  const labels = Object.fromEntries(filterLabels(params));
  const nav = useNavigate();

  const listingMatches = (items: (Course | Product)[]) =>
    filters.q ? items.filter((i) => isPublished(i) && score(filters.q, [[i.title, 3], [i.by, 1], [i.description, 1]]) > 0).length : 0;
  const courseHits = listingMatches(courses);
  const productHits = listingMatches(products);

  return (
    <div className="card">
      <Empty icon="SearchX" title="No providers match" text={spelling ? undefined : 'Try one of these, or clear your filters to see every centre.'}
        action={(
          <div className="stack-sm" style={{ gap: 14, alignItems: 'center' }}>
            {spelling && (
              <p className="small">Did you mean <button type="button" className="btn-link bold" onClick={() => onSet({ q: spelling })}>{spelling}</button>?</p>
            )}
            {relax.length > 0 && (
              <div className="row wrap" style={{ gap: 8, justifyContent: 'center' }}>
                {relax.map(({ key, count }) => (
                  <button key={key} type="button" className="btn btn-secondary btn-sm" onClick={() => onSet({ [key]: '' })}>
                    Remove {labels[key]} <span className="muted">({count})</span>
                  </button>
                ))}
              </div>
            )}
            {(courseHits > 0 || productHits > 0) && (
              <div className="notice info" style={{ textAlign: 'left' }}>
                <Lightbulb size={18} />
                <div>
                  {courseHits > 0 && <>{courseHits} online course{courseHits === 1 ? ' matches' : 's match'} {labels.q}. <button type="button" className="btn-link bold" onClick={() => nav(`/courses?q=${encodeURIComponent(filters.q)}`)}>See courses</button>{productHits > 0 && ' · '}</>}
                  {productHits > 0 && <>{productHits} marketplace product{productHits === 1 ? ' matches' : 's match'}{courseHits > 0 ? '' : ` ${labels.q}`}. <button type="button" className="btn-link bold" onClick={() => nav(`/marketplace?q=${encodeURIComponent(filters.q)}`)}>See products</button></>}
                </div>
              </div>
            )}
            <button type="button" className="btn btn-primary" onClick={onClear}>Clear all filters</button>
          </div>
        )} />
    </div>
  );
}
