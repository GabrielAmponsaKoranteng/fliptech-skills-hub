import { Suspense, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, matchPath, useLocation, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { Wrench, Menu, X, LayoutDashboard, LogOut, Heart, MessageSquare, Settings, ChevronDown, Facebook, Instagram, Linkedin, Youtube, Search, ShoppingBag, ShoppingCart, Play, Smartphone, MessageCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Avatar, Loading, Logo } from './ui';
import { ErrorBoundary } from './ErrorBoundary';
import { NotificationBell } from './NotificationBell';
import { SITE } from '../data/catalog';
import type { Role } from '../types';
import { setRouteMeta, type PageMeta } from '../lib/pageMeta';

const HOMES: Record<Role, string> = { trainee: '/app', trainer: '/trainer', admin: '/admin' };
export const homeFor = (role: Role | undefined) => (role ? HOMES[role] : '/');

export function UserMenu({ dark = false }: { dark?: boolean }) {
  const { user, logout } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  if (!user) return null;
  const roleLabel = ({ trainee: 'Trainee', trainer: 'Training centre', admin: 'Super admin' } satisfies Record<Role, string>)[user.role];
  return (
    <div className="menu-wrap" ref={ref}>
      <button className="btn btn-ghost" style={{ paddingLeft: 6, paddingRight: 8, color: dark ? '#fff' : undefined }} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Avatar name={user.name} src={user.avatar} size="sm" />
        <span className="hide-m" style={{ fontSize: 14 }}>{user.name.split(' ')[0]}</span>
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="menu" onClick={() => setOpen(false)}>
          <div className="menu-head">
            <div className="bold">{user.name}</div>
            <div className="xs muted">{user.email}</div>
            <span className="badge badge-brand mt-2">{roleLabel}</span>
          </div>
          <Link to={homeFor(user.role)}><LayoutDashboard size={16} /> Dashboard</Link>
          {user.role === 'trainee' && <Link to="/app/saved"><Heart size={16} /> Saved providers</Link>}
          {user.role === 'trainee' && <Link to="/app/enquiries"><MessageSquare size={16} /> My enquiries</Link>}
          {user.role === 'trainee' && <Link to="/app/orders"><ShoppingBag size={16} /> My orders</Link>}
          <Link to={`${homeFor(user.role)}/settings`}><Settings size={16} /> Settings</Link>
          <button onClick={() => { logout(); nav('/'); }}><LogOut size={16} /> Sign out</button>
        </div>
      )}
    </div>
  );
}

export function Navbar() {
  const { user, cart } = useApp();
  const cartCount = cart.reduce((n, i) => n + i.qty, 0);
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => { setOpen(false); }, [loc.pathname]);
  const links = [
    ['/', 'Home'],
    ['/search', 'Find Training'],
    ['/courses', 'Online Learning'],
    ['/marketplace', 'Marketplace'],
    ['/for-trainers', 'Become a Provider'],
    ['/about', 'About'],
    ['/contact', 'Contact'],
  ];
  return (
    <header className="nav">
      <div className="container nav-inner">
        <Logo />
        <nav className="nav-links" aria-label="Main">
          {links.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'}>{label}</NavLink>)}
        </nav>
        <div className="nav-actions">
          <Link to="/search" className="btn btn-ghost btn-icon hide-m" aria-label="Search"><Search size={20} /></Link>
          {cart.length > 0 && (
            <Link to="/cart" className="btn btn-ghost btn-icon nav-cart" aria-label={`Cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`}>
              <ShoppingCart size={20} /><span className="nav-cart-count">{cartCount}</span>
            </Link>
          )}
          {user ? (
            <>
              <Link to={homeFor(user.role)} className="btn btn-soft btn-sm hide-m"><LayoutDashboard size={15} /> Dashboard</Link>
              <NotificationBell user={user} />
              <UserMenu />
            </>
          ) : (
            <>
              <Link to="/signin" className="btn btn-outline btn-sm hide-m">Sign In</Link>
              <Link to="/signup" className="btn btn-primary btn-sm hide-m">Register</Link>
            </>
          )}
        </div>
        <button className="btn btn-ghost btn-icon nav-burger" onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      <div className={`mobile-menu ${open ? 'open' : ''}`}>
        {links.map(([to, label]) => <Link key={to} to={to}>{label}</Link>)}
        {!user && (
          <div className="row mt-2">
            <Link to="/signin" className="btn btn-outline grow">Sign In</Link>
            <Link to="/signup" className="btn btn-primary grow">Register</Link>
          </div>
        )}
      </div>
    </header>
  );
}

const FOOTER_COLS: [title: string, links: [to: string, label: string][]][] = [
  ['Quick Links', [['/', 'Home'], ['/search', 'Find Training'], ['/courses', 'Online Learning'], ['/marketplace', 'Marketplace']]],
  ['Support', [['/about', 'About Us'], ['/contact', 'Contact Us'], ['/help', 'Help Centre'], ['/terms', 'Terms of Service'], ['/privacy', 'Privacy Policy']]],
  ['For Providers', [['/trainer/register', 'Register as Trainer'], ['/signup', 'Register as Seller'], ['/for-trainers', 'Subscription Plans'], ['/for-trainers', 'Provider Guide']]],
];

/** TikTok mark (not in lucide); sized like the lucide icons beside it. */
function TikTok({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

/** Official Fliptech accounts. Entries with an empty URL are hidden until a link is added. */
const SOCIALS: [LucideIcon | typeof TikTok, string, string][] = [
  [Facebook, 'Facebook', 'https://www.facebook.com/profile.php?id=61596125247213'],
  [Instagram, 'Instagram', 'https://www.instagram.com/fliiptechskillshub'],
  [Linkedin, 'LinkedIn', ''],
  [Youtube, 'YouTube', ''],
  [TikTok, 'TikTok', 'https://www.tiktok.com/@fliiptechskillshub'],
  [MessageCircle, 'WhatsApp', 'https://wa.me/233597389575'],
];

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Logo />
            <p className="mt-4 small">A Fliptech Engineering Solutions platform</p>
            <p className="small">Find • Compare • Connect • Build Skills</p>
          </div>
          {FOOTER_COLS.map(([title, items]) => (
            <div key={title}>
              <h4>{title}</h4>
              <ul>{items.map(([to, label]) => <li key={label}><Link to={to}>{label}</Link></li>)}</ul>
            </div>
          ))}
          <div>
            <h4>Connect With Us</h4>
            <div className="row" style={{ gap: 6 }}>
              {SOCIALS.filter(([, , url]) => url).map(([I, label, url]) => (
                <a key={label} href={url} target="_blank" rel="noopener noreferrer" aria-label={`Fliptech on ${label} (opens in a new tab)`} className="social-btn"><I size={18} /></a>
              ))}
            </div>
          </div>
          <div className="footer-app">
            <h4>Download Our App</h4>
            <div className="row wrap" style={{ gap: 8 }}>
              <a href="#" className="store-btn" aria-label="Get it on Google Play (coming soon)"><Play size={18} fill="currentColor" /><span><small>GET IT ON</small>Google Play</span></a>
              <a href="#" className="store-btn" aria-label="Download on the App Store (coming soon)"><Smartphone size={18} /><span><small>Download on the</small>App Store</span></a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 Fliptech Skills Hub. All rights reserved.</span>
          <span>Made with care in Accra, Ghana</span>
        </div>
      </div>
    </footer>
  );
}

/** Shown on every page while an admin has maintenance mode switched on. */
export function MaintenanceBanner() {
  if (!SITE.maintenance) return null;
  return (
    <div className="site-banner warn" role="status">
      <Wrench size={16} /> We’re doing some maintenance, so parts of Fliptech may be slow or unavailable. Need help? Call {SITE.supportPhone}.
    </div>
  );
}

/**
 * Default titles for public pages, first match wins. Pages about one centre, course or product
 * replace these with its name (see usePageMeta).
 */
const PUBLIC_META: [pattern: string, meta: PageMeta][] = [
  ['/', {}],
  ['/search', { title: 'Find training providers', description: 'Compare fees, course length, intake dates and verified training centres across Greater Accra.' }],
  ['/providers/:id/enquire', { title: 'Send an enquiry' }],
  ['/providers/:id', { title: 'Training centre' }],
  ['/courses', { title: 'Online courses', description: 'Recorded courses from skilled professionals. Learn at your own pace, on your phone or laptop.' }],
  ['/courses/:id', { title: 'Online course' }],
  ['/marketplace', { title: 'Marketplace', description: 'Products made by trainers, trainees and skilled professionals across Ghana.' }],
  ['/marketplace/:id', { title: 'Marketplace' }],
  ['/cart', { title: 'Your cart' }],
  ['/checkout', { title: 'Checkout' }],
  ['/orders/:id', { title: 'Your order' }],
  ['/signin', { title: 'Sign in' }],
  ['/signup', { title: 'Create an account' }],
  ['/forgot-password', { title: 'Forgot your password' }],
  ['/reset-password', { title: 'Choose a new password' }],
  ['/trainer/register', { title: 'Register your training centre' }],
  ['/for-trainers', { title: 'For training providers', description: 'List your training centre on Fliptech Skills Hub and get enquiries from trainees near you.' }],
  ['/about', { title: 'About us' }],
  ['/contact', { title: 'Contact us' }],
  ['/help', { title: 'Help centre' }],
  ['/privacy', { title: 'Privacy policy' }],
  ['/terms', { title: 'Terms of service' }],
];
const metaFor = (pathname: string): PageMeta =>
  PUBLIC_META.find(([pattern]) => matchPath(pattern, pathname))?.[1] ?? { title: 'Page not found' };

export function PublicLayout({ bare = false }: { bare?: boolean }) {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); setRouteMeta(metaFor(pathname)); }, [pathname]);
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <MaintenanceBanner />
      <Navbar />
      <main id="main" tabIndex={-1}>
        {/* Keyed by path so a crash on one page clears when you navigate away. */}
        <ErrorBoundary key={pathname}>
          {/* A full-height placeholder, so the footer doesn't flash up and then jump down when the page arrives. */}
          <Suspense fallback={<div className="container" style={{ paddingTop: 40, minHeight: '100vh' }}><Loading label="Loading page" /></div>}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
      {!bare && <Footer />}
    </>
  );
}
