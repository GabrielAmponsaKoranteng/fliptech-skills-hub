import { useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Clock, CalendarDays, Info, Send, CheckCircle2, MessageSquare, Search } from 'lucide-react';
import { providerById } from '../../data/catalog';
import { cedi, fmtDate } from '../../lib/format';
import { useApp } from '../../context/AppContext';
import { Empty, Img } from '../../components/ui';
import type { FieldEvent } from '../../types';
import { usePageMeta } from '../../lib/pageMeta';

const PHONE_RE = /^0\d{2}\s?\d{3}\s?\d{4}$/;

export default function Enquiry() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const p = providerById(id);
  const { user, addEnquiry } = useApp();
  const [form, setForm] = useState({
    phone: user?.phone || '',
    name: user?.name || '',
    message: '',
    programme: params.get('programme') || p?.programmes[0].id,
    contact: 'call',
  });
  const [touched, setTouched] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  usePageMeta(p ? { title: `Enquire – ${p.name}` } : { title: 'Provider not found' });

  if (!p) return <div className="container"><Empty title="Provider not found" action={<Link to="/search" className="btn btn-primary">Back to search</Link>} /></div>;
  const pr = p.programmes.find((x) => x.id === form.programme) || p.programmes[0];
  const phoneOk = PHONE_RE.test(form.phone.trim());
  const set = (k: keyof typeof form) => (e: FieldEvent) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!phoneOk) return;
    setBusy(true);
    const created = await addEnquiry({ providerId: p.id, programme: pr.name, trainee: form.name, phone: form.phone, message: form.message });
    setBusy(false);
    if (!created) return; // error toast already shown; the form keeps what they typed
    setSent(true);
    window.scrollTo({ top: 0 });
  };

  if (sent) {
    return (
      <div className="container" style={{ maxWidth: 620, paddingTop: 56 }}>
        <div className="card card-pad fade-in" style={{ textAlign: 'center', padding: 40 }}>
          <div className="empty-ico" style={{ background: 'var(--success-50)', color: 'var(--success)', width: 76, height: 76, borderRadius: 24 }}><CheckCircle2 size={38} /></div>
          <h2>Enquiry sent!</h2>
          <p className="muted mt-2">{p.name} will contact you on <b style={{ color: 'var(--ink)' }}>{form.phone}</b>, usually within one working day.</p>
          <div className="card mt-6" style={{ padding: 16, display: 'flex', gap: 14, alignItems: 'center', textAlign: 'left' }}>
            <Img src={p.images[0]} alt="" trade={p.trade} sizes="64px" style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover' }} />
            <div className="grow"><div className="bold">{pr.name}</div><div className="small muted">{cedi(pr.fee)} · Intake {fmtDate(pr.intake)}</div></div>
          </div>
          <div className="row mt-6" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            {user?.role === 'trainee'
              ? <Link to="/app/enquiries" className="btn btn-primary"><MessageSquare size={16} /> View my enquiries</Link>
              : <Link to="/signup" className="btn btn-primary">Create an account to track replies</Link>}
            <Link to="/search" className="btn btn-secondary"><Search size={16} /> Keep browsing</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 1000, paddingTop: 28 }}>
      <Link to={`/providers/${p.id}`} className="back-link"><ArrowLeft size={16} /> Back to provider</Link>
      <div className="mt-4 mb-6">
        <h1>Enquire about this training</h1>
        <p className="muted mt-2">{p.name}</p>
      </div>
      <div className="detail-grid" style={{ gridTemplateColumns: '1fr 340px' }}>
        <form className="card card-pad stack" onSubmit={submit} noValidate>
          {p.programmes.length > 1 && (
            <div className="field">
              <label className="label" htmlFor="eprog">Programme</label>
              <select id="eprog" className="select" value={form.programme} onChange={set('programme')}>
                {p.programmes.map((x) => <option key={x.id} value={x.id}>{x.name} — {cedi(x.fee)}</option>)}
              </select>
            </div>
          )}
          <div className="field">
            <label className="label" htmlFor="ephone">Your phone number <span className="req">*</span></label>
            <input id="ephone" className={`input ${touched && !phoneOk ? 'invalid' : ''}`} inputMode="tel" placeholder="e.g. 024 123 4567" value={form.phone} onChange={set('phone')} aria-invalid={touched && !phoneOk} aria-describedby="ephone-err" />
            {touched && !phoneOk && <span id="ephone-err" className="error-text">Enter a valid Ghana number, e.g. 024 123 4567</span>}
          </div>
          <div className="field">
            <label className="label" htmlFor="ename">Your name <span className="muted" style={{ fontWeight: 500 }}>(optional)</span></label>
            <input id="ename" className="input" placeholder="e.g. Kwame Mensah" value={form.name} onChange={set('name')} />
          </div>
          <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="label mb-2">How should they contact you?</legend>
            <div className="seg-toggle" style={{ width: 'fit-content' }}>
              {[['call', 'Phone call'], ['sms', 'SMS'], ['whatsapp', 'WhatsApp']].map(([v, l]) => (
                <button type="button" key={v} className={form.contact === v ? 'on' : ''} onClick={() => setForm((f) => ({ ...f, contact: v }))}>{l}</button>
              ))}
            </div>
          </fieldset>
          <div className="field">
            <label className="label" htmlFor="emsg">Your message <span className="muted" style={{ fontWeight: 500 }}>(optional)</span></label>
            <textarea id="emsg" className="textarea" maxLength={500} placeholder="e.g. I’m interested in the next intake. Please can you share more details about fees and requirements?" value={form.message} onChange={set('message')} />
            <span className="hint" style={{ textAlign: 'right' }}>{form.message.length}/500</span>
          </div>
          <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? 'Sending…' : <><Send size={17} /> Send enquiry</>}</button>
          <div className="notice info"><Info size={18} /><div>Your message will be sent directly to the training provider. Fliptech does not share your number with anyone else.</div></div>
        </form>

        <aside className="sticky-card">
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ aspectRatio: '16/10' }}><Img src={p.images[0]} alt="" trade={p.trade} sizes="(max-width: 820px) 100vw, 380px" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
            <div className="card-body stack-sm">
              <div className="bold">{pr.name}</div>
              <div className="price" style={{ fontSize: 22 }}>From {cedi(pr.fee)}</div>
              <div className="meta"><Clock /> {pr.months} months</div>
              <div className="meta"><CalendarDays /> Next intake: {fmtDate(pr.intake)}</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
