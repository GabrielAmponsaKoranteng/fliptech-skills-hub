import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CalendarDays, Clock, MapPin, Send, Phone, Search, Trash2, Columns3, Check, X } from 'lucide-react';
import { useApp, useUser } from '../../context/AppContext';
import { api } from '../../api';
import { errorMessage } from '../../api/errors';
import { imageToDataUrl } from '../../lib/image';
import { PROVIDERS, providerById, providersByIds, tradeById } from '../../data/catalog';
import { cedi, fmtDate } from '../../lib/format';
import type { Enquiry, EnquiryStatus, FieldEvent, Provider } from '../../types';

/** Pairs each enquiry with its provider, skipping any whose listing has since been removed. */
const withProviders = (list: Enquiry[]) =>
  list.flatMap((e) => {
    const p = providerById(e.providerId);
    return p ? [{ e, p }] : [];
  });
import { PageTitle } from '../../components/DashboardLayout';
import { Avatar, Empty, Img, Modal, Stat, StatusBadge, TradeTag, VerifyBadges, SIZES } from '../../components/ui';
import { ProviderCard } from '../../components/ProviderCard';
import { NotificationPrefsCard } from '../../components/NotificationPrefs';
import { RecentOrders, useMyOrders } from './Orders';
import { ContinueLearning } from './MyCourses';
import { resized } from '../../assets/images';

/** Enquiries sent by the signed-in trainee (the shared list also holds other people's). */
function useMyEnquiries(): Enquiry[] {
  const { enquiries } = useApp();
  const user = useUser();
  return useMemo(() => enquiries.filter((e) => e.userId === user.id), [enquiries, user.id]);
}

export function TraineeDashboard() {
  const { saved } = useApp();
  const user = useUser();
  const enquiries = useMyEnquiries();
  const savedP = providersByIds(saved);
  const upcoming = [...savedP].sort((a, b) => a.intake.localeCompare(b.intake));
  const replied = enquiries.filter((e) => e.status === 'Replied').length;
  const myOrders = useMyOrders();
  const recommended = PROVIDERS.filter((p) => !saved.includes(p.id) && p.ctvet && p.visited).slice(0, 3);

  return (
    <>
      <div className="welcome">
        <h1>Welcome, {user.name.split(' ')[0]} <span className="wave" aria-hidden="true">👋</span></h1>
        <p>Here’s your training activity. {upcoming[0] && <>The next intake you saved starts <b style={{ color: '#fff' }}>{fmtDate(upcoming[0].intake, { day: 'numeric', month: 'long' })}</b>.</>}</p>
        <div className="row mt-4 wrap"><Link to="/search" className="btn btn-white"><Search size={16} /> Find training</Link><Link to="/app/enquiries" className="btn btn-ghost" style={{ color: '#fff' }}>View enquiries <ArrowRight size={16} /></Link></div>
      </div>

      <div className="stats mt-6">
        <Stat icon="Heart" tone="danger" label="Saved providers" value={saved.length} />
        <Stat icon="Send" tone="brand" label="Enquiries sent" value={enquiries.length} />
        <Stat icon="MessageCircleReply" tone="success" label="Replies received" value={replied} />
        <Stat icon="ShoppingBag" tone="accent" label="Orders" value={myOrders.length} />
        <Stat icon="CalendarClock" tone="violet" label="Upcoming intakes" value={upcoming.filter((p) => p.intake >= '2026-10-04').length} />
      </div>

      <div className="grid-3-1 mt-6">
        <div className="card">
          <div className="card-head"><h3>Recent enquiries</h3><Link to="/app/enquiries" className="small bold">View all</Link></div>
          {enquiries.length === 0 ? <Empty icon="Send" title="No enquiries yet" text="Find a centre you like and tap “Enquire now”." /> : withProviders(enquiries).slice(0, 4).map(({ e, p }) => {
            return (
              <Link to="/app/enquiries" key={e.id} className="li" style={{ color: 'inherit' }}>
                <img className="li-img" src={resized(p.images[0], 96)} alt="" loading="lazy" />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="bold ellipsis">{p.name}</div>
                  <div className="small muted ellipsis">{e.programme}</div>
                </div>
                <div style={{ textAlign: 'right' }}><StatusBadge status={e.status} /><div className="xs muted mt-1">{fmtDate(e.date, { day: 'numeric', month: 'short' })}</div></div>
              </Link>
            );
          })}
        </div>
        <div className="card">
          <div className="card-head"><h3>Upcoming intakes</h3></div>
          {upcoming.length === 0 ? <Empty icon="CalendarDays" title="Nothing saved" text="Save providers to track their intake dates." /> : upcoming.slice(0, 4).map((p) => {
            const d = new Date(p.intake + 'T00:00:00');
            return (
              <Link key={p.id} to={`/providers/${p.id}`} className="li" style={{ color: 'inherit' }}>
                <div className="li-ico tone-brand" style={{ flexDirection: 'column', gap: 0, width: 46, height: 50 }}>
                  <span className="xs bold" style={{ textTransform: 'uppercase', lineHeight: 1 }}>{d.toLocaleString('en', { month: 'short' })}</span>
                  <span style={{ fontWeight: 800, fontSize: 18, lineHeight: 1.1 }}>{d.getDate()}</span>
                </div>
                <div className="grow" style={{ minWidth: 0 }}><div className="bold small ellipsis">{p.name}</div><div className="xs muted">{tradeById(p.trade).name} · {p.places} places left</div></div>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-6"><ContinueLearning /></div>
      <div className="mt-6"><RecentOrders /></div>

      <div className="card mt-6">
        <div className="card-head"><h3>Saved providers</h3><Link to="/app/saved" className="small bold">View all</Link></div>
        <div className="card-body">
          {savedP.length === 0 ? <Empty icon="Heart" title="No saved providers" text="Tap the heart on any provider to save it here." /> : (
            <div className="pgrid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 14 }}>
              {savedP.slice(0, 4).map((p) => (
                <Link key={p.id} to={`/providers/${p.id}`} style={{ color: 'inherit' }}>
                  <div style={{ borderRadius: 12, overflow: 'hidden', aspectRatio: '16/10' }}><Img src={p.images[0]} alt="" trade={p.trade} sizes={SIZES.card} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
                  <div className="bold small mt-2 ellipsis">{p.name}</div>
                  <div className="xs muted">{p.area} · From {cedi(p.fee)}</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6">
        <div className="row-between mb-4"><h3>Recommended for you</h3><span className="badge badge-success">CTVET + Fliptech verified</span></div>
        <div className="pgrid">{recommended.map((p) => <ProviderCard key={p.id} p={p} />)}</div>
      </div>
    </>
  );
}

/** [label, cell renderer, optional "is best value" test used to highlight the winner] */
type CompareRow = [label: string, cell: (p: Provider) => ReactNode, best?: (p: Provider) => boolean];

export function SavedProviders() {
  const { saved, toggleSave } = useApp();
  const list = providersByIds(saved);
  const [compare, setCompare] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const cmp = providersByIds(compare);
  const toggleCmp = (id: string) => setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length < 3 ? [...c, id] : c));

  return (
    <>
      <PageTitle title="Saved providers" sub={`${list.length} provider${list.length === 1 ? '' : 's'} saved. Select up to 3 to compare.`}>
        <button className="btn btn-primary" disabled={compare.length < 2} onClick={() => setOpen(true)}><Columns3 size={16} /> Compare ({compare.length})</button>
      </PageTitle>
      {list.length === 0 ? (
        <div className="card"><Empty icon="Heart" title="No saved providers yet" text="Tap the heart on any provider to keep it here for later." action={<Link to="/search" className="btn btn-primary">Find training</Link>} /></div>
      ) : (
        <div className="stack">
          {list.map((p) => (
            <div key={p.id} className="card prow" style={compare.includes(p.id) ? { borderColor: 'var(--brand)', boxShadow: 'var(--ring)' } : undefined}>
              <Link to={`/providers/${p.id}`} className="prow-media" aria-label={p.name}><Img src={p.images[0]} alt="" trade={p.trade} sizes="(max-width: 820px) 120px, 200px" /></Link>
              <div className="prow-main">
                <div className="row" style={{ gap: 8 }}><TradeTag trade={p.trade} /></div>
                <Link to={`/providers/${p.id}`} className="pcard-title">{p.name}</Link>
                <div className="facts"><span className="meta"><MapPin /> {p.area}</span><span className="meta"><Clock /> {p.months} months</span><span className="meta"><CalendarDays /> Intake {fmtDate(p.intake, { day: 'numeric', month: 'short' })}</span></div>
                <div className="row wrap" style={{ gap: 6 }}><VerifyBadges p={p} compact /></div>
              </div>
              <div className="prow-side">
                <div className="price" style={{ fontSize: 22 }}>{cedi(p.fee)}</div>
                <div className="row" style={{ gap: 6 }}>
                  <label className="check small" style={{ alignItems: 'center' }}><input type="checkbox" checked={compare.includes(p.id)} onChange={() => toggleCmp(p.id)} disabled={!compare.includes(p.id) && compare.length >= 3} /> Compare</label>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { toggleSave(p.id); setCompare((c) => c.filter((x) => x !== p.id)); }} aria-label="Remove"><Trash2 size={16} /></button>
                  <Link to={`/providers/${p.id}/enquire`} className="btn btn-primary btn-sm">Enquire</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Compare providers" width={860}>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th></th>{cmp.map((p) => <th key={p.id} style={{ textTransform: 'none', letterSpacing: 0, fontSize: 13, color: 'var(--ink)' }}>{p.name}</th>)}</tr></thead>
            <tbody>
              {([
                ['Fee', (p) => cedi(p.fee), (p) => p.fee === Math.min(...cmp.map((x) => x.fee))],
                ['Duration', (p) => `${p.months} months`, (p) => p.months === Math.min(...cmp.map((x) => x.months))],
                ['Next intake', (p) => fmtDate(p.intake), (p) => p.intake === cmp.map((x) => x.intake).sort()[0]],
                ['Area', (p) => p.area],
                ['Rating', (p) => `★ ${p.rating}`, (p) => p.rating === Math.max(...cmp.map((x) => x.rating))],
                ['CTVET', (p) => (p.ctvet ? <Check size={18} color="var(--success-500)" /> : <X size={18} color="var(--muted-2)" />)],
                ['Fliptech visited', (p) => (p.visited ? <Check size={18} color="var(--success-500)" /> : <X size={18} color="var(--muted-2)" />)],
                ['Places left', (p) => p.places],
              ] as CompareRow[]).map(([k, fn, best]) => (
                <tr key={k}><td className="muted bold small">{k}</td>{cmp.map((p) => <td key={p.id} style={best?.(p) ? { color: 'var(--success)', fontWeight: 750 } : undefined}>{fn(p)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
    </>
  );
}

export function MyEnquiries() {
  const { user, replyToEnquiry } = useApp();
  const enquiries = useMyEnquiries();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<'All' | EnquiryStatus>('All');
  const rows = useMemo(() => withProviders(enquiries), [enquiries]);
  const list = rows.filter(({ e }) => filter === 'All' || e.status === filter);
  // ?enquiry= comes from a reply notification and opens that conversation.
  const sel = params.get('enquiry') ?? list[0]?.e.id;
  const setSel = (id: string) => { const next = new URLSearchParams(params); next.set('enquiry', id); setParams(next, { replace: true }); };
  const curRow = rows.find(({ e }) => e.id === sel) || list[0];
  const cur = curRow?.e;
  const p = curRow?.p;
  const [draft, setDraft] = useState('');
  const thread = cur?.thread ?? [];

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || !cur) return;
    const text = draft;
    setDraft('');
    // Put the message back in the box if it didn't send, so nothing is lost.
    if (!(await replyToEnquiry(cur.id, text))) setDraft(text);
  };

  return (
    <>
      <PageTitle title="My enquiries" sub="Messages you’ve sent to training providers." />
      {enquiries.length === 0 ? (
        <div className="card"><Empty icon="Send" title="No enquiries yet" text="When you enquire about a programme, the conversation will appear here." action={<Link className="btn btn-primary" to="/search">Find training</Link>} /></div>
      ) : (
        <div className="card inbox" style={{ overflow: 'hidden' }}>
          <div className="inbox-list">
            <div className="toolbar" style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
              <div className="seg-toggle">{(['All', 'Sent', 'Replied'] as const).map((f) => <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{f}</button>)}</div>
            </div>
            {list.map(({ e, p: ep }) => {
              return (
                <div key={e.id} className={`inbox-item ${cur?.id === e.id ? 'on' : ''}`} onClick={() => setSel(e.id)}>
                  <div className="row-between"><strong className="small ellipsis">{ep.name}</strong><span className="xs muted">{fmtDate(e.date, { day: 'numeric', month: 'short' })}</span></div>
                  <div className="xs muted ellipsis">{e.programme}</div>
                  <div className="row-between mt-1"><span className="xs muted ellipsis" style={{ maxWidth: 200 }}>{e.thread.at(-1)?.text}</span><StatusBadge status={e.status} /></div>
                </div>
              );
            })}
          </div>
          {cur && p && (
            <div className="thread">
              <div className="card-head">
                <div className="row" style={{ minWidth: 0 }}>
                  <img src={resized(p.images[0], 96)} alt="" loading="lazy" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover' }} />
                  <div style={{ minWidth: 0 }}><Link to={`/providers/${p.id}`} className="bold ellipsis" style={{ color: 'var(--ink)', display: 'block' }}>{p.name}</Link><div className="xs muted ellipsis">{cur.programme}</div></div>
                </div>
                <a href={`tel:${p.phone.replace(/\s/g, '')}`} className="btn btn-secondary btn-sm"><Phone size={15} /> Call</a>
              </div>
              <div className="thread-body">
                {thread.map((m, i) => (
                  <div key={i} className={`bubble ${m.from === 'trainee' ? 'me' : 'them'}`}>
                    {m.text}<time>{m.from === 'trainee' ? (user?.name.split(' ')[0] || 'You') : p.name.split(' ').slice(0, 2).join(' ')} · {m.at}</time>
                  </div>
                ))}
                {cur.status === 'Sent' && <div className="xs muted" style={{ textAlign: 'center' }}>Waiting for {p.name} to reply. Most centres reply within 1 day.</div>}
              </div>
              <form className="composer" onSubmit={send}>
                <textarea className="textarea grow" placeholder="Write a follow-up…" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) send(e); }} aria-label="Message" />
                <button className="btn btn-primary btn-icon" aria-label="Send"><Send size={17} /></button>
              </form>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export function AccountSettings() {
  const { updateUser, toast, logout } = useApp();
  const user = useUser();
  const [form, setForm] = useState({ name: user.name, phone: user.phone, email: user.email, area: user.area || '' });
  const [del, setDel] = useState(false);
  const set = (k: keyof typeof form) => (e: FieldEvent) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwErr, setPwErr] = useState('');
  /** Which action is waiting on the server */
  const [busy, setBusy] = useState<'profile' | 'photo' | 'password' | 'export' | 'delete' | null>(null);
  const nav = useNavigate();

  const run = async (what: NonNullable<typeof busy>, call: () => Promise<unknown>, ok?: string) => {
    setBusy(what);
    try {
      await call();
      if (ok) toast(ok);
      return true;
    } catch (x) {
      toast(errorMessage(x), 'error');
      return false;
    } finally {
      setBusy(null);
    }
  };
  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setBusy('profile');
    const ok = await updateUser(form);
    setBusy(null);
    if (ok) toast('Profile updated');
  };
  const uploadPhoto = async (file: File) => {
    setBusy('photo');
    try {
      // Small square-ish JPEG; a real backend would take the file and return a URL.
      const avatar = await imageToDataUrl(file, 256, 0.85);
      if (await updateUser({ avatar })) toast('Profile photo updated');
    } catch (x) {
      toast(errorMessage(x), 'error');
    } finally {
      setBusy(null);
    }
  };
  const removePhoto = async () => {
    setBusy('photo');
    if (await updateUser({ avatar: '' })) toast('Profile photo removed');
    setBusy(null);
  };
  const changePassword = async () => {
    if (pw.next.length < 8) return setPwErr('New password must be at least 8 characters');
    if (pw.next !== pw.confirm) return setPwErr('The new passwords don’t match');
    setPwErr('');
    if (await run('password', () => api.me.changePassword(pw.current, pw.next), 'Password updated')) setPw({ current: '', next: '', confirm: '' });
  };
  const deleteAccount = async () => {
    if (!(await run('delete', () => api.me.deleteAccount()))) return;
    setDel(false);
    await logout();
    toast('Your account has been deleted');
    nav('/');
  };
  const spin = (what: NonNullable<typeof busy>, label: ReactNode) => (busy === what ? <><span className="spinner" /> Please wait…</> : label);
  const roleTitle = user.role === 'trainer' ? 'Account settings' : user.role === 'admin' ? 'My account' : 'My profile';

  return (
    <>
      <PageTitle title={roleTitle} sub="Update your personal information and how we contact you." />
      <div className="grid-3-1" style={{ alignItems: 'start' }}>
        <div className="stack" style={{ gap: 20 }}>
          <form className="card" onSubmit={saveProfile}>
            <div className="card-head"><h3>Personal information</h3></div>
            <div className="card-body">
              <div className="row mb-6">
                <Avatar name={form.name} src={user.avatar} size="lg" />
                <div>
                  <div className="row" style={{ gap: 8 }}>
                    <label className={`btn btn-secondary btn-sm ${busy ? 'disabled' : ''}`}>
                      {spin('photo', user.avatar ? 'Change photo' : 'Upload photo')}
                      <input type="file" accept="image/*" hidden disabled={!!busy} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void uploadPhoto(file); }} />
                    </label>
                    {user.avatar && <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => void removePhoto()}>Remove</button>}
                  </div>
                  <div className="xs muted mt-1">JPG or PNG. We resize it for you.</div>
                </div>
              </div>
              <div className="form-grid">
                <div className="field span-2"><label className="label" htmlFor="sn">Full name</label><input id="sn" className="input" value={form.name} onChange={set('name')} /></div>
                <div className="field"><label className="label" htmlFor="sp">Phone number</label><input id="sp" className="input" value={form.phone} onChange={set('phone')} /></div>
                <div className="field"><label className="label" htmlFor="se">Email <span className="muted" style={{ fontWeight: 500 }}>(optional)</span></label><input id="se" className="input" type="email" value={form.email} onChange={set('email')} /></div>
              </div>
            </div>
            <div className="modal-foot" style={{ borderRadius: '0 0 18px 18px' }}><button className="btn btn-primary" disabled={!!busy}>{spin('profile', 'Save changes')}</button></div>
          </form>

          <NotificationPrefsCard />

          <div className="card">
            <div className="card-head"><h3>Password</h3></div>
            <div className="card-body form-grid">
              <div className="field span-2"><label className="label" htmlFor="pw0">Current password</label><input id="pw0" type="password" className="input" autoComplete="current-password" value={pw.current} onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} /></div>
              <div className="field"><label className="label" htmlFor="pw1">New password</label><input id="pw1" type="password" className="input" autoComplete="new-password" value={pw.next} onChange={(e) => { setPw((p) => ({ ...p, next: e.target.value })); setPwErr(''); }} /></div>
              <div className="field"><label className="label" htmlFor="pw2">Confirm new password</label><input id="pw2" type="password" className="input" autoComplete="new-password" value={pw.confirm} onChange={(e) => { setPw((p) => ({ ...p, confirm: e.target.value })); setPwErr(''); }} /></div>
              {pwErr && <div className="span-2 error-text">{pwErr}</div>}
              <div className="span-2"><button className="btn btn-secondary" disabled={!!busy} onClick={() => void changePassword()}>{spin('password', 'Update password')}</button></div>
            </div>
          </div>
        </div>

        <div className="stack" style={{ gap: 20 }}>
          <div className="card card-pad">
            <h4>Your data</h4>
            <p className="small muted mt-2">Download a copy of everything we hold about you, as described in our <Link to="/privacy">Privacy Policy</Link>.</p>
            <button className="btn btn-secondary btn-sm mt-4" disabled={!!busy} onClick={() => void run('export', () => api.me.requestDataExport(), 'We’ll email your data export within 24 hours')}>{spin('export', 'Request data export')}</button>
          </div>
          <div className="card card-pad" style={{ borderColor: '#fecaca' }}>
            <h4 style={{ color: 'var(--danger)' }}>Delete account</h4>
            <p className="small muted mt-2">Permanently delete your account, saved providers and enquiry history.</p>
            <button className="btn btn-danger btn-sm mt-4" onClick={() => setDel(true)}><Trash2 size={15} /> Delete account</button>
          </div>
        </div>
      </div>
      <Modal open={del} onClose={() => setDel(false)} title="Delete your account?" footer={<><button className="btn btn-secondary" onClick={() => setDel(false)}>Cancel</button><button className="btn btn-danger" disabled={!!busy} onClick={() => void deleteAccount()}>{spin('delete', 'Yes, delete my account')}</button></>}>
        <p className="muted">This can’t be undone. Training centres you enquired with will keep your phone number, but you won’t be able to see the conversations.</p>
      </Modal>
    </>
  );
}

