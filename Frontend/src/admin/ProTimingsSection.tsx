import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { TenantSettings } from '../types';
import { fetchAdminTenantProfile, updateTenantSettings } from '../services/menuService';
import { t } from '../i18n/en';

const FIELDS: { key: keyof TenantSettings; label: string; max: number }[] = [
  { key: 'default_prep_minutes', label: t.settings.defaultPrep, max: 240 },
  { key: 'bill_reminder_minutes', label: t.settings.billReminder, max: 600 },
  { key: 'bill_escalation_minutes', label: t.settings.billEscalation, max: 600 },
  { key: 'confirm_reminder_minutes', label: t.settings.confirmReminder, max: 600 },
  { key: 'long_table_minutes', label: t.settings.longTable, max: 600 },
];

/** Pro managers: prep and reminder times, saved on their own (separately from branding). */
export default function ProTimingsSection({ onSaved }: { onSaved?: (message: string) => void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminTenantProfile()
      .then((profile) => {
        const settings = profile?.settings;
        if (settings) {
          setValues(Object.fromEntries(FIELDS.map((f) => [f.key, String(settings[f.key])])));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const changes: Partial<TenantSettings> = {};
      for (const f of FIELDS) {
        const n = Number(values[f.key]);
        if (values[f.key] !== undefined && values[f.key] !== '') changes[f.key] = n;
      }
      const saved = await updateTenantSettings(changes);
      setValues(Object.fromEntries(FIELDS.map((f) => [f.key, String(saved[f.key])])));
      onSaved?.(t.settings.saved);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save timings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-label={t.settings.proTitle} style={{ borderTop: '1px solid var(--admin-border)', paddingTop: '16px', display: 'grid', gap: '10px' }}>
      <h4 style={{ margin: 0, fontSize: '14px' }}>{t.settings.proTitle}</h4>
      {loading ? (
        <Loader2 size={16} className="admin-spin" />
      ) : (
        <>
          {FIELDS.map((f) => (
            <label key={f.key} className="admin-input-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <span>{f.label}</span>
              <input
                type="number"
                min={1}
                max={f.max}
                className="admin-input-control"
                style={{ width: '90px' }}
                value={values[f.key] ?? ''}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              />
            </label>
          ))}
          {error && (
            <p role="alert" style={{ color: 'var(--admin-danger, #dc2626)', fontSize: '13px', margin: 0 }}>
              {error}
            </p>
          )}
          <button type="button" className="admin-save-pill-btn" style={{ justifySelf: 'start' }} onClick={save} disabled={saving}>
            {saving ? <Loader2 size={14} className="admin-spin" /> : null} {t.settings.save}
          </button>
        </>
      )}
    </section>
  );
}
