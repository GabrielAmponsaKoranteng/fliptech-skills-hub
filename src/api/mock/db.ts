// The mock server's "database": named tables persisted to localStorage.
// Each table is seeded on first use and survives reloads. Call `resetDb()` to start over.
import type {
  Activity, AdminProvider, AdminUser, AppNotification, Course, CourseProgress, Enquiry, NotificationPrefs, Order,
  PlatformSettings, Product, QueueItem, Review, SkillCategory, Trade, TrainerProgramme, User,
} from '../../types';
import { buildSeed } from './seed';

/** A stored account: the admin view of a user plus sign-in details. */
export type DbUser = AdminUser & Pick<User, 'phone' | 'centreId' | 'avatar'>;

/** A message the mock would have emailed or texted. The demo shows these, since nothing is really sent. */
export interface OutboxMessage { id: string; at: string; to: string; kind: 'password_reset' | 'invitation'; subject: string; link: string }

export interface Tables {
  users: DbUser[];
  providers: AdminProvider[];
  trades: Trade[];
  areas: string[];
  categories: SkillCategory[];
  reviews: Review[];
  courses: Course[];
  products: Product[];
  orders: Order[];
  enquiries: Enquiry[];
  notifications: AppNotification[];
  /** Keyed by audience key (see lib/notifications `audienceKey`) */
  prefs: Record<string, Partial<NotificationPrefs>>;
  /** Keyed by `${userId}:${courseId}` */
  progress: Record<string, CourseProgress>;
  /** Keyed by user id */
  saved: Record<string, string[]>;
  /** Keyed by centre (provider) id */
  programmes: Record<string, TrainerProgramme[]>;
  queue: QueueItem[];
  activity: Activity[];
  settings: PlatformSettings;
  /** Write-only inboxes, kept so the demo can show they were received */
  supportMessages: { at: string; name: string; email: string; topic: string; message: string }[];
  visitRequests: { at: string; centreId: string; date: string; slot: string; notes?: string }[];
  session: { userId: string } | null;
  resetTokens: { token: string; userId: string; expires: string; used?: boolean }[];
  /** Public page views per centre per day: { [providerId]: { 'YYYY-MM-DD': count } } */
  views: Record<string, Record<string, number>>;
  outbox: OutboxMessage[];
}

const PREFIX = 'fsh.db.v3.';
let seed: Tables | null = null;
const cache: Partial<Tables> = {};

function seedFor<K extends keyof Tables>(k: K): Tables[K] {
  seed ??= buildSeed();
  return structuredClone(seed[k]);
}

export function read<K extends keyof Tables>(k: K): Tables[K] {
  if (k in cache) return cache[k] as Tables[K];
  let value: Tables[K];
  try {
    const raw = localStorage.getItem(PREFIX + k);
    value = raw ? (JSON.parse(raw) as Tables[K]) : seedFor(k);
  } catch {
    value = seedFor(k);
  }
  cache[k] = value;
  return value;
}

export function write<K extends keyof Tables>(k: K, value: Tables[K]): Tables[K] {
  cache[k] = value;
  try {
    localStorage.setItem(PREFIX + k, JSON.stringify(value));
  } catch {
    // Storage full or blocked: keep the in-memory copy for this session.
  }
  return value;
}

/** Read-modify-write helper. */
export function update<K extends keyof Tables>(k: K, fn: (v: Tables[K]) => Tables[K]): Tables[K] {
  return write(k, fn(read(k)));
}

/** Wipes every table back to the seed data (handy in demos and tests). */
export function resetDb() {
  for (const key of Object.keys(localStorage)) if (key.startsWith(PREFIX)) localStorage.removeItem(key);
  for (const key of Object.keys(cache)) delete cache[key as keyof Tables];
}
