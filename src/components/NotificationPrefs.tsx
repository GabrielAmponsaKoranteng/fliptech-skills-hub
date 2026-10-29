import { BellOff } from 'lucide-react';
import { useApp, useUser } from '../context/AppContext';
import { PREF_OPTIONS, audienceOf } from '../lib/notifications';
import { PROVIDERS } from '../data/catalog';
import { Switch } from './ui';
import type { NotificationPrefs } from '../types';

/** Notification toggles for the signed-in user; changes apply to notifications created from now on. */
export function NotificationPrefsCard({ title = 'Notification preferences' }: { title?: string }) {
  const { prefs, setPref, toast } = useApp();
  const user = useUser();
  const audience = audienceOf(user);
  const options = PREF_OPTIONS[user.role];
  const allInAppOff = options.filter((o) => o.inApp).every((o) => !prefs[o.key]);

  const change = async (pref: keyof NotificationPrefs, label: string, on: boolean) => {
    if (!(await setPref(pref, on))) return;
    toast(pref === 'sms' || pref === 'news' ? 'Preference saved' : `${label} ${on ? 'turned on' : 'turned off'}`);
  };

  const scope = audience.role === 'trainer'
    ? `Shared by everyone who manages ${PROVIDERS.find((p) => p.id === audience.sellerId)?.name ?? 'your centre'}.`
    : audience.role === 'admin' ? 'Shared by all administrators.' : null;

  return (
    <div className="card">
      <div className="card-head">
        <div><h3>{title}</h3>{scope && <div className="xs muted mt-1">{scope}</div>}</div>
      </div>
      <div>
        {options.map((o) => (
          <div key={o.key} className="li">
            <div className="grow">
              <div className="bold small row" style={{ gap: 8 }}>
                {o.label}
                {o.key === 'sms' && <span className="badge badge-warn" style={{ height: 20 }}>Coming soon</span>}
              </div>
              <div className="xs muted">{o.hint}</div>
            </div>
            <Switch checked={prefs[o.key]} onChange={(on) => change(o.key, o.label, on)} label={o.label} />
          </div>
        ))}
      </div>
      {allInAppOff && (
        <div className="card-body" style={{ paddingTop: 0 }}>
          <div className="notice warn"><BellOff size={18} /><div>All alerts are off, so nothing new will appear in your notifications. Existing notifications stay until you read them.</div></div>
        </div>
      )}
    </div>
  );
}
