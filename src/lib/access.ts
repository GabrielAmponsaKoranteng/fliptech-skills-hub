// What each kind of administrator can do. The admin menu, the page guards and the server all use
// this map, so a backend should enforce the same table (see docs/API.md → Admin).
import type { AdminAccess } from '../types';

export type AdminArea = 'verification' | 'providers' | 'users' | 'enquiries' | 'orders' | 'catalog' | 'settings';

export const ADMIN_AREAS: Record<AdminAccess, AdminArea[]> = {
  super: ['verification', 'providers', 'users', 'enquiries', 'orders', 'catalog', 'settings'],
  verification: ['verification', 'providers'],
  support: ['users', 'enquiries', 'orders'],
};

export const ACCESS_LABEL: Record<AdminAccess, string> = {
  super: 'Super admin',
  verification: 'Verification officer',
  support: 'Support',
};

/** Admins created before access levels existed have none set; they are super admins. */
export const canAdmin = (access: AdminAccess | undefined, area: AdminArea) => ADMIN_AREAS[access ?? 'super'].includes(area);

/** The area an admin page belongs to; the overview and anything unlisted is open to every admin. */
const PAGE_AREAS: [prefix: string, area: AdminArea][] = [
  ['/admin/verification', 'verification'],
  ['/admin/providers', 'providers'],
  ['/admin/users', 'users'],
  ['/admin/enquiries', 'enquiries'],
  ['/admin/orders', 'orders'],
  ['/admin/trades', 'catalog'],
];

export const adminAreaFor = (path: string): AdminArea | undefined => PAGE_AREAS.find(([p]) => path.startsWith(p))?.[1];
