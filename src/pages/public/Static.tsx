import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, CheckCircle2, Inbox, BadgeCheck, CalendarRange, BarChart3, ArrowRight, Compass, Target, HeartHandshake } from 'lucide-react';
import { IMG, resized } from '../../assets/images';
import { Img, SIZES } from '../../components/ui';
import { SITE } from '../../data/catalog';

const POLICY = [
  ['intro', 'Introduction', 'Fliptech Skills Hub (operated by Fliptech Engineering Solutions) respects your privacy and is committed to protecting your personal data in accordance with Ghana’s Data Protection Act, 2012 (Act 843). This policy explains what we collect, why, and the choices you have.'],
  ['collect', 'Information we collect', 'We collect information you provide when you create an account, send an enquiry or register a training centre — such as your name, phone number, email address, area and messages. For training centres we also collect business registration documents and photos. We automatically collect basic usage data such as pages visited and device type.'],
  ['use', 'How we use your information', 'To provide and improve the platform, connect trainees with training providers, verify training centres, send updates you have asked for, and keep the platform safe from fraud and spam.'],
  ['share', 'Data sharing', 'We only share your information with training providers when you send an enquiry, and with trusted service providers who help us operate the platform (for example SMS delivery and hosting). We never sell your personal data.'],
  ['retain', 'How long we keep data', 'Account data is kept while your account is active. Enquiries are kept for 24 months so you and the provider can refer back to them, then deleted or anonymised.'],
  ['rights', 'Your rights', 'You can request access, correction or deletion of your personal data at any time by contacting us at privacy@fliptech.com or from your account settings. You may also complain to the Data Protection Commission of Ghana.'],
  ['contact', 'Contact us', 'Fliptech Engineering Solutions, Osu, Accra. Email privacy@fliptech.com or call 030 222 1100.'],
];

export function Privacy() {
  return (
    <div className="container" style={{ paddingTop: 40 }}>
      <div className="grid-3-1" style={{ gridTemplateColumns: '240px 1fr', gap: 48 }}>
        <nav className="toc hide-m" aria-label="On this page">
          <div className="xs bold muted mb-2" style={{ textTransform: 'uppercase', letterSpacing: '.08em' }}>On this page</div>
          {POLICY.map(([id, t], i) => <a key={id} href={`#${id}`}>{i + 1}. {t}</a>)}
        </nav>
        <article className="prose">
          <h1>Privacy Policy</h1>
          <p className="muted mt-2">Last updated: 1 October 2026</p>
          {POLICY.map(([id, t, body], i) => (
            <section key={id} id={id}>
              <h2>{i + 1}. {t}</h2>
              <p>{body}</p>
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}

export function Terms() {
  return (
    <div className="container prose" style={{ paddingTop: 40 }}>
      <h1>Terms of Use</h1>
      <p className="muted mt-2">Last updated: 1 October 2026</p>
      <h2>Using Fliptech Skills Hub</h2>
      <p>Fliptech Skills Hub is a directory that helps people find training providers. We do not run the training ourselves and are not a party to any agreement between you and a provider.</p>
      <h2>Listings</h2>
      <p>Training centres are responsible for keeping their fees, intake dates and programme details accurate. Verification badges describe checks we performed at a point in time.</p>
      <h2>Acceptable use</h2>
      <p>Don’t send spam, impersonate others or post misleading information. We may suspend accounts that break these rules.</p>
    </div>
  );
}

const FAQ = [
  ['Is Fliptech Skills Hub free?', 'Yes. Searching, saving providers and sending enquiries is completely free for trainees. Listing a training centre is also free.'],
  ['What does “CTVET registered” mean?', 'The Commission for Technical and Vocational Education and Training (CTVET) regulates TVET providers in Ghana. We check a centre’s registration number before showing this badge.'],
  ['What does “Fliptech visited” mean?', 'Our field team visited the centre in person to confirm the workshop exists, has working equipment and has instructors on site.'],
  ['Do I pay the fee through Fliptech?', 'No. You pay the training centre directly. We recommend always visiting a centre before paying any money.'],
  ['How quickly will a centre reply?', 'Most centres reply within one working day. You can see replies in “My enquiries” if you have an account.'],
  ['How do I report a problem with a centre?', 'Use the “Report” option on your enquiry, or email hello@fliptech.com. Our team reviews every report.'],
];

export function Help() {
  const [open, setOpen] = useState(0);
  return (
    <div className="container" style={{ maxWidth: 820, paddingTop: 48 }}>
      <div style={{ textAlign: 'center' }}>
        <div className="eyebrow">Help centre</div>
        <h1>Frequently asked questions</h1>
        <p className="muted mt-2">Can’t find what you need? Call us on {SITE.supportPhone} or email <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>.</p>
      </div>
      <div className="card mt-8">
        {FAQ.map(([q, a], i) => (
          <div key={q} style={{ borderBottom: i < FAQ.length - 1 ? '1px solid var(--line-2)' : 0 }}>
            <button onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i} style={{ width: '100%', border: 0, background: 'none', padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700, fontSize: 15.5, textAlign: 'left', color: 'var(--ink)' }}>
              {q}<ChevronDown size={18} style={{ transition: '.2s', transform: open === i ? 'rotate(180deg)' : 'none', flexShrink: 0 }} />
            </button>
            {open === i && <p className="muted fade-in" style={{ padding: '0 22px 20px' }}>{a}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function About() {
  return (
    <div className="container" style={{ paddingTop: 48 }}>
      <div className="grid-2" style={{ alignItems: 'center', gap: 48 }}>
        <div>
          <div className="eyebrow">About us</div>
          <h1>Practical skills. Brighter futures.</h1>
          <p className="muted mt-4" style={{ fontSize: 16.5 }}>Thousands of young people in Greater Accra want to learn a trade, but finding a trustworthy centre with clear fees is hard. Fliptech Skills Hub brings every option into one place — checked, compared and one tap away.</p>
        </div>
        <div style={{ borderRadius: 24, overflow: 'hidden', aspectRatio: '4/3' }}><Img src={IMG.team} alt="" trade="tailoring" sizes={SIZES.half} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
      </div>
      <div className="grid-3 mt-8">
        {([[Compass, 'Our mission', 'Make quality technical training easy to find and easy to trust.'], [Target, 'Our focus', 'Greater Accra first — then every region in Ghana.'], [HeartHandshake, 'Our promise', 'Honest listings, real verification, and no hidden fees for trainees.']] as const).map(([I, t, d]) => (
          <div key={t} className="card card-pad"><div className="stat-ico tone-brand mb-4"><I size={20} /></div><h3>{t}</h3><p className="muted mt-2">{d}</p></div>
        ))}
      </div>
    </div>
  );
}

export function ForTrainers() {
  return (
    <>
      <section className="hero">
        <div className="hero-bg"><Img src={resized(IMG.workshop, 1600)} alt="" trade="carpentry" sizes={SIZES.full} priority /></div>
        <div className="container"><div className="hero-inner">
          <div className="hero-eyebrow"><b>FREE</b> No commission, ever</div>
          <h1>Fill your intakes with <em>serious trainees</em></h1>
          <p className="lead">List your centre on Fliptech Skills Hub and receive enquiries from motivated young people across Greater Accra.</p>
          <div className="row mt-6 wrap"><Link to="/trainer/register" className="btn btn-primary btn-lg">Register your centre <ArrowRight size={17} /></Link><Link to="/signin" className="btn btn-white btn-lg">Trainer sign in</Link></div>
        </div></div>
      </section>
      <div className="container section">
        <div className="grid-2" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
          {([[Inbox, 'Enquiries to your phone', 'Every enquiry lands in your inbox and by SMS, with the trainee’s number ready to call.'], [BadgeCheck, 'Trust badges', 'Get CTVET and Fliptech-visited badges that make trainees choose you with confidence.'], [CalendarRange, 'Manage intakes', 'Update fees, intake dates and places remaining in seconds.'], [BarChart3, 'See what works', 'Track profile views and enquiries for each programme.']] as const).map(([I, t, d]) => (
            <div key={t} className="card card-pad"><div className="stat-ico tone-brand mb-4"><I size={20} /></div><h3>{t}</h3><p className="muted mt-2">{d}</p></div>
          ))}
        </div>
        <div className="card card-pad mt-8" style={{ display: 'grid', gap: 12 }}>
          <h3>How listing works</h3>
          {['Create your centre profile (5 minutes)', 'Add your programmes, fees and intake dates', 'Upload documents for verification', 'Start receiving enquiries'].map((s) => <div key={s} className="row"><CheckCircle2 size={18} color="var(--success-500)" /> {s}</div>)}
        </div>
      </div>
    </>
  );
}

export function NotFound() {
  return (
    <div className="container" style={{ paddingTop: 80, textAlign: 'center' }}>
      <div style={{ fontSize: 88, fontWeight: 800, letterSpacing: '-.05em', color: 'var(--brand-100)' }}>404</div>
      <h1>We couldn’t find that page</h1>
      <p className="muted mt-2">It may have moved, or the link might be broken.</p>
      <div className="row mt-6" style={{ justifyContent: 'center' }}><Link to="/" className="btn btn-primary">Go home</Link><Link to="/search" className="btn btn-secondary">Find training</Link></div>
    </div>
  );
}
