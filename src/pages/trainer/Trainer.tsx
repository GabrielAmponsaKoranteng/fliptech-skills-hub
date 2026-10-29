import { useEffect, useMemo, useState, type FormEvent, type SyntheticEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Plus, Pencil, Trash2, Eye, Phone, Send, MessageCircle, CheckCircle2, CircleDashed, UploadCloud, FileText,
  CalendarDays, MapPin, ExternalLink, Image as ImageIcon, Info, Copy, X,
} from 'lucide-react';
import { useApp, useUser } from '../../context/AppContext';
import { AREAS, PROVIDERS, TRADES, providerById } from '../../data/catalog';
import { api } from '../../api';
import { errorMessage } from '../../api/errors';
import { useApiQuery } from '../../api/useApiQuery';
import { imageToDataUrl } from '../../lib/image';
import { score } from '../../lib/search';
import { cedi, fmtDate } from '../../lib/format';
import { centreEnquiries } from '../../lib/enquiries';
import { sellerIdFor } from '../../lib/orders';
import { PageTitle } from '../../components/DashboardLayout';
import { Drawer, Empty, ErrorState, Img, Loading, Modal, Skeleton, Stat, StatusBadge, Switch, TradeTag, VerifyBadges, inertRef } from '../../components/ui';
import { ProviderCard } from '../../components/ProviderCard';
import { BarChart } from '../../components/BarChart';
import { LatestOrders, useSellerOrders } from './SellerOrders';
import type { CentreStats, Enquiry, FieldEvent, InboxStatus, Period, Provider, TrainerProgramme } from '../../types';

/** The signed-in trainer's centre enquiries. */
function useCentreEnquiries(): Enquiry[] {
  const { enquiries } = useApp();
  const providerId = sellerIdFor(useUser());
  return useMemo(() => centreEnquiries(enquiries, providerId), [enquiries, providerId]);
}

/** Form state for the programme drawer; numeric fields stay strings while editing. */
type ProgrammeForm = Omit<TrainerProgramme, 'id' | 'fee' | 'months' | 'places'> & { id?: string; fee: string; months: string; places: string };

const toForm = (p: TrainerProgramme): ProgrammeForm => ({ ...p, fee: String(p.fee), months: String(p.months), places: String(p.places) });
const fromForm = (p: ProgrammeForm, id: string): TrainerProgramme => ({ ...p, id, fee: Number(p.fee), months: Number(p.months), places: Number(p.places) || 0 });

const INBOX_STATUSES: InboxStatus[] = ['New', 'Replied', 'Enrolled', 'Closed'];

/** The signed-in trainer's centre, as listed in the catalog. */
function useCentre() {
  const id = sellerIdFor(useUser());
  return providerById(id) ?? PROVIDERS[0];
}


/** Percent change from the previous period; nothing to compare against gives no trend. */
const change = ({ current, previous }: { current: number | null; previous: number | null }) =>
  current != null && previous ? Math.round(((current - previous) / previous) * 100) : undefined;

const fmtHours = (h: number | null) => (h == null ? '—' : h < 1 ? `${Math.max(1, Math.round(h * 60))}m` : h < 48 ? `${h.toFixed(1)}h` : `${(h / 24).toFixed(1)}d`);

/** What a complete public profile has, checked against the centre's listing. */
const profileChecks = (c: Provider): [label: string, done: boolean][] => [
  ['Centre name & description', c.name.trim().length > 0 && c.about.trim().length >= 80],
  ['Phone & street address', !!c.phone && !!c.address],
  ['At least 3 photos', c.images.length >= 3],
  ['Programmes with intake dates', c.programmes.length > 0 && c.programmes.every((p) => !!p.intake)],
  ['CTVET certificate', c.ctvet],
  ['Email & opening hours', !!c.email && !!c.hours],
];

/** Chart labels: the month on the first bar and wherever it changes, otherwise the day. */
function weekLabels(weeks: CentreStats['weekly']) {
  return weeks.map((w, i) => {
    const d = new Date(w.week);
    const monthChanged = i === 0 || new Date(weeks[i - 1].week).getUTCMonth() !== d.getUTCMonth();
    return monthChanged ? fmtDate(w.week, { day: 'numeric', month: 'short' }) : String(d.getUTCDate());
  });
}

const greeting = (h = new Date().getHours()) => (h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');

export function TrainerOverview() {
  const user = useUser();
  const { enquiries } = useApp();
  const newOrders = useSellerOrders().list.filter((so) => so.status === 'New').length;
  const c = useCentre();
  const inbox = useCentreEnquiries();
  const newCount = inbox.filter((e) => e.inboxStatus === 'New').length;
  // Reloads when the inbox changes, e.g. after a reply or marking someone enrolled.
  const q = useApiQuery(() => api.centre.stats(), [enquiries]);
  const s = q.data;
  // A placeholder bar while loading; a dash only if the numbers couldn't be loaded.
  const pending = q.loading && !s ? <Skeleton w={64} h={26} /> : '—';
  const num = (p: Period | undefined) => (p ? p.current.toLocaleString('en-GH') : pending);
  const completeness = profileChecks(c);
  const pct = Math.round((completeness.filter((x) => x[1]).length / completeness.length) * 100);
  const todayIso = new Date().toISOString().slice(0, 10);
  const upcoming = c.programmes.filter((p) => p.intake >= todayIso).sort((a, b) => a.intake.localeCompare(b.intake));

  // Views run in the hundreds and enquiries in single figures, so views are scaled down to share the axis.
  const weekly = s?.weekly ?? [];
  const maxViews = Math.max(0, ...weekly.map((w) => w.views));
  const maxEnq = Math.max(1, ...weekly.map((w) => w.enquiries));
  const scale = maxViews > maxEnq ? 10 ** Math.ceil(Math.log10(maxViews / maxEnq)) : 1;

  return (
    <>
      <PageTitle title={`${greeting()}, ${user.name.split(' ')[0]}`} sub={`Here’s how ${c.name} has done over the last 30 days.`}>
        <Link to={`/providers/${c.id}`} className="btn btn-secondary"><Eye size={16} /> View public page</Link>
        <Link to="/trainer/programmes" className="btn btn-primary"><Plus size={16} /> New programme</Link>
      </PageTitle>

      {newCount > 0 && (
        <div className="notice info mb-6" style={{ alignItems: 'center' }}>
          <MessageCircle size={18} />
          <div className="grow">You have <b>{newCount} new enquiries</b> waiting. Centres that reply within 24 hours enrol 2× more trainees.</div>
          <Link to="/trainer/enquiries" className="btn btn-primary btn-sm">Reply now</Link>
        </div>
      )}
      {newOrders > 0 && (
        <div className="notice success mb-6" style={{ alignItems: 'center' }}>
          <CheckCircle2 size={18} />
          <div className="grow">You have <b>{newOrders} new order{newOrders === 1 ? '' : 's'}</b> to confirm. Buyers expect a call within one working day.</div>
          <Link to="/trainer/orders" className="btn btn-success btn-sm">View orders</Link>
        </div>
      )}

      {q.error != null && !s && <ErrorState error={q.error} onRetry={q.reload} />}
      <div className="stats">
        <Stat icon="Eye" tone="brand" label="Profile views (30 days)" value={num(s?.views)} trend={s && change(s.views)} />
        <Stat icon="Inbox" tone="violet" label="Enquiries (30 days)" value={num(s?.enquiries)} trend={s && change(s.enquiries)} />
        <Stat icon="UserCheck" tone="success" label="Enrolled from enquiries (30 days)" value={num(s?.enrolled)} trend={s && change(s.enrolled)} />
        <Stat icon="Timer" tone="accent" label="Avg. reply time (30 days)" value={s ? fmtHours(s.replyHours.current) : pending} trend={s && change(s.replyHours)} lowerIsBetter />
      </div>

      <div className="grid-3-1 mt-6">
        <div className="card">
          <div className="card-head">
            <div><h3>Enquiries & views</h3><div className="xs muted">Last 8 weeks</div></div>
            <div className="row small" style={{ gap: 14 }}><span className="row" style={{ gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: '#d4c3fb' }} /> Views{scale > 1 && ` ÷${scale}`}</span><span className="row" style={{ gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: '#7c3aed' }} /> Enquiries</span></div>
          </div>
          <div className="card-body">
            {!s ? <Loading rows={2} label="Loading chart" />
              : weekly.every((w) => w.views === 0 && w.enquiries === 0)
                ? <Empty icon="Eye" title="No visits or enquiries yet" text="Share your public page so trainees can find you. Weekly numbers appear here as they come in." action={<Link to={`/providers/${c.id}`} className="btn btn-soft btn-sm">View public page</Link>} />
                : <BarChart data={weekly.map((w) => w.enquiries)} alt={weekly.map((w) => Math.round(w.views / scale))} labels={weekLabels(weekly)} />}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h3>Profile strength</h3><span className="bold" style={{ color: 'var(--brand)' }}>{pct}%</span></div>
          <div className="card-body">
            <div className="progress"><div style={{ width: `${pct}%` }} /></div>
            <div className="stack-sm mt-4" style={{ gap: 10 }}>
              {completeness.map(([t, ok]) => (
                <div key={t} className="row small" style={{ gap: 10, color: ok ? 'var(--ink-2)' : 'var(--muted)' }}>
                  {ok ? <CheckCircle2 size={17} color="var(--success-500)" /> : <CircleDashed size={17} />} {t}
                </div>
              ))}
            </div>
            <Link to="/trainer/centre" className="btn btn-soft btn-sm btn-block mt-4">Complete profile</Link>
          </div>
        </div>
      </div>

      <div className="mt-6"><LatestOrders /></div>

      <div className="grid-2 mt-6">
        <div className="card">
          <div className="card-head"><h3>Latest enquiries</h3><Link to="/trainer/enquiries" className="small bold">Open inbox</Link></div>
          {inbox.length === 0 && <Empty icon="Inbox" title="No enquiries yet" text="New enquiries from trainees will appear here." />}
          {inbox.slice(0, 4).map((e) => (
            <Link to="/trainer/enquiries" key={e.id} className="li" style={{ color: 'inherit' }}>
              <span className="avatar">{e.trainee.split(' ').map((s) => s[0]).join('')}</span>
              <div className="grow" style={{ minWidth: 0 }}><div className="bold small">{e.trainee}</div><div className="xs muted ellipsis">{e.thread.at(-1)?.text}</div></div>
              <StatusBadge status={e.inboxStatus} />
            </Link>
          ))}
        </div>
        <div className="card">
          <div className="card-head"><h3>Upcoming intakes</h3><Link to="/trainer/programmes" className="small bold">Manage</Link></div>
          <div className="card-body stack">
            {upcoming.length === 0 && <div className="small muted">No upcoming intakes. Add a date to a programme so trainees can plan ahead.</div>}
            {upcoming.map((p) => {
              // Places listed are the ones still open; enrolled trainees from enquiries fill the rest.
              const filled = s?.enrolledByProgramme[p.name] ?? 0;
              const total = filled + p.places;
              return (
                <div key={p.id}>
                  <div className="row-between small"><span className="bold">{p.name}</span><span className="muted">{fmtDate(p.intake, { day: 'numeric', month: 'short' })}</span></div>
                  <div className="row mt-2" style={{ gap: 10 }}><div className="progress grow"><div style={{ width: `${total ? (filled / total) * 100 : 0}%` }} /></div><span className="xs bold">{filled}/{total}</span></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

const TEMPLATES = [
  'Thank you for your interest! Yes, the intake is still open. Please visit us any weekday between 9am and 3pm.',
  'You can pay in two instalments: half at registration and half after the first month.',
  'Please bring a valid ID card and GH₵100 registration fee on your first day.',
];

export function TrainerEnquiries() {
  const { replyToEnquiry, setInboxStatus, markEnquiryRead, toast } = useApp();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') || '';
  const all = useCentreEnquiries();
  const items = useMemo(() => all.filter((e) => score(query, [[e.trainee, 3], [e.phone.replace(/\s/g, ''), 2], [e.phone, 2], [e.programme, 1.5], [e.thread.map((m) => m.text).join(' '), 1]]) > 0), [all, query]);
  const [filter, setFilter] = useState<'All' | InboxStatus>('All');
  const [sel, setSel] = useState<string | undefined>(items[0]?.id);
  const [draft, setDraft] = useState('');
  const list = items.filter((e) => filter === 'All' || e.inboxStatus === filter);
  const cur = items.find((e) => e.id === sel);

  // Opening a conversation marks it read for everyone at the centre.
  useEffect(() => { if (sel) markEnquiryRead(sel); }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async (e?: SyntheticEvent) => {
    e?.preventDefault();
    if (!draft.trim() || !cur) return;
    const text = draft;
    setDraft('');
    if (!(await replyToEnquiry(cur.id, text))) { setDraft(text); return; }
    const first = cur.trainee.split(' ')[0];
    toast(cur.userId ? `Reply sent — ${first} will see it in their Fliptech inbox` : `Reply sent to ${cur.trainee} by SMS`);
  };
  const counts = (st: 'All' | InboxStatus) => items.filter((e) => st === 'All' || e.inboxStatus === st).length;

  return (
    <>
      <PageTitle title="Enquiries" sub="Reply quickly — trainees are often comparing several centres." />
      {query && (
        <div className="active-filters mb-4" style={{ marginTop: 0 }}>
          <span className="small muted bold">{items.length} enquir{items.length === 1 ? 'y' : 'ies'} matching</span>
          <span className="chip">“{query}”<button type="button" onClick={() => setParams({}, { replace: true })} aria-label={`Clear search “${query}”`}><X size={14} /></button></span>
        </div>
      )}
      <div className="card inbox" style={{ overflow: 'hidden' }}>
        <div className="inbox-list">
          <div className="toolbar" style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
            <div className="tabs" style={{ border: 0 }}>
              {(['All', ...INBOX_STATUSES] as const).map((f) => <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)} style={{ padding: '6px 8px' }}>{f} <span className="count">{counts(f)}</span></button>)}
            </div>
          </div>
          {list.length === 0 && (query && all.length > 0
            ? <Empty icon="SearchX" title="No matching enquiries" text="Try a name, phone number or programme." />
            : items.length === 0
            ? <Empty icon="Inbox" title="No enquiries yet" text="When trainees ask about your programmes, their messages appear here." />
            : <Empty icon="Inbox" title={`No ${filter.toLowerCase()} enquiries`} text="Nothing in this stage right now." />)}
          {list.map((e) => (
            <div key={e.id} className={`inbox-item ${sel === e.id ? 'on' : ''} ${e.centreUnread ? 'unread' : ''}`} onClick={() => setSel(e.id)}>
              <div className="row-between"><strong className="small">{e.trainee}</strong><span className="xs muted">{fmtDate(e.date, { day: 'numeric', month: 'short' })}</span></div>
              <div className="xs muted ellipsis">{e.programme}</div>
              <div className="row-between mt-1"><span className="xs muted ellipsis" style={{ maxWidth: 210 }}>{e.thread.at(-1)?.from === 'trainer' ? 'You: ' : ''}{e.thread.at(-1)?.text}</span><StatusBadge status={e.inboxStatus} /></div>
            </div>
          ))}
        </div>
        {cur && (
          <div className="thread">
            <div className="card-head wrap">
              <div className="row">
                <span className="avatar">{cur.trainee.split(' ').map((w) => w[0]).join('')}</span>
                <div><div className="bold">{cur.trainee}</div><div className="xs muted">{cur.phone} · {cur.programme}{!cur.userId && ' · Guest'}</div></div>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <select className="select" style={{ height: 34, width: 140, fontSize: 13 }} value={cur.inboxStatus} onChange={(e) => { const status = e.target.value as InboxStatus; setInboxStatus(cur.id, status); toast(`Marked as ${status}`); }} aria-label="Status">
                  {INBOX_STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
                <a href={`tel:${cur.phone.replace(/\s/g, '')}`} className="btn btn-secondary btn-sm"><Phone size={15} /> Call</a>
                <a href={`https://wa.me/233${cur.phone.replace(/\s/g, '').slice(1)}`} target="_blank" rel="noreferrer" className="btn btn-success btn-sm"><MessageCircle size={15} /> WhatsApp</a>
              </div>
            </div>
            <div className="thread-body">
              {cur.thread.map((m, i: number) => (
                <div key={i} className={`bubble ${m.from === 'trainer' ? 'me' : 'them'}`}>{m.text}<time>{m.from === 'trainer' ? 'You' : cur.trainee.split(' ')[0]} · {m.at}</time></div>
              ))}
            </div>
            <div style={{ padding: '10px 14px 0', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {TEMPLATES.map((t, i) => <button key={i} className="chip" style={{ cursor: 'pointer', height: 28, fontSize: 12 }} onClick={() => setDraft(t)}>{['Intake open', 'Instalments', 'What to bring'][i]}</button>)}
            </div>
            <form className="composer" onSubmit={send}>
              <textarea className="textarea grow" placeholder={cur.userId ? `Reply to ${cur.trainee.split(' ')[0]}… (they’ll be notified in Fliptech)` : `Reply to ${cur.trainee.split(' ')[0]}… (sent by SMS — guest enquiry)`} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) send(e); }} aria-label="Reply" />
              <button className="btn btn-primary" aria-label="Send"><Send size={16} /> Send</button>
            </form>
          </div>
        )}
        {!cur && (
          <div className="thread" style={{ display: 'grid', placeItems: 'center' }}>
            {items.length === 0
              ? <Empty icon="MessagesSquare" title="Your conversations will show here" text="A complete profile with photos and intake dates gets more enquiries." action={<Link to="/trainer/centre" className="btn btn-soft btn-sm">Improve your profile</Link>} />
              : <Empty icon="MessagesSquare" title="Choose a conversation" text="Select an enquiry on the left to read and reply." />}
          </div>
        )}
      </div>
    </>
  );
}

const blankProg: ProgrammeForm = { name: '', trade: 'welding', type: 'Certificate', fee: '', months: '', days: 'Mon – Fri', time: '8:00am – 4:00pm', intake: '', places: '', published: true };

export function TrainerProgrammes() {
  const { toast, reloadCatalog } = useApp();
  const q = useApiQuery(() => api.centre.programmes(), []);
  const items = q.data ?? [];
  const [edit, setEdit] = useState<ProgrammeForm | null>(null);
  const [confirm, setConfirm] = useState<TrainerProgramme | null>(null);
  const [busy, setBusy] = useState(false);

  /** Saves on the server, then updates the table and the public listing. Returns false if it failed. */
  const persist = async (p: TrainerProgramme, ok: string) => {
    setBusy(true);
    try {
      const saved = await api.centre.saveProgramme(p);
      q.setData((xs = []) => (xs.some((x) => x.id === saved.id) ? xs.map((x) => (x.id === saved.id ? saved : x)) : [...xs, saved]));
      toast(ok);
      void reloadCatalog();
      return true;
    } catch (x) {
      toast(errorMessage(x), 'error');
      return false;
    } finally {
      setBusy(false);
    }
  };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!edit || busy) return;
    if (!edit.name || !(Number(edit.fee) > 0) || !(Number(edit.months) > 0)) return toast('Please fill in name, fee and duration', 'error');
    // An empty id asks the server to create one.
    if (await persist(fromForm(edit, edit.id ?? ''), edit.id ? 'Programme updated' : 'Programme created')) setEdit(null);
  };
  const remove = async (p: TrainerProgramme) => {
    setBusy(true);
    try {
      await api.centre.deleteProgramme(p.id);
      q.setData((xs = []) => xs.filter((x) => x.id !== p.id));
      toast('Programme deleted');
      void reloadCatalog();
    } catch (x) {
      toast(errorMessage(x), 'error');
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };
  const set = (k: keyof ProgrammeForm) => (e: FieldEvent) => setEdit((x) => (x ? { ...x, [k]: e.target.value } : x));

  return (
    <>
      <PageTitle title="Programmes" sub="What you offer, how much it costs, and when the next intake starts.">
        <button className="btn btn-primary" onClick={() => setEdit({ ...blankProg })}><Plus size={16} /> New programme</button>
      </PageTitle>
      <div className="card">
        {q.error && !q.data ? <ErrorState error={q.error} onRetry={() => void q.reload()} />
        : q.loading && !q.data ? <Loading label="Loading programmes" />
        : items.length === 0 ? <Empty icon="BookOpen" title="No programmes yet" text="Add your first programme so trainees can see what you offer." />
        : <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Programme</th><th>Fee</th><th>Duration</th><th>Schedule</th><th>Next intake</th><th>Places</th><th>Published</th><th /></tr></thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td><div className="bold">{p.name}</div><div className="row mt-1" style={{ gap: 6 }}><TradeTag trade={p.trade} /><span className="badge">{p.type}</span></div></td>
                  <td className="price">{cedi(p.fee)}</td>
                  <td>{p.months} mo</td>
                  <td className="small">{p.days}<div className="xs muted">{p.time}</div></td>
                  <td>{p.intake ? fmtDate(p.intake) : '—'}</td>
                  <td><span className={`badge ${Number(p.places) < 10 ? 'badge-warn' : 'badge-success'}`}>{p.places}</span></td>
                  <td><Switch checked={p.published} onChange={(v) => void persist({ ...p, published: v }, v ? 'Programme published' : 'Programme hidden')} label="Published" /></td>
                  <td>
                    <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEdit(toForm(p))} aria-label="Edit"><Pencil size={16} /></button>
                      <button className="btn btn-ghost btn-icon btn-sm" disabled={busy} onClick={() => void persist({ ...p, id: '', name: p.name + ' (copy)', published: false }, 'Programme duplicated')} aria-label="Duplicate"><Copy size={16} /></button>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setConfirm(p)} aria-label="Delete"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
      </div>

      <Drawer open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit programme' : 'New programme'} footer={<><button className="btn btn-secondary" onClick={() => setEdit(null)}>Cancel</button><button className="btn btn-primary" form="progform" disabled={busy}>{busy ? <><span className="spinner" /> Saving…</> : 'Save programme'}</button></>}>
        {edit && (
          <form id="progform" className="form-grid" onSubmit={(e) => void save(e)}>
            <div className="field span-2"><label className="label" htmlFor="tr-programme-name">Programme name <span className="req">*</span></label><input id="tr-programme-name" className="input" value={edit.name} onChange={set('name')} placeholder="e.g. Welding – Certificate Programme" /></div>
            <div className="field"><label className="label" htmlFor="tr-trade">Trade</label><select id="tr-trade" className="select" value={edit.trade} onChange={set('trade')}>{TRADES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
            <div className="field"><label className="label" htmlFor="tr-programme-type">Programme type</label><select id="tr-programme-type" className="select" value={edit.type} onChange={set('type')}>{['Certificate', 'Advanced Certificate', 'Short course', 'Apprenticeship'].map((t) => <option key={t}>{t}</option>)}</select></div>
            <div className="field"><label className="label" htmlFor="tr-fee-gh">Fee (GH₵) <span className="req">*</span></label><input id="tr-fee-gh" className="input" type="number" value={edit.fee} onChange={set('fee')} /></div>
            <div className="field"><label className="label" htmlFor="tr-duration-months">Duration (months) <span className="req">*</span></label><input id="tr-duration-months" className="input" type="number" value={edit.months} onChange={set('months')} /></div>
            <div className="field"><label className="label" htmlFor="tr-training-days">Training days</label><select id="tr-training-days" className="select" value={edit.days} onChange={set('days')}>{['Mon – Fri', 'Mon – Sat', 'Sat – Sun', 'Sat', 'Evenings'].map((d) => <option key={d}>{d}</option>)}</select></div>
            <div className="field"><label className="label" htmlFor="tr-training-time">Training time</label><input id="tr-training-time" className="input" value={edit.time} onChange={set('time')} /></div>
            <div className="field"><label className="label" htmlFor="tr-next-intake">Next intake</label><input id="tr-next-intake" className="input" type="date" value={edit.intake} onChange={set('intake')} /></div>
            <div className="field"><label className="label" htmlFor="tr-places-available">Places available</label><input id="tr-places-available" className="input" type="number" value={edit.places} onChange={set('places')} /></div>
            <div className="field span-2"><label className="label" htmlFor="tr-what-trainees-will-learn">What trainees will learn</label><textarea id="tr-what-trainees-will-learn" className="textarea" placeholder="e.g. Arc welding, MIG welding, reading drawings, workshop safety…" /></div>
            <label className="check span-2"><input type="checkbox" checked={edit.published} onChange={(e) => { const published = e.target.checked; setEdit((x) => (x ? { ...x, published } : x)); }} /> Publish on my public page</label>
          </form>
        )}
      </Drawer>

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title="Delete programme?" footer={<><button className="btn btn-secondary" onClick={() => setConfirm(null)}>Cancel</button><button className="btn btn-danger" disabled={busy} onClick={() => { if (confirm) void remove(confirm); }}>{busy ? <><span className="spinner" /> Deleting…</> : 'Delete'}</button></>}>
        <p className="muted">“{confirm?.name}” will be removed from your public page. Existing enquiries will be kept.</p>
      </Modal>
    </>
  );
}

export function TrainerCentre() {
  const { toast, reloadCatalog } = useApp();
  const c = useCentre();
  const initial = () => ({ name: c.name, about: c.about, phone: c.phone, email: c.email ?? '', area: c.area, address: c.address ?? '', hours: c.hours, payment: c.payment });
  const [f, setF] = useState(initial);
  const [photos, setPhotos] = useState(c.images);
  const [saving, setSaving] = useState(false);
  const discard = () => { setF(initial()); setPhotos(c.images); };
  // Resized to small JPEGs so they survive a reload; a real backend would take the files and return URLs.
  const addPhotos = async (files: File[]) => {
    for (const file of files) {
      try {
        const url = await imageToDataUrl(file);
        setPhotos((p) => [...p, url]);
      } catch (x) {
        toast(errorMessage(x), 'error');
      }
    }
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.centre.updateProfile({ ...f, images: photos });
      await reloadCatalog();
      toast('Centre profile saved');
    } catch (x) {
      toast(errorMessage(x), 'error');
    } finally {
      setSaving(false);
    }
  };
  const set = (k: keyof typeof f) => (e: FieldEvent) => setF((x) => ({ ...x, [k]: e.target.value }));
  const preview = useMemo(() => ({ ...c, name: f.name, area: f.area, images: photos }), [c, f.name, f.area, photos]);

  return (
    <>
      <PageTitle title="Centre profile" sub="This is what trainees see on your public page.">
        <Link to={`/providers/${c.id}`} className="btn btn-secondary"><ExternalLink size={16} /> View public page</Link>
      </PageTitle>
      <div className="grid-3-1" style={{ alignItems: 'start' }}>
        <form className="stack" style={{ gap: 20 }} onSubmit={(e) => void submit(e)}>
          <div className="card">
            <div className="card-head"><h3>Basic details</h3></div>
            <div className="card-body form-grid">
              <div className="field span-2"><label className="label" htmlFor="tr-centre-name">Centre name</label><input id="tr-centre-name" className="input" value={f.name} onChange={set('name')} /></div>
              <div className="field span-2"><label className="label" htmlFor="tr-about-your-centre">About your centre</label><textarea id="tr-about-your-centre" className="textarea" rows={5} value={f.about} onChange={set('about')} /></div>
              <div className="field"><label className="label" htmlFor="tr-phone-number">Phone number</label><input id="tr-phone-number" className="input" value={f.phone} onChange={set('phone')} /></div>
              <div className="field"><label className="label" htmlFor="tr-email">Email</label><input id="tr-email" className="input" value={f.email} onChange={set('email')} /></div>
              <div className="field"><label className="label" htmlFor="tr-area">Area</label><select id="tr-area" className="select" value={f.area} onChange={set('area')}>{AREAS.map((a) => <option key={a}>{a}</option>)}</select></div>
              <div className="field"><label className="label" htmlFor="tr-opening-hours">Opening hours</label><input id="tr-opening-hours" className="input" value={f.hours} onChange={set('hours')} /></div>
              <div className="field span-2"><label className="label" htmlFor="tr-address-landmark">Address / landmark</label><div className="input-icon"><MapPin size={17} /><input id="tr-address-landmark" className="input" value={f.address} onChange={set('address')} /></div></div>
              <div className="field span-2"><label className="label" htmlFor="tr-payment-options">Payment options</label><input id="tr-payment-options" className="input" value={f.payment} onChange={set('payment')} /></div>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h3>Photos</h3><span className="xs muted">{photos.length} photos · first photo is your cover</span></div>
            <div className="card-body">
              <div className="pgrid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 10 }}>
                {photos.map((src, i) => (
                  <div key={i} style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', aspectRatio: '1' }}>
                    <Img src={src} alt="" trade="welding" sizes="240px" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    {i === 0 && <span className="badge badge-dark" style={{ position: 'absolute', left: 6, top: 6 }}>Cover</span>}
                    <button type="button" className="save-btn" style={{ position: 'absolute', right: 6, top: 6, width: 30, height: 30 }} onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))} aria-label="Remove photo"><Trash2 size={14} /></button>
                  </div>
                ))}
                <label className="dropzone" style={{ aspectRatio: '1', display: 'grid', placeItems: 'center', padding: 8 }}>
                  <input type="file" accept="image/*" multiple hidden onChange={(e) => { const files = [...(e.target.files ?? [])]; e.target.value = ''; void addPhotos(files); }} />
                  <div><ImageIcon size={22} color="var(--brand)" style={{ margin: '0 auto' }} /><div className="xs bold mt-1">Add photo</div></div>
                </label>
              </div>
            </div>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn btn-secondary" onClick={discard} disabled={saving}>Discard</button><button className="btn btn-primary" disabled={saving}>{saving ? <><span className="spinner" /> Saving…</> : 'Save changes'}</button></div>
        </form>
        <div className="sticky-card">
          <div className="xs bold muted mb-2" style={{ textTransform: 'uppercase', letterSpacing: '.08em' }}>Live preview</div>
          <div ref={inertRef}><ProviderCard p={preview} /></div>
        </div>
      </div>
    </>
  );
}

export function TrainerVerification() {
  const { toast } = useApp();
  const c = useCentre();
  const [visit, setVisit] = useState(false);
  const [req, setReq] = useState<{ date: string; slot: 'morning' | 'afternoon'; notes: string }>({ date: '', slot: 'morning', notes: '' });
  const [sending, setSending] = useState(false);
  const requestVisit = async () => {
    if (!req.date) return toast('Choose a preferred date', 'error');
    setSending(true);
    try {
      await api.centre.requestVisit({ date: req.date, slot: req.slot, notes: req.notes.trim() || undefined });
      setVisit(false);
      setReq({ date: '', slot: 'morning', notes: '' });
      toast('Visit requested — we’ll call you to confirm');
    } catch (x) {
      toast(errorMessage(x), 'error');
    } finally {
      setSending(false);
    }
  };
  const docs: [title: string, status: string, file: string | null][] = [
    ['Business registration certificate', 'Approved', 'Registrar-General_cert.pdf'],
    ['CTVET certificate', 'Approved', 'CTVET_GAR_2019_0421.pdf'],
    ['Instructor CVs', 'Missing', null],
    ['Workshop safety policy', 'Under review', 'safety_policy_v2.pdf'],
  ];
  return (
    <>
      <PageTitle title="Verification" sub="Badges help trainees trust your centre. Verified centres receive up to 3× more enquiries." />
      <div className="card card-pad" style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="grow"><h3>Your badges</h3><div className="row wrap mt-3" style={{ gap: 8 }}><VerifyBadges p={c} /></div></div>
        <div className="notice success"><CheckCircle2 size={18} /><div>Next re-verification due <b>April 2027</b></div></div>
      </div>
      <div className="grid-2 mt-6">
        <div className="card">
          <div className="card-head"><h3>Verification steps</h3></div>
          <div className="card-body timeline">
            {([[true, 'Account created', '2 Nov 2025'], [true, 'Business details confirmed', '5 Nov 2025'], [true, 'CTVET registration confirmed', '12 Nov 2025'], [true, 'Fliptech site visit', 'Completed Apr 2026 by Kojo A.'], [false, 'Instructor profiles', 'Upload CVs to add instructor badges']] as [boolean, string, string][]).map(([ok, t, d]) => (
              <div key={t} className="timeline-item">
                <div className="timeline-dot" style={ok ? undefined : { background: 'var(--line-2)', color: 'var(--muted)' }}>{ok ? <CheckCircle2 /> : <CircleDashed />}</div>
                <div><div className="bold small">{t}</div><div className="xs muted">{d}</div></div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h3>Documents</h3></div>
          <div>
            {docs.map(([t, s, file]) => (
              <div key={t} className="li">
                <div className="file-ico"><FileText size={18} /></div>
                <div className="grow" style={{ minWidth: 0 }}><div className="bold small">{t}</div><div className="xs muted ellipsis">{file || 'Not uploaded'}</div></div>
                {s === 'Missing' ? <label className="btn btn-soft btn-sm"><UploadCloud size={15} /> Upload<input type="file" hidden onChange={() => toast('Document uploaded for review')} /></label> : <StatusBadge status={s} />}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="cta-band mt-6" style={{ gridTemplateColumns: '1fr auto', padding: 32 }}>
        <div><h3 style={{ color: '#fff' }}>Changed location or added new equipment?</h3><p>Book a free follow-up visit and keep your Fliptech badge up to date.</p></div>
        <button className="btn btn-white btn-lg" onClick={() => setVisit(true)}><CalendarDays size={17} /> Book a visit</button>
      </div>
      <Modal open={visit} onClose={() => setVisit(false)} title="Book a Fliptech site visit" footer={<><button className="btn btn-secondary" onClick={() => setVisit(false)}>Cancel</button><button className="btn btn-primary" disabled={sending} onClick={() => void requestVisit()}>{sending ? <><span className="spinner" /> Sending…</> : 'Request visit'}</button></>}>
        <div className="form-grid">
          <div className="field"><label className="label" htmlFor="tr-preferred-date">Preferred date</label><input id="tr-preferred-date" className="input" type="date" min={new Date().toISOString().slice(0, 10)} value={req.date} onChange={(e) => setReq((r) => ({ ...r, date: e.target.value }))} /></div>
          <div className="field"><label className="label" htmlFor="tr-time">Time</label><select id="tr-time" className="select" value={req.slot} onChange={(e) => setReq((r) => ({ ...r, slot: e.target.value as 'morning' | 'afternoon' }))}><option value="morning">Morning (9am – 12pm)</option><option value="afternoon">Afternoon (12pm – 3pm)</option></select></div>
          <div className="field span-2"><label className="label" htmlFor="tr-notes-for-our-team">Notes for our team</label><textarea id="tr-notes-for-our-team" className="textarea" placeholder="e.g. We moved to a bigger workshop next to the old one." value={req.notes} onChange={(e) => setReq((r) => ({ ...r, notes: e.target.value }))} /></div>
        </div>
        <div className="notice info mt-4"><Info size={18} /><div>Visits are free and take about 45 minutes.</div></div>
      </Modal>
    </>
  );
}

