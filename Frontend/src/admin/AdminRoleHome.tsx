import { LogOut } from 'lucide-react';
import type { StaffRole } from '../types';
import { roleLabel } from '../utils/roles';
import { t } from '../i18n/en';

interface AdminRoleHomeProps {
  role: StaffRole;
  fullName?: string;
  onLogout: () => void;
}

/** The signed-in screen for waiters and cashiers until their own screens are built. */
export default function AdminRoleHome({ role, fullName = '', onLogout }: AdminRoleHomeProps) {
  return (
    <section
      aria-label={roleLabel(role)}
      style={{ maxWidth: '520px', margin: '80px auto', padding: '32px 24px', textAlign: 'center', background: '#ffffff', borderRadius: '20px', border: '1px solid #e2e8f0' }}
    >
      <h2 style={{ margin: '0 0 6px', fontSize: '22px', color: '#0f172a' }}>{t.roleHome.greeting(fullName)}</h2>
      <p style={{ margin: '0 0 18px', fontSize: '13px', fontWeight: 700, color: 'var(--admin-primary, #ff5a36)' }}>
        {t.roleHome.signedInAs(roleLabel(role))}
      </p>
      <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#475569' }}>
        {role === 'cashier' ? t.roleHome.cashierComing : t.roleHome.waiterComing}
      </p>
      <button type="button" className="admin-sec-pill-btn" onClick={onLogout}>
        <LogOut size={14} /> {t.roleHome.signOut}
      </button>
    </section>
  );
}
