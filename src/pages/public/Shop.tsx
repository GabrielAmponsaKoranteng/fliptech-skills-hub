import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Mail, Phone, MapPin, Clock, Send, CheckCircle2, Lightbulb } from 'lucide-react';
import { PROVIDERS, SITE, SKILL_CATEGORIES, tradeById } from '../../data/catalog';
import { didYouMean, score, type Field } from '../../lib/search';
import { isPublished, ownedCourseIds } from '../../lib/listings';
import { CourseCard, ProductCard } from '../../components/ShopCards';
import { CardGridSkeleton, Empty, ErrorState } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { api } from '../../api';
import { errorMessage } from '../../api/errors';
import type { Course, FieldEvent, Product } from '../../types';

type SortKey = 'match' | 'popular' | 'rating' | 'low' | 'high';
type Listing = Course | Product;

const SORTERS: Record<Exclude<SortKey, 'match'>, (a: Listing, b: Listing) => number> = {
  popular: (a, b) => b.reviews - a.reviews,
  rating: (a, b) => b.rating - a.rating || b.reviews - a.reviews,
  low: (a, b) => a.price - b.price,
  high: (a, b) => b.price - a.price,
};

interface CatalogueProps<T extends Listing> {
  /** Plural name for the empty states, e.g. "products" */
  noun: string;
  emptyIcon: string;
  items: T[];
  title: string;
  sub: string;
  eyebrow: string;
  /** `eager` is true for the first row, whose photos load straight away. */
  render: (item: T, eager: boolean) => ReactNode;
  /** Show the "Free only" checkbox (courses) */
  extraFilter?: boolean;
}

const SORTS: [SortKey, string][] = [['match', 'Best match'], ['popular', 'Most popular'], ['rating', 'Highest rated'], ['low', 'Price: low to high'], ['high', 'Price: high to low']];

const catName = (id: string) => SKILL_CATEGORIES.find((c) => c.id === id)?.name;
const fieldsOf = (i: Listing): Field[] => [[i.title, 3], [catName(i.cat), 2], [i.by, 1.5], [i.description, 1]];

/** Search, sort and filter state lives in the URL (?q=&cat=&sort=&free=1), so Back from an item restores it. */
function Catalogue<T extends Listing>({ items, title, sub, eyebrow, render, noun, emptyIcon, extraFilter = false }: CatalogueProps<T>) {
  const [params, setParams] = useSearchParams();
  const cat = params.get('cat') || '';
  const q = params.get('q') || '';
  const freeOnly = extraFilter && params.get('free') === '1';
  // With a search, the best matches come first unless they picked another order.
  const sort = (params.get('sort') as SortKey) || (q.trim() ? 'match' : 'popular');
  const { dataStatus, dataError, retryData } = useApp();

  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) { if (v) next.set(k, v); else next.delete(k); }
    setParams(next, { replace: true });
  };
  const clearAll = () => setParams(new URLSearchParams(), { replace: true });

  /** Items passing the search and the free filter (but not the category), with their match score. */
  const matching = useMemo(() => items
    .filter((i) => !freeOnly || i.price === 0)
    .map((i) => [i, score(q, fieldsOf(i))] as const)
    .filter(([, s]) => s > 0), [items, q, freeOnly]);

  const list = useMemo(() => {
    const l = matching.filter(([i]) => !cat || i.cat === cat);
    const by = sort === 'match' || !(sort in SORTERS) ? null : SORTERS[sort as Exclude<SortKey, 'match'>];
    return [...l].sort((a, b) => (by ? by(a[0], b[0]) : b[1] - a[1] || SORTERS.popular(a[0], b[0]))).map(([i]) => i);
  }, [matching, cat, sort]);

  // Category chips show how many results each would give with the current search.
  const cats = SKILL_CATEGORIES.filter((c) => items.some((i) => i.cat === c.id))
    .map((c) => ({ ...c, count: matching.filter(([i]) => i.cat === c.id).length }));

  return (
    <div className="container" style={{ paddingTop: 40 }}>
      <div className="h-eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      <p className="muted mt-2">{sub}</p>

      <div className="row wrap mt-6" role="search" style={{ gap: 12 }}>
        <div className="input-icon" style={{ flex: '1 1 260px', maxWidth: 420 }}>
          <Search size={17} />
          <input type="search" className="input" placeholder={`Search ${title.toLowerCase()}…`} value={q} onChange={(e) => update({ q: e.target.value })} aria-label="Search" enterKeyHint="search" />
        </div>
        {extraFilter && <label className="check" style={{ alignItems: 'center' }}><input type="checkbox" checked={freeOnly} onChange={(e) => update({ free: e.target.checked ? '1' : '' })} /> Free only</label>}
        <select className="select" style={{ width: 200, marginLeft: 'auto' }} value={sort} onChange={(e) => update({ sort: e.target.value })} aria-label="Sort">
          {SORTS.filter(([v]) => v !== 'match' || q.trim()).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div className="row wrap mt-4" role="group" aria-label="Category" style={{ gap: 8 }}>
        <button className={`h-chip ${!cat ? 'on' : ''}`} aria-pressed={!cat} onClick={() => update({ cat: '' })}>All <span className="chip-count">{matching.length}</span></button>
        {cats.map((c) => (
          <button key={c.id} className={`h-chip ${cat === c.id ? 'on' : ''}`} aria-pressed={cat === c.id} onClick={() => update({ cat: cat === c.id ? '' : c.id })}>
            {c.name} <span className="chip-count">{c.count}</span>
          </button>
        ))}
      </div>

      {dataStatus === 'loading' ? (
        <div className="mt-6" role="status" aria-live="polite"><span className="sr-only">Loading {title.toLowerCase()}</span><CardGridSkeleton count={8} /></div>
      ) : dataStatus === 'error' ? (
        <div className="card mt-6"><ErrorState error={dataError} onRetry={retryData} title={`We couldn’t load ${title.toLowerCase()}`} /></div>
      ) : (
        <>
          <div className="small muted mt-6 mb-4" aria-live="polite">{list.length} result{list.length === 1 ? '' : 's'}{cat ? ` in ${catName(cat)}` : ''}</div>
          {list.length > 0 ? <div className="shop-grid">{list.map((item, i) => render(item, i < 4))}</div>
            : items.length === 0 ? <div className="card"><Empty icon={emptyIcon} title={`No ${noun} yet`} text="Check back soon: new listings are added every week." /></div>
              : <CatalogueNoResults items={items} noun={noun} q={q} cat={cat} freeOnly={freeOnly} onSet={update} onClear={clearAll} />}
        </>
      )}
    </div>
  );
}

/** Empty results with a way forward: the likely spelling, which filter to drop, and matching training centres. */
function CatalogueNoResults({ items, noun, q, cat, freeOnly, onSet, onClear }: {
  items: Listing[]; noun: string; q: string; cat: string; freeOnly: boolean; onSet: (c: Record<string, string>) => void; onClear: () => void;
}) {
  const count = (query: string, c: string, free: boolean) =>
    items.filter((i) => (!c || i.cat === c) && (!free || i.price === 0) && score(query, fieldsOf(i)) > 0).length;
  const fixed = q ? didYouMean(q, items.flatMap((i) => [i.title, i.by, catName(i.cat) ?? ''])) : null;
  const spelling = fixed && count(fixed, '', false) > 0 ? fixed : null;
  type Relax = { label: string; n: number; change: Record<string, string> };
  const relax: Relax[] = [];
  if (cat) relax.push({ label: 'Search all categories', n: count(q, '', freeOnly), change: { cat: '' } });
  if (freeOnly) relax.push({ label: `Include paid ${noun}`, n: count(q, cat, false), change: { free: '' } });
  const ways = relax.filter((r) => r.n > 0);
  const centres = q ? PROVIDERS.filter((p) => score(q, [[p.name, 3], [tradeById(p.trade)?.name, 2.5], [p.blurb, 1]]) > 0).length : 0;

  return (
    <div className="card">
      <Empty icon="SearchX" title="Nothing matches"
        text={`No ${noun} match${q ? ` “${q}”` : ''}${cat ? ` in ${catName(cat) ?? 'this category'}` : ''}${freeOnly ? ' that are free' : ''}.`}
        action={(
          <div className="stack-sm" style={{ gap: 14, alignItems: 'center' }}>
            {spelling && <p className="small">Did you mean <button type="button" className="btn-link bold" onClick={() => onSet({ q: spelling })}>{spelling}</button>?</p>}
            {ways.length > 0 && (
              <div className="row wrap" style={{ gap: 8, justifyContent: 'center' }}>
                {ways.map((r) => <button key={r.label} type="button" className="btn btn-secondary btn-sm" onClick={() => onSet(r.change)}>{r.label} <span className="muted">({r.n})</span></button>)}
              </div>
            )}
            {centres > 0 && (
              <div className="notice info" style={{ textAlign: 'left' }}>
                <Lightbulb size={18} />
                <div>{centres} training centre{centres === 1 ? ' matches' : 's match'} “{q}”. <Link to={`/search?q=${encodeURIComponent(q)}`} className="bold">Find training near you</Link></div>
              </div>
            )}
            <button className="btn btn-primary" onClick={onClear}>Clear search and filters</button>
          </div>
        )} />
    </div>
  );
}

export function Courses() {
  const { courses, orders, user } = useApp();
  const owned = ownedCourseIds(orders, user?.id);
  return (
    <Catalogue
      items={courses.filter(isPublished)}
      eyebrow="Online Learning"
      title="Online courses"
      sub="Recorded courses from skilled professionals. Learn at your own pace, on your phone or laptop."
      noun="courses"
      emptyIcon="BookOpen"
      extraFilter
      render={(c, eager) => <CourseCard key={c.id} c={c} showMeta owned={owned.has(c.id)} eager={eager} />}
    />
  );
}

export function Marketplace() {
  const { products } = useApp();
  return (
    <Catalogue
      items={products.filter(isPublished)}
      eyebrow="Marketplace"
      title="Marketplace"
      sub="Quality products made by trainers, trainees and skilled professionals across Ghana."
      noun="products"
      emptyIcon="ShoppingBag"
      render={(p, eager) => <ProductCard key={p.id} p={p} eager={eager} />}
    />
  );
}

export function Contact() {
  const { toast } = useApp();
  const [sent, setSent] = useState(false);
  const [f, setF] = useState({ name: '', email: '', topic: 'General question', message: '' });
  const [touched, setTouched] = useState(false);
  const set = (k: keyof typeof f) => (e: FieldEvent) => setF((x) => ({ ...x, [k]: e.target.value }));
  const errs = { name: !f.name.trim(), email: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim()), message: f.message.trim().length < 10 };

  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (Object.values(errs).some(Boolean)) return;
    setBusy(true);
    try {
      await api.support.contact(f);
      setSent(true);
      toast('Message sent — we’ll reply within 1 working day');
    } catch (x) {
      toast(errorMessage(x), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container" style={{ paddingTop: 40 }}>
      <div className="h-eyebrow">Contact</div>
      <h1>We’d love to hear from you</h1>
      <p className="muted mt-2">Questions about training, courses, selling or your account — our team in Accra is here to help.</p>
      <div className="grid-3-1 mt-8" style={{ alignItems: 'start' }}>
        <div className="card card-pad">
          {sent ? (
            <div className="empty">
              <div className="empty-ico" style={{ background: 'var(--success-50)', color: 'var(--success)' }}><CheckCircle2 size={30} /></div>
              <h3>Thanks, {f.name.split(' ')[0]}!</h3>
              <p>We’ve received your message and will reply to {f.email} within one working day.</p>
              <button className="btn btn-secondary mt-4" onClick={() => { setSent(false); setTouched(false); setF({ name: '', email: '', topic: 'General question', message: '' }); }}>Send another message</button>
            </div>
          ) : (
            <form className="form-grid" onSubmit={submit} noValidate>
              <div className="field">
                <label className="label" htmlFor="cn">Your name <span className="req">*</span></label>
                <input id="cn" className={`input ${touched && errs.name ? 'invalid' : ''}`} value={f.name} onChange={set('name')} />
                {touched && errs.name && <span className="error-text">Please enter your name</span>}
              </div>
              <div className="field">
                <label className="label" htmlFor="ce">Email <span className="req">*</span></label>
                <input id="ce" type="email" className={`input ${touched && errs.email ? 'invalid' : ''}`} value={f.email} onChange={set('email')} />
                {touched && errs.email && <span className="error-text">Enter a valid email address</span>}
              </div>
              <div className="field span-2">
                <label className="label" htmlFor="ct">Topic</label>
                <select id="ct" className="select" value={f.topic} onChange={set('topic')}>
                  {['General question', 'Finding training', 'Online courses', 'Buying or selling', 'Becoming a provider', 'Account help'].map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="field span-2">
                <label className="label" htmlFor="cm">Message <span className="req">*</span></label>
                <textarea id="cm" className={`textarea ${touched && errs.message ? 'invalid' : ''}`} value={f.message} onChange={set('message')} />
                {touched && errs.message && <span className="error-text">Please write at least 10 characters</span>}
              </div>
              <div className="span-2"><button className="btn btn-primary btn-lg" disabled={busy}>{busy ? <><span className="spinner" /> Sending…</> : <><Send size={17} /> Send message</>}</button></div>
            </form>
          )}
        </div>
        <div className="card card-pad stack">
          {([[Phone, 'Call us', SITE.supportPhone], [Mail, 'Email', SITE.supportEmail], [MapPin, 'Visit', 'Osu, Accra, Ghana'], [Clock, 'Hours', 'Mon – Fri, 8:00am – 5:00pm']] as const).map(([I, t, v]) => (
            <div key={t} className="row"><div className="stat-ico tone-brand"><I size={19} /></div><div><div className="xs muted bold">{t}</div><div className="bold">{v}</div></div></div>
          ))}
        </div>
      </div>
    </div>
  );
}
