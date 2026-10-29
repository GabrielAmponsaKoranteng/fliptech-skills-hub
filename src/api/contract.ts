// The Fliptech Skills Hub API, as the frontend uses it.
//
// Every read and write the app makes goes through this interface. Two implementations exist:
//   - src/api/mock   — runs in the browser on localStorage (default; used for the demo)
//   - src/api/http.ts — calls the REST endpoints documented in docs/API.md
// A backend is "done" for the frontend when http.ts works against it unchanged.
//
// Rules for implementations:
//   - The signed-in user comes from the session (cookie or bearer token), never from arguments.
//   - Scoped reads return only what the caller may see (e.g. a trainee's own orders).
//   - Errors are thrown as ApiError with an HTTP-style status and a stable `code`.

import type {
  Activity, AdminAccess, AdminStats, AdminProvider, AdminUser, AppNotification, CentreStats, Course, CourseProgress, Enquiry, Fulfilment,
  InboxStatus, ListingKind, ListingStatus, MomoNetwork, NotificationPrefs, Order, OrderContact, PaymentMethod,
  PlatformSettings, Product, Provider, QueueItem, QueueStatus, Review, Role, SellerStatus, SkillCategory, Trade,
  TrainerProgramme, User,
} from '../types';
import type { Catalog } from '../data/catalog';

export type { Catalog };

// ---------------------------------------------------------------- errors

export type ApiErrorCode =
  | 'unauthenticated' // no session (401)
  | 'forbidden' // signed in, but not allowed (403)
  | 'not_found' // 404
  | 'validation' // bad input (422); see `fields`
  | 'conflict' // e.g. out of stock, email already used (409)
  | 'network' // request never reached the server
  | 'server'; // anything else (5xx)

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ApiErrorCode,
    message: string,
    /** Per-field messages for validation errors */
    public fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ---------------------------------------------------------------- inputs

export interface RegisterTraineeInput { name: string; phone: string; email?: string; password: string }

export interface RegisterCentreInput {
  centre: string;
  description: string;
  phone: string;
  email?: string;
  area: string;
  address?: string;
  ctvetNo?: string;
  password: string;
  programmes: { name: string; trade: string; fee: number; months: number; days: string; intake?: string }[];
  /** File names only for now; real uploads need a storage endpoint */
  documents: { registration: string; ctvet?: string; photos: string[] };
}

export type ProfilePatch = Partial<Pick<User, 'name' | 'phone' | 'email' | 'area' | 'avatar'>>;

/** What the browser sends to place an order. The server prices it from its own listings. */
export interface PlaceOrderInput {
  items: { id: string; kind: ListingKind; qty: number }[];
  fulfilment: Fulfilment | null;
  contact: OrderContact;
  payment: PaymentMethod;
  momoNetwork?: MomoNetwork;
}

export interface NewEnquiryInput { providerId: string; programme: string; trainee: string; phone: string; message: string }

export type CentreProfilePatch = Partial<Pick<Provider, 'name' | 'about' | 'phone' | 'email' | 'area' | 'address' | 'hours' | 'payment' | 'images'>>;

export interface InviteAdminInput { name: string; email: string; access: AdminAccess; note?: string }

export interface ProviderModerationPatch { ctvet?: boolean; visited?: string | null; featured?: boolean; status?: AdminProvider['status'] }

// ---------------------------------------------------------------- the API

export interface Api {
  auth: {
    /** The signed-in user, or null if there is no session. */
    me(): Promise<User | null>;
    signIn(identifier: string, password: string): Promise<User>;
    /** Demo only: sign in as the sample trainee, trainer or admin. Remove when real accounts exist. */
    demoSignIn(role: Role): Promise<User>;
    signOut(): Promise<void>;
    registerTrainee(input: RegisterTraineeInput): Promise<User>;
    /** Creates the trainer account and puts the centre in the verification queue. */
    registerCentre(input: RegisterCentreInput): Promise<User>;
    /** Sends a reset link by email or SMS. Always succeeds, so it can't be used to find out who has an account. */
    requestPasswordReset(identifier: string): Promise<void>;
    /** Sets a new password from a reset link; `conflict` if the link has expired or was already used. */
    resetPassword(token: string, password: string): Promise<void>;
  };

  /** The signed-in user's own account. */
  me: {
    update(patch: ProfilePatch): Promise<User>;
    changePassword(current: string, next: string): Promise<void>;
    requestDataExport(): Promise<void>;
    deleteAccount(): Promise<void>;
    savedProviders(): Promise<string[]>;
    setSaved(providerId: string, saved: boolean): Promise<string[]>;
  };

  /** Public reference data. */
  catalog: {
    get(): Promise<Catalog>;
    reviews(providerId: string): Promise<Review[]>;
    /** Counts a visit to a centre's public page. Visits by the centre's own staff and by admins aren't counted. */
    trackView(providerId: string): Promise<void>;
  };

  listings: {
    /** Published listings, plus the caller's own hidden ones if they are a seller. */
    list(): Promise<{ courses: Course[]; products: Product[] }>;
    /** Create (no matching id) or update one of the caller's listings. */
    save(item: Course | Product): Promise<Course | Product>;
    setStatus(kind: ListingKind, id: string, status: ListingStatus): Promise<void>;
    /** Fails with `conflict` for a course that learners have bought (hide it instead). */
    remove(kind: ListingKind, id: string): Promise<void>;
  };

  orders: {
    /** Trainee: their orders. Trainer: orders containing their items. Admin: all. */
    list(): Promise<Order[]>;
    get(id: string): Promise<Order>;
    /** Validates stock and availability, prices the order, takes stock and notifies sellers and admins. */
    place(input: PlaceOrderInput): Promise<Order>;
    /** Seller (for their part) or admin (any part). Completing a pay-on-delivery order marks it paid. */
    setSellerStatus(orderId: string, sellerId: string, status: SellerStatus): Promise<Order>;
    /** Admin */
    markPaid(orderId: string): Promise<Order>;
    /** Admin: cancels every seller's part */
    cancel(orderId: string): Promise<Order>;
  };

  enquiries: {
    /** Trainee: theirs. Trainer: their centre's. Admin: all. */
    list(): Promise<Enquiry[]>;
    /** Works without a session (guest enquiry). */
    create(input: NewEnquiryInput): Promise<Enquiry>;
    /** Who is replying (trainee or centre) comes from the session. */
    reply(id: string, text: string): Promise<Enquiry>;
    /** Trainer: the centre's workflow status */
    setStatus(id: string, status: InboxStatus): Promise<Enquiry>;
    /** Trainer: opened the conversation */
    markRead(id: string): Promise<void>;
    /** Admin moderation */
    setFlagged(id: string, flagged: boolean): Promise<Enquiry>;
    remove(id: string): Promise<void>;
  };

  notifications: {
    list(): Promise<AppNotification[]>;
    markRead(ids: string[]): Promise<void>;
    prefs(): Promise<NotificationPrefs>;
    setPref(pref: keyof NotificationPrefs, on: boolean): Promise<NotificationPrefs>;
  };

  learning: {
    /** Progress for every course the trainee owns, keyed by course id. */
    progress(): Promise<Record<string, CourseProgress>>;
    setLessonDone(courseId: string, lessonId: string, done: boolean): Promise<CourseProgress>;
    setLastLesson(courseId: string, lessonId: string): Promise<CourseProgress>;
  };

  /** The signed-in trainer's own centre. */
  centre: {
    programmes(): Promise<TrainerProgramme[]>;
    saveProgramme(p: TrainerProgramme): Promise<TrainerProgramme>;
    deleteProgramme(id: string): Promise<void>;
    updateProfile(patch: CentreProfilePatch): Promise<Provider>;
    requestVisit(input: { date: string; slot: 'morning' | 'afternoon'; notes?: string }): Promise<void>;
    /** Dashboard numbers for the caller's centre. */
    stats(): Promise<CentreStats>;
  };

  admin: {
    users(): Promise<AdminUser[]>;
    updateUser(id: string, patch: Partial<Pick<AdminUser, 'role' | 'status'>>): Promise<AdminUser>;
    inviteAdmin(input: InviteAdminInput): Promise<AdminUser>;
    revokeInvite(userId: string): Promise<void>;
    resendInvite(userId: string): Promise<void>;
    sendPasswordReset(userId: string): Promise<void>;
    verificationQueue(): Promise<QueueItem[]>;
    decide(id: string, status: QueueStatus, message?: string): Promise<QueueItem>;
    providers(): Promise<AdminProvider[]>;
    updateProvider(id: string, patch: ProviderModerationPatch): Promise<AdminProvider>;
    activity(): Promise<Activity[]>;
    /** Totals and the last `months` months of sign-ups and enquiries (default 6). */
    stats(months?: number): Promise<AdminStats>;
    saveTrade(trade: Trade | (Omit<Trade, 'id'> & { id: string })): Promise<Catalog>;
    setAreas(areas: string[]): Promise<Catalog>;
    saveCategories(categories: SkillCategory[]): Promise<Catalog>;
    settings(): Promise<PlatformSettings>;
    saveSettings(patch: Partial<PlatformSettings>): Promise<PlatformSettings>;
  };

  support: {
    contact(input: { name: string; email: string; topic: string; message: string }): Promise<void>;
  };
}
