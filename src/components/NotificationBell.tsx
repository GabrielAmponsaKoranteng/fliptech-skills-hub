import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CalendarClock, CheckCheck, MessageCircle, PackageCheck, Settings, ShoppingBag } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Loading } from './ui';
import { isFor, timeAgo } from '../lib/notifications';
import { setUnreadCount } from '../lib/pageMeta';
import type { AppNotification, User } from '../types';

const SETTINGS: Record<User['role'], string> = { trainee: '/app/settings', trainer: '/trainer/settings', admin: '/admin/settings' };

/** Ids that have already triggered an arrival toast, per user, so each notification pops at most once. */
const alertedKey = (u: User) => `fsh.notif.alerted.${u.role}.${u.id}`;
const MAX_REMEMBERED = 300;


/**
 * Pops a toast for unread notifications this user hasn't been alerted about yet
 * (e.g. orders placed while they were away). Tracking ids rather than a timestamp
 * makes it safe to run repeatedly, including React's double-run in development.
 */
function useArrivalAlert(user: User, mine: AppNotification[]) {
  const { toast } = useApp();
  useEffect(() => {
    let alerted: string[] = [];
    try { alerted = JSON.parse(localStorage.getItem(alertedKey(user)) || '[]') as string[]; } catch { /* storage unavailable */ }
    const done = new Set(alerted);
    const fresh = mine.filter((n) => !n.read && !done.has(n.id));
    if (fresh.length === 0) return;
    const orders = fresh.filter((n) => n.kind === 'order_new').length;
    toast(orders
      ? `You have ${orders} new order${orders === 1 ? '' : 's'}`
      : `You have ${fresh.length} new notification${fresh.length === 1 ? '' : 's'}`);
    const next = [...fresh.map((n) => n.id), ...alerted].slice(0, MAX_REMEMBERED);
    try { localStorage.setItem(alertedKey(user), JSON.stringify(next)); } catch { /* storage unavailable */ }
  }, [user.id, user.role, mine]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function NotificationBell({ user }: { user: User }) {
  const { notifications, markRead, dataStatus } = useApp();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const mine = useMemo(
    () => notifications.filter((n) => isFor(n, user)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [notifications, user],
  );
  const unread = mine.filter((n) => !n.read);
  const shown = (unreadOnly ? unread : mine).slice(0, 30);

  useArrivalAlert(user, mine);

  // Show the unread count in the browser tab, e.g. "(2) Orders · Fliptech Skills Hub".
  useEffect(() => {
    setUnreadCount(unread.length);
    return () => setUnreadCount(0);
  }, [unread.length]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [open]);

  const openItem = (n: AppNotification) => {
    markRead([n.id]);
    setOpen(false);
    nav(n.link);
  };

  return (
    <div className="menu-wrap" ref={ref}>
      <button className="icon-btn" onClick={() => setOpen((o) => !o)} aria-label={unread.length ? `Notifications, ${unread.length} unread` : 'Notifications'} aria-expanded={open}>
        <Bell size={18} />
        {unread.length > 0 && <span className="bell-count">{unread.length > 9 ? '9+' : unread.length}</span>}
      </button>
      {open && (
        <div className="menu notif-panel" role="dialog" aria-label="Notifications">
          <div className="notif-head">
            <div className="bold">Notifications</div>
            <div className="row" style={{ gap: 4 }}>
              <div className="seg-toggle notif-toggle">
                <button className={!unreadOnly ? 'on' : ''} onClick={() => setUnreadOnly(false)}>All</button>
                <button className={unreadOnly ? 'on' : ''} onClick={() => setUnreadOnly(true)}>Unread{unread.length ? ` (${unread.length})` : ''}</button>
              </div>
            </div>
          </div>
          <div className="notif-list">
            {dataStatus === 'loading' && shown.length === 0 ? (
              <Loading label="Loading notifications" rows={3} />
            ) : shown.length === 0 ? (
              <div className="notif-empty"><Bell size={22} /><div className="small bold mt-2">{unreadOnly ? 'You’re all caught up' : 'No notifications yet'}</div><div className="xs muted">New orders and updates will appear here.</div></div>
            ) : shown.map((n) => (
              <button key={n.id} className={`notif-item ${n.read ? '' : 'unread'}`} onClick={() => openItem(n)}>
                <span className={`notif-ico ${n.kind === 'order_new' ? 'tone-success' : n.kind === 'intake_reminder' ? 'tone-accent' : n.kind === 'enquiry_reply' ? 'tone-violet' : 'tone-brand'}`}>{n.kind === 'order_new' ? <ShoppingBag size={16} /> : n.kind === 'intake_reminder' ? <CalendarClock size={16} /> : n.kind === 'enquiry_reply' ? <MessageCircle size={16} /> : <PackageCheck size={16} />}</span>
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="notif-title">{n.title}</span>
                  <span className="notif-body">{n.body}</span>
                  <span className="notif-time">{timeAgo(n.createdAt)}</span>
                </span>
                {!n.read && <span className="notif-dot" aria-label="Unread" />}
              </button>
            ))}
          </div>
          <div className="notif-foot">
            {unread.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => markRead(unread.map((n) => n.id))}><CheckCheck size={15} /> Mark all as read</button>}
            <button className="btn btn-ghost btn-sm" onClick={() => { setOpen(false); nav(SETTINGS[user.role]); }}><Settings size={15} /> Settings</button>
          </div>
        </div>
      )}
    </div>
  );
}
