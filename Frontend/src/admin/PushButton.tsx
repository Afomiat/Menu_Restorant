import { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { enablePush, fetchPushKey, pushSupported, type PushState } from '../utils/push';
import { t } from '../i18n/en';

/** "Turn on phone alerts" for staff whose phones lock; hidden when the server has push off. */
export default function PushButton() {
  const [state, setState] = useState<PushState | 'loading'>('loading');

  useEffect(() => {
    if (!pushSupported()) {
      setState('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setState('blocked');
      return;
    }
    fetchPushKey()
      .then((key) => setState(!key.enabled ? 'disabled' : Notification.permission === 'granted' ? 'on' : 'off'))
      .catch(() => setState('disabled'));
  }, []);

  // Once permission is granted, keep this browser's subscription saved for this staff member
  useEffect(() => {
    if (state === 'on') enablePush().catch(() => undefined);
  }, [state]);

  if (state === 'loading' || state === 'disabled') return null;

  const message =
    state === 'on' ? t.push.enabled : state === 'blocked' ? t.push.blocked : state === 'unsupported' ? t.push.unsupported : null;

  return (
    <div style={{ marginBottom: '12px' }}>
      {state === 'off' ? (
        <button
          type="button"
          className="admin-sec-pill-btn"
          onClick={() =>
            enablePush()
              .then(setState)
              .catch(() => setState('blocked'))
          }
        >
          <BellRing size={14} /> {t.push.enable}
        </button>
      ) : (
        <span role="status" style={{ fontSize: '12px', color: state === 'on' ? '#15803d' : '#64748b' }}>
          {message}
        </span>
      )}
    </div>
  );
}
