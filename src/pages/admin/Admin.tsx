import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Download, Search, CheckCircle2, XCircle, CalendarDays, FileText, MapPin, MoreHorizontal, ShieldCheck, Ban, UserCheck,
  Plus, Pencil, Trash2, Flag, Eye, ExternalLink, Info, Send, BadgeCheck,
} from 'lucide-react';
import { useApp, useUser } from '../../context/AppContext';
import { ACCESS_LABEL, canAdmin } from '../../lib/access';
import { AREAS, PROVIDERS, TRADES, providerById, tradeById } from '../../data/catalog';
import { cedi, fmtDate, initials } from '../../lib/format';
import { downloadCsv } from '../../lib/csv';
import { score } from '../../lib/search';
import { api } from '../../api';
import { errorMessage, fieldErrors } from '../../api/errors';
import { useApiQuery, type Query } from '../../api/useApiQuery';
import type { InviteAdminInput, ProviderModerationPatch } from '../../api/contract';
import { PageTitle } from '../../components/DashboardLayout';
import { Drawer, Empty, ErrorState, Icon, Img, Loading, Modal, Stat, StatusBadge, Switch, TradeTag, rowAction, SIZES } from '../../components/ui';
import { BarChart } from '../../components/BarChart';
import { RecentPlatformOrders } from './AdminOrders';
import { NotificationPrefsCard } from '../../components/NotificationPrefs';
import type { AdminAccess, AdminProvider, AdminStats, AdminUser, FieldEvent, PlatformSettings, QueueItem, QueueStatus, Role, Trade } from '../../types';
import { resized } from '../../assets/images';

interface DonutPart { label: string; value: number; color: string }

/** Admins can create trades beyond the built-in set, so ids are free-form here. */
type EditableTrade = Omit<Trade, 'id'> & { id: string };

/**
 * Runs admin actions against the API. `run` shows a toast on success or failure, and remembers
 * which action is in flight (by key) so its button can show a spinner.
 */
function useAction() {
  const { toast } = useApp();
  const [pending, setPending] = useState<string | null>(null);
  const run = useCallback(async (key: string, call: () => Promise<unknown>, ok?: string) => {
    setPending(key);
    try {
      await call();
      if (ok) toast(ok);
      return true;
    } catch (e) {
      toast(errorMessage(e), 'error');
      return false;
    } finally {
      setPending(null);
    }
  }, [toast]);
  return { run, pending, busy: pending !== null };
}

/** Label for a button whose action may be in flight. */
const spin = (on: boolean, label: ReactNode, busyLabel = 'Saving…') => (on ? <><span className="spinner" /> {busyLabel}</> : label);

/** First-load states for a page-level query; renders `children` once data is available. */
function QueryState<T>({ q, label, children }: { q: Query<T>; label: string; children: (data: T) => ReactNode }) {
  if (q.data !== undefined) return <>{children(q.data)}</>;
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.reload()} />;
  return <Loading label={label} />;
}

/** Replace one row of a cached list. */
const replaceIn = <T extends { id: string }>(next: T) => (xs: T[] = []) => xs.map((x) => (x.id === next.id ? next : x));

function Donut({ parts, size = 150, stroke = 22 }: { parts: DonutPart[]; size?: number; stroke?: number }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Enquiries by trade">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line-2)" strokeWidth={stroke} />
      {parts.map((p) => {
        const len = (p.value / total) * C;
        const el = <circle key={p.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth={stroke} strokeDasharray={`${len - 2} ${C - len + 2}`} strokeDashoffset={-offset} transform={`rotate(-90 ${size / 2} ${size / 2})`} />;
        offset += len;
        return el;
      })}
      <text x="50%" y="47%" textAnchor="middle" style={{ fontSize: 24, fontWeight: 800, fill: 'var(--ink)' }}>{total}</text>
      <text x="50%" y="61%" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--muted)' }}>enquiries</text>
    </svg>
  );
}

/** Stages still waiting on an admin. */
const OPEN_STAGES: QueueStatus[] = ['Pending', 'Visit scheduled', 'Needs info'];

const PERIODS: [months: number, label: string][] = [[3, 'Last 3 months'], [6, 'Last 6 months'], [12, 'Last 12 months']];

/** "2026-10" → "Oct" (or "Oct 26" when the range spans years). */
const monthLabel = (m: string, withYear: boolean) =>
  new Date(`${m}-01T00:00:00`).toLocaleDateString('en-GB', withYear ? { month: 'short', year: '2-digit' } : { month: 'short' });

/** Month-on-month change in percent, or undefined when there's nothing to compare with. */
function trendOf(series: number[]): number | undefined {
  const [prev, cur] = series.slice(-2);
  return prev ? Math.round(((cur - prev) / prev) * 100) : undefined;
}

function exportOverview(s: AdminStats) {
  const name = (id: string) => providerById(id)?.name ?? id;
  downloadCsv('overview', ['Section', 'Item', 'Value', 'Extra'], [
    ['Totals', 'Trainees', s.trainees, ''], ['Totals', 'Training centre accounts', s.trainers, ''], ['Totals', 'Admins', s.admins, ''],
    ['Totals', 'Listed providers', s.providers, ''], ['Totals', 'Enquiries', s.enquiries, ''],
    ...s.monthly.map((m) => ['Monthly', m.month, m.signups, `${m.enquiries} enquiries`]),
    ...s.enquiriesByTrade.map((t) => ['Enquiries by trade', tradeById(t.trade)?.name ?? t.trade, t.count, '']),
    ...s.topProviders.map((p) => ['Top providers', name(p.providerId), p.enquiries, `${Math.round(p.replyRate * 100)}% replied`]),
  ]);
}

export function AdminOverview() {
  const { toast } = useApp();
  const access = useUser().access;
  const canVerify = canAdmin(access, 'verification');
  const canOrders = canAdmin(access, 'orders');
  const [months, setMonths] = useState(6);
  const stats = useApiQuery(() => api.admin.stats(months), [months]);
  const queue = useApiQuery(() => (canVerify ? api.admin.verificationQueue() : Promise.resolve([])), [canVerify]);
  const activity = useApiQuery(() => api.admin.activity(), []);
  const open = (queue.data ?? []).filter((q) => OPEN_STAGES.includes(q.status));
  const s = stats.data;
  const fmt = (n: number | undefined) => (n === undefined ? '…' : n.toLocaleString('en-GB'));
  const spansYears = !!s && s.monthly[0]?.month.slice(0, 4) !== s.monthly.at(-1)?.month.slice(0, 4);
  const donut: DonutPart[] = (s?.enquiriesByTrade ?? []).slice(0, 6).map((t) => {
    const trade = tradeById(t.trade);
    return { label: trade?.name ?? t.trade, value: t.count, color: trade?.color ?? 'var(--muted)' };
  });

  return (
    <>
      <PageTitle title="Platform overview" sub={`Fliptech Skills Hub · Greater Accra · ${PERIODS.find(([m]) => m === months)?.[1]}`}>
        <select className="select" style={{ width: 170, height: 40 }} aria-label="Period" value={months} onChange={(e) => setMonths(Number(e.target.value))}>
          {PERIODS.map(([m, l]) => <option key={m} value={m}>{l}</option>)}
        </select>
        <button className="btn btn-secondary" disabled={!s} onClick={() => { if (s) { exportOverview(s); toast('Overview exported'); } }}><Download size={16} /> Export</button>
      </PageTitle>
      <div className="stats">
        <Stat icon="Users" tone="brand" label="Registered trainees" value={fmt(s?.trainees)} trend={s && trendOf(s.monthly.map((m) => m.signups))} />
        <Stat icon="Building2" tone="violet" label="Listed providers" value={fmt(s?.providers)} />
        <Stat icon="Send" tone="success" label="Enquiries sent" value={fmt(s?.enquiries)} trend={s && trendOf(s.monthly.map((m) => m.enquiries))} />
        {canVerify && <Stat icon="ShieldAlert" tone="accent" label="Awaiting verification" value={queue.data ? open.length : '…'} />}
      </div>

      <div className="grid-3-1 mt-6">
        <div className="card">
          <div className="card-head"><div><h3>Growth</h3><div className="xs muted">New trainees (dark) vs enquiries (light) per month</div></div></div>
          <QueryState q={stats} label="Loading growth">
            {(d) => <div className="card-body"><BarChart data={d.monthly.map((m) => m.signups)} alt={d.monthly.map((m) => m.enquiries)} labels={d.monthly.map((m) => monthLabel(m.month, spansYears))} /></div>}
          </QueryState>
        </div>
        <div className="card">
          <div className="card-head"><h3>Enquiries by trade</h3></div>
          <QueryState q={stats} label="Loading enquiries by trade">
            {() => donut.length === 0 ? <Empty icon="Send" title="No enquiries yet" text="The split by trade appears once trainees start enquiring." /> : (
              <div className="card-body" style={{ display: 'grid', placeItems: 'center', gap: 18 }}>
                <Donut parts={donut} />
                <div className="donut-legend" style={{ width: '100%' }}>
                  {donut.map((p) => <div key={p.label}><i style={{ background: p.color }} /> <span className="grow">{p.label}</span><b>{p.value}</b></div>)}
                </div>
              </div>
            )}
          </QueryState>
        </div>
      </div>

      <div className={canVerify ? 'grid-3-1 mt-6' : 'mt-6'}>
        {canVerify && <div className="card">
          <div className="card-head"><h3>Verification queue</h3><Link to="/admin/verification" className="small bold">Review all</Link></div>
          <QueryState q={queue} label="Loading the verification queue">
            {() => open.length === 0
              ? <Empty icon="ShieldCheck" title="Queue is clear" text="No centres are waiting for review." />
              : open.slice(0, 4).map((q) => (
                <div key={q.id} className="li">
                  <img className="li-img" src={resized(q.img, 96)} alt="" loading="lazy" />
                  <div className="grow" style={{ minWidth: 0 }}><div className="bold small ellipsis">{q.name}</div><div className="xs muted">{q.area} · {tradeById(q.trade)?.name ?? q.trade} · {q.docs.length} documents</div></div>
                  <StatusBadge status={q.status} />
                </div>
              ))}
          </QueryState>
        </div>}
        <div className="card">
          <div className="card-head"><h3>Recent activity</h3></div>
          <QueryState q={activity} label="Loading activity">
            {(items) => items.length === 0 ? <Empty icon="Timer" title="No activity yet" /> : (
              <div className="card-body timeline">
                {items.slice(0, 8).map((a, i) => (
                  <div key={i} className="timeline-item">
                    <div className={`timeline-dot tone-${a.tone}`}><Icon name={a.icon} /></div>
                    <div><div className="small" style={{ fontWeight: 600 }}>{a.text}</div><div className="xs muted">{a.by} · {a.at}</div></div>
                  </div>
                ))}
              </div>
            )}
          </QueryState>
        </div>
      </div>

      {canOrders && <div className="mt-6"><RecentPlatformOrders /></div>}

      <div className="card mt-6">
        <div className="card-head"><h3>Top providers by enquiries</h3>{canAdmin(access, 'providers') && <Link to="/admin/providers" className="small bold">All providers</Link>}</div>
        <QueryState q={stats} label="Loading top providers">
          {(d) => d.topProviders.length === 0 ? <Empty icon="Building2" title="No enquiries yet" text="Centres are ranked here by the enquiries they receive." /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Provider</th><th>Trade</th><th>Enquiries</th><th>Reply rate</th><th>Rating</th></tr></thead>
                <tbody>
                  {d.topProviders.map((t) => {
                    const p = providerById(t.providerId);
                    const rate = Math.round(t.replyRate * 100);
                    return (
                      <tr key={t.providerId}>
                        <td>{p ? <div className="cell-user"><img src={resized(p.images[0], 96)} alt="" loading="lazy" /><div><strong>{p.name}</strong><span className="xs muted">{p.area}</span></div></div> : <span className="muted">Unlisted centre</span>}</td>
                        <td>{p && <TradeTag trade={p.trade} />}</td>
                        <td className="bold">{t.enquiries}</td>
                        <td><div className="row" style={{ gap: 10 }}><div className="progress" style={{ width: 90 }}><div style={{ width: `${rate}%` }} /></div><span className="xs bold">{rate}%</span></div></td>
                        <td>{p && p.reviews > 0 ? `★ ${p.rating}` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </QueryState>
      </div>
    </>
  );
}

const REJECT_REASONS = ['Could not verify business registration', 'Workshop photos do not match a real centre', 'Duplicate listing', 'Other'];
const REJECT_MESSAGE = 'Thank you for applying. Unfortunately we couldn’t verify your details. You’re welcome to re-apply with updated documents.';

export function AdminVerification() {
  const { reloadCatalog } = useApp();
  const q = useApiQuery(() => api.admin.verificationQueue(), []);
  const items = q.data ?? [];
  const { run, pending, busy } = useAction();
  const [sel, setSel] = useState<string | null>(null);
  const [reject, setReject] = useState<QueueItem | null>(null);
  const [reason, setReason] = useState(REJECT_REASONS[0]);
  const [message, setMessage] = useState(REJECT_MESSAGE);
  const [tab, setTab] = useState<QueueStatus>('Pending');

  const decide = async (item: QueueItem, status: QueueStatus, ok: string, note?: string) => {
    const done = await run(`${item.id}:${status}`, async () => {
      const next = await api.admin.decide(item.id, status, note);
      q.setData(replaceIn(next));
    }, ok);
    if (done) {
      setSel(null);
      // Approving publishes the centre.
      if (status === 'Approved') void reloadCatalog();
    }
    return done;
  };
  const isPending = (item: QueueItem | undefined, status: QueueStatus) => !!item && pending === `${item.id}:${status}`;
  const tabs: QueueStatus[] = ['Pending', 'Visit scheduled', 'Needs info', 'Approved', 'Rejected'];
  const list = items.filter((x) => x.status === tab);
  const cur = items.find((x) => x.id === sel);

  return (
    <>
      <PageTitle title="Verification queue" sub="Review new training centres before they appear on the platform." />
      <div className="tabs mb-6">
        {tabs.map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t} <span className="count">{items.filter((x) => x.status === t).length}</span></button>)}
      </div>
      <QueryState q={q} label="Loading applications">
        {() => list.length === 0 ? <div className="card"><Empty icon="ShieldCheck" title="Queue is clear" text="Nothing in this stage right now." /></div> : (
          <div className="pgrid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))' }}>
            {list.map((item) => (
              <div key={item.id} className="card pcard">
                <div className="pcard-media" style={{ aspectRatio: '16/8' }}><Img src={item.img} alt="" trade={item.trade} sizes={SIZES.card} /><div className="media-badges"><StatusBadge status={item.status} /></div></div>
                <div className="pcard-body">
                  <div className="row-between"><TradeTag trade={item.trade} /><span className="xs muted">Submitted {fmtDate(item.submitted, { day: 'numeric', month: 'short' })}</span></div>
                  <div className="pcard-title">{item.name}</div>
                  <div className="meta"><MapPin /> {item.area} · Owner: {item.owner}</div>
                  <div className="row wrap" style={{ gap: 6 }}>{item.docs.map((d) => <span key={d} className="badge"><FileText /> {d}</span>)}</div>
                  <div className="row mt-2" style={{ gap: 8 }}>
                    <button className="btn btn-secondary btn-sm grow" onClick={() => setSel(item.id)}><Eye size={15} /> Review</button>
                    {tab !== 'Approved' && <button className="btn btn-success btn-sm grow" disabled={busy} onClick={() => void decide(item, 'Approved', `${item.name} approved and published`)}>{spin(isPending(item, 'Approved'), <><CheckCircle2 size={15} /> Approve</>, 'Approving…')}</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </QueryState>

      <Drawer open={!!cur} onClose={() => setSel(null)} title="Review application" footer={cur && <>
        <button className="btn btn-ghost" disabled={busy} onClick={() => setReject(cur)} style={{ color: 'var(--danger)', marginRight: 'auto' }}><XCircle size={16} /> Reject</button>
        <button className="btn btn-secondary" disabled={busy} onClick={() => void decide(cur, 'Visit scheduled', 'Site visit scheduled')}>{spin(isPending(cur, 'Visit scheduled'), <><CalendarDays size={16} /> Schedule visit</>)}</button>
        <button className="btn btn-success" disabled={busy} onClick={() => void decide(cur, 'Approved', `${cur.name} approved and published`)}>{spin(isPending(cur, 'Approved'), <><CheckCircle2 size={16} /> Approve</>, 'Approving…')}</button>
      </>}>
        {cur && (
          <div className="stack">
            <div style={{ borderRadius: 14, overflow: 'hidden', aspectRatio: '16/9' }}><Img src={cur.img} alt="" trade={cur.trade} sizes="480px" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
            <div><TradeTag trade={cur.trade} /><h2 className="mt-2" style={{ fontSize: 22 }}>{cur.name}</h2><div className="meta mt-1"><MapPin /> {cur.area}</div></div>
            <dl className="kv"><dt>Owner</dt><dd>{cur.owner}</dd><dt>Submitted</dt><dd>{fmtDate(cur.submitted)}</dd><dt>Status</dt><dd><StatusBadge status={cur.status} /></dd></dl>
            <div>
              <h4 className="mb-2">Documents</h4>
              <div className="stack-sm">
                {cur.docs.map((d) => (
                  <div key={d} className="file-row"><div className="file-ico"><FileText size={18} /></div><div className="grow"><div className="bold small">{d}</div><div className="xs muted">PDF · 240 KB</div></div><button className="btn btn-ghost btn-sm"><ExternalLink size={14} /> Open</button></div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="mb-2">Checklist</h4>
              <div className="stack-sm">
                {['Business name matches registration', 'Phone number answered', 'CTVET number valid on registry', 'Photos show a real workshop', 'Fees look reasonable for trade'].map((c, i) => <label key={c} className="check"><input type="checkbox" defaultChecked={i < 2} /> {c}</label>)}
              </div>
            </div>
            <div className="field"><label className="label" htmlFor="adm-internal-note">Internal note</label><textarea id="adm-internal-note" className="textarea" placeholder="Only visible to admins" /></div>
            <button className="btn btn-soft" disabled={busy} onClick={() => void decide(cur, 'Needs info', `Asked ${cur.owner} for more information`)}>{spin(isPending(cur, 'Needs info'), <><Send size={15} /> Request more information</>, 'Sending…')}</button>
          </div>
        )}
      </Drawer>

      <Modal open={!!reject} onClose={() => setReject(null)} title={`Reject ${reject?.name}?`} footer={<>
        <button className="btn btn-secondary" onClick={() => setReject(null)}>Cancel</button>
        <button className="btn btn-danger" disabled={busy} onClick={async () => {
          if (reject && await decide(reject, 'Rejected', 'Application rejected', `${reason}. ${message.trim()}`)) setReject(null);
        }}>{spin(isPending(reject ?? undefined, 'Rejected'), 'Reject application', 'Rejecting…')}</button>
      </>}>
        <div className="field"><label className="label" htmlFor="adm-reason-sent-to-the-appli">Reason (sent to the applicant)</label>
          <select id="adm-reason-sent-to-the-appli" className="select" value={reason} onChange={(e) => setReason(e.target.value)}>{REJECT_REASONS.map((r) => <option key={r}>{r}</option>)}</select>
        </div>
        <div className="field mt-4"><label className="label" htmlFor="adm-message">Message</label><textarea id="adm-message" className="textarea" value={message} onChange={(e) => setMessage(e.target.value)} /></div>
      </Modal>
    </>
  );
}

/** e.g. "Oct 2026", the format used for site-visit badges */
const thisMonth = () => new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

function exportProviders(rows: AdminProvider[]) {
  downloadCsv('providers',
    ['ID', 'Name', 'Trade', 'Area', 'Phone', 'Email', 'From (GHS)', 'Programmes', 'CTVET', 'Fliptech visit', 'Featured', 'Status', 'Rating', 'Reviews'],
    rows.map((p) => [p.id, p.name, tradeById(p.trade)?.name ?? p.trade, p.area, p.phone, p.email, p.fee, p.programmes.length,
      p.ctvet ? 'Yes' : 'No', p.visited ?? 'Not visited', p.featured ? 'Yes' : 'No', p.status, p.rating, p.reviews]));
}

function exportUsers(rows: AdminUser[]) {
  downloadCsv('users',
    ['ID', 'Name', 'Email', 'Role', 'Area', 'Joined', 'Status', 'Enquiries'],
    rows.map((u) => [u.id, u.name, u.email, u.role === 'admin' ? accessLabel(u.access) : u.role, u.area, u.joined, u.status, u.enquiries]));
}

export function AdminProviders() {
  const { reloadCatalog, toast } = useApp();
  const query = useApiQuery(() => api.admin.providers(), []);
  const rows = query.data ?? [];
  const { run, busy } = useAction();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  // The header search can change ?q= while this page is open.
  useEffect(() => { setQ(params.get('q') ?? ''); }, [params]);
  const [trade, setTrade] = useState('');
  const list = rows.filter((p) => score(q, [[p.name, 3], [p.area, 2], [tradeById(p.trade)?.name, 2]]) > 0 && (!trade || p.trade === trade));

  /** Optimistic: the table changes at once and reverts if the server refuses. */
  const patch = (p: AdminProvider, v: ProviderModerationPatch, ok?: string) => {
    query.setData(replaceIn({ ...p, ...v }));
    void run(p.id, async () => {
      try {
        query.setData(replaceIn(await api.admin.updateProvider(p.id, v)));
      } catch (e) {
        query.setData(replaceIn(p));
        throw e;
      }
      // Badges, featuring and suspension all show on public pages.
      void reloadCatalog();
    }, ok);
  };

  return (
    <>
      <PageTitle title="Providers" sub={query.data ? `${rows.length} training centres listed on the platform.` : 'Training centres listed on the platform.'}>
        <button className="btn btn-secondary" disabled={list.length === 0} onClick={() => { exportProviders(list); toast(`Exported ${list.length} providers`); }}><Download size={16} /> Export CSV</button>
      </PageTitle>
      <div className="card">
        <div className="toolbar">
          <div className="input-icon" style={{ flex: '1 1 240px' }}><Search size={16} /><input className="input" aria-label="Search providers" placeholder="Search providers…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <select className="select" style={{ width: 170 }} value={trade} onChange={(e) => setTrade(e.target.value)} aria-label="Trade"><option value="">All trades</option>{TRADES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        </div>
        <QueryState q={query} label="Loading providers">
          {() => (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Provider</th><th>Trade</th><th>From</th><th>CTVET</th><th>Visited</th><th>Featured</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {list.map((p) => (
                    <tr key={p.id}>
                      <td><div className="cell-user"><img src={resized(p.images[0], 96)} alt="" loading="lazy" /><div><Link to={`/providers/${p.id}`} style={{ color: 'var(--ink)' }}><strong>{p.name}</strong></Link><span className="xs muted">{p.area}</span></div></div></td>
                      <td><TradeTag trade={p.trade} /></td>
                      <td className="price">{cedi(p.fee)}</td>
                      <td><Switch checked={p.ctvet} onChange={(v) => patch(p, { ctvet: v }, `CTVET badge ${v ? 'added' : 'removed'}`)} label="CTVET" /></td>
                      <td>{p.visited ? <span className="badge badge-brand"><BadgeCheck /> {p.visited}</span> : <button className="btn btn-soft btn-sm" disabled={busy} onClick={() => patch(p, { visited: thisMonth() }, 'Marked as visited')}>Mark visited</button>}</td>
                      <td><Switch checked={p.featured} onChange={(v) => patch(p, { featured: v }, v ? `${p.name} featured on the homepage` : `${p.name} no longer featured`)} label="Featured" /></td>
                      <td><StatusBadge status={p.status} /></td>
                      <td>
                        {p.status === 'Pending' || p.status === 'Rejected'
                          // Applications are published or rejected from the verification queue.
                          ? <Link to="/admin/verification" className="btn btn-ghost btn-sm"><Eye size={15} /> {p.status === 'Pending' ? 'Review' : 'View'}</Link>
                          : p.status === 'Suspended'
                          ? <button className="btn btn-ghost btn-sm" onClick={() => patch(p, { status: 'Published' }, 'Provider restored')}><UserCheck size={15} /> Restore</button>
                          : <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => patch(p, { status: 'Suspended' }, 'Provider suspended')}><Ban size={15} /> Suspend</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {list.length === 0 && <Empty icon="SearchX" title="No providers match" />}
            </div>
          )}
        </QueryState>
      </div>
    </>
  );
}

const ACCESS: [AdminAccess, string, string][] = [
  ['super', 'Super admin', 'Full access, including platform settings and other admins'],
  ['verification', 'Verification officer', 'Review and approve training centres'],
  ['support', 'Support', 'Manage users and moderate enquiries'],
];

interface InviteModalProps {
  open: boolean;
  onClose: () => void;
  /** Called with the new invitation once the server has accepted it */
  onInvited: (admin: AdminUser) => void;
  /** Accounts and pending invites, used to reject duplicate emails before asking the server */
  existing: { email: string }[];
}

function InviteAdminModal({ open, onClose, onInvited, existing }: InviteModalProps) {
  const { toast } = useApp();
  const blank: InviteAdminInput & { note: string } = { name: '', email: '', access: 'verification', note: '' };
  const [f, setF] = useState(blank);
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [server, setServer] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (e: FieldEvent) => { setF((x) => ({ ...x, [k]: e.target.value })); setServer({}); };
  const email = f.email.trim().toLowerCase();
  const errors = {
    name: (!f.name.trim() && 'Enter their full name') || server.name || false,
    email: (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Enter a valid email address'
      : existing.some((u) => u.email.toLowerCase() === email) ? 'This email already has an account or invitation' : false) || server.email || false,
  };
  const close = () => { setF(blank); setTouched(false); setServer({}); onClose(); };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (errors.name || errors.email || sending) return;
    setSending(true);
    try {
      const admin = await api.admin.inviteAdmin({ name: f.name.trim(), email, access: f.access, note: f.note.trim() || undefined });
      onInvited(admin);
      toast(`Invitation sent to ${email}`);
      close();
    } catch (x) {
      setServer(fieldErrors(x));
      toast(errorMessage(x), 'error');
    } finally {
      setSending(false);
    }
  };
  return (
    <Modal open={open} onClose={close} title="Invite an administrator" footer={<><button className="btn btn-secondary" onClick={close}>Cancel</button><button className="btn btn-primary" form="invite-form" disabled={sending}>{spin(sending, <><Send size={15} /> Send invitation</>, 'Sending…')}</button></>}>
      <form id="invite-form" className="stack" onSubmit={(e) => void submit(e)} noValidate>
        <div className="field">
          <label className="label" htmlFor="inv-name">Full name <span className="req">*</span></label>
          <input id="inv-name" className={`input ${touched && errors.name ? 'invalid' : ''}`} value={f.name} onChange={set('name')} placeholder="e.g. Kojo Annor" autoFocus />
          {touched && errors.name && <span className="error-text">{errors.name}</span>}
        </div>
        <div className="field">
          <label className="label" htmlFor="inv-email">Work email <span className="req">*</span></label>
          <input id="inv-email" type="email" className={`input ${touched && errors.email ? 'invalid' : ''}`} value={f.email} onChange={set('email')} placeholder="name@fliptech.com" />
          {touched && errors.email && <span className="error-text">{errors.email}</span>}
        </div>
        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="label mb-2">Access level</legend>
          <div className="stack-sm">
            {ACCESS.map(([v, l, d]) => (
              <label key={v} className="check" style={{ padding: 12, border: '1px solid', borderColor: f.access === v ? 'var(--brand)' : 'var(--line)', borderRadius: 12, background: f.access === v ? 'var(--brand-50)' : '#fff' }}>
                <input type="radio" name="access" value={v} checked={f.access === v} onChange={set('access')} />
                <span><span className="bold" style={{ color: 'var(--ink)' }}>{l}</span><br /><span className="xs muted">{d}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="field">
          <label className="label" htmlFor="inv-note">Personal note <span className="muted" style={{ fontWeight: 500 }}>(optional)</span></label>
          <textarea id="inv-note" className="textarea" style={{ minHeight: 80 }} value={f.note} onChange={set('note')} placeholder="Added to the invitation email" />
        </div>
        <div className="notice info"><Info size={18} /><div>They’ll get an email with a link to set a password. The invitation expires in 7 days.</div></div>
      </form>
    </Modal>
  );
}

const accessLabel = (v: AdminAccess | undefined) => ACCESS_LABEL[v ?? 'super'];

export function AdminUsers() {
  // Inviting admins and changing roles are super-admin only.
  const canManageAdmins = canAdmin(useUser().access, 'settings');
  const { toast } = useApp();
  const query = useApiQuery(() => api.admin.users(), []);
  const rows = query.data ?? [];
  const { run, pending, busy } = useAction();
  const [role, setRole] = useState<Role | ''>('');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const list = rows.filter((u) => (!role || u.role === role) && (!q || (u.name + u.email).toLowerCase().includes(q.toLowerCase())));
  const cur = rows.find((r) => r.id === sel);
  const roleBadge = { trainee: 'badge-brand', trainer: 'badge-violet', admin: 'badge-accent' };
  const countOf = (r: Role) => (query.data ? rows.filter((u) => u.role === r).length : '…');

  const patch = (u: AdminUser, v: Partial<Pick<AdminUser, 'role' | 'status'>>, ok: string) =>
    run(`${u.id}:patch`, async () => query.setData(replaceIn(await api.admin.updateUser(u.id, v))), ok);
  const revoke = async (u: AdminUser) => {
    if (await run(`${u.id}:revoke`, () => api.admin.revokeInvite(u.id), 'Invitation revoked')) {
      query.setData((xs = []) => xs.filter((x) => x.id !== u.id));
      setSel(null);
    }
  };

  return (
    <>
      <PageTitle title="Users" sub="Trainees, training centre accounts and administrators.">
        <button className="btn btn-secondary" disabled={list.length === 0} onClick={() => { exportUsers(list); toast(`Exported ${list.length} users`); }}><Download size={16} /> Export CSV</button>
        {canManageAdmins && <button className="btn btn-primary" onClick={() => setInviting(true)}><Plus size={16} /> Invite admin</button>}
      </PageTitle>
      <div className="stats mb-6" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <Stat icon="GraduationCap" tone="brand" label="Trainees" value={countOf('trainee')} />
        <Stat icon="Building2" tone="violet" label="Trainer accounts" value={countOf('trainer')} />
        <Stat icon="ShieldCheck" tone="accent" label="Admins" value={countOf('admin')} />
      </div>
      <div className="card">
        <div className="toolbar">
          <div className="input-icon" style={{ flex: '1 1 240px' }}><Search size={16} /><input className="input" aria-label="Search users by name or email" placeholder="Search by name or email…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="seg-toggle">{([['', 'All'], ['trainee', 'Trainees'], ['trainer', 'Trainers'], ['admin', 'Admins']] as [Role | '', string][]).map(([v, l]) => <button key={v} className={role === v ? 'on' : ''} onClick={() => setRole(v)}>{l}</button>)}</div>
        </div>
        <QueryState q={query} label="Loading users">
          {() => (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>User</th><th>Role</th><th>Area</th><th>Joined</th><th>Enquiries</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {list.map((u) => (
                    <tr key={u.id} {...rowAction(() => setSel(u.id))}>
                      <td><div className="cell-user"><span className="avatar">{initials(u.name)}</span><div><strong>{u.name}</strong><span className="xs muted">{u.email}</span></div></div></td>
                      <td><span className={`badge ${roleBadge[u.role]}`} style={{ textTransform: 'capitalize' }}>{u.role}</span></td>
                      <td>{u.area}</td>
                      <td>{fmtDate(u.joined)}</td>
                      <td>{u.enquiries}</td>
                      <td><StatusBadge status={u.status} /></td>
                      <td><button className="btn btn-ghost btn-icon btn-sm" aria-label="More"><MoreHorizontal size={17} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {list.length === 0 && <Empty icon="SearchX" title="No users match" />}
            </div>
          )}
        </QueryState>
      </div>
      <InviteAdminModal
        open={inviting}
        onClose={() => setInviting(false)}
        existing={rows}
        onInvited={(admin) => { query.setData((xs = []) => [admin, ...xs]); setRole(''); }}
      />
      <Drawer open={!!cur} onClose={() => setSel(null)} title="User details" footer={cur && (cur.status === 'Invited'
        ? !canManageAdmins ? null : <>
          <button className="btn btn-ghost" disabled={busy} style={{ color: 'var(--danger)', marginRight: 'auto' }} onClick={() => void revoke(cur)}>{spin(pending === `${cur.id}:revoke`, <><Trash2 size={16} /> Revoke invite</>, 'Revoking…')}</button>
          <button className="btn btn-primary" disabled={busy} onClick={() => void run(`${cur.id}:resend`, () => api.admin.resendInvite(cur.id), `Invitation resent to ${cur.email}`)}>{spin(pending === `${cur.id}:resend`, <><Send size={16} /> Resend invite</>, 'Sending…')}</button>
        </>
        : cur.status === 'Suspended'
        ? <button className="btn btn-success" disabled={busy} onClick={() => void patch(cur, { status: 'Active' }, 'User reactivated')}>{spin(pending === `${cur.id}:patch`, <><UserCheck size={16} /> Reactivate</>)}</button>
        : <button className="btn btn-danger" disabled={busy} onClick={() => void patch(cur, { status: 'Suspended' }, 'User suspended')}>{spin(pending === `${cur.id}:patch`, <><Ban size={16} /> Suspend user</>)}</button>)}>
        {cur && (
          <div className="stack">
            <div className="row"><span className="avatar avatar-lg">{initials(cur.name)}</span><div><h3>{cur.name}</h3><div className="small muted">{cur.email}</div><div className="mt-1"><StatusBadge status={cur.status} /></div></div></div>
            {cur.status === 'Invited' && <div className="notice info"><Info size={18} /><div>Invited on {fmtDate(cur.joined)} as <b>{accessLabel(cur.access)}</b>. Waiting for them to accept.</div></div>}
            <dl className="kv"><dt>Area</dt><dd>{cur.area}</dd><dt>{cur.status === 'Invited' ? 'Invited' : 'Joined'}</dt><dd>{fmtDate(cur.joined)}</dd><dt>Enquiries</dt><dd>{cur.enquiries}</dd></dl>
            {canManageAdmins ? <>
              <div className="field"><label className="label" htmlFor="adm-role">Role</label>
                <select id="adm-role" className="select" value={cur.role} disabled={busy} onChange={(e) => void patch(cur, { role: e.target.value as Role }, 'Role updated')}><option value="trainee">Trainee</option><option value="trainer">Trainer</option><option value="admin">Admin</option></select>
              </div>
              <div className="notice warn"><Info size={18} /><div>Changing a role takes effect the next time this user signs in.</div></div>
            </> : <dl className="kv"><dt>Role</dt><dd style={{ textTransform: 'capitalize' }}>{cur.role === 'admin' ? accessLabel(cur.access) : cur.role}</dd></dl>}
            <button className="btn btn-secondary" disabled={busy} onClick={() => void run(`${cur.id}:reset`, () => api.admin.sendPasswordReset(cur.id), 'Password reset link sent')}>{spin(pending === `${cur.id}:reset`, 'Send password reset', 'Sending…')}</button>
          </div>
        )}
      </Drawer>
    </>
  );
}

export function AdminEnquiries() {
  // Every centre's enquiries, including ones the spam screen held back from centres.
  const query = useApiQuery(() => api.enquiries.list(), []);
  const rows = query.data ?? [];
  const { run, pending } = useAction();
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const list = rows.filter((r) => !onlyFlagged || r.flagged);

  return (
    <>
      <PageTitle title="Enquiries" sub="Monitor enquiries across all providers and remove spam.">
        <label className="row small bold" style={{ gap: 10 }}><Switch checked={onlyFlagged} onChange={setOnlyFlagged} label="Only flagged" /> Only flagged ({rows.filter((r) => r.flagged).length})</label>
      </PageTitle>
      <div className="card">
        <QueryState q={query} label="Loading enquiries">
          {() => list.length === 0 ? <Empty icon="Inbox" title={onlyFlagged ? 'Nothing flagged' : 'No enquiries yet'} text={onlyFlagged ? 'Enquiries that look like spam are flagged here for review.' : 'Enquiries trainees send to any centre will appear here.'} /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Trainee</th><th>Provider</th><th>Message</th><th>Date</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {list.map((r) => {
                    const p = providerById(r.providerId);
                    return (
                      <tr key={r.id} style={r.flagged ? { background: 'var(--danger-50)' } : undefined}>
                        <td><div className="bold">{r.trainee}</div><div className="xs muted">{r.phone}</div></td>
                        <td><div className="bold small">{p?.name ?? 'Removed listing'}</div><div className="xs muted">{r.programme}</div></td>
                        <td className="small" style={{ maxWidth: 280 }}><div className="ellipsis">{r.thread[0]?.text}</div></td>
                        <td className="small">{fmtDate(r.date, { day: 'numeric', month: 'short' })}</td>
                        <td>{r.flagged ? <span className="badge badge-danger"><Flag /> Flagged</span> : <StatusBadge status={r.inboxStatus} />}</td>
                        <td>
                          <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                            {r.flagged && <button className="btn btn-ghost btn-sm" disabled={pending === r.id} onClick={() => void run(r.id, async () => query.setData(replaceIn(await api.enquiries.setFlagged(r.id, false))), 'Marked as not spam — sent to the centre')}>Not spam</button>}
                            <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--danger)' }} disabled={pending === r.id} onClick={() => void run(r.id, async () => {
                              await api.enquiries.remove(r.id);
                              query.setData((xs = []) => xs.filter((x) => x.id !== r.id));
                            }, 'Enquiry removed')} aria-label="Remove">{pending === r.id ? <span className="spinner" /> : <Trash2 size={16} />}</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </QueryState>
      </div>
    </>
  );
}

export function AdminTrades() {
  const { reloadCatalog } = useApp();
  const { run, pending, busy } = useAction();
  const [newArea, setNewArea] = useState('');
  const [edit, setEdit] = useState<EditableTrade | null>(null);

  // Trades and areas are part of the catalog, so saving reloads it for every page.
  const saveTrade = async () => {
    if (!edit || !edit.name.trim()) return;
    if (await run('trade', async () => { await api.admin.saveTrade({ ...edit, name: edit.name.trim() }); await reloadCatalog(); }, 'Trade saved')) setEdit(null);
  };
  const setAreas = (areas: string[], ok: string) => run('areas', async () => { await api.admin.setAreas(areas); await reloadCatalog(); }, ok);
  const addArea = async (e: FormEvent) => {
    e.preventDefault();
    const a = newArea.trim();
    if (!a) return;
    if (AREAS.some((x) => x.toLowerCase() === a.toLowerCase())) return void setNewArea('');
    if (await setAreas([...AREAS, a], 'Area added')) setNewArea('');
  };

  return (
    <>
      <PageTitle title="Trades & areas" sub="The categories and locations trainees can filter by." />
      <div className="grid-3-1" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-head"><h3>Trades</h3><button className="btn btn-primary btn-sm" onClick={() => setEdit({ id: '', name: '', icon: 'Wrench', color: '#7c3aed', bg: '#eff4ff', img: '' })}><Plus size={15} /> Add trade</button></div>
          {TRADES.map((t) => (
            <div key={t.id} className="li">
              <div className="li-ico" style={{ background: t.bg, color: t.color }}><Icon name={t.icon} size={19} /></div>
              <div className="grow"><div className="bold small">{t.name}</div><div className="xs muted">{PROVIDERS.filter((p) => p.trade === t.id).length} providers</div></div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEdit({ ...t })} aria-label="Edit"><Pencil size={16} /></button>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="card-head"><h3>Areas</h3><span className="xs muted">{pending === 'areas' ? <span className="spinner" /> : AREAS.length}</span></div>
          <div className="card-body">
            <form className="row" style={{ gap: 8 }} onSubmit={(e) => void addArea(e)}>
              <input className="input" style={{ height: 38 }} aria-label="New area name" placeholder="New area…" value={newArea} onChange={(e) => setNewArea(e.target.value)} />
              <button className="btn btn-primary btn-sm btn-icon" disabled={busy} aria-label="Add area"><Plus size={16} /></button>
            </form>
            <div className="row wrap mt-4" style={{ gap: 8 }}>
              {AREAS.map((a) => <span key={a} className="chip" style={{ background: '#fff', borderColor: 'var(--line)', color: 'var(--ink-2)' }}>{a}<button disabled={busy} onClick={() => void setAreas(AREAS.filter((x) => x !== a), `${a} removed`)} aria-label={`Remove ${a}`}>×</button></span>)}
            </div>
          </div>
        </div>
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? `Edit ${edit.name}` : 'Add trade'} footer={<><button className="btn btn-secondary" onClick={() => setEdit(null)}>Cancel</button><button className="btn btn-primary" disabled={busy || !edit?.name.trim()} onClick={() => void saveTrade()}>{spin(pending === 'trade', 'Save')}</button></>}>
        {edit && (
          <div className="form-grid">
            <div className="field span-2"><label className="label" htmlFor="adm-name">Name</label><input id="adm-name" className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
            <div className="field"><label className="label" htmlFor="adm-icon">Icon</label><select id="adm-icon" className="select" value={edit.icon} onChange={(e) => setEdit({ ...edit, icon: e.target.value })}>{['Flame', 'Scissors', 'Wrench', 'Car', 'Sparkles', 'Zap', 'Hammer', 'Paintbrush', 'ChefHat', 'Laptop'].map((i) => <option key={i}>{i}</option>)}</select></div>
            <div className="field"><label className="label" htmlFor="adm-colour">Colour</label><input id="adm-colour" className="input" type="color" value={edit.color} onChange={(e) => setEdit({ ...edit, color: e.target.value })} style={{ padding: 4 }} /></div>
            <div className="span-2 row"><div className="li-ico" style={{ background: edit.bg, color: edit.color }}><Icon name={edit.icon} size={19} /></div><span className="bold">{edit.name || 'Preview'}</span></div>
          </div>
        )}
      </Modal>
    </>
  );
}

type FeatureFlag = keyof PlatformSettings['flags'];

const FEATURES: [FeatureFlag, string, string][] = [
  ['signups', 'Trainee sign-ups', 'Allow new trainees to create accounts'],
  ['trainerReg', 'Training centre registration', 'Allow new centres to apply'],
  ['autoPublish', 'Auto-publish new centres', 'Skip the verification queue (not recommended)'],
  ['sms', 'SMS notifications', 'Send enquiry alerts to providers by SMS'],
  ['reviews', 'Trainee reviews', 'Show ratings and reviews on provider pages'],
  ['maintenance', 'Maintenance mode', 'Show a maintenance banner to all visitors'],
];

function ContactSettingsForm({ settings, onSaved }: { settings: PlatformSettings; onSaved: (s: PlatformSettings) => void }) {
  const { run, busy } = useAction();
  const [f, setF] = useState({ supportPhone: settings.supportPhone, supportEmail: settings.supportEmail, announcement: settings.announcement });
  const set = (k: keyof typeof f) => (e: FieldEvent) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <form className="card" onSubmit={(e) => { e.preventDefault(); void run('contact', async () => onSaved(await api.admin.saveSettings(f)), 'Settings saved'); }}>
      <div className="card-head"><h3>Contact & branding</h3></div>
      <div className="card-body form-grid">
        <div className="field"><label className="label" htmlFor="st-phone">Support phone</label><input id="st-phone" className="input" value={f.supportPhone} onChange={set('supportPhone')} /></div>
        <div className="field"><label className="label" htmlFor="st-email">Support email</label><input id="st-email" className="input" value={f.supportEmail} onChange={set('supportEmail')} /></div>
        <div className="field span-2"><label className="label" htmlFor="st-ann">Homepage announcement</label><input id="st-ann" className="input" value={f.announcement} onChange={set('announcement')} /></div>
        <div className="span-2"><button className="btn btn-primary" disabled={busy}>{spin(busy, 'Save')}</button></div>
      </div>
    </form>
  );
}

export function AdminSettings() {
  const access = useUser().access;
  if (canAdmin(access, 'settings')) return <PlatformSettingsPage />;
  // Other admins only manage their own notifications here.
  return (
    <>
      <PageTitle title="Settings" sub={`Your role: ${ACCESS_LABEL[access ?? 'super']}. Platform settings are managed by super admins.`} />
      <div style={{ maxWidth: 640 }}><NotificationPrefsCard title="My notifications" /></div>
    </>
  );
}

function PlatformSettingsPage() {
  const { reloadCatalog } = useApp();
  const settings = useApiQuery(() => api.admin.settings(), []);
  const users = useApiQuery(() => api.admin.users(), []);
  const { run, pending } = useAction();
  const [inviting, setInviting] = useState(false);
  const admins = (users.data ?? []).filter((u) => u.role === 'admin');
  /** Maintenance, the announcement and support contacts are shown to visitors, so refresh the public copy. */
  const saved = (next: PlatformSettings) => { settings.setData(next); void reloadCatalog(); };

  /** Optimistic: the switch flips at once and flips back if saving fails. */
  const toggle = (s: PlatformSettings, k: FeatureFlag, v: boolean) => {
    settings.setData({ ...s, flags: { ...s.flags, [k]: v } });
    void run(`flag:${k}`, async () => {
      try {
        saved(await api.admin.saveSettings({ flags: { ...s.flags, [k]: v } }));
      } catch (e) {
        settings.setData(s);
        throw e;
      }
    }, 'Setting saved');
  };
  const revoke = (u: AdminUser) => run(`revoke:${u.id}`, async () => {
    await api.admin.revokeInvite(u.id);
    users.setData((xs = []) => xs.filter((x) => x.id !== u.id));
  }, 'Invitation revoked');

  return (
    <>
      <PageTitle title="Platform settings" sub="Controls that affect every user of Fliptech Skills Hub." />
      <div className="grid-3-1" style={{ alignItems: 'start' }}>
        <QueryState q={settings} label="Loading settings">
          {(s) => (
            <div className="stack" style={{ gap: 20 }}>
              <div className="card">
                <div className="card-head"><h3>Features</h3></div>
                {FEATURES.map(([k, l, d]) => (
                  <div key={k} className="li"><div className="grow"><div className="bold small">{l}</div><div className="xs muted">{d}</div></div><Switch checked={s.flags[k]} onChange={(v) => toggle(s, k, v)} label={l} /></div>
                ))}
              </div>
              <ContactSettingsForm settings={s} onSaved={saved} />
            </div>
          )}
        </QueryState>
        <div className="stack" style={{ gap: 20 }}>
          <NotificationPrefsCard title="My notifications" />
          <div className="card">
            <div className="card-head"><h3>Administrators</h3></div>
            <QueryState q={users} label="Loading administrators">
              {() => admins.map((u) => (
                <div key={u.id} className="li">
                  <span className="avatar">{initials(u.name)}</span>
                  <div className="grow" style={{ minWidth: 0 }}><div className="bold small">{u.name}</div><div className="xs muted ellipsis">{u.email} · {accessLabel(u.access)}</div></div>
                  {u.status === 'Invited'
                    ? <><StatusBadge status="Invited" /><button className="btn btn-ghost btn-icon btn-sm" disabled={pending === `revoke:${u.id}`} aria-label={`Revoke invitation for ${u.name}`} onClick={() => void revoke(u)}>{pending === `revoke:${u.id}` ? <span className="spinner" /> : <Trash2 size={15} />}</button></>
                    : <ShieldCheck size={17} color="var(--brand)" />}
                </div>
              ))}
            </QueryState>
            <div className="card-body"><button className="btn btn-soft btn-block btn-sm" onClick={() => setInviting(true)}><Plus size={15} /> Invite administrator</button></div>
          </div>
        </div>
      </div>
      <InviteAdminModal
        open={inviting}
        onClose={() => setInviting(false)}
        existing={users.data ?? []}
        onInvited={(admin) => users.setData((xs = []) => [admin, ...xs])}
      />
    </>
  );
}
