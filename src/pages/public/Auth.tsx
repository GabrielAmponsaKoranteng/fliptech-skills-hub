import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Check, UserRound, Building2, ShieldCheck, GraduationCap, ArrowRight, PauseCircle, MailCheck, KeyRound, Info } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { IMG } from '../../assets/images';
import { SITE } from '../../data/catalog';
import { API_MODE, api } from '../../api';
import { errorMessage, fieldErrors } from '../../api/errors';
import { Img } from '../../components/ui';
import { homeFor } from '../../components/Layout';
import type { FieldEvent, Role, User } from '../../types';

function AuthShell({ img, quote, who, children }: { img: string; quote: string; who: string; children: ReactNode }) {
  return (
    <div className="auth-wrap">
      <div className="auth-side">
        <Img src={img} alt="" trade="welding" sizes="50vw" priority />
        <blockquote>“{quote}”</blockquote>
        <div className="small mt-4" style={{ color: '#c9d4ea' }}>{who}</div>
      </div>
      <div className="auth-main"><div className="auth-box fade-in">{children}</div></div>
    </div>
  );
}

/** Shown instead of a sign-up form while an admin has switched registrations off. */
export function Paused({ title, text }: { title: string; text: string }) {
  return (
    <div className="container" style={{ maxWidth: 560, paddingTop: 64, paddingBottom: 40 }}>
      <div className="card card-pad fade-in" style={{ textAlign: 'center', padding: 40 }}>
        <div className="empty-ico" style={{ width: 68, height: 68, borderRadius: 22 }}><PauseCircle size={32} /></div>
        <h1 className="as-h2">{title}</h1>
        <p className="muted mt-2">{text} Questions? Call {SITE.supportPhone} or email <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>.</p>
        <div className="row mt-6" style={{ justifyContent: 'center', gap: 10 }}>
          <Link to="/signin" className="btn btn-secondary">Sign in</Link>
          <Link to="/search" className="btn btn-primary">Browse training</Link>
        </div>
      </div>
    </div>
  );
}

export function SignIn() {
  const { login, signIn } = useApp();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [show, setShow] = useState(false);
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  /** Which sign-in is in progress: the form, or one of the demo roles */
  const [busy, setBusy] = useState<'form' | Role | null>(null);

  const done = (u: User | undefined) => { if (u) nav(params.get('next') || homeFor(u.role)); };
  const go = async (role: Role) => {
    setBusy(role);
    done(await login(role));
    setBusy(null);
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!id || !pw) return setErr('Enter your phone/email and password.');
    setBusy('form');
    done(await signIn(id, pw));
    setBusy(null);
  };

  return (
    <AuthShell img={IMG.welding3} quote="We filled our October welding intake two weeks early — every enquiry came through Fliptech." who="Emmanuel Tetteh · Accra Central Welding Works">
      <h1 className="as-h2">Welcome back</h1>
      <p className="muted mt-2">Sign in to manage your saved providers, enquiries and listings.</p>
      <form className="stack mt-6" onSubmit={submit} noValidate>
        <div className="field">
          <label className="label" htmlFor="sid">Phone number or email</label>
          <input id="sid" className="input" placeholder="e.g. 024 123 4567" value={id} onChange={(e) => { setId(e.target.value); setErr(''); }} autoComplete="username" />
        </div>
        <div className="field">
          <div className="row-between"><label className="label" htmlFor="spw">Password</label><Link to="/forgot-password" className="small bold">Forgot password?</Link></div>
          <div style={{ position: 'relative' }}>
            <input id="spw" className="input" type={show ? 'text' : 'password'} value={pw} onChange={(e) => { setPw(e.target.value); setErr(''); }} autoComplete="current-password" style={{ paddingRight: 44 }} />
            <button type="button" className="btn btn-ghost btn-icon btn-sm" style={{ position: 'absolute', right: 5, top: 5 }} onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button>
          </div>
        </div>
        {err && <div className="error-text">{err}</div>}
        <label className="check"><input type="checkbox" defaultChecked /> Keep me signed in</label>
        <button className="btn btn-primary btn-lg btn-block" disabled={!!busy}>{busy === 'form' ? <><span className="spinner" /> Signing in…</> : 'Sign in'}</button>
      </form>
      <div className="or mt-6 mb-4">Explore the demo as</div>
      <div className="demo-roles">
        <button onClick={() => void go('trainee')} disabled={!!busy}><GraduationCap size={20} /> {busy === 'trainee' ? 'Signing in…' : 'Trainee'}</button>
        <button onClick={() => void go('trainer')} disabled={!!busy}><Building2 size={20} /> {busy === 'trainer' ? 'Signing in…' : 'Trainer'}</button>
        <button onClick={() => void go('admin')} disabled={!!busy}><ShieldCheck size={20} /> {busy === 'admin' ? 'Signing in…' : 'Super admin'}</button>
      </div>
      <p className="small muted mt-6" style={{ textAlign: 'center' }}>New to Fliptech? <Link to="/signup" className="bold">Create an account</Link></p>
    </AuthShell>
  );
}

export function SignUp() {
  const [role, setRole] = useState<'trainee' | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '', agree: false });
  const [touched, setTouched] = useState(false);
  const { registerTrainee, toast } = useApp();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: FieldEvent) => {
    const t = e.target;
    const value = t instanceof HTMLInputElement && t.type === 'checkbox' ? t.checked : t.value;
    setForm((f) => ({ ...f, [k]: value }));
  };
  const valid = form.name.trim() && /^0\d{2}\s?\d{3}\s?\d{4}$/.test(form.phone.trim()) && form.password.length >= 8 && form.agree;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    setBusy(true);
    const u = await registerTrainee({ name: form.name, phone: form.phone, email: form.email || undefined, password: form.password });
    setBusy(false);
    if (!u) return;
    toast('Welcome to Fliptech Skills Hub!');
    nav('/app');
  };

  if (role === 'trainee' && !SITE.signups) return <Paused title="New sign-ups are paused" text="We’re not creating new trainee accounts right now. You can still browse training and send enquiries without an account." />;

  if (role !== 'trainee') {
    return (
      <div className="container" style={{ maxWidth: 760, paddingTop: 56, paddingBottom: 40 }}>
        <div style={{ textAlign: 'center' }} className="fade-in">
          <h1>Join Fliptech Skills Hub</h1>
          <p className="muted mt-2">Create an account to save providers, send enquiries and get updates.</p>
        </div>
        <div className="role-cards mt-8">
          <button className={`role-card ${role === 'trainee' ? 'on' : ''}`} onClick={() => setRole('trainee')}>
            <div className="ri tone-brand"><UserRound size={26} /></div>
            <h3>I’m looking for training</h3>
            <ul>
              {['Save favourite providers', 'Send enquiries', 'Get intake updates', 'It’s free and only takes a minute'].map((x) => <li key={x}><Check size={15} /> {x}</li>)}
            </ul>
            <span className="btn btn-primary btn-block mt-2">Continue as trainee <ArrowRight size={16} /></span>
          </button>
          <button className="role-card" onClick={() => nav('/trainer/register')}>
            <div className="ri tone-violet"><Building2 size={26} /></div>
            <h3>I run a training centre</h3>
            <ul>
              {['List your workshop', 'Reach more students', 'Showcase your programmes', 'Verify your centre with Fliptech'].map((x) => <li key={x}><Check size={15} /> {x}</li>)}
            </ul>
            <span className="btn btn-primary btn-block mt-2">Continue as trainer <ArrowRight size={16} /></span>
          </button>
        </div>
        <p className="small muted mt-8" style={{ textAlign: 'center' }}>Already have an account? <Link to="/signin" className="bold">Sign in</Link></p>
      </div>
    );
  }

  const err = (cond: boolean, msg: string) => touched && cond && <span className="error-text">{msg}</span>;
  return (
    <AuthShell img={IMG.tailoring1} quote="I compared five tailoring schools in one evening and enrolled the next week." who="Abena Owusu · Trainee, Madina">
      <button className="back-link" style={{ border: 0, background: 'none', padding: 0 }} onClick={() => setRole(null)}>← Choose a different account type</button>
      <h1 className="as-h2 mt-4">Create your trainee account</h1>
      <p className="muted mt-2">Free forever. We’ll never share your number without your permission.</p>
      <form className="stack mt-6" onSubmit={submit} noValidate>
        <div className="field">
          <label className="label" htmlFor="rn">Full name <span className="req">*</span></label>
          <input id="rn" className="input" placeholder="e.g. Kwame Mensah" value={form.name} onChange={set('name')} autoComplete="name" />
          {err(!form.name.trim(), 'Please enter your name')}
        </div>
        <div className="field">
          <label className="label" htmlFor="rp">Phone number <span className="req">*</span></label>
          <input id="rp" className="input" inputMode="tel" placeholder="e.g. 024 123 4567" value={form.phone} onChange={set('phone')} autoComplete="tel" />
          {err(!/^0\d{2}\s?\d{3}\s?\d{4}$/.test(form.phone.trim()), 'Enter a valid Ghana number')}
        </div>
        <div className="field">
          <label className="label" htmlFor="re">Email <span className="muted" style={{ fontWeight: 500 }}>(optional)</span></label>
          <input id="re" className="input" type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} autoComplete="email" />
        </div>
        <div className="field">
          <label className="label" htmlFor="rpw">Password <span className="req">*</span></label>
          <input id="rpw" className="input" type="password" value={form.password} onChange={set('password')} autoComplete="new-password" />
          <div className="progress" style={{ height: 5 }}><div style={{ width: `${Math.min(100, form.password.length * 10)}%`, background: form.password.length >= 8 ? 'var(--success-500)' : 'var(--accent)' }} /></div>
          <span className="hint">At least 8 characters</span>
        </div>
        <label className="check"><input type="checkbox" checked={form.agree} onChange={set('agree')} /> <span>I agree to the <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy Policy</Link></span></label>
        {err(!form.agree, 'Please accept the terms to continue')}
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? <><span className="spinner" /> Creating your account…</> : "Create account"}</button>
      </form>
      <p className="small muted mt-6" style={{ textAlign: 'center' }}>Already have an account? <Link to="/signin" className="bold">Sign in</Link></p>
    </AuthShell>
  );
}

export function ForgotPassword() {
  const [id, setId] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  /** Demo only: the mock can't send email, so it hands back the link it would have sent. */
  const [demoLink, setDemoLink] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!id.trim()) return setErr('Enter your phone number or email.');
    setBusy(true);
    const since = new Date().toISOString();
    try {
      await api.auth.requestPasswordReset(id);
      if (API_MODE === 'mock') {
        const { demoOutbox } = await import('../../api/mock');
        setDemoLink(demoOutbox('password_reset', since)?.link ?? null);
      }
      setSent(true);
    } catch (x) {
      setErr(errorMessage(x));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell img={IMG.welding3} quote="We filled our October welding intake two weeks early — every enquiry came through Fliptech." who="Emmanuel Tetteh · Accra Central Welding Works">
      {sent ? (
        <div className="fade-in">
          <div className="empty-ico" style={{ width: 64, height: 64, borderRadius: 20, margin: 0 }}><MailCheck size={28} /></div>
          <h1 className="as-h2 mt-4">Check your messages</h1>
          {/* Same message whether or not the account exists, so this page can't reveal who is registered. */}
          <p className="muted mt-2">If <b style={{ color: 'var(--ink)' }}>{id.trim()}</b> belongs to a Fliptech account, we’ve sent a link to reset your password. It works for 1 hour.</p>
          {API_MODE === 'mock' && (
            <div className="notice info mt-6"><Info size={18} /><div>
              <b>Demo:</b> no real emails or texts are sent.{' '}
              {demoLink ? <Link to={demoLink} className="bold">Open the reset link</Link> : 'No account matched, so no link was created.'}
            </div></div>
          )}
          <p className="small muted mt-6">Didn’t get it? <button type="button" className="btn-link bold" onClick={() => { setSent(false); setDemoLink(null); }}>Try again</button> or call {SITE.supportPhone}.</p>
        </div>
      ) : (
        <>
          <h1 className="as-h2">Forgot your password?</h1>
          <p className="muted mt-2">Enter the phone number or email on your account and we’ll send you a link to choose a new one.</p>
          <form className="stack mt-6" onSubmit={submit} noValidate>
            <div className="field">
              <label className="label" htmlFor="fid">Phone number or email</label>
              <input id="fid" className={`input ${err ? 'invalid' : ''}`} placeholder="e.g. 024 123 4567" value={id} onChange={(e) => { setId(e.target.value); setErr(''); }} autoComplete="username" autoFocus />
              {err && <span className="error-text">{err}</span>}
            </div>
            <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? <><span className="spinner" /> Sending…</> : 'Send reset link'}</button>
          </form>
        </>
      )}
      <p className="small muted mt-6" style={{ textAlign: 'center' }}>Remembered it? <Link to="/signin" className="bold">Back to sign in</Link></p>
    </AuthShell>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  /** The link itself is bad (expired/used), as opposed to a problem with what was typed */
  const [badLink, setBadLink] = useState(!token);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return setErr('Use at least 8 characters.');
    if (pw !== pw2) return setErr('The passwords don’t match.');
    setBusy(true);
    try {
      await api.auth.resetPassword(token, pw);
      setDone(true);
    } catch (x) {
      if (fieldErrors(x).password) setErr(fieldErrors(x).password);
      else { setBadLink(true); setErr(errorMessage(x)); }
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell img={IMG.tailoring1} quote="I compared five tailoring schools in one evening and enrolled the next week." who="Abena Owusu · Trainee, Madina">
      {done ? (
        <div className="fade-in">
          <div className="empty-ico" style={{ width: 64, height: 64, borderRadius: 20, margin: 0, background: 'var(--success-50)', color: 'var(--success)' }}><Check size={28} /></div>
          <h1 className="as-h2 mt-4">Password updated</h1>
          <p className="muted mt-2">You can now sign in with your new password.</p>
          <Link to="/signin" className="btn btn-primary btn-lg btn-block mt-6">Sign in</Link>
        </div>
      ) : badLink ? (
        <div className="fade-in">
          <h1 className="as-h2">This link doesn’t work</h1>
          <p className="muted mt-2">{err || 'The reset link is missing or incomplete.'} Reset links work once, for 1 hour.</p>
          <Link to="/forgot-password" className="btn btn-primary btn-lg btn-block mt-6">Get a new link</Link>
        </div>
      ) : (
        <>
          <div className="empty-ico" style={{ width: 56, height: 56, borderRadius: 18, margin: 0 }}><KeyRound size={24} /></div>
          <h1 className="as-h2 mt-4">Choose a new password</h1>
          <form className="stack mt-6" onSubmit={submit} noValidate>
            <div className="field">
              <label className="label" htmlFor="npw">New password</label>
              <div style={{ position: 'relative' }}>
                <input id="npw" className="input" type={show ? 'text' : 'password'} value={pw} onChange={(e) => { setPw(e.target.value); setErr(''); }} autoComplete="new-password" style={{ paddingRight: 44 }} autoFocus />
                <button type="button" className="btn btn-ghost btn-icon btn-sm" style={{ position: 'absolute', right: 5, top: 5 }} onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button>
              </div>
              <span className="hint">At least 8 characters</span>
            </div>
            <div className="field">
              <label className="label" htmlFor="npw2">Confirm new password</label>
              <input id="npw2" className="input" type={show ? 'text' : 'password'} value={pw2} onChange={(e) => { setPw2(e.target.value); setErr(''); }} autoComplete="new-password" />
            </div>
            {err && <div className="error-text">{err}</div>}
            <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? <><span className="spinner" /> Saving…</> : 'Save new password'}</button>
          </form>
        </>
      )}
    </AuthShell>
  );
}
