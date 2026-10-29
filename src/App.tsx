import { lazy, useEffect, useRef, useState, type ComponentType } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { currentTitle } from './lib/pageMeta';
import { PublicLayout } from './components/Layout';
import DashboardLayout from './components/DashboardLayout';
// The homepage is in the main bundle so the first visit paints fast; every other page is
// downloaded when first opened. Pages from the same file share one download (e.g. all admin pages).
import Home from './pages/public/Home';

/** Lazy-loads one named export of a page module. */
function page<M>(load: () => Promise<M>, name: keyof M) {
  return lazy(async () => ({ default: (await load())[name] as ComponentType }));
}

const publicShop = () => import('./pages/public/Shop');
const publicCart = () => import('./pages/public/Cart');
const publicListing = () => import('./pages/public/ListingDetail');
const publicStatic = () => import('./pages/public/Static');
const publicAuth = () => import('./pages/public/Auth');
const trainee = () => import('./pages/trainee/Trainee');
const traineeCourses = () => import('./pages/trainee/MyCourses');
const trainer = () => import('./pages/trainer/Trainer');
const admin = () => import('./pages/admin/Admin');

const publicSearch = () => import('./pages/public/Search');
const publicProvider = () => import('./pages/public/ProviderDetail');
const publicEnquiry = () => import('./pages/public/Enquiry');
const publicRegister = () => import('./pages/public/TrainerRegister');
const traineeOrders = () => import('./pages/trainee/Orders');
const sellerOrders = () => import('./pages/trainer/SellerOrders');
const sellerListings = () => import('./pages/trainer/Listings');
const adminOrders = () => import('./pages/admin/AdminOrders');

/**
 * Which page file each address needs, so it can start downloading at once (alongside the app's
 * start-up requests) instead of after start-up finishes. Checked in order; the first match wins.
 */
const ROUTE_FILES: [RegExp, () => Promise<unknown>][] = [
  [/^\/search\b/, publicSearch],
  [/^\/providers\/[^/]+\/enquire/, publicEnquiry],
  [/^\/providers\//, publicProvider],
  [/^\/trainer\/register/, publicRegister],
  [/^\/(signin|signup|forgot-password|reset-password)\b/, publicAuth],
  [/^\/(courses|marketplace)\/[^/]+/, publicListing],
  [/^\/(courses|marketplace|contact)\b/, publicShop],
  [/^\/(cart|checkout|orders\/)/, publicCart],
  [/^\/app\/orders/, traineeOrders],
  [/^\/app\/courses/, traineeCourses],
  [/^\/app\b/, trainee],
  [/^\/trainer\/orders/, sellerOrders],
  [/^\/trainer\/listings/, sellerListings],
  [/^\/trainer\b/, trainer],
  [/^\/admin\/orders/, adminOrders],
  [/^\/admin\b/, admin],
  [/^\/(about|for-trainers|help|privacy|terms)\b/, publicStatic],
];

/** Starts downloading the page file for `pathname` (nothing for the homepage, which is built in). */
export function preloadRoute(pathname: string) {
  const load = ROUTE_FILES.find(([re]) => re.test(pathname))?.[1];
  if (load) void load().catch(() => { /* the page's own loader retries and shows the error */ });
}

/**
 * Once the first page is up and the browser is idle, fetch the public pages people open next
 * (search, a centre, the shops) so those clicks are instant. Skipped when the visitor has asked
 * to save data or is on a very slow connection.
 */
export function prefetchLikelyPages() {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (conn?.saveData || /(^|-)2g$/.test(conn?.effectiveType ?? '')) return;
  const idle = (cb: () => void) => ('requestIdleCallback' in window ? window.requestIdleCallback(cb, { timeout: 4000 }) : setTimeout(cb, 2000));
  idle(() => { for (const load of [publicSearch, publicProvider, publicShop]) void load().catch(() => {}); });
}

const SearchPage = page(publicSearch, 'default');
const ProviderDetail = page(publicProvider, 'default');
const Enquiry = page(publicEnquiry, 'default');
const TrainerRegister = page(publicRegister, 'default');
const SignIn = page(publicAuth, 'SignIn');
const SignUp = page(publicAuth, 'SignUp');
const ForgotPassword = page(publicAuth, 'ForgotPassword');
const ResetPassword = page(publicAuth, 'ResetPassword');
const Contact = page(publicShop, 'Contact');
const Courses = page(publicShop, 'Courses');
const Marketplace = page(publicShop, 'Marketplace');
const Cart = page(publicCart, 'Cart');
const Checkout = page(publicCart, 'Checkout');
const OrderConfirmation = page(publicCart, 'OrderConfirmation');
const CourseDetail = page(publicListing, 'CourseDetail');
const ProductDetail = page(publicListing, 'ProductDetail');
const About = page(publicStatic, 'About');
const ForTrainers = page(publicStatic, 'ForTrainers');
const Help = page(publicStatic, 'Help');
const NotFound = page(publicStatic, 'NotFound');
const Privacy = page(publicStatic, 'Privacy');
const Terms = page(publicStatic, 'Terms');

const TraineeDashboard = page(trainee, 'TraineeDashboard');
const SavedProviders = page(trainee, 'SavedProviders');
const MyEnquiries = page(trainee, 'MyEnquiries');
const AccountSettings = page(trainee, 'AccountSettings');
const MyOrders = page(traineeOrders, 'MyOrders');
const MyCourses = page(traineeCourses, 'MyCourses');
const CoursePlayer = page(traineeCourses, 'CoursePlayer');

const TrainerOverview = page(trainer, 'TrainerOverview');
const TrainerEnquiries = page(trainer, 'TrainerEnquiries');
const TrainerProgrammes = page(trainer, 'TrainerProgrammes');
const TrainerCentre = page(trainer, 'TrainerCentre');
const TrainerVerification = page(trainer, 'TrainerVerification');
const SellerOrders = page(sellerOrders, 'SellerOrders');
const SellerListings = page(sellerListings, 'SellerListings');

const AdminOverview = page(admin, 'AdminOverview');
const AdminVerification = page(admin, 'AdminVerification');
const AdminProviders = page(admin, 'AdminProviders');
const AdminUsers = page(admin, 'AdminUsers');
const AdminEnquiries = page(admin, 'AdminEnquiries');
const AdminTrades = page(admin, 'AdminTrades');
const AdminSettings = page(admin, 'AdminSettings');
const AdminOrders = page(adminOrders, 'AdminOrders');

/**
 * Reads out the new page title after moving between pages inside the app. A full page load does this
 * by itself; in-app navigation is silent for screen-reader users without it.
 */
function RouteAnnouncer() {
  const { pathname } = useLocation();
  const [text, setText] = useState('');
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    // After the page has set its own title (e.g. a centre's name).
    const t = setTimeout(() => setText(currentTitle()), 300);
    return () => clearTimeout(t);
  }, [pathname]);
  return <div className="sr-only" aria-live="polite" aria-atomic="true">{text}</div>;
}

export default function App() {
  return (
    <>
      <RouteAnnouncer />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="providers/:id" element={<ProviderDetail />} />
          <Route path="providers/:id/enquire" element={<Enquiry />} />
          <Route path="signup" element={<SignUp />} />
          <Route path="trainer/register" element={<TrainerRegister />} />
          <Route path="privacy" element={<Privacy />} />
          <Route path="terms" element={<Terms />} />
          <Route path="help" element={<Help />} />
          <Route path="about" element={<About />} />
          <Route path="courses" element={<Courses />} />
          <Route path="courses/:id" element={<CourseDetail />} />
          <Route path="marketplace" element={<Marketplace />} />
          <Route path="marketplace/:id" element={<ProductDetail />} />
          <Route path="contact" element={<Contact />} />
          <Route path="cart" element={<Cart />} />
          <Route path="checkout" element={<Checkout />} />
          <Route path="orders/:id" element={<OrderConfirmation />} />
          <Route path="for-trainers" element={<ForTrainers />} />
          <Route path="*" element={<NotFound />} />
        </Route>
  
        {/* Full-height pages without the footer */}
        <Route element={<PublicLayout bare />}>
          <Route path="search" element={<SearchPage />} />
          <Route path="signin" element={<SignIn />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="reset-password" element={<ResetPassword />} />
        </Route>
  
        <Route path="app" element={<DashboardLayout role="trainee" />}>
          <Route index element={<TraineeDashboard />} />
          <Route path="saved" element={<SavedProviders />} />
          <Route path="enquiries" element={<MyEnquiries />} />
          <Route path="orders" element={<MyOrders />} />
          <Route path="courses" element={<MyCourses />} />
          <Route path="courses/:id" element={<CoursePlayer />} />
          <Route path="settings" element={<AccountSettings />} />
        </Route>
  
        <Route path="trainer" element={<DashboardLayout role="trainer" />}>
          <Route index element={<TrainerOverview />} />
          <Route path="enquiries" element={<TrainerEnquiries />} />
          <Route path="orders" element={<SellerOrders />} />
          <Route path="listings" element={<SellerListings />} />
          <Route path="programmes" element={<TrainerProgrammes />} />
          <Route path="centre" element={<TrainerCentre />} />
          <Route path="verification" element={<TrainerVerification />} />
          <Route path="settings" element={<AccountSettings />} />
        </Route>
  
        <Route path="admin" element={<DashboardLayout role="admin" />}>
          <Route index element={<AdminOverview />} />
          <Route path="verification" element={<AdminVerification />} />
          <Route path="providers" element={<AdminProviders />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="enquiries" element={<AdminEnquiries />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="trades" element={<AdminTrades />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
      </Routes>
    </>
  );
}
