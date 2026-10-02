import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '../../api/client';
import { announceAvatar } from '../../components/insight/AvatarUploader';
import Icon from '../../components/Icon';
import { useTranslations, useLanguage } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/student/profile';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Student Portal's own Profile page — was missing entirely (Topbar's
 * `/${role}/profile` link had nowhere to go for `student`, so it fell
 * through to the catch-all route and bounced back to the dashboard).
 * Mirrors the other roles' Profile pages (Faculty) and
 * the old app/Views/student/profile.php this portal never got an SPA
 * equivalent of (see src/i18n/student/profile.js, auto-extracted from
 * that view).
 *
 * Talks to the real JSON API (App\Http\Controllers\Api\StudentsApiController):
 *   GET   /api/v1/students/me              -> { profile, join_request }
 *   PATCH /api/v1/students/me              full_name / bio
 *   POST  /api/v1/students/me/avatar       multipart avatar upload
 *   POST  /api/v1/students/me/join-request university_id (+ optional
 *                                          faculty_id/department_id/program_id)
 * University/faculty/department/program pickers reuse the same public
 * endpoints Register.jsx's cascade uses (GET /api/v1/auth/universities,
 * GET /api/v1/auth/university-hierarchy/{id}) — same pool, same shape.
 */
export default function StudentProfile() {
  const t = useTranslations(translations);
  const { locale } = useLanguage();

  const [profile, setProfile] = useState(null);
  const [joinRequest, setJoinRequest] = useState(null);
  const [form, setForm] = useState({ full_name: '', bio: '' });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveOk, setSaveOk] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // University join-request panel state (only relevant while unlinked).
  const [universities, setUniversities] = useState([]);
  const [universityId, setUniversityId] = useState('');
  const [faculties, setFaculties] = useState([]);
  const [facultyId, setFacultyId] = useState('');
  const [allDepartments, setAllDepartments] = useState([]);
  const [allPrograms, setAllPrograms] = useState([]);
  const [departmentId, setDepartmentId] = useState('');
  const [programId, setProgramId] = useState('');
  const [hierarchyLoading, setHierarchyLoading] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [requestError, setRequestError] = useState(null);
  const [requestOk, setRequestOk] = useState(false);

  const avatarInputRef = useRef(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/api/v1/students/me', { locale })
      .then((json) => {
        const p = json.data?.profile || {};
        setProfile(p);
        setJoinRequest(json.data?.join_request || null);
        setForm({ full_name: p.full_name || '', bio: p.bio || '' });
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [locale]);

  useEffect(() => { load(); }, [load]);

  // Only fetch the university picker's data once the account actually
  // needs it (unlinked, no pending request) — same lazy pattern as
  // Register.jsx.
  useEffect(() => {
    if (profile?.university_id || joinRequest?.status === 'pending' || universities.length) return;
    let cancelled = false;
    api.get('/api/v1/auth/universities', { locale })
      .then((json) => { if (!cancelled) setUniversities(json.data || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [profile, joinRequest, universities.length, locale]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);
    try {
      await api.patch('/api/v1/students/me', { full_name: form.full_name, bio: form.bio });
      setSaveOk(true);
      load();
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const json = await api.postForm('/api/v1/students/me/avatar', formData);
      setProfile((p) => ({ ...p, avatar_path: json.data?.avatar_path || p?.avatar_path }));
      announceAvatar(json.data?.avatar_path);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  }

  function resetDownstream() {
    setFaculties([]);
    setFacultyId('');
    setAllDepartments([]);
    setAllPrograms([]);
    setDepartmentId('');
    setProgramId('');
  }

  async function handleUniversityChange(e) {
    const id = e.target.value;
    setUniversityId(id);
    resetDownstream();
    if (!id) return;

    setHierarchyLoading(true);
    try {
      const json = await api.get(`/api/v1/auth/university-hierarchy/${id}`, { locale });
      setFaculties(json.data?.faculties || []);
      setAllDepartments(json.data?.departments || []);
      setAllPrograms(json.data?.programs || []);
    } catch {
      setFaculties([]);
      setAllDepartments([]);
      setAllPrograms([]);
    } finally {
      setHierarchyLoading(false);
    }
  }

  function handleFacultyChange(e) {
    const id = e.target.value;
    setFacultyId(id);
    setDepartmentId('');
    setProgramId('');
  }

  function handleDepartmentChange(e) {
    const id = e.target.value;
    setDepartmentId(id);
    setProgramId('');
  }

  const departmentsForFaculty = facultyId
    ? allDepartments.filter((d) => String(d.faculty_id) === String(facultyId))
    : [];
  const programsForDepartment = departmentId
    ? allPrograms.filter((p) => String(p.department_id) === String(departmentId))
    : [];

  async function handleSendRequest(e) {
    e.preventDefault();
    if (!universityId) return;
    setSendingRequest(true);
    setRequestError(null);
    setRequestOk(false);
    try {
      await api.post('/api/v1/students/me/join-request', {
        university_id: universityId,
        ...(facultyId ? { faculty_id: facultyId } : {}),
        ...(departmentId ? { department_id: departmentId } : {}),
        ...(programId ? { program_id: programId } : {}),
      });
      setRequestOk(true);
      setUniversityId('');
      resetDownstream();
      load();
    } catch (err) {
      setRequestError(errorMessage(err));
    } finally {
      setSendingRequest(false);
    }
  }

  if (loading) return <p className="text-small" style={{ padding: 'var(--space-5)' }}>{t('Loading…')}</p>;
  if (error) return <p style={{ color: 'var(--color-danger)', padding: 'var(--space-5)' }}>{error}</p>;
  if (!profile) return null;

  const isLinked = !!profile.university_id;
  const isPending = joinRequest?.status === 'pending';
  const isRejected = joinRequest?.status === 'rejected';

  return (
    <>
      <div className="page-header animate-rise-in">
        <div className="page-header__title">
          <h1 className="text-h1">{t('Profile')}</h1>
          <p className="text-small">{t('Your profile, academic info, and university link.')}</p>
        </div>
      </div>

      <div className="grid-2">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <div className="glass-panel" style={{ padding: 'var(--space-6)' }}>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">{t('Full Name')}</label>
                <input className="form-input" type="text" value={form.full_name} onChange={(e) => set('full_name', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('University Email')}</label>
                <input className="form-input" type="email" value={profile.email || ''} disabled />
              </div>
              <div className="form-group">
                <label className="form-label">{t('Bio')}</label>
                <textarea className="form-textarea" rows={4} value={form.bio} onChange={(e) => set('bio', e.target.value)} />
              </div>

              {saveError && <p className="form-error" style={{ marginTop: 'var(--space-2)' }}>{saveError}</p>}
              {saveOk && <p className="text-small" style={{ marginTop: 'var(--space-2)', color: 'var(--color-success)' }}>{t('Profile updated.')}</p>}

              <button type="submit" className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }} disabled={saving}>
                <Icon name="check" size={18} /> {saving ? t('Saving…') : t('Save Changes')}
              </button>
            </form>
          </div>

          <div className="glass-panel" style={{ padding: 'var(--space-6)' }}>
            <h2 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>{t('Academic Info')}</h2>
            <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <div>
                <dt className="text-caption">{t('Student Number')}</dt>
                <dd className="text-small">{profile.student_number || t('Not assigned yet')}</dd>
              </div>
              <div>
                <dt className="text-caption">{t('Year')}</dt>
                <dd className="text-small">{profile.academic_year || t('Not assigned yet')}</dd>
              </div>
              <div>
                <dt className="text-caption">{t('Faculty')}</dt>
                <dd className="text-small">{profile.faculty_name || t('Not assigned yet')}</dd>
              </div>
              <div>
                <dt className="text-caption">{t('Department')}</dt>
                <dd className="text-small">{profile.department_name || t('Not assigned yet')}</dd>
              </div>
              <div>
                <dt className="text-caption">{t('Account Status')}</dt>
                <dd className="text-small">{profile.account_status || '—'}</dd>
              </div>
            </dl>
          </div>
        </div>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <div className="glass-panel" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
            {profile.avatar_path ? (
              <img
                src={`/${profile.avatar_path}`}
                alt={t('Your profile photo')}
                style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', margin: '0 auto var(--space-4)', display: 'block' }}
              />
            ) : (
              <span style={{
                width: 96, height: 96, borderRadius: '50%', background: 'var(--color-primary)', color: 'var(--color-on-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 'var(--text-h1)',
                margin: '0 auto var(--space-4)',
              }}>
                {(profile.full_name || '?').slice(0, 1)}
              </span>
            )}
            <h2 className="text-h3">{profile.full_name || ''}</h2>

            <div style={{ marginTop: 'var(--space-4)' }}>
              <label className="btn btn-outline btn-sm" style={{ cursor: uploadingAvatar ? 'default' : 'pointer', opacity: uploadingAvatar ? 0.7 : 1 }}>
                <Icon name="upload" size={16} /> {uploadingAvatar ? t('Uploading…') : t('Change Photo')}
                <input ref={avatarInputRef} type="file" accept=".jpg,.jpeg,.png,.webp" style={{ display: 'none' }} disabled={uploadingAvatar} onChange={handleAvatarChange} />
              </label>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: 'var(--space-6)' }}>
            <h2 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>{t('University Link')}</h2>

            {isLinked && (
              <p className="text-small">
                {t('Your account is linked to')} <strong>{profile.university_name || profile.university_id}</strong>.
              </p>
            )}

            {!isLinked && isPending && (
              <p className="text-small">
                {t('Your join request to')} <strong>{joinRequest.university}</strong> {t('is awaiting the university\'s review.')}
              </p>
            )}

            {!isLinked && !isPending && (
              <>
                {isRejected && (
                  <p className="text-small" style={{ color: 'var(--color-danger)', marginBottom: 'var(--space-3)' }}>
                    {t('Your join request to')} <strong>{joinRequest.university}</strong> {t('was rejected. You can choose a different university and try again.')}
                  </p>
                )}
                {!isRejected && (
                  <p className="text-small" style={{ marginBottom: 'var(--space-3)' }}>
                    {t('Your account isn\'t linked to a university yet. Choose one so you can submit projects for approval.')}
                  </p>
                )}

                <form onSubmit={handleSendRequest}>
                  <div className="form-group">
                    <label className="form-label">{t('University')}</label>
                    <select className="form-select" value={universityId} onChange={handleUniversityChange}>
                      <option value="">{t('— Select —')}</option>
                      {universities.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">{t('Faculty (optional)')}</label>
                    <select className="form-select" value={facultyId} onChange={handleFacultyChange} disabled={!universityId || hierarchyLoading}>
                      <option value="">{universityId ? t('— Select —') : t('— Select university first —')}</option>
                      {faculties.map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">{t('Department')}</label>
                    <select className="form-select" value={departmentId} onChange={handleDepartmentChange} disabled={!facultyId}>
                      <option value="">{facultyId ? t('— Select —') : t('— Select faculty first —')}</option>
                      {departmentsForFaculty.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">{t('Program (optional)')}</label>
                    <select className="form-select" value={programId} onChange={(e) => setProgramId(e.target.value)} disabled={!departmentId}>
                      <option value="">{t('— No program —')}</option>
                      {programsForDepartment.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  {requestError && <p className="form-error" style={{ marginTop: 'var(--space-2)' }}>{requestError}</p>}
                  {requestOk && <p className="text-small" style={{ marginTop: 'var(--space-2)', color: 'var(--color-success)' }}>{t('Your join request has been sent.')}</p>}

                  <button type="submit" className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }} disabled={sendingRequest || !universityId}>
                    <Icon name="send" size={18} /> {sendingRequest ? t('Sending…') : (isRejected ? t('Send a new request') : t('Send Join Request'))}
                  </button>
                </form>
              </>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
