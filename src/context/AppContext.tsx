// Session-wide state: the signed-in user and the data their screens share (listings, orders,
// enquiries, notifications…). Everything is loaded from and saved through `api`; this file holds
// a client-side cache plus optimistic updates. Business rules live on the server (see src/api).
import { createPortal } from 'react-dom';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../api';
import type { NewEnquiryInput, PlaceOrderInput, ProfilePatch, RegisterCentreInput, RegisterTraineeInput } from '../api/contract';
import { errorMessage } from '../api/errors';
import { setCatalog } from '../data/catalog';
import { Logo } from '../components/ui';
import type {
  AppNotification, CartItem, Course, CourseProgress, Enquiry, InboxStatus, ListingKind, ListingStatus, NotificationPrefs,
  Order, Product, Role, SellerStatus, User,
} from '../types';
import { DEFAULT_PREFS } from '../lib/notifications';

export type { ListingKind, CourseProgress } from '../types';
export type { NewEnquiryInput } from '../api/contract';
export { messageTime } from '../lib/format';

type ToastType = 'success' | 'error';
interface Toast { id: string; text: string; type: ToastType }

/** Max units of one product per order. */
export const MAX_QTY = 10;

const isCourse = (x: Course | Product): x is Course => 'curriculum' in x;
const CART_KEY = 'fsh.cart.v3';
const POLL_MS = 60_000;

export interface AppState {
  user: User | null;
  /** Demo sign-in as the sample trainee, trainer or admin */
  login: (role: Role) => Promise<User | undefined>;
  signIn: (identifier: string, password: string) => Promise<User | undefined>;
  registerTrainee: (input: RegisterTraineeInput) => Promise<User | undefined>;
  registerCentre: (input: RegisterCentreInput) => Promise<User | undefined>;
  logout: () => Promise<void>;
  updateUser: (patch: ProfilePatch) => Promise<boolean>;
  saved: string[];
  toggleSave: (providerId: string) => Promise<void>;
  enquiries: Enquiry[];
  addEnquiry: (e: NewEnquiryInput) => Promise<Enquiry | undefined>;
  /** Adds a message to a conversation; the server works out whether it's from the trainee or the centre. */
  replyToEnquiry: (id: string, text: string) => Promise<boolean>;
  setInboxStatus: (id: string, status: InboxStatus) => Promise<void>;
  markEnquiryRead: (id: string) => Promise<void>;
  toast: (text: string, type?: ToastType) => void;
  cart: CartItem[];
  addToCart: (item: Course | Product, opts?: { silent?: boolean; qty?: number }) => void;
  removeFromCart: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clearCart: () => void;
  /** Published listings, plus the signed-in seller's hidden ones. */
  courses: Course[];
  products: Product[];
  saveListing: (item: Course | Product) => Promise<Course | Product | undefined>;
  setListingStatus: (kind: ListingKind, id: string, status: ListingStatus) => Promise<void>;
  deleteListing: (kind: ListingKind, id: string) => Promise<boolean>;
  progressFor: (courseId: string) => CourseProgress;
  setLessonDone: (courseId: string, lessonId: string, done: boolean) => Promise<void>;
  setLastLesson: (courseId: string, lessonId: string) => Promise<void>;
  /** Orders the user may see (their own, their centre's, or all for admins) */
  orders: Order[];
  placeOrder: (input: PlaceOrderInput) => Promise<Order | undefined>;
  updateSellerStatus: (orderId: string, sellerId: string, status: SellerStatus) => Promise<void>;
  markOrderPaid: (orderId: string) => Promise<void>;
  cancelOrder: (orderId: string) => Promise<void>;
  /** The signed-in user's notifications */
  notifications: AppNotification[];
  markRead: (ids: string[]) => Promise<void>;
  prefs: NotificationPrefs;
  /** Resolves true if saved */
  setPref: (pref: keyof NotificationPrefs, on: boolean) => Promise<boolean>;
  /** Reload reference data after an edit (trades, areas, centre profile…). */
  reloadCatalog: () => Promise<void>;
  /** Bumped whenever the catalog (data/catalog live bindings) is replaced, so readers re-render */
  catalogVersion: number;
  /** Reload the user's data (e.g. after switching accounts). */
  refresh: () => Promise<void>;
  /**
   * Whether the signed-in user's data (orders, enquiries, saved centres, notifications) and the
   * marketplace listings have arrived. Pages show placeholders while 'loading' instead of empty states.
   */
  dataStatus: DataStatus;
  dataError: unknown;
  /** Try loading that data again after an error. */
  retryData: () => void;
}

export type DataStatus = 'loading' | 'ready' | 'error';

const AppCtx = createContext<AppState | null>(null);

function readCart(): CartItem[] {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]') as CartItem[]; } catch { return []; }
}

function BootScreen({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="boot">
      <div className="boot-inner">
        <Logo />
        {error ? (
          <>
            <h2 style={{ fontSize: 20 }}>We couldn’t load Fliptech Skills Hub</h2>
            <p className="muted">{errorMessage(error)}</p>
            <button className="btn btn-primary" onClick={onRetry}>Try again</button>
          </>
        ) : (
          <><div className="spinner" aria-hidden="true" /><span className="muted small" role="status">Loading…</span></>
        )}
      </div>
    </div>
  );
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [boot, setBoot] = useState<'loading' | 'ready' | 'error'>('loading');
  const [bootError, setBootError] = useState<unknown>(null);
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [user, setUser] = useState<User | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [cart, setCart] = useState<CartItem[]>(readCart);
  const [courses, setCourses] = useState<Course[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [progress, setProgress] = useState<Record<string, CourseProgress>>({});
  const [orders, setOrders] = useState<Order[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dataStatus, setDataStatus] = useState<DataStatus>('loading');
  const [dataError, setDataError] = useState<unknown>(null);
  const dataSeq = useRef(0);
  const userRef = useRef<User | null>(null);
  userRef.current = user;

  useEffect(() => {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* storage unavailable */ }
  }, [cart]);

  const toast = useCallback((text: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, text, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  /** Runs an API call; on failure shows the error, runs `rollback` and resolves to undefined. */
  const attempt = useCallback(async <T,>(call: () => Promise<T>, rollback?: () => void): Promise<T | undefined> => {
    try {
      return await call();
    } catch (e) {
      rollback?.();
      toast(errorMessage(e), 'error');
      return undefined;
    }
  }, [toast]);

  // ---------------------------------------------------------------- loading

  const loadUserData = useCallback(async (u: User | null) => {
    const [listings, ord, enq, notifs, pr, sv, prog] = await Promise.all([
      api.listings.list(),
      u ? api.orders.list() : Promise.resolve([] as Order[]),
      u ? api.enquiries.list() : Promise.resolve([] as Enquiry[]),
      u ? api.notifications.list() : Promise.resolve([] as AppNotification[]),
      u ? api.notifications.prefs() : Promise.resolve(DEFAULT_PREFS),
      u ? api.me.savedProviders() : Promise.resolve([] as string[]),
      u?.role === 'trainee' ? api.learning.progress() : Promise.resolve({} as Record<string, CourseProgress>),
    ]);
    setCourses(listings.courses);
    setProducts(listings.products);
    setOrders(ord);
    setEnquiries(enq);
    setNotifications(notifs);
    setPrefs(pr);
    setSaved(sv);
    setProgress(prog);
  }, []);

  /** Loads the user's data and tracks its status. A newer load (e.g. after switching account) wins. */
  const loadData = useCallback(async (u: User | null) => {
    const n = ++dataSeq.current;
    setDataStatus('loading');
    setDataError(null);
    try {
      await loadUserData(u);
      if (n === dataSeq.current) setDataStatus('ready');
    } catch (e) {
      if (n === dataSeq.current) { setDataError(e); setDataStatus('error'); }
    }
  }, [loadUserData]);

  const reloadCatalog = useCallback(async () => {
    const c = await attempt(() => api.catalog.get());
    if (c) { setCatalog(c); setCatalogVersion((v) => v + 1); }
  }, [attempt]);

  const start = useCallback(async () => {
    setBoot('loading');
    setBootError(null);
    try {
      const [c, me] = await Promise.all([api.catalog.get(), api.auth.me()]);
      setCatalog(c);
      setUser(me);
      // Show the app now; pages show placeholders until the user's own data arrives.
      setBoot('ready');
      void loadData(me);
    } catch (e) {
      setBootError(e);
      setBoot('error');
    }
  }, [loadData]);

  useEffect(() => { void start(); }, [start]);

  const refresh = useCallback(async () => {
    if (await attempt(() => loadUserData(userRef.current).then(() => true))) setDataStatus('ready');
  }, [attempt, loadUserData]);

  const retryData = useCallback(() => { void loadData(userRef.current); }, [loadData]);

  // New orders, replies and updates arrive from other people; check when the tab regains focus and every minute.
  useEffect(() => {
    if (boot !== 'ready' || !user) return;
    const pull = () => {
      void api.notifications.list().then(setNotifications).catch(() => { /* try again next time */ });
      void api.orders.list().then(setOrders).catch(() => {});
      void api.enquiries.list().then(setEnquiries).catch(() => {});
    };
    const onFocus = () => { if (document.visibilityState === 'visible') pull(); };
    const timer = setInterval(pull, POLL_MS);
    document.addEventListener('visibilitychange', onFocus);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onFocus); };
  }, [boot, user]);

  // ---------------------------------------------------------------- auth

  const enter = useCallback(async (call: () => Promise<User>) => {
    const u = await attempt(call);
    // The catalog depends on who is signed in (a trainer sees their own centre before it's approved).
    // Their own data loads in the background, so the dashboard opens at once with placeholders.
    if (u) { setUser(u); void loadData(u); await reloadCatalog(); }
    return u;
  }, [attempt, loadData, reloadCatalog]);

  const login = useCallback((role: Role) => enter(() => api.auth.demoSignIn(role)), [enter]);
  const signIn = useCallback((identifier: string, password: string) => enter(() => api.auth.signIn(identifier, password)), [enter]);
  const registerTrainee = useCallback((input: RegisterTraineeInput) => enter(() => api.auth.registerTrainee(input)), [enter]);
  const registerCentre = useCallback((input: RegisterCentreInput) => enter(() => api.auth.registerCentre(input)), [enter]);

  const logout = useCallback(async () => {
    await attempt(() => api.auth.signOut());
    setUser(null);
    await Promise.all([reloadCatalog(), loadData(null)]);
  }, [attempt, loadData, reloadCatalog]);

  const updateUser = useCallback(async (patch: ProfilePatch) => {
    const u = await attempt(() => api.me.update(patch));
    if (u) setUser(u);
    return !!u;
  }, [attempt]);

  // ---------------------------------------------------------------- saved providers

  const toggleSave = useCallback(async (id: string) => {
    if (!userRef.current) { toast('Sign in to save providers', 'error'); return; }
    const on = saved.includes(id);
    const before = saved;
    setSaved(on ? saved.filter((x) => x !== id) : [...saved, id]);
    const next = await attempt(() => api.me.setSaved(id, !on), () => setSaved(before));
    if (!next) return;
    setSaved(next);
    toast(on ? 'Removed from saved providers' : 'Saved to your providers');
    // Saving a provider can trigger an intake reminder.
    void api.notifications.list().then(setNotifications).catch(() => {});
  }, [saved, attempt, toast]);

  // ---------------------------------------------------------------- cart (kept in the browser; re-checked at checkout)

  const addToCart = useCallback((item: Course | Product, { silent = false, qty = 1 }: { silent?: boolean; qty?: number } = {}) => {
    const kind = isCourse(item) ? 'course' : 'product';
    const existing = cart.find((x) => x.id === item.id);
    const limit = isCourse(item) ? 1 : Math.min(MAX_QTY, item.stock);
    if (!isCourse(item)) {
      if (limit <= 0) { if (!silent) toast(`${item.title} is sold out`, 'error'); return; }
      if (existing && existing.qty >= limit) { if (!silent) toast(`Only ${item.stock} ${item.title} available`, 'error'); return; }
    }
    if (existing && kind === 'course') { if (!silent) toast(`${item.title} is already in your cart`); return; }
    const add = Math.max(1, qty);
    setCart((c) => (c.some((x) => x.id === item.id)
      ? c.map((x) => (x.id === item.id ? { ...x, qty: Math.min(limit, x.qty + add) } : x))
      : [...c, { id: item.id, kind, title: item.title, by: item.by, sellerId: item.sellerId, price: item.price, img: item.img, qty: Math.min(limit, add) }]));
    if (!silent) toast(existing ? `Added ${add > 1 ? add + ' more' : 'another'} ${item.title}` : `${add > 1 ? add + ' × ' : ''}${item.title} added to cart`);
  }, [cart, toast]);

  const removeFromCart = useCallback((id: string) => setCart((c) => c.filter((x) => x.id !== id)), []);
  const setQty = useCallback((id: string, qty: number) => {
    const stock = products.find((p) => p.id === id)?.stock ?? MAX_QTY;
    setCart((c) => c.map((x) => (x.id === id && x.kind === 'product' ? { ...x, qty: Math.max(1, Math.min(MAX_QTY, stock, qty)) } : x)));
  }, [products]);
  const clearCart = useCallback(() => setCart([]), []);

  // ---------------------------------------------------------------- listings

  const reloadListings = useCallback(async () => {
    const l = await api.listings.list().catch(() => undefined);
    if (l) { setCourses(l.courses); setProducts(l.products); }
  }, []);

  const saveListing = useCallback(async (item: Course | Product) => {
    const saved = await attempt(() => api.listings.save(item));
    if (!saved) return undefined;
    const upsert = <T extends { id: string }>(list: T[], x: T) => (list.some((y) => y.id === x.id) ? list.map((y) => (y.id === x.id ? x : y)) : [x, ...list]);
    if (isCourse(saved)) setCourses((l) => upsert(l, saved)); else setProducts((l) => upsert(l, saved as Product));
    return saved;
  }, [attempt]);

  const setListingStatus = useCallback(async (kind: ListingKind, id: string, status: ListingStatus) => {
    const before = { courses, products };
    if (kind === 'course') setCourses((l) => l.map((c) => (c.id === id ? { ...c, status } : c)));
    else setProducts((l) => l.map((p) => (p.id === id ? { ...p, status } : p)));
    await attempt(() => api.listings.setStatus(kind, id, status), () => { setCourses(before.courses); setProducts(before.products); });
  }, [attempt, courses, products]);

  const deleteListing = useCallback(async (kind: ListingKind, id: string) => {
    const before = { courses, products };
    if (kind === 'course') setCourses((l) => l.filter((c) => c.id !== id)); else setProducts((l) => l.filter((p) => p.id !== id));
    const ok = await attempt(() => api.listings.remove(kind, id).then(() => true), () => { setCourses(before.courses); setProducts(before.products); });
    if (ok) setCart((c) => c.filter((i) => i.id !== id));
    return !!ok;
  }, [attempt, courses, products]);

  // ---------------------------------------------------------------- learning

  const progressFor = useCallback((courseId: string): CourseProgress => progress[courseId] ?? { done: [] }, [progress]);

  const setLessonDone = useCallback(async (courseId: string, lessonId: string, done: boolean) => {
    const before = progress[courseId];
    const cur = before ?? { done: [] };
    setProgress((p) => ({ ...p, [courseId]: { ...cur, done: done ? [...new Set([...cur.done, lessonId])] : cur.done.filter((x) => x !== lessonId) } }));
    const next = await attempt(() => api.learning.setLessonDone(courseId, lessonId, done), () => setProgress((p) => ({ ...p, [courseId]: before ?? { done: [] } })));
    if (next) setProgress((p) => ({ ...p, [courseId]: next }));
  }, [attempt, progress]);

  const setLastLesson = useCallback(async (courseId: string, lessonId: string) => {
    if (progress[courseId]?.last === lessonId) return;
    setProgress((p) => ({ ...p, [courseId]: { done: p[courseId]?.done ?? [], last: lessonId } }));
    // Losing a "last viewed" bookmark isn't worth an error toast.
    await api.learning.setLastLesson(courseId, lessonId).catch(() => {});
  }, [progress]);

  // ---------------------------------------------------------------- orders

  const replaceOrder = (o: Order) => setOrders((l) => (l.some((x) => x.id === o.id) ? l.map((x) => (x.id === o.id ? o : x)) : [o, ...l]));

  const placeOrder = useCallback(async (input: PlaceOrderInput) => {
    const order = await attempt(() => api.orders.place(input));
    // Stock changed either way (sold, or someone else bought it first).
    void reloadListings();
    if (!order) return undefined;
    replaceOrder(order);
    setCart([]);
    if (order.items.some((i) => i.kind === 'course') && userRef.current?.role === 'trainee') {
      void api.learning.progress().then(setProgress).catch(() => {});
    }
    return order;
  }, [attempt, reloadListings]);

  const updateSellerStatus = useCallback(async (orderId: string, sellerId: string, status: SellerStatus) => {
    const before = orders.find((o) => o.id === orderId);
    if (before) replaceOrder({ ...before, sellerStatus: { ...before.sellerStatus, [sellerId]: status } });
    const next = await attempt(() => api.orders.setSellerStatus(orderId, sellerId, status), () => { if (before) replaceOrder(before); });
    if (next) replaceOrder(next);
  }, [attempt, orders]);

  const markOrderPaid = useCallback(async (orderId: string) => {
    const next = await attempt(() => api.orders.markPaid(orderId));
    if (next) replaceOrder(next);
  }, [attempt]);

  const cancelOrder = useCallback(async (orderId: string) => {
    const next = await attempt(() => api.orders.cancel(orderId));
    if (next) replaceOrder(next);
  }, [attempt]);

  // ---------------------------------------------------------------- enquiries

  const replaceEnquiry = (e: Enquiry) => setEnquiries((l) => l.map((x) => (x.id === e.id ? e : x)));

  const addEnquiry = useCallback(async (input: NewEnquiryInput) => {
    const e = await attempt(() => api.enquiries.create(input));
    if (e && userRef.current) setEnquiries((l) => [e, ...l]);
    return e;
  }, [attempt]);

  const replyToEnquiry = useCallback(async (id: string, text: string) => {
    const before = enquiries.find((e) => e.id === id);
    const u = userRef.current;
    if (before && u) {
      replaceEnquiry({ ...before, thread: [...before.thread, { from: u.role === 'trainer' ? 'trainer' : 'trainee', text: text.trim(), at: 'Sending…' }] });
    }
    const next = await attempt(() => api.enquiries.reply(id, text), () => { if (before) replaceEnquiry(before); });
    if (next) replaceEnquiry(next);
    return !!next;
  }, [attempt, enquiries]);

  const setInboxStatus = useCallback(async (id: string, status: InboxStatus) => {
    const before = enquiries.find((e) => e.id === id);
    if (before) replaceEnquiry({ ...before, inboxStatus: status });
    const next = await attempt(() => api.enquiries.setStatus(id, status), () => { if (before) replaceEnquiry(before); });
    if (next) replaceEnquiry(next);
  }, [attempt, enquiries]);

  const markEnquiryRead = useCallback(async (id: string) => {
    const before = enquiries.find((e) => e.id === id);
    if (!before?.centreUnread) return;
    replaceEnquiry({ ...before, centreUnread: false });
    await api.enquiries.markRead(id).catch(() => replaceEnquiry(before));
  }, [enquiries]);

  // ---------------------------------------------------------------- notifications

  const markRead = useCallback(async (ids: string[]) => {
    const set = new Set(ids);
    setNotifications((l) => l.map((n) => (set.has(n.id) ? { ...n, read: true } : n)));
    await api.notifications.markRead(ids).catch(() => { /* stays read locally; will resync on next poll */ });
  }, []);

  const setPref = useCallback(async (pref: keyof NotificationPrefs, on: boolean) => {
    const before = prefs;
    setPrefs({ ...prefs, [pref]: on });
    const next = await attempt(() => api.notifications.setPref(pref, on), () => setPrefs(before));
    if (next) setPrefs(next);
    return !!next;
  }, [attempt, prefs]);

  // ---------------------------------------------------------------- context value

  const value = useMemo<AppState>(() => ({
    user, login, signIn, registerTrainee, registerCentre, logout, updateUser, saved, toggleSave,
    enquiries, addEnquiry, replyToEnquiry, setInboxStatus, markEnquiryRead, toast,
    cart, addToCart, removeFromCart, setQty, clearCart,
    courses, products, saveListing, setListingStatus, deleteListing, progressFor, setLessonDone, setLastLesson,
    orders, placeOrder, updateSellerStatus, markOrderPaid, cancelOrder,
    notifications, markRead, prefs, setPref, reloadCatalog, refresh, catalogVersion, dataStatus, dataError, retryData,
  }), [
    user, login, signIn, registerTrainee, registerCentre, logout, updateUser, saved, toggleSave,
    enquiries, addEnquiry, replyToEnquiry, setInboxStatus, markEnquiryRead, toast,
    cart, addToCart, removeFromCart, setQty, clearCart,
    courses, products, saveListing, setListingStatus, deleteListing, progressFor, setLessonDone, setLastLesson,
    orders, placeOrder, updateSellerStatus, markOrderPaid, cancelOrder,
    notifications, markRead, prefs, setPref, reloadCatalog, refresh, catalogVersion, dataStatus, dataError, retryData,
  ]);

  return (
    <AppCtx.Provider value={value}>
      {boot === 'ready' ? children : <BootScreen error={boot === 'error' ? bootError : null} onRetry={() => void start()} />}
      {/* Outside #root, so toasts are still announced while a dialog makes the page inert. */}
      {createPortal(
        <div className="toasts" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`toast ${t.type}`}>
              {t.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
              {t.text}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </AppCtx.Provider>
  );
}

export function useApp(): AppState {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}

/** For screens that only render for a signed-in user (dashboards guard this in DashboardLayout). */
export function useUser(): User {
  const { user } = useApp();
  if (!user) throw new Error('useUser called without a signed-in user');
  return user;
}
