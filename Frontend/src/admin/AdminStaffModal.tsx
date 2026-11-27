import { type ReactNode, useEffect, useState } from 'react';
import { X, Users, UserPlus, KeyRound, Pencil } from 'lucide-react';
import type { PlanTier, StaffMember, StaffRole } from '../types';
import { createStaff, fetchStaff, updateStaff, type StaffChanges } from '../services/staffService';
import { hasPlan } from '../utils/plan';
import { BusyButton, SkeletonBlocks } from './Loading';
import AdminPageShell from './AdminPageShell';
import { STAFF_ROLES, roleLabel } from '../utils/roles';
import { t } from '../i18n/en';

interface AdminStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Shown as its own dashboard page instead of a dialog. */
  asPage?: boolean;
  plan: PlanTier;
  /** The signed-in manager; they cannot change their own role or turn themselves off. */
  currentUserId?: string;
  onToast?: (message: string) => void;
}

const emptyForm = { full_name: '', phone: '', email: '', password: '', role: 'waiter' as StaffRole };

export default function AdminStaffModal({ isOpen, onClose, plan, currentUserId, onToast, asPage = false }: AdminStaffModalProps) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  // What the busy row is saving ('active', 'password', 'edit'), so only that button spins
  const [busyKind, setBusyKind] = useState<string | null>(null);
  const [passwordFor, setPasswordFor] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  // Name and phone editing, one row at a time
  const [editFor, setEditFor] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  const isPro = hasPlan(plan, 'pro');

  useEffect(() => {
    if (!isOpen || !isPro) return;
    setLoading(true);
    setListError(null);
    fetchStaff()
      .then(setStaff)
      .catch((err: unknown) => setListError(err instanceof Error ? err.message : 'Failed to load staff'))
      .finally(() => setLoading(false));
  }, [isOpen, isPro]);

  useEffect(() => {
    if (!isOpen) {
      setForm(emptyForm);
      setFormError(null);
      setPasswordFor(null);
      setNewPassword('');
      setEditFor(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const replace = (updated: StaffMember) => setStaff((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdding(true);
    setFormError(null);
    try {
      const created = await createStaff({ ...form, email: form.email.trim() || undefined });
      setStaff((prev) => [...prev, created]);
      setForm(emptyForm);
      onToast?.(t.staff.added(created.full_name));
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to add staff member');
    } finally {
      setIsAdding(false);
    }
  };

  const handleChange = async (member: StaffMember, changes: StaffChanges, toast: string) => {
    setBusyId(member.id);
    setListError(null);
    try {
      replace(await updateStaff(member.id, changes));
      onToast?.(toast);
      return true;
    } catch (err: unknown) {
      setListError(err instanceof Error ? err.message : 'Failed to save');
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const handlePasswordSave = async (member: StaffMember) => {
    if (await handleChange(member, { password: newPassword }, t.staff.passwordReset(member.full_name))) {
      setPasswordFor(null);
      setNewPassword('');
    }
  };

  const openEdit = (member: StaffMember) => {
    const opening = editFor !== member.id;
    setEditFor(opening ? member.id : null);
    setEditName(member.full_name);
    setEditPhone(member.phone || '');
    setPasswordFor(null);
  };

  const handleEditSave = async (member: StaffMember) => {
    const name = editName.trim();
    if (!name) {
      setListError(t.staff.nameRequired);
      return;
    }
    const phone = editPhone.trim();
    const changes: StaffChanges = {};
    if (name !== member.full_name) changes.full_name = name;
    const phoneRequested = phone !== '' && phone !== (member.phone || '');
    if (phoneRequested) changes.phone = phone;
    if (Object.keys(changes).length === 0) {
      setEditFor(null);
      return;
    }
    setBusyId(member.id);
    setListError(null);
    try {
      const updated = await updateStaff(member.id, changes);
      replace(updated);
      setEditFor(null);
      // A server that does not support phone changes ignores the field and returns the old number
      if (phoneRequested && (updated.phone || '') === (member.phone || '')) {
        setListError(t.staff.phoneNotSaved);
      } else {
        onToast?.(t.staff.detailsSaved(updated.full_name || name));
      }
    } catch (err: unknown) {
      setListError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setBusyId(null);
    }
  };

  const frame = (content: ReactNode) =>
    asPage ? (
      <AdminPageShell title={t.staff.title} subtitle={t.staff.pageSubtitle} maxWidth={1200} bare>
        {content}
      </AdminPageShell>
    ) : (
      <div className="admin-modal-overlay" onClick={onClose}>
        <div
          className="admin-modal-dialog"
          style={{ maxWidth: '760px', width: '94%' }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={t.staff.title}
        >
          <div className="admin-modal-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={20} color="var(--admin-primary)" />
              <h3 className="admin-modal-title">{t.staff.title}</h3>
            </div>
            <button type="button" className="admin-modal-close-btn" onClick={onClose} aria-label="Close modal">
              <X size={18} />
            </button>
          </div>
          {content}
        </div>
      </div>
    );

  return frame(
        <div className={asPage ? 'stf' : 'admin-modal-body'} style={asPage ? undefined : { maxHeight: '72vh', overflowY: 'auto' }}>
          {!isPro ? (
            <p className={asPage ? 'rpt-panel' : undefined} style={{ margin: 0, fontSize: '15px', color: '#475569', lineHeight: 1.5 }}>{t.staff.proOnly}</p>
          ) : (
            <>
              {listError && (
                <p role="alert" style={{ color: '#dc2626', fontSize: '14px', margin: 0 }}>
                  {listError}
                </p>
              )}

              {!loading && staff.length > 0 && <p className="stf-summary">{teamSummary(staff)}</p>}

              <div className={asPage ? 'stf-layout' : undefined}>
              <section className={asPage ? 'rpt-panel' : undefined} aria-label={t.staff.team}>
              {asPage && <h2 className="rpt-panel-title">{t.staff.team}</h2>}
              {loading ? (
                <SkeletonBlocks sections={[{ kind: 'rows', count: 5 }]} label={t.staff.loading} />
              ) : staff.length === 0 ? (
                <p className="rpt-empty">{t.staff.empty}</p>
              ) : (
                <ul className="stf-list">
                  {staff.map((member) => {
                    const isSelf = member.id === currentUserId;
                    const busy = busyId === member.id;
                    return (
                      <li key={member.id} data-testid={`staff-row-${member.id}`} className={`stf-row ${member.is_active ? '' : 'stf-row-off'}`}>
                        <div className="stf-who">
                          <span className={`stf-avatar stf-avatar-${member.role}`} aria-hidden="true">
                            {initials(member.full_name || member.email || '?')}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div className="stf-name">
                              {member.full_name || member.email}
                              {isSelf && <span className="stf-you">({t.staff.you})</span>}
                            </div>
                            <div className="stf-contact">{[member.phone, member.email].filter(Boolean).join(' · ')}</div>
                            <span className={`bill-status ${member.is_active ? 'bill-status-confirmed' : ''}`}>
                              {member.is_active ? t.staff.active : t.staff.inactive}
                            </span>
                          </div>
                        </div>

                        <div className="stf-actions">
                          <select
                            aria-label={`${t.staff.role}: ${member.full_name}`}
                            className="admin-input-control"
                            style={{ width: 'auto' }}
                            value={member.role}
                            disabled={isSelf || busy}
                            onChange={(e) => {
                              setBusyKind('role');
                              handleChange(member, { role: e.target.value as StaffRole }, t.staff.saved);
                            }}
                          >
                            {STAFF_ROLES.map((role) => (
                              <option key={role} value={role}>
                                {roleLabel(role)}
                              </option>
                            ))}
                          </select>

                          <BusyButton
                            className="admin-sec-pill-btn"
                            busy={busy && busyKind === 'active'}
                            disabled={isSelf || busy}
                            onClick={() => {
                              setBusyKind('active');
                              handleChange(member, { is_active: !member.is_active }, t.staff.saved);
                            }}
                          >
                            {member.is_active ? t.staff.turnOff : t.staff.turnOn}
                          </BusyButton>

                          <button
                            type="button"
                            className="admin-sec-pill-btn"
                            disabled={busy}
                            onClick={() => openEdit(member)}
                            aria-expanded={editFor === member.id}
                          >
                            <Pencil size={14} /> {t.staff.edit}
                          </button>

                          <button
                            type="button"
                            className="admin-sec-pill-btn"
                            disabled={busy}
                            onClick={() => {
                              setPasswordFor(passwordFor === member.id ? null : member.id);
                              setNewPassword('');
                              setEditFor(null);
                            }}
                          >
                            <KeyRound size={14} /> {t.staff.resetPassword}
                          </button>
                        </div>

                        {passwordFor === member.id && (
                          <div style={{ flexBasis: '100%', display: 'flex', gap: '8px' }}>
                            <input
                              type="text"
                              className="admin-input-control"
                              aria-label={t.staff.resetPasswordPrompt(member.full_name)}
                              placeholder={t.staff.resetPasswordPrompt(member.full_name)}
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                            />
                            <BusyButton
                              className="admin-save-pill-btn"
                              busy={busy && busyKind === 'password'}
                              disabled={busy || newPassword.length === 0}
                              onClick={() => {
                                setBusyKind('password');
                                handlePasswordSave(member);
                              }}
                            >
                              {t.staff.save}
                            </BusyButton>
                          </div>
                        )}

                        {editFor === member.id && (
                          <div style={{ flexBasis: '100%', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            <input
                              type="text"
                              className="admin-input-control"
                              style={{ flex: '1 1 160px' }}
                              aria-label={t.staff.editName(member.full_name || member.email)}
                              placeholder={t.staff.fullName}
                              value={editName}
                              maxLength={100}
                              onChange={(e) => setEditName(e.target.value)}
                            />
                            <input
                              type="tel"
                              className="admin-input-control"
                              style={{ flex: '1 1 140px' }}
                              aria-label={t.staff.editPhone(member.full_name || member.email)}
                              placeholder={t.staff.phonePlaceholder}
                              value={editPhone}
                              onChange={(e) => setEditPhone(e.target.value)}
                            />
                            <BusyButton
                              className="admin-save-pill-btn"
                              busy={busy && busyKind === 'edit'}
                              disabled={busy}
                              onClick={() => {
                                setBusyKind('edit');
                                handleEditSave(member);
                              }}
                            >
                              {t.staff.save}
                            </BusyButton>
                            <button type="button" className="admin-sec-pill-btn" disabled={busy} onClick={() => setEditFor(null)}>
                              {t.staff.cancel}
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              </section>

              <form onSubmit={handleAdd} aria-label={t.staff.addTitle} className={asPage ? 'rpt-panel stf-add' : undefined} style={asPage ? undefined : { borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                <h2 className="rpt-panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <UserPlus size={18} /> {t.staff.addTitle}
                </h2>
                <div className="stf-fields">
                  <label className="admin-input-label">
                    {t.staff.fullName}
                    <input
                      className="admin-input-control"
                      required
                      value={form.full_name}
                      onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    />
                  </label>
                  <label className="admin-input-label">
                    {t.staff.phone}
                    <input
                      className="admin-input-control"
                      type="tel"
                      required
                      placeholder={t.staff.phonePlaceholder}
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </label>
                  <label className="admin-input-label">
                    {t.staff.email}
                    <input
                      className="admin-input-control"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </label>
                  <label className="admin-input-label">
                    {t.staff.password}
                    <input
                      className="admin-input-control"
                      type="text"
                      required
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                    />
                  </label>
                  <label className="admin-input-label">
                    {t.staff.role}
                    <select
                      className="admin-input-control"
                      value={form.role}
                      onChange={(e) => setForm({ ...form, role: e.target.value as StaffRole })}
                    >
                      {STAFF_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {roleLabel(role)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p style={{ fontSize: '13px', color: '#64748b', margin: '10px 0' }}>{t.staff.passwordHint}</p>
                {formError && (
                  <p role="alert" style={{ color: '#dc2626', fontSize: '14px', margin: '0 0 8px' }}>
                    {formError}
                  </p>
                )}
                <BusyButton type="submit" className="admin-save-pill-btn" busy={isAdding}>
                  {isAdding ? t.staff.adding : t.staff.add}
                </BusyButton>
              </form>
              </div>
            </>
          )}
        </div>
  );
}

/** "Abebe Kebede" → "AK"; one word → its first two letters. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** "7 staff · 2 waiters · 1 chef · 1 turned off": who is on the team, by role. */
function teamSummary(staff: StaffMember[]): string {
  const active = staff.filter((s) => s.is_active);
  const byRole = STAFF_ROLES.map((role) => [role, active.filter((s) => s.role === role).length] as const).filter(([, n]) => n > 0);
  const off = staff.length - active.length;
  return [
    t.staff.teamCount(staff.length),
    ...byRole.map(([role, n]) => t.staff.roleCount(n, roleLabel(role))),
    ...(off > 0 ? [t.staff.offCount(off)] : []),
  ].join(' · ');
}
