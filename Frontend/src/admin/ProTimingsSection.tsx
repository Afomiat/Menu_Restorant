import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
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

export interface ProTimingsHandle {
  /**
   * Saves the timings if any changed. Resolves false, with the reason shown in the section,
   * when a value is wrong or the server refuses, so the Settings window can stay open.
   */
  save: () => Promise<boolean>;
}

/** Checks the values the way the server does, with the names the manager sees. */
function validate(values: Record<string, string>): string | null {
  for (const f of FIELDS) {
    const raw = (values[f.key] ?? '').trim();
    if (raw === '' || !Number.isInteger(Number(raw))) return t.settings.enterNumber(f.label);
    const n = Number(raw);
    if (n < 1 || n > f.max) return t.settings.outOfRange(f.label, f.max);
  }
  if (Number(values.bill_escalation_minutes) <= Number(values.bill_reminder_minutes)) return t.settings.escalationOrder;
  return null;
}

interface ProTimingsSectionProps {
  /** Called with the timings the server stored, so other screens can use the new values */
  onSaved?: (settings: TenantSettings) => void;
}

/** Pro managers: prep and reminder times, saved together with the rest of the Settings window. */
const ProTimingsSection = forwardRef<ProTimingsHandle, ProTimingsSectionProps>(function ProTimingsSection({ onSaved }, ref) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminTenantProfile()
      .then((profile) => {
        const settings = profile?.settings;
        if (settings) {
          const loaded = Object.fromEntries(FIELDS.map((f) => [f.key, String(settings[f.key])]));
          setValues(loaded);
          setSaved(loaded);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      save: async () => {
        const changed = FIELDS.some((f) => (values[f.key] ?? '') !== (saved[f.key] ?? ''));
        if (loading || !changed) return true;
        const problem = validate(values);
        setError(problem);
        if (problem) return false;
        try {
          const changes = Object.fromEntries(FIELDS.map((f) => [f.key, Number(values[f.key])])) as Partial<TenantSettings>;
          const result = await updateTenantSettings(changes);
          const stored = Object.fromEntries(FIELDS.map((f) => [f.key, String(result[f.key])]));
          setValues(stored);
          setSaved(stored);
          onSaved?.(result);
          return true;
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : 'Failed to save timings');
          return false;
        }
      },
    }),
    [values, saved, loading, onSaved],
  );

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
                inputMode="numeric"
                // No min/max here: the browser's own popup would block the save with a generic message;
                // validate() names the setting instead
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
        </>
      )}
    </section>
  );
});

export default ProTimingsSection;
