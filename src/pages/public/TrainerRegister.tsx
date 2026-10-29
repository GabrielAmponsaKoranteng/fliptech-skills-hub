import { useState, type ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, MapPin, Plus, Trash2, UploadCloud, FileText, Image as ImageIcon, ArrowLeft, ArrowRight, PartyPopper, Info } from 'lucide-react';
import { AREAS, PROVIDERS, SITE, TRADES } from '../../data/catalog';
import { cedi } from '../../lib/format';
import { useApp } from '../../context/AppContext';
import { Paused } from './Auth';
import type { FieldEvent } from '../../types';

/** A programme as typed into the form; numbers stay strings until submitted. */
interface DraftProgramme { name: string; trade: string; fee: string; months: string; days: string; intake: string }
interface PickedFile { name: string; size: number }
interface Docs { registration: PickedFile | null; ctvet: PickedFile | null; photos: PickedFile[] }

const STEPS = ['Profile', 'Training', 'Documents', 'Review'];

export function Stepper({ step, steps = STEPS }: { step: number; steps?: string[] }) {
  return (
    <div className="stepper" aria-label="Progress">
      {steps.map((s, i) => (
        <div key={s} className={`step ${i === step ? 'on' : ''} ${i < step ? 'done' : ''}`}>
          <span className="sn">{i < step ? <Check size={15} /> : i + 1}</span>
          <span className="lbl">{s}</span>
        </div>
      ))}
    </div>
  );
}

const emptyProg = (): DraftProgramme => ({ name: '', trade: 'welding', fee: '', months: '', days: 'Mon – Fri', intake: '' });

export default function TrainerRegister() {
  const [step, setStep] = useState(0);
  const [touched, setTouched] = useState(false);
  const [done, setDone] = useState(false);
  /** Auto-publish was on, so the centre is already live */
  const [live, setLive] = useState(false);
  const [f, setF] = useState({ centre: '', description: '', phone: '', email: '', area: '', address: '', ctvetNo: '', password: '' });
  const [progs, setProgs] = useState([emptyProg()]);
  const [docs, setDocs] = useState<Docs>({ registration: null, ctvet: null, photos: [] });
  const { registerCentre } = useApp();
  const [submitting, setSubmitting] = useState(false);
  const nav = useNavigate();

  const set = (k: keyof typeof f) => (e: FieldEvent) => setF((x) => ({ ...x, [k]: e.target.value }));
  const setProg = (i: number, k: keyof DraftProgramme) => (e: FieldEvent) => setProgs((ps) => ps.map((p, j) => (j === i ? { ...p, [k]: e.target.value } : p)));

  const stepValid = [
    f.centre.trim() && f.description.trim().length >= 20 && /^0\d{2}\s?\d{3}\s?\d{4}$/.test(f.phone.trim()) && f.area && f.password.length >= 8,
    progs.every((p) => p.name.trim() && Number(p.fee) > 0 && Number(p.months) > 0),
    !!docs.registration && docs.photos.length > 0,
    true,
  ];

  const submit = async () => {
    setSubmitting(true);
    const u = await registerCentre({
      centre: f.centre, description: f.description, phone: f.phone, email: f.email || undefined, area: f.area,
      address: f.address || undefined, ctvetNo: f.ctvetNo || undefined, password: f.password,
      programmes: progs.map((p) => ({ name: p.name, trade: p.trade, fee: Number(p.fee), months: Number(p.months), days: p.days, intake: p.intake || undefined })),
      documents: { registration: docs.registration?.name ?? '', ctvet: docs.ctvet?.name, photos: docs.photos.map((x) => x.name) },
    });
    setSubmitting(false);
    if (u) {
      setLive(PROVIDERS.some((p) => p.id === u.centreId));
      setDone(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const next = () => {
    setTouched(true);
    if (!stepValid[step]) return;
    setTouched(false);
    if (step < 3) { setStep(step + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    else void submit();
  };
  const err = (cond: boolean, msg: string) => touched && cond && <span className="error-text">{msg}</span>;
  const pickFile = (key: keyof Docs) => (e: ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])].map((x) => ({ name: x.name, size: x.size }));
    if (!files.length) return;
    setDocs((d) => (key === 'photos' ? { ...d, photos: [...d.photos, ...files] } : { ...d, [key]: files[0] }));
  };

  if (!SITE.trainerReg && !done) return <Paused title="Centre registration is paused" text="We’re not taking new training centres right now. Please check back soon." />;

  if (done) {
    return (
      <div className="container" style={{ maxWidth: 620, paddingTop: 56 }}>
        <div className="card card-pad fade-in" style={{ textAlign: 'center', padding: 40 }}>
          <div className="empty-ico" style={{ width: 76, height: 76, borderRadius: 24 }}><PartyPopper size={36} /></div>
          <h1 className="as-h2">{live ? 'Your centre is live' : 'Your centre has been submitted'}</h1>
          <p className="muted mt-2">{live
            ? <><b style={{ color: 'var(--ink)' }}>{f.centre}</b> is now listed on Fliptech, so trainees can find it and send enquiries.</>
            : <>Our team will review <b style={{ color: 'var(--ink)' }}>{f.centre}</b> within 2 working days. You can start setting up your programmes while you wait.</>}</p>
          <div className="notice info mt-6" style={{ textAlign: 'left' }}><Info size={18} /><div>Next, we’ll call <b>{f.phone}</b> to schedule a free Fliptech site visit for your verified badge.</div></div>
          <button className="btn btn-primary btn-lg mt-6" onClick={() => nav('/trainer')}>Go to my dashboard <ArrowRight size={17} /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 860, paddingTop: 32 }}>
      <h1 className="sr-only">Register your training centre</h1>
      <Stepper step={step} />
      <div className="card card-pad mt-6 fade-in" key={step}>
        {step === 0 && (
          <div className="stack">
            <div><h2>Tell us about your training centre</h2><p className="muted mt-1">This information will be shown to trainees on Fliptech Skills Hub.</p></div>
            <div className="field">
              <label className="label" htmlFor="c1">Centre name <span className="req">*</span></label>
              <input id="c1" className="input" placeholder="e.g. Accra Central Welding Works" value={f.centre} onChange={set('centre')} />
              {err(!f.centre.trim(), 'Centre name is required')}
            </div>
            <div className="field">
              <label className="label" htmlFor="c2">Description <span className="req">*</span></label>
              <textarea id="c2" className="textarea" placeholder="Tell us about your centre, training approach and experience…" value={f.description} onChange={set('description')} maxLength={800} />
              <div className="row-between">{err(f.description.trim().length < 20, 'Please write at least 20 characters') || <span />}<span className="hint">{f.description.length}/800</span></div>
            </div>
            <div className="form-grid">
              <div className="field">
                <label className="label" htmlFor="c3">Phone number <span className="req">*</span></label>
                <input id="c3" className="input" inputMode="tel" placeholder="e.g. 024 123 4567" value={f.phone} onChange={set('phone')} />
                {err(!/^0\d{2}\s?\d{3}\s?\d{4}$/.test(f.phone.trim()), 'Enter a valid Ghana number')}
              </div>
              <div className="field">
                <label className="label" htmlFor="c4">Email <span className="muted" style={{ fontWeight: 500 }}>(optional)</span></label>
                <input id="c4" className="input" type="email" placeholder="e.g. info@yourcentre.com" value={f.email} onChange={set('email')} />
              </div>
              <div className="field">
                <label className="label" htmlFor="c5">Area <span className="req">*</span></label>
                <select id="c5" className="select" value={f.area} onChange={set('area')}>
                  <option value="">Select your area</option>
                  {AREAS.map((a) => <option key={a}>{a}</option>)}
                </select>
                {err(!f.area, 'Choose your area')}
              </div>
              <div className="field">
                <label className="label" htmlFor="c6">Street address / landmark</label>
                <div className="input-icon"><MapPin size={17} /><input id="c6" className="input" placeholder="e.g. Behind Kaneshie Market" value={f.address} onChange={set('address')} /></div>
              </div>
              <div className="field span-2">
                <label className="label" htmlFor="c7">Create a password <span className="req">*</span></label>
                <input id="c7" className="input" type="password" value={f.password} onChange={set('password')} autoComplete="new-password" />
                {err(f.password.length < 8, 'At least 8 characters')}
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="stack">
            <div><h2>What training do you offer?</h2><p className="muted mt-1">Add at least one programme. You can add more later from your dashboard.</p></div>
            {progs.map((p, i) => (
              <div key={i} className="card" style={{ padding: 18, background: '#fbfcfe' }}>
                <div className="row-between mb-4"><h4>Programme {i + 1}</h4>{progs.length > 1 && <button className="btn btn-ghost btn-sm" onClick={() => setProgs((ps) => ps.filter((_, j) => j !== i))}><Trash2 size={15} /> Remove</button>}</div>
                <div className="form-grid">
                  <div className="field span-2">
                    <label className="label" htmlFor={`reg-programme-name-${i}`}>Programme name <span className="req">*</span></label>
                    <input id={`reg-programme-name-${i}`} className="input" placeholder="e.g. Welding – Certificate Programme" value={p.name} onChange={setProg(i, 'name')} />
                    {err(!p.name.trim(), 'Required')}
                  </div>
                  <div className="field">
                    <label className="label" htmlFor={`reg-trade-${i}`}>Trade</label>
                    <select id={`reg-trade-${i}`} className="select" value={p.trade} onChange={setProg(i, 'trade')}>{TRADES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                  </div>
                  <div className="field">
                    <label className="label" htmlFor={`reg-fee-gh-${i}`}>Fee (GH₵) <span className="req">*</span></label>
                    <input id={`reg-fee-gh-${i}`} className="input" type="number" min="0" placeholder="750" value={p.fee} onChange={setProg(i, 'fee')} />
                    {err(!(Number(p.fee) > 0), 'Enter a fee')}
                  </div>
                  <div className="field">
                    <label className="label" htmlFor={`reg-duration-months-${i}`}>Duration (months) <span className="req">*</span></label>
                    <input id={`reg-duration-months-${i}`} className="input" type="number" min="1" placeholder="3" value={p.months} onChange={setProg(i, 'months')} />
                    {err(!(Number(p.months) > 0), 'Enter a duration')}
                  </div>
                  <div className="field">
                    <label className="label" htmlFor={`reg-training-days-${i}`}>Training days</label>
                    <select id={`reg-training-days-${i}`} className="select" value={p.days} onChange={setProg(i, 'days')}>{['Mon – Fri', 'Mon – Sat', 'Sat – Sun', 'Evenings'].map((d) => <option key={d}>{d}</option>)}</select>
                  </div>
                  <div className="field span-2">
                    <label className="label" htmlFor={`reg-next-intake-date-${i}`}>Next intake date</label>
                    <input id={`reg-next-intake-date-${i}`} className="input" type="date" value={p.intake} onChange={setProg(i, 'intake')} />
                  </div>
                </div>
              </div>
            ))}
            <button className="btn btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={() => setProgs((ps) => [...ps, emptyProg()])}><Plus size={16} /> Add another programme</button>
          </div>
        )}

        {step === 2 && (
          <div className="stack">
            <div><h2>Verification documents</h2><p className="muted mt-1">Documents are only seen by the Fliptech team and are used to award your trust badges.</p></div>
            <div className="field">
              <label className="label" htmlFor="c8">CTVET registration number <span className="muted" style={{ fontWeight: 500 }}>(if registered)</span></label>
              <input id="c8" className="input" placeholder="e.g. CTVET/GAR/2019/0421" value={f.ctvetNo} onChange={set('ctvetNo')} />
            </div>
            {([['registration', 'Business registration certificate', true], ['ctvet', 'CTVET certificate', false]] as const).map(([k, label, req]) => {
              const doc = docs[k];
              return (
              <div key={k} className="field">
                <span className="label">{label} {req && <span className="req">*</span>}</span>
                {doc ? (
                  <div className="file-row"><div className="file-ico"><FileText size={19} /></div><div className="grow"><div className="bold small ellipsis">{doc.name}</div><div className="xs muted">{(doc.size / 1024).toFixed(0)} KB · Ready to upload</div></div><button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDocs((d) => ({ ...d, [k]: null }))} aria-label="Remove"><Trash2 size={16} /></button></div>
                ) : (
                  <label className="dropzone"><input type="file" accept=".pdf,image/*" hidden onChange={pickFile(k)} /><UploadCloud size={26} color="var(--brand)" style={{ margin: '0 auto' }} /><div className="bold mt-2">Click to upload</div><div className="xs muted">PDF, JPG or PNG up to 5 MB</div></label>
                )}
                {k === 'registration' && err(!docs.registration, 'Please upload your business registration')}
              </div>
              );
            })}
            <div className="field">
              <span className="label">Workshop photos <span className="req">*</span></span>
              <label className="dropzone"><input type="file" accept="image/*" multiple hidden onChange={pickFile('photos')} /><ImageIcon size={26} color="var(--brand)" style={{ margin: '0 auto' }} /><div className="bold mt-2">Add photos of your workshop and equipment</div><div className="xs muted">Clear, well-lit photos get more enquiries</div></label>
              {docs.photos.map((p, i) => (
                <div key={i} className="file-row"><div className="file-ico"><ImageIcon size={19} /></div><div className="grow bold small ellipsis">{p.name}</div><button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDocs((d) => ({ ...d, photos: d.photos.filter((_, j) => j !== i) }))} aria-label="Remove"><Trash2 size={16} /></button></div>
              ))}
              {err(docs.photos.length === 0, 'Add at least one photo')}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="stack">
            <div><h2>Review and submit</h2><p className="muted mt-1">Check everything looks right. You can edit these details later.</p></div>
            <div className="card" style={{ padding: 18 }}>
              <div className="row-between"><h4>Centre profile</h4><button className="btn btn-ghost btn-sm" onClick={() => setStep(0)}>Edit</button></div>
              <dl className="kv mt-3"><dt>Name</dt><dd>{f.centre}</dd><dt>Area</dt><dd>{f.area}{f.address && ` · ${f.address}`}</dd><dt>Phone</dt><dd>{f.phone}</dd><dt>Email</dt><dd>{f.email || '—'}</dd></dl>
            </div>
            <div className="card" style={{ padding: 18 }}>
              <div className="row-between"><h4>Programmes ({progs.length})</h4><button className="btn btn-ghost btn-sm" onClick={() => setStep(1)}>Edit</button></div>
              {progs.map((p, i) => <div key={i} className="row-between mt-3 small"><span className="bold">{p.name}</span><span>{cedi(p.fee)} · {p.months} months · {p.days}</span></div>)}
            </div>
            <div className="card" style={{ padding: 18 }}>
              <div className="row-between"><h4>Documents</h4><button className="btn btn-ghost btn-sm" onClick={() => setStep(2)}>Edit</button></div>
              <div className="small mt-2">{[docs.registration && 'Business registration', docs.ctvet && 'CTVET certificate', `${docs.photos.length} photo(s)`].filter(Boolean).join(' · ')}</div>
            </div>
            <label className="check"><input type="checkbox" defaultChecked /> I confirm these details are accurate and I’m authorised to list this centre.</label>
          </div>
        )}

        <div className="row-between mt-8">
          {step === 0 ? <Link to="/signup" className="btn btn-ghost">Cancel</Link> : <button className="btn btn-ghost" onClick={() => setStep(step - 1)}><ArrowLeft size={16} /> Back</button>}
          <button className="btn btn-primary btn-lg" onClick={next} disabled={submitting}>{submitting ? <><span className="spinner" /> Submitting…</> : <>{step === 3 ? 'Submit for review' : 'Save and continue'} <ArrowRight size={17} /></>}</button>
        </div>
      </div>
    </div>
  );
}
