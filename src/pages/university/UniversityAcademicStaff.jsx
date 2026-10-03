import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { CredentialsModal, PasswordInput } from '../../components/people/credentials';
import { PasswordModal, ImportStaffModal } from '../faculty/FacultyAcademicStaff';
import { useTranslations, useLanguage } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/university/academic-staff';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Mirrors app/Views/university/academic-staff.php's core roster
 * management, talking to the real JSON API (App\Controllers\Api\
 * AcademicStaffApiController — same AcademicStaffManagementService the
 * Blade page uses). Covers roster listing/search, invite, edit
 * assignment (faculty/department/rank/bio), activate/deactivate, resend
 * invite, delete, and custom academic rank creation (storeRank(), now
 * exposed at POST /api/v1/academic-staff/ranks). Leadership-title
 * assignment (Dean/Head of Department/President) is a separate, larger
 * sub-feature the API itself doesn't cover yet (see
 * AcademicStaffApiController's docblock) so it isn't duplicated here.
 */

const STATUS_META = {
  active: { cls: 'badge-success', en: 'Active', ar: 'نشط' },
  pending: { cls: 'badge-primary', en: 'Pending', ar: 'قيد التفعيل' },
  inactive: { cls: 'badge-neutral', en: 'Inactive', ar: 'غير نشط' },
  suspended: { cls: 'badge-danger', en: 'Suspended', ar: 'موقوف' },
};
const INVITE_META = {
  pending: { cls: 'badge-primary', en: 'Invite Pending', ar: 'دعوة قيد الانتظار' },
  accepted: { cls: 'badge-success', en: 'Accepted', ar: 'مقبولة' },
  expired: { cls: 'badge-danger', en: 'Invite Expired', ar: 'دعوة منتهية' },
};

export default function UniversityAcademicStaff() {
  const t = useTranslations(translations);
  const { locale } = useLanguage();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [faculties, setFaculties] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState(null);
  const [passwordFor, setPasswordFor] = useState(null);
  const [importing, setImporting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/api/v1/academic-staff', { search: search || undefined, per_page: 100 })
      .then((json) => {
        setRows(json.data || []);
        setTotal(json.meta?.total ?? (json.data || []).length);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get('/api/v1/faculty', { per_page: 100 })
      .then((json) => setFaculties(json.data || []))
      .catch(() => {});
  }, []);

  async function handleToggleStatus(s) {
    setBusyId(s.id);
    setActionError(null);
    try {
      await api.post(`/api/v1/academic-staff/${s.id}/${s.status === 'active' ? 'deactivate' : 'activate'}`, {});
      load();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleResend(s) {
    setBusyId(s.id);
    setActionError(null);
    try {
      await api.post(`/api/v1/academic-staff/${s.id}/resend`, {});
      load();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(s) {
    if (!window.confirm(t('Remove this staff member?'))) return;
    setBusyId(s.id);
    setActionError(null);
    try {
      await api.delete(`/api/v1/academic-staff/${s.id}`);
      load();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="page-header animate-rise-in">
        <div className="page-header__title">
          <h1 className="text-h1">{t('Academic Staff')}</h1>
          <p className="text-small">{total} {t('Academic Staff')}</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-outline" onClick={() => setImporting(true)}>
            <Icon name="upload" size={16} /> {locale === 'ar' ? 'استيراد' : 'Import'}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setInviting(true)}>
            <Icon name="plus" size={16} /> {locale === 'ar' ? 'إضافة دكتور / معيد' : 'Add Doctor / TA'}
          </button>
        </div>
      </div>

      {actionError && <p style={{ color: 'var(--color-danger)' }}>{actionError}</p>}

      <div className="card glass-panel" style={{ marginBottom: 'var(--space-5)', display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="form-input" placeholder={t('Full Name')} value={search}
          onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 280 }} />
      </div>

      {loading && <p className="text-small">{t('Loading…')}</p>}
      {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}

      {!loading && !error && (
        <div className="table-responsive card glass-panel">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('Full Name')}</th>
                <th>{t('Academic Rank')}</th>
                <th>{t('Faculty')}</th>
                <th>{t('Department')}</th>
                <th>{locale === 'ar' ? 'الحالة' : 'Status'}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const meta = STATUS_META[s.status] || STATUS_META.active;
                const inviteMeta = s.effective_invitation_status && INVITE_META[s.effective_invitation_status];
                const busy = busyId === s.id;
                const rankName = locale === 'ar' ? (s.rank_name_ar || s.rank_name_en) : (s.rank_name_en || s.rank_name_ar);
                const facultyName = locale === 'ar' ? (s.faculty_name_ar || s.faculty_name_en) : (s.faculty_name_en || s.faculty_name_ar);
                const departmentName = locale === 'ar' ? (s.department_name_ar || s.department_name_en) : (s.department_name_en || s.department_name_ar);
                return (
                  <tr key={s.id}>
                    <td>{s.full_name}<br /><span className="text-caption">{s.email}</span></td>
                    <td>{rankName || t('— None —')}</td>
                    <td>{facultyName || '—'}</td>
                    <td>{departmentName || t('— No department —')}</td>
                    <td>
                      <span className={`badge ${meta.cls}`}>{meta[locale]}</span>
                      {inviteMeta && <> <span className={`badge ${inviteMeta.cls}`}>{inviteMeta[locale]}</span></>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                        <button type="button" className="btn btn-outline btn-sm" title={t('Manage')} onClick={() => setEditing(s)}><Icon name="edit" size={14} /></button>
                        <button type="button" className="btn btn-outline btn-sm" title={locale === 'ar' ? 'كلمة السر' : 'Password'} onClick={() => setPasswordFor(s)}><Icon name="key" size={14} /></button>
                        {s.effective_invitation_status && s.effective_invitation_status !== 'accepted' && (
                          <button type="button" className="btn btn-outline btn-sm" disabled={busy} title={t('Resend')} onClick={() => handleResend(s)}><Icon name="mail" size={14} /></button>
                        )}
                        {s.status === 'active' ? (
                          <button type="button" className="btn btn-outline btn-sm" disabled={busy} title={t('Deactivate')} onClick={() => handleToggleStatus(s)}><Icon name="x" size={14} /></button>
                        ) : (
                          <button type="button" className="btn btn-primary btn-sm" disabled={busy} title={t('Activate')} onClick={() => handleToggleStatus(s)}><Icon name="check" size={14} /></button>
                        )}
                        <button type="button" className="btn btn-danger btn-sm" disabled={busy} title={t('Remove')} onClick={() => handleDelete(s)}><Icon name="trash" size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="text-small" style={{ padding: 'var(--space-5)', textAlign: 'center' }}>{t('No academic staff added yet.')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {inviting && (
        <InviteStaffModal faculties={faculties} onClose={() => setInviting(false)} onDone={(err) => { setInviting(false); if (err) setActionError(err); else load(); }} />
      )}

      {passwordFor && (
        <PasswordModal staff={passwordFor} onClose={() => setPasswordFor(null)} onDone={(err) => { setPasswordFor(null); if (err) setActionError(err); }} />
      )}

      {importing && (
        <ImportStaffModal faculties={faculties} onClose={() => setImporting(false)} onDone={(err) => { setImporting(false); if (err) setActionError(err); else load(); }} />
      )}

      {editing && (
        <EditStaffModal staff={editing} faculties={faculties} onClose={() => setEditing(null)} onDone={(err) => { setEditing(null); if (err) setActionError(err); else load(); }} />
      )}
    </>
  );
}

function useRanks() {
  const [ranks, setRanks] = useState([]);
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    api.get('/api/v1/academic-staff/ranks').then((json) => setRanks(json.data || [])).catch(() => {});
  }, [reloadKey]);
  return [ranks, () => setReloadKey((k) => k + 1)];
}

function useDepartments(facultyId) {
  const [departments, setDepartments] = useState([]);
  useEffect(() => {
    if (!facultyId) { setDepartments([]); return; }
    let cancelled = false;
    api.get(`/api/v1/faculty/${facultyId}`)
      .then((json) => { if (!cancelled) setDepartments(json.data?.departments || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [facultyId]);
  return departments;
}

function AddRankPanel({ onCreated }) {
  const t = useTranslations(translations);
  const { locale } = useLanguage();
  const [open, setOpen] = useState(false);
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [category, setCategory] = useState('academic');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleCreate() {
    if (!nameAr.trim() || !nameEn.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const json = await api.post('/api/v1/academic-staff/ranks', {
        name_ar: nameAr.trim(),
        name_en: nameEn.trim(),
        category,
      });
      onCreated(json.data);
      setNameAr(''); setNameEn(''); setCategory('academic'); setOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: 'var(--space-2)' }} onClick={() => setOpen((v) => !v)}>
        <Icon name="plus" size={14} /> {t('Add a custom rank for your university')}
      </button>
      {open && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: 'var(--space-3)', marginTop: 'var(--space-2)', gap: 'var(--space-2)' }}>
          <input className="form-input" type="text" placeholder={t('Rank name (Arabic)')} value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
          <input className="form-input" type="text" placeholder={t('Rank name (English)')} value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
          <select className="form-input" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="academic">{t('Academic')}</option>
            <option value="administrative">{t('Administrative')}</option>
          </select>
          {error && <p className="form-error">{error}</p>}
          <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={handleCreate}>
            {saving ? (locale === 'ar' ? 'جارٍ الحفظ…' : 'Saving…') : t('Create Rank')}
          </button>
        </div>
      )}
    </>
  );
}

function InviteStaffModal({ faculties, onClose, onDone }) {
  const t = useTranslations(translations);
  const { locale } = useLanguage();
  const [ranks, reloadRanks] = useRanks();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [facultyId, setFacultyId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [rankId, setRankId] = useState('');
  const [staffNumber, setStaffNumber] = useState('');
  const [bio, setBio] = useState('');
  const [password, setPassword] = useState('');
  const [created, setCreated] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const departments = useDepartments(facultyId);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const json = await api.post('/api/v1/academic-staff', {
        full_name: fullName,
        email,
        faculty_id: facultyId || null,
        department_id: departmentId || null,
        academic_rank_id: rankId || null,
        staff_number: staffNumber || null,
        bio: bio || null,
        password: password.trim() || null,
      });
      setCreated(json.data?.password ?? '');
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  if (created !== null) {
    return (
      <CredentialsModal
        title={locale === 'ar' ? 'تمت الإضافة' : 'Staff member added'}
        email={email}
        password={created}
        message={locale === 'ar' ? 'تم إنشاء الحساب. سلّم بيانات الدخول لصاحبها.' : 'The account was created. Hand the login details to the staff member.'}
        onClose={() => onDone(null)}
      />
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box card glass-panel" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-box__title text-h3">{t('Invite Academic Staff')}</h2>
        {faculties.length === 0 && (
          <p className="text-small" style={{ color: 'var(--color-danger)' }}>{t('No faculties yet — create a faculty from Faculty management first.')}</p>
        )}
        <form onSubmit={handleSubmit}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">{t('Full Name')}</label>
              <input className="form-input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">{t('Email')}</label>
              <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">{t('Faculty')}</label>
              <select className="form-input" value={facultyId} onChange={(e) => { setFacultyId(e.target.value); setDepartmentId(''); }}>
                <option value="">{t('— Select faculty —')}</option>
                {faculties.map((f) => <option key={f.id} value={f.id}>{locale === 'ar' ? f.name_ar : f.name_en}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('Department')}</label>
              <select className="form-input" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} disabled={!facultyId}>
                <option value="">{t('— No department —')}</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{locale === 'ar' ? d.name_ar : d.name_en}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('Academic Rank')}</label>
              <select className="form-input" value={rankId} onChange={(e) => setRankId(e.target.value)}>
                <option value="">{t('— Select rank —')}</option>
                {ranks.map((r) => <option key={r.id} value={r.id}>{locale === 'ar' ? r.name_ar : r.name_en}</option>)}
              </select>
              <AddRankPanel onCreated={(rank) => { reloadRanks(); if (rank?.id) setRankId(String(rank.id)); }} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('Staff Number')}</label>
              <input className="form-input" value={staffNumber} onChange={(e) => setStaffNumber(e.target.value)} />
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">{t('Bio (optional)')}</label>
              <textarea className="form-input" rows={2} value={bio} onChange={(e) => setBio(e.target.value)} />
            </div>
          </div>
          <PasswordInput value={password} onChange={setPassword} />
          {error && <p className="form-error">{error}</p>}
          <div className="modal-box__actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>{locale === 'ar' ? 'إلغاء' : 'Cancel'}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? (locale === 'ar' ? 'جارٍ الإرسال…' : 'Sending…') : t('Invite Staff')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditStaffModal({ staff, faculties, onClose, onDone }) {
  const t = useTranslations(translations);
  const { locale } = useLanguage();
  const [ranks, reloadRanks] = useRanks();
  const [facultyId, setFacultyId] = useState(staff.faculty_id ?? '');
  const [departmentId, setDepartmentId] = useState(staff.department_id ?? '');
  const [rankId, setRankId] = useState(staff.academic_rank_id ?? '');
  const [bio, setBio] = useState(staff.bio || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const departments = useDepartments(facultyId);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/api/v1/academic-staff/${staff.id}`, {
        faculty_id: facultyId || null,
        department_id: departmentId || null,
        academic_rank_id: rankId || null,
        bio: bio || null,
      });
      onDone(null);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box card glass-panel" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-box__title text-h3">{t('Manage: ')}{staff.full_name}</h2>
        <form onSubmit={handleSubmit}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">{t('Faculty')}</label>
              <select className="form-input" value={facultyId} onChange={(e) => { setFacultyId(e.target.value); setDepartmentId(''); }}>
                <option value="">{t('— Select faculty —')}</option>
                {faculties.map((f) => <option key={f.id} value={f.id}>{locale === 'ar' ? f.name_ar : f.name_en}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('Department')}</label>
              <select className="form-input" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} disabled={!facultyId}>
                <option value="">{t('— No department —')}</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{locale === 'ar' ? d.name_ar : d.name_en}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('Academic Rank')}</label>
              <select className="form-input" value={rankId} onChange={(e) => setRankId(e.target.value)}>
                <option value="">{t('— Select rank —')}</option>
                {ranks.map((r) => <option key={r.id} value={r.id}>{locale === 'ar' ? r.name_ar : r.name_en}</option>)}
              </select>
              <AddRankPanel onCreated={(rank) => { reloadRanks(); if (rank?.id) setRankId(String(rank.id)); }} />
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">{t('Bio (optional)')}</label>
              <textarea className="form-input" rows={2} value={bio} onChange={(e) => setBio(e.target.value)} />
            </div>
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-box__actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>{locale === 'ar' ? 'إلغاء' : 'Cancel'}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? (locale === 'ar' ? 'جارٍ الحفظ…' : 'Saving…') : t('Save')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
