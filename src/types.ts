// Domain types shared by the data layer and the UI.
// When a backend is added, these describe the shapes its API should return.

export type Role = 'trainee' | 'trainer' | 'admin';

export type Tone = 'brand' | 'success' | 'warn' | 'danger' | 'violet' | 'accent';

export type TradeId = 'welding' | 'tailoring' | 'plumbing' | 'auto' | 'hair' | 'electrical' | 'carpentry';

export interface Trade {
  id: TradeId;
  name: string;
  /** lucide-react icon name, resolved by `<Icon>` */
  icon: string;
  color: string;
  bg: string;
  img: string;
}

export interface Programme {
  id: string;
  name: string;
  fee: number;
  months: number;
  days: string;
  time: string;
  type: string;
  /** ISO date, e.g. 2026-10-06 */
  intake: string;
  places: number;
}

export interface Provider {
  id: string;
  name: string;
  area: string;
  trade: TradeId;
  /** Lowest programme fee, in cedis */
  fee: number;
  months: number;
  intake: string;
  ctvet: boolean;
  /** Month of the last Fliptech site visit, or null if never visited */
  visited: string | null;
  rating: number;
  reviews: number;
  students: number;
  founded: number;
  places: number;
  phone: string;
  email: string | null;
  /** Street address or landmark */
  address?: string;
  hours: string;
  images: string[];
  blurb: string;
  about: string;
  programmeType: string;
  payment: string;
  programmes: Programme[];
  coords: [lat: number, lng: number];
}

export interface Message {
  from: 'trainee' | 'trainer';
  text: string;
  /** Display label, e.g. "2 Oct, 10:14" */
  at: string;
  /** ISO time it was sent; older seed messages only have the label */
  sentAt?: string;
}

export type EnquiryStatus = 'Sent' | 'Replied';

export type InboxStatus = 'New' | 'Replied' | 'Enrolled' | 'Closed';

/**
 * One conversation between a trainee and a training centre. Both sides read and
 * write the same record: the trainee sees `status`, the centre sees `inboxStatus`.
 */
export interface Enquiry {
  id: string;
  providerId: string;
  programme: string;
  trainee: string;
  phone: string;
  date: string;
  /** Account that sent it; absent for guest enquiries, which centres answer by phone */
  userId?: string;
  /** Trainee-facing: has the centre replied yet? */
  status: EnquiryStatus;
  /** Centre-facing workflow status */
  inboxStatus: InboxStatus;
  /** True until someone at the centre opens the conversation */
  centreUnread: boolean;
  /** Marked as likely spam (automatically or by a moderator) */
  flagged?: boolean;
  thread: Message[];
}

export interface User {
  id: string;
  role: Role;
  name: string;
  email: string;
  phone: string;
  area?: string;
  centreId?: string;
  /** Admins only: which parts of the admin area they can use (missing means super) */
  access?: AdminAccess;
  /** Profile photo URL */
  avatar?: string;
}

export type QueueStatus = 'Pending' | 'Visit scheduled' | 'Needs info' | 'Approved' | 'Rejected';

export interface QueueItem {
  id: string;
  name: string;
  owner: string;
  area: string;
  trade: TradeId;
  submitted: string;
  docs: string[];
  status: QueueStatus;
  img: string;
  /** The centre record created at registration, published when the application is approved */
  providerId?: string;
}

export type AccountStatus = 'Active' | 'Pending' | 'Suspended' | 'Invited';

export type AdminAccess = 'super' | 'verification' | 'support';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  area: string;
  joined: string;
  status: AccountStatus;
  enquiries: number;
  access?: AdminAccess;
}

export interface Activity {
  icon: string;
  tone: Tone;
  text: string;
  by: string;
  at: string;
}

export interface Review {
  name: string;
  rating: number;
  date: string;
  text: string;
}

export interface SkillCategory {
  id: string;
  name: string;
  img: string;
  to: string;
}

/** Hidden listings stay in the seller's dashboard but disappear from the marketplace. */
export type ListingStatus = 'Published' | 'Hidden';

export type CourseLevel = 'Beginner' | 'Intermediate' | 'Advanced';

export interface Lesson {
  id: string;
  title: string;
  minutes: number;
}

export interface Course {
  id: string;
  title: string;
  by: string;
  /** Who gets paid and fulfils the order: a provider id, or a slug for independent sellers */
  sellerId: string;
  cat: string;
  rating: number;
  reviews: number;
  /** 0 means free */
  price: number;
  badge?: 'Bestseller' | 'Free' | 'New';
  img: string;
  description: string;
  /** "What you'll learn" bullet points */
  outcomes: string[];
  level: CourseLevel;
  /** Lesson count and total hours are derived from this; see `courseStats` */
  curriculum: Lesson[];
  status: ListingStatus;
}

export interface Product {
  id: string;
  title: string;
  by: string;
  sellerId: string;
  cat: string;
  rating: number;
  reviews: number;
  price: number;
  img: string;
  description: string;
  /** Units available; 0 shows as sold out */
  stock: number;
  status: ListingStatus;
}

export interface CartItem {
  id: string;
  /** Courses are digital (always qty 1, no delivery); products are physical */
  kind: 'course' | 'product';
  title: string;
  by: string;
  sellerId: string;
  /** Unit price in cedis; 0 for free courses */
  price: number;
  img: string;
  qty: number;
}

export type Fulfilment = 'delivery' | 'pickup';
export type PaymentMethod = 'momo' | 'card' | 'cod' | 'free';
export type MomoNetwork = 'MTN' | 'Telecel' | 'AirtelTigo';
export type OrderStatus = 'Paid' | 'Awaiting payment';

/**
 * A seller's progress on their part of an order. Course-only parts start at
 * 'Completed' because access is sent automatically.
 */
export type SellerStatus = 'New' | 'Confirmed' | 'Ready for pickup' | 'Out for delivery' | 'Completed' | 'Cancelled';

export interface OrderContact {
  name: string;
  phone: string;
  email: string;
  area: string;
  address: string;
  notes: string;
}

export interface Order {
  id: string;
  placedAt: string;
  /** Account that placed the order; absent for guest checkouts */
  userId?: string;
  items: CartItem[];
  subtotal: number;
  delivery: number;
  total: number;
  /** null when the order is courses only */
  fulfilment: Fulfilment | null;
  contact: OrderContact;
  payment: PaymentMethod;
  momoNetwork?: MomoNetwork;
  status: OrderStatus;
  /** Fulfilment progress per seller in this order, keyed by sellerId */
  sellerStatus: Record<string, SellerStatus>;
}

/** Change event from any text-like form control, for `set('field')` style handlers. */
export type FieldEvent = import('react').ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;

/** Who a notification is for. Admin notifications are shared by all admins. */
export type Audience =
  | { role: 'admin' }
  | { role: 'trainer'; sellerId: string }
  | { role: 'trainee'; userId: string };

export type NotificationKind = 'order_new' | 'order_update' | 'intake_reminder' | 'enquiry_reply';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  audience: Audience;
  title: string;
  body: string;
  /** In-app link opened when the notification is clicked */
  link: string;
  createdAt: string;
  read: boolean;
  orderId?: string;
  enquiryId?: string;
  /** Stable identity for notifications that must only be sent once (e.g. one reminder per intake) */
  dedupeKey?: string;
}

/** What a person wants to be told about. Each key is one toggle in settings. */
export interface NotificationPrefs {
  /** Sellers and admins: an order is placed */
  newOrders: boolean;
  /** Sellers: an admin cancelled one of their orders */
  cancellations: boolean;
  /** Buyers: a seller confirmed, dispatched, completed or cancelled their order */
  orderUpdates: boolean;
  /** Buyers: a saved provider has an intake starting within a week */
  intakeReminders: boolean;
  /** Trainees: a training centre replied to their enquiry */
  enquiryReplies: boolean;
  /** Marketing consent: monthly news from Fliptech */
  news: boolean;
  /** Also send by SMS (stored now; delivered once SMS is connected) */
  sms: boolean;
}

// ---- Types shared with the API (see src/api/contract.ts) ----

export type ListingKind = 'course' | 'product';

/** A trainee's progress through one course. */
export interface CourseProgress {
  /** Lesson ids marked complete */
  done: string[];
  /** Lesson last opened, for "continue where you left off" */
  last?: string;
}

/** A programme as managed by its centre: adds its trade and whether it's shown publicly. */
export interface TrainerProgramme extends Programme {
  trade: string;
  published: boolean;
}

/** A provider row in the admin table, with moderation fields. */
/** Published: public. Pending: awaiting verification. Rejected: application turned down. Suspended: removed by an admin. */
export type ProviderStatus = 'Published' | 'Pending' | 'Rejected' | 'Suspended';

export type AdminProvider = Provider & { status: ProviderStatus; featured: boolean };

/** The public part of the platform settings, sent to everyone with the catalog. */
export interface SiteInfo {
  supportPhone: string;
  supportEmail: string;
  /** Shown on the homepage; empty for none */
  announcement: string;
  maintenance: boolean;
  signups: boolean;
  trainerReg: boolean;
  reviews: boolean;
}

export interface PlatformSettings {
  flags: {
    signups: boolean;
    trainerReg: boolean;
    autoPublish: boolean;
    sms: boolean;
    reviews: boolean;
    maintenance: boolean;
  };
  supportPhone: string;
  supportEmail: string;
  announcement: string;
}

/** Platform numbers for the admin overview, computed by the server. */
/** A number for the last 30 days and the 30 days before, so the dashboard can show a trend. */
export interface Period { current: number; previous: number }

export interface CentreStats {
  /** Public profile page views */
  views: Period;
  enquiries: Period;
  /** Enquiries sent in the period that the centre has marked Enrolled */
  enrolled: Period;
  /** Average hours from an enquiry to the centre's first reply; null when nothing was answered */
  replyHours: { current: number | null; previous: number | null };
  /** The last 8 weeks, oldest first; `week` is the Monday it starts on */
  weekly: { week: string; views: number; enquiries: number }[];
  /** Enrolled enquiries per programme name over the last 90 days, for the intake progress bars */
  enrolledByProgramme: Record<string, number>;
}

export interface AdminStats {
  trainees: number;
  trainers: number;
  admins: number;
  /** Published training centres */
  providers: number;
  enquiries: number;
  /** One entry per month, oldest first, e.g. { month: '2026-10', signups: 12, enquiries: 30 } */
  monthly: { month: string; signups: number; enquiries: number }[];
  /** All-time enquiries per trade, most first */
  enquiriesByTrade: { trade: string; count: number }[];
  /** Centres with the most enquiries; replyRate is the share (0–1) the centre has answered */
  topProviders: { providerId: string; enquiries: number; replyRate: number }[];
}
