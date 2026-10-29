import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Menu, Search, LogOut, ExternalLink, Clock } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { useApp } from '../context/AppContext';
import { Avatar, Empty, Icon, Logo, PageSkeleton, useStackableTables } from './ui';
import { DataGate } from './DataGate';
import { ErrorBoundary } from './ErrorBoundary';
import { MaintenanceBanner, UserMenu, homeFor } from './Layout';
import { attentionReasons, sellerIdFor, sellerOrders } from '../lib/orders';
import { centreEnquiries } from '../lib/enquiries';
import { ACCESS_LABEL, adminAreaFor, canAdmin } from '../lib/access';
import { MY_CENTRE, PROVIDERS } from '../data/catalog';
import type { Role } from '../types';
import { setRouteMeta } from '../lib/pageMeta';

/** [path, icon, label, exact match?, badge count?, badge tone?] */
type NavItem = [to: string, icon: string, label: string, end?: boolean, badge?: number, tone?: 'warn'];

interface NavConfig {
  label: string;
  dark?: boolean;
  sections: { title?: string; items: NavItem[] }[];
  card?: { title: string; text: string; cta: [to: string, label: string] };
}

const NAVS: Record<Role, NavConfig> = {
  trainee: {
    label: 'Trainee',
    sections: [
      { items: [
        ['/app', 'LayoutDashboard', 'Dashboard', true],
        ['/search', 'Search', 'Find training'],
        ['/app/courses', 'BookOpen', 'My courses'],
        ['/app/saved', 'Heart', 'Saved providers'],
        ['/app/enquiries', 'MessageSquare', 'My enquiries'],
        ['/app/orders', 'ShoppingBag', 'My orders'],
      ] },
      { title: 'Account', items: [
        ['/app/settings', 'UserRound', 'My profile'],
        ['/help', 'LifeBuoy', 'Help'],
      ] },
    ],
    card: { title: 'Not sure which trade?', text: 'Compare fees and intake dates across {centres} centres.', cta: ['/search', 'Explore trades'] },
  },
  trainer: {
    label: 'Training centre',
    sections: [
      { items: [
        ['/trainer', 'LayoutDashboard', 'Overview', true],
        ['/trainer/enquiries', 'Inbox', 'Enquiries'],
        ['/trainer/orders', 'ShoppingBag', 'Orders'],
        ['/trainer/listings', 'Store', 'Listings'],
        ['/trainer/programmes', 'GraduationCap', 'Programmes'],
        ['/trainer/centre', 'Building2', 'Centre profile'],
        ['/trainer/verification', 'ShieldCheck', 'Verification'],
      ] },
      { title: 'Account', items: [
        ['/trainer/settings', 'Settings', 'Settings'],
        ['/help', 'LifeBuoy', 'Help'],
      ] },
    ],
    card: { title: 'Get the Fliptech visit badge', text: 'Verified centres get 3× more enquiries.', cta: ['/trainer/verification', 'Book a visit'] },
  },
  admin: {
    label: 'Super admin',
    dark: true,
    sections: [
      { items: [
        ['/admin', 'LayoutDashboard', 'Overview', true],
        ['/admin/verification', 'ShieldCheck', 'Verification queue'],
        ['/admin/providers', 'Building2', 'Providers'],
        ['/admin/users', 'Users', 'Users'],
        ['/admin/enquiries', 'MessagesSquare', 'Enquiries'],
        ['/admin/orders', 'ShoppingBag', 'Orders', false, undefined, 'warn'],
      ] },
      { title: 'Platform', items: [
        ['/admin/trades', 'Shapes', 'Trades & areas'],
        ['/admin/settings', 'Settings', 'Settings'],
      ] },
    ],
  },
};

export default function DashboardLayout({ role }: { role: Role }) {
  const { user, logout, orders, enquiries } = useApp();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
    // The longest menu link that contains this address, e.g. /app/courses for a course player page.
    const items = NAVS[role].sections.flatMap((s) => s.items);
    const item = items.filter(([to, , , end]) => (end ? loc.pathname === to : loc.pathname === to || loc.pathname.startsWith(`${to}/`)))
      .sort((a, b) => b[0].length - a[0].length)[0];
    setRouteMeta({ title: `${item?.[2] ?? 'Dashboard'} · ${NAVS[role].label}` });
  }, [loc.pathname, role]);
  const mainRef = useRef<HTMLElement>(null);
  const sideRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  // Phone menu: focus its first link when it opens; Escape closes it and returns to the menu button.
  useEffect(() => {
    if (!open) return;
    sideRef.current?.querySelector<HTMLElement>('nav a')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); toggleRef.current?.focus(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  useStackableTables(mainRef);

  if (!user) return <Navigate to={`/signin?next=${encodeURIComponent(loc.pathname)}`} replace />;
  if (user.role !== role) return <Navigate to={homeFor(user.role)} replace />;

  const base = NAVS[role];
  // Admins only see the parts of the admin area their access level includes.
  const allowed = (to: string) => role !== 'admin' || (() => { const area = adminAreaFor(to); return !area || canAdmin(user.access, area); })();
  const cfg: NavConfig = {
    ...base,
    label: role === 'admin' ? ACCESS_LABEL[user.access ?? 'super'] : base.label,
    sections: base.sections.map((sec) => ({ ...sec, items: sec.items.filter(([to]) => allowed(to)) })).filter((sec) => sec.items.length),
  };
  const pageAllowed = allowed(loc.pathname);
  // A new centre isn't public until Fliptech approves it.
  const awaitingApproval = role === 'trainer' && !!user.centreId && MY_CENTRE?.id === user.centreId;
  // Counts that change as the user works, overriding the static badges in NAVS.
  const liveBadges: Record<string, number> = role === 'trainer'
    ? {
      '/trainer/orders': sellerOrders(orders, sellerIdFor(user)).filter((so) => so.status === 'New').length,
      '/trainer/enquiries': centreEnquiries(enquiries, sellerIdFor(user)).filter((e) => e.centreUnread).length,
    }
    : role === 'admin'
      ? { '/admin/orders': orders.filter((o) => attentionReasons(o).length > 0).length }
      : {};
  // Overviews are stat tiles and cards; every other dashboard page is a title and a list.
  const skeleton = <PageSkeleton kind={loc.pathname === homeFor(role) ? 'dashboard' : 'list'} label="Loading page" />;
  return (
    <div className={`dash ${open ? 'open' : ''}`}>
      <a className="skip-link" href="#main">Skip to content</a>
      <div className="scrim" onClick={() => setOpen(false)} />
      <aside ref={sideRef} id="dash-menu" aria-label={`${cfg.label} menu`} className={`side ${cfg.dark ? 'dark' : ''}`}>
        <div className="side-logo"><Logo light={cfg.dark} to={homeFor(role)} /></div>
        <div className="side-role">
          <Avatar name={user.name} src={user.avatar} size="sm" />
          <div className="grow">
            <div className="bold ellipsis" style={{ color: cfg.dark ? '#fff' : 'var(--ink)', fontSize: 13.5 }}>{user.name}</div>
            <div className="xs">{cfg.label}</div>
          </div>
        </div>
        {cfg.sections.map((s, i) => (
          <div key={i}>
            {s.title && <div className="side-section">{s.title}</div>}
            <nav>
              {s.items.map(([to, icon, label, end, badge, tone]) => (
                <NavLink key={to} to={to} end={end}>
                  <Icon name={icon} /> {label}
                  {(liveBadges[to] ?? badge) ? <span className={`nbadge ${tone || ''}`}>{liveBadges[to] ?? badge}</span> : null}
                </NavLink>
              ))}
            </nav>
          </div>
        ))}
        <div className="side-foot">
          {cfg.card && (
            <div className="side-card">
              <div className="bold" style={{ fontSize: 14 }}>{cfg.card.title}</div>
              <p className="small muted mt-1">{cfg.card.text.replace('{centres}', String(PROVIDERS.length))}</p>
              <Link to={cfg.card.cta[0]} className="btn btn-primary btn-sm mt-3">{cfg.card.cta[1]}</Link>
            </div>
          )}
          <nav>
            <Link to="/"><ExternalLink /> View public site</Link>
            <a href="#" onClick={(e) => { e.preventDefault(); logout(); nav('/'); }}><LogOut /> Sign out</a>
          </nav>
        </div>
      </aside>
      <div className="dash-main">
        <MaintenanceBanner />
        <header className="topbar">
          <button ref={toggleRef} className="icon-btn side-toggle" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} aria-controls="dash-menu"><Menu size={18} /></button>
          <form className="search input-icon" role="search" onSubmit={(e) => {
            e.preventDefault();
            const q = new FormData(e.currentTarget).get('q')?.toString().trim() ?? '';
            nav(`${HEADER_SEARCH[role].to}${q ? `?q=${encodeURIComponent(q)}` : ''}`);
          }}>
            <Search size={17} />
            <input name="q" type="search" className="input" placeholder={HEADER_SEARCH[role].placeholder} aria-label={HEADER_SEARCH[role].placeholder.replace('…', '')} enterKeyHint="search" key={loc.pathname} />
          </form>
          <div className="row" style={{ marginLeft: 'auto', gap: 10 }}>
            <NotificationBell user={user} />
            <UserMenu />
          </div>
        </header>
        <main ref={mainRef} id="main" tabIndex={-1} className="dash-content fade-in" key={loc.pathname}>
          {awaitingApproval && (
            <div className="notice warn mb-6"><Clock size={18} /><div><b>Your centre is waiting for verification.</b> Trainees can’t see it yet. You can set up your programmes and profile in the meantime — we’ll notify you when it’s approved.</div></div>
          )}
          {pageAllowed ? (
            // The surrounding div is keyed by path, so a crash on one page clears when you navigate away.
            <ErrorBoundary>
              <Suspense fallback={skeleton}>
                {/* Trainee and trainer pages are built from the user's own data; admin pages load their own. */}
                {role === 'admin' ? <Outlet /> : <DataGate skeleton={skeleton}><Outlet /></DataGate>}
              </Suspense>
            </ErrorBoundary>
          ) : (
            <div className="card"><Empty icon="ShieldAlert" title="This isn’t part of your role" text={`Your role (${cfg.label}) doesn’t include this page. Ask a super admin if you need it.`} action={<Link to="/admin" className="btn btn-secondary">Back to overview</Link>} /></div>
          )}
        </main>
      </div>
    </div>
  );
}

/** Where the search box at the top of each dashboard takes you. */
const HEADER_SEARCH: Record<Role, { to: string; placeholder: string }> = {
  trainee: { to: '/search', placeholder: 'Search training…' },
  trainer: { to: '/trainer/enquiries', placeholder: 'Search enquiries…' },
  admin: { to: '/admin/providers', placeholder: 'Search providers…' },
};

export function PageTitle({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="dash-title">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className="row wrap">{children}</div>}
    </div>
  );
}
