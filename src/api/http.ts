// REST implementation of the API contract. Routes and payloads are documented in docs/API.md.
// Enable it by setting VITE_API_URL (e.g. VITE_API_URL=https://api.fliptech.com/v1).
import { ApiError, type Api, type ApiErrorCode, type Catalog } from './contract';
import type { Course, CourseProgress, Product, User } from '../types';

const TOKEN_KEY = 'fsh.token';

const codeFor = (status: number): ApiErrorCode =>
  status === 401 ? 'unauthenticated' : status === 403 ? 'forbidden' : status === 404 ? 'not_found'
    : status === 409 ? 'conflict' : status === 422 || status === 400 ? 'validation' : 'server';

export function createHttpApi(baseUrl: string): Api {
  const root = baseUrl.replace(/\/$/, '');

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) headers.Authorization = `Bearer ${token}`;
    let res: Response;
    try {
      res = await fetch(root + path, { method, headers, credentials: 'include', body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
      throw new ApiError(0, 'network', 'We couldn’t reach Fliptech. Check your connection and try again.');
    }
    if (res.status === 204) return undefined as T;
    const data: unknown = await res.json().catch(() => undefined);
    if (!res.ok) {
      const e = (data ?? {}) as { code?: ApiErrorCode; message?: string; fields?: Record<string, string> };
      throw new ApiError(res.status, e.code ?? codeFor(res.status), e.message ?? `Request failed (${res.status})`, e.fields);
    }
    return data as T;
  }

  /** Auth endpoints return { user, token }; keep the token for later requests. */
  async function session(p: Promise<{ user: User; token?: string }>): Promise<User> {
    const { user, token } = await p;
    if (token) localStorage.setItem(TOKEN_KEY, token);
    return user;
  }

  const get = <T>(path: string) => request<T>('GET', path);
  const post = <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {});
  const put = <T>(path: string, body: unknown) => request<T>('PUT', path, body);
  const patch = <T>(path: string, body: unknown) => request<T>('PATCH', path, body);
  const del = <T = void>(path: string) => request<T>('DELETE', path);
  const enc = encodeURIComponent;
  const plural = (kind: 'course' | 'product') => (kind === 'course' ? 'courses' : 'products');

  return {
    auth: {
      me: () => get<User | null>('/auth/me').catch((e: unknown) => {
        if (e instanceof ApiError && e.code === 'unauthenticated') return null;
        throw e;
      }),
      signIn: (identifier, password) => session(post('/auth/sign-in', { identifier, password })),
      demoSignIn: (role) => session(post('/auth/demo', { role })),
      signOut: async () => { await post('/auth/sign-out'); localStorage.removeItem(TOKEN_KEY); },
      registerTrainee: (input) => session(post('/auth/register/trainee', input)),
      registerCentre: (input) => session(post('/auth/register/centre', input)),
      requestPasswordReset: (identifier) => post('/auth/password-reset', { identifier }),
      resetPassword: (token, password) => post('/auth/password-reset/confirm', { token, password }),
    },
    me: {
      update: (p) => patch('/me', p),
      changePassword: (current, next) => post('/me/password', { current, next }),
      requestDataExport: () => post('/me/export'),
      deleteAccount: async () => { await del('/me'); localStorage.removeItem(TOKEN_KEY); },
      savedProviders: () => get('/me/saved'),
      setSaved: (providerId, saved) => (saved ? put<string[]>(`/me/saved/${enc(providerId)}`, {}) : del<string[]>(`/me/saved/${enc(providerId)}`)),
    },
    catalog: {
      get: () => get<Catalog>('/catalog'),
      reviews: (providerId) => get(`/providers/${enc(providerId)}/reviews`),
      trackView: async (providerId) => { await post(`/providers/${enc(providerId)}/views`); },
    },
    listings: {
      list: () => get<{ courses: Course[]; products: Product[] }>('/listings'),
      save: (item) => put<Course | Product>(`/listings/${'curriculum' in item ? 'courses' : 'products'}/${enc(item.id)}`, item),
      setStatus: (kind, id, status) => patch(`/listings/${plural(kind)}/${enc(id)}/status`, { status }),
      remove: (kind, id) => del(`/listings/${plural(kind)}/${enc(id)}`),
    },
    orders: {
      list: () => get('/orders'),
      get: (id) => get(`/orders/${enc(id)}`),
      place: (input) => post('/orders', input),
      setSellerStatus: (orderId, sellerId, status) => patch(`/orders/${enc(orderId)}/sellers/${enc(sellerId)}`, { status }),
      markPaid: (orderId) => post(`/orders/${enc(orderId)}/mark-paid`),
      cancel: (orderId) => post(`/orders/${enc(orderId)}/cancel`),
    },
    enquiries: {
      list: () => get('/enquiries'),
      create: (input) => post('/enquiries', input),
      reply: (id, text) => post(`/enquiries/${enc(id)}/messages`, { text }),
      setStatus: (id, status) => patch(`/enquiries/${enc(id)}`, { inboxStatus: status }),
      markRead: (id) => post(`/enquiries/${enc(id)}/read`),
      setFlagged: (id, flagged) => patch(`/enquiries/${enc(id)}/flag`, { flagged }),
      remove: (id) => del(`/enquiries/${enc(id)}`),
    },
    notifications: {
      list: () => get('/notifications'),
      markRead: (ids) => post('/notifications/read', { ids }),
      prefs: () => get('/notifications/prefs'),
      setPref: (pref, on) => patch('/notifications/prefs', { [pref]: on }),
    },
    learning: {
      progress: () => get<Record<string, CourseProgress>>('/learning/progress'),
      setLessonDone: (courseId, lessonId, done) => put(`/learning/courses/${enc(courseId)}/lessons/${enc(lessonId)}`, { done }),
      setLastLesson: (courseId, lessonId) => put(`/learning/courses/${enc(courseId)}/last-lesson`, { lessonId }),
    },
    centre: {
      programmes: () => get('/centre/programmes'),
      stats: () => get('/centre/stats'),
      saveProgramme: (p) => put(`/centre/programmes/${enc(p.id)}`, p),
      deleteProgramme: (id) => del(`/centre/programmes/${enc(id)}`),
      updateProfile: (p) => patch('/centre/profile', p),
      requestVisit: (input) => post('/centre/visits', input),
    },
    admin: {
      users: () => get('/admin/users'),
      updateUser: (id, p) => patch(`/admin/users/${enc(id)}`, p),
      inviteAdmin: (input) => post('/admin/invitations', input),
      revokeInvite: (userId) => del(`/admin/invitations/${enc(userId)}`),
      resendInvite: (userId) => post(`/admin/invitations/${enc(userId)}/resend`),
      sendPasswordReset: (userId) => post(`/admin/users/${enc(userId)}/password-reset`),
      verificationQueue: () => get('/admin/verification'),
      decide: (id, status, message) => post(`/admin/verification/${enc(id)}/decision`, { status, message }),
      providers: () => get('/admin/providers'),
      updateProvider: (id, p) => patch(`/admin/providers/${enc(id)}`, p),
      activity: () => get('/admin/activity'),
      stats: (months = 6) => get(`/admin/stats?months=${months}`),
      saveTrade: (trade) => put(`/admin/trades/${enc(trade.id || 'new')}`, trade),
      setAreas: (areas) => put('/admin/areas', { areas }),
      saveCategories: (categories) => put('/admin/categories', { categories }),
      settings: () => get('/admin/settings'),
      saveSettings: (p) => patch('/admin/settings', p),
    },
    support: {
      contact: (input) => post('/support/messages', input),
    },
  };
}
