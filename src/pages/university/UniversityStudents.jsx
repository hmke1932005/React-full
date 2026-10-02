import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { useTranslations, useLanguage } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/university/students';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Mirrors app/Views/university/students.php's core roster management,
 * talking to the real JSON API (GET/PATCH/DELETE /api/v1/students —
 * App\Controllers\Api\StudentsApiController, the exact same
 * StudentManagementService the Blade page uses). Covers listing +
 * search/filter/sort/pagination, per-student edit (basic info, academic
 * details, faculty/department placement), activate/deactivate, resend
 * invite, and delete — plus the CSV bulk-import (POST
 * /api/v1/bulk/students/import — BulkApiController::studentsImport(),
 * same StudentManagementService::importCsv() the Blade form posts to)
 * and Groups/Teams management (GET/POST/PATCH/DELETE /api/v1/groups —
 * GroupsApiController, University role: full CRUD + members) that the
 * Blade page also has. Selecting rows and moving them into a group
 * mirrors the Blade "move-group-form" via POST
 * /api/v1/bulk/students/update (group_id).
 */

const PER_PAGE = 20;
const STATUS_META = {
  active: { cls: 'badge-success', en: 'Active', ar: 'نشط' },
  pending: { cls: 'badge-primary', en: 'Pending', ar: 'قيد التفعيل' },
  inactive: { cls: 'badge-neutral', en: 'Inactive', ar: 'غير نشط' },
  suspended: { cls: 'badge-danger', en: 'Suspended', ar: 'موقوف' },
  banned: { cls: 'badge-danger', en: 'Banned', ar: 'محظور' },
};
const INVITE_META = {
  pending: { cls: 'badge-primary', en: 'Invite Pending', ar: 'دعوة قيد الانتظار' },
  accepted: { cls: 'badge-success', en: 'Accepted', ar: 'مقبولة' },
  expired: { cls: 'badge-danger', en: 'Invite Expired', ar: 'دعوة منتهية' },
};

export default function UniversityStudents() {
  const t = useTranslations(translations);
  const { locale } = useLanguage();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [faculties, setFaculties] = useState([]);
  const [search, setSearch] = useState('');
  const [facultyFilter, setFacultyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort] = useState('full_name');
  const [order, setOrder] = useState('asc');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [inviting, setInviting] = useState(false);
  const [groupFilter, setGroupFilter] = useState('');
  const [groups, setGroups] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [moveGroupId, setMoveGroupId] = useState('');
  const [moving, setMoving] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [managingGroup, setManagingGroup] = useState(null);
  const [groupError, setGroupError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/api/v1/students', {
      search: search || undefined,
      faculty: facultyFilter || undefined,
      status: statusFilter || undefined,
      group_id: groupFilter || undefined,
      sort, order, page, per_page: PER_PAGE,
    })
      .then((json) => {
        setRows(json.data || []);
        setTotal(json.meta?.total ?? 0);
        setSelectedIds([]);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [search, facultyFilter, statusFilter, groupFilter, sort, order, page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get('/api/v1/faculty', { per_page: 100 })
      .then((json) => setFaculties(json.data || []))
      .catch(() => {});
  }, []);

  const loadGroups = useCallback(() => {
    api.get('/api/v1/groups', { per_page: 200 })
      .then((json) => setGroups(json.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  async function handleToggleStatus(s) {
    setBusyId(s.id);
    setActionError(null);
    try {
      await api.patch(`/api/v1/students/${s.id}`, { account_status: s.account_status === 'active' ? 'inactive' : 'active' });
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
      await api.post(`/api/v1/students/${s.id}/resend`, {});
      load();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(s) {
    if (!window.confirm(locale === 'ar' ? 'حذف هذا الطالب؟' : 'Remove this student?')) return;
    setBusyId(s.id);
    setActionError(null);
    try {
      await api.delete(`/api/v1/students/${s.id}`);
      load();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  function toggleSelected(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => (prev.length === rows.length ? [] : rows.map((r) => r.id)));
  }

  async function handleMoveSelected() {
    if (selectedIds.length === 0) return;
    setMoving(true);
    setActionError(null);
    try {
      await api.post('/api/v1/bulk/students/update', { ids: selectedIds, group_id: moveGroupId || null });
      setMoveGroupId('');
      load();
      loadGroups();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setMoving(false);
    }
  }

  async function handleImport(file) {
    if (!file) return;
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append('csv_file', file);
      const json = await api.postForm('/api/v1/bulk/students/import', fd);
      setImportResult(json.data);
      load();
      loadGroups();
    } catch (err) {
      setImportError(errorMessage(err));
    } finally {
      setImporting(false);
    }
  }

  async function handleDeleteGroup(g) {
    if (!window.confirm(locale === 'ar' ? 'حذف هذه المجموعة؟ لن يُحذف طلابها.' : 'Delete this group? Its students will not be deleted.')) return;
    setGroupError(null);
    try {
      await api.del(`/api/v1/groups/${g.id}`);
      loadGroups();
      load();
    } catch (err) {
      setGroupError(errorMessage(err));
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <>
      <div className="page-header animate-rise-in">
        <div className="page-header__title">
          <h1 className="text-h1">{t('Students')}</h1>
          <p className="text-small">{total} {locale === 'ar' ? 'طالب' : 'students'}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setInviting(true)}>
          <Icon name="plus" size={16} /> {t('Add Student')}
        </button>
      </div>

      {actionError && <p style={{ color: 'var(--color-danger)' }}>{actionError}</p>}

      <div className="card glass-panel" style={{ marginBottom: 'var(--space-5)', display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="form-input" placeholder={t('Name, student ID, or email')} value={search}
          onChange={(e) => { setPage(1); setSearch(e.target.value); }} style={{ maxWidth: 280 }} />
        <select className="form-input" value={facultyFilter} onChange={(e) => { setPage(1); setFacultyFilter(e.target.value); }} style={{ maxWidth: 220 }}>
          <option value="">{locale === 'ar' ? 'كل الكليات' : 'All Faculties'}</option>
          {faculties.map((f) => <option key={f.id} value={locale === 'ar' ? f.name_ar : f.name_en}>{locale === 'ar' ? f.name_ar : f.name_en}</option>)}
        </select>
        <select className="form-input" value={statusFilter} onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }} style={{ maxWidth: 180 }}>
          <option value="">{locale === 'ar' ? 'كل الحالات' : 'All Statuses'}</option>
          <option value="active">{STATUS_META.active[locale]}</option>
          <option value="inactive">{STATUS_META.inactive[locale]}</option>
          <option value="suspended">{STATUS_META.suspended[locale]}</option>
        </select>
        <select className="form-input" value={groupFilter} onChange={(e) => { setPage(1); setGroupFilter(e.target.value); }} style={{ maxWidth: 200 }}>
          <option value="">{t('Group')}</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select className="form-input" value={`${sort}:${order}`} onChange={(e) => { const [s, o] = e.target.value.split(':'); setSort(s); setOrder(o); }} style={{ maxWidth: 220 }}>
          <option value="full_name:asc">{t('Full Name')} A→Z</option>
          <option value="full_name:desc">{t('Full Name')} Z→A</option>
          <option value="created_at:desc">{locale === 'ar' ? 'الأحدث' : 'Newest'}</option>
          <option value="academic_year:asc">{t('Academic Year')} ↑</option>
          <option value="projects_count:desc">{locale === 'ar' ? 'أكثر المشاريع' : 'Most Projects'}</option>
        </select>
      </div>

      {selectedIds.length > 0 && (
        <div className="card glass-panel" style={{ marginBottom: 'var(--space-5)', display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="text-small">{selectedIds.length} {locale === 'ar' ? 'محدد' : 'selected'}</span>
          <label className="text-small">{t('Move checked students to')}</label>
          <select className="form-input" value={moveGroupId} onChange={(e) => setMoveGroupId(e.target.value)} style={{ maxWidth: 200 }}>
            <option value="">{t('No group')}</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <button type="button" className="btn btn-primary btn-sm" disabled={moving} onClick={handleMoveSelected}>
            {moving ? (locale === 'ar' ? 'جارٍ النقل…' : 'Moving…') : t('Move')}
          </button>
        </div>
      )}

      {loading && <p className="text-small">{t('Loading…')}</p>}
      {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}

      {!loading && !error && (
        <div className="table-responsive card glass-panel">
          <table className="data-table">
            <thead>
              <tr>
                <th><input type="checkbox" checked={rows.length > 0 && selectedIds.length === rows.length} onChange={toggleSelectAll} title={t('Select to move')} /></th>
                <th>{t('Full Name')}</th>
                <th>{t('Student ID')}</th>
                <th>{t('Faculty')}</th>
                <th>{t('Department')}</th>
                <th>{t('Group')}</th>
                <th>{t('Academic Year')}</th>
                <th>{locale === 'ar' ? 'الحالة' : 'Status'}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const meta = STATUS_META[s.account_status] || STATUS_META.active;
                const inviteMeta = s.invitation_status && s.invitation_status !== 'n/a' ? INVITE_META[s.invitation_status] : null;
                const busy = busyId === s.id;
                return (
                  <tr key={s.id}>
                    <td><input type="checkbox" checked={selectedIds.includes(s.id)} onChange={() => toggleSelected(s.id)} title={t('Select to move')} /></td>
                    <td>{s.full_name}<br /><span className="text-caption">{s.email}</span></td>
                    <td className="text-mono">{s.student_number || '—'}</td>
                    <td>{s.faculty || '—'}</td>
                    <td>{s.department || '—'}</td>
                    <td>{s.group_name || t('No group')}</td>
                    <td>{s.academic_year ?? '—'}</td>
                    <td>
                      <span className={`badge ${meta.cls}`}>{meta[locale]}</span>
                      {inviteMeta && <> <span className={`badge ${inviteMeta.cls}`}>{inviteMeta[locale]}</span></>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                        <Link to={`/university/graduation/${s.id}/review`} className="btn btn-outline btn-sm" title={t('Graduation Review')}><Icon name="award" size={14} /></Link>
                        <button type="button" className="btn btn-outline btn-sm" title={t('Edit')} onClick={() => setEditing(s)}><Icon name="edit" size={14} /></button>
                        {inviteMeta && s.invitation_status !== 'accepted' && (
                          <button type="button" className="btn btn-outline btn-sm" disabled={busy} title={t('Resend')} onClick={() => handleResend(s)}><Icon name="mail" size={14} /></button>
                        )}
                        {s.account_status === 'active' ? (
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
                <tr><td colSpan={9} className="text-small" style={{ padding: 'var(--space-5)', textAlign: 'center' }}>{t('No matching students yet.')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-5)', alignItems: 'center' }}>
          <button type="button" className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><Icon name="chevron-left" size={16} /></button>
          <span className="text-small">{page} / {totalPages}</span>
          <button type="button" className="btn btn-outline btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}><Icon name="chevron-right" size={16} /></button>
        </div>
      )}

      <div className="card glass-panel" style={{ marginTop: 'var(--space-6)' }}>
        <h2 className="text-h4" style={{ marginBottom: 'var(--space-2)' }}>{t('Import from CSV')}</h2>
        <p className="text-caption" style={{ marginBottom: 'var(--space-3)' }}>
          {t('Column order: full_name, email, student_number, faculty, department, academic_year, current_semester, group — faculty/department must exactly match the name (Arabic or English) of a faculty/department that already exists at your university, or the row is skipped.')}
        </p>
        <form onSubmit={(e) => { e.preventDefault(); const file = e.target.elements.csv_file.files[0]; handleImport(file); e.target.reset(); }}
          style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="file" name="csv_file" accept=".csv,text/csv" required />
          <button type="submit" className="btn btn-outline btn-sm" disabled={importing}>
            <Icon name="upload" size={14} /> {importing ? (locale === 'ar' ? 'جارٍ الاستيراد…' : 'Importing…') : t('Import')}
          </button>
        </form>
        {importError && <p className="form-error" style={{ marginTop: 'var(--space-3)' }}>{importError}</p>}
        {importResult && (
          <p className="text-small" style={{ marginTop: 'var(--space-3)' }}>
            {locale === 'ar'
              ? `تم استيراد ${importResult.imported}، وتخطي ${importResult.skipped}.`
              : `Imported ${importResult.imported}, skipped ${importResult.skipped}.`}
            {importResult.errors?.length > 0 && (
              <span style={{ display: 'block', color: 'var(--color-danger)', marginTop: 'var(--space-1)' }}>
                {importResult.errors.slice(0, 5).join(' ')}
              </span>
            )}
          </p>
        )}
      </div>

      <div className="card glass-panel" style={{ marginTop: 'var(--space-5)' }}>
        <h2 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>{t('Groups/Teams')}</h2>
        {groupError && <p className="form-error">{groupError}</p>}
        {groups.length === 0 ? (
          <p className="text-caption" style={{ marginBottom: 'var(--space-4)' }}>{t('No groups yet.')}</p>
        ) : (
          <div className="grid-2" style={{ marginBottom: 'var(--space-4)' }}>
            {groups.map((g) => (
              <div key={g.id} className="card" style={{ padding: 'var(--space-3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <div>
                    <strong>{g.name}</strong>
                    <p className="text-caption">{g.members_count} {t('members')}{g.max_members ? ` / ${g.max_members}` : ''}</p>
                    {g.description && <p className="text-caption">{g.description}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button type="button" className="btn btn-outline btn-sm" title={t('Edit')} onClick={() => setManagingGroup(g)}><Icon name="users" size={14} /></button>
                    <button type="button" className="btn btn-outline btn-sm" title={t('Edit')} onClick={() => setEditingGroup(g)}><Icon name="edit" size={14} /></button>
                    <button type="button" className="btn btn-danger btn-sm" title={t('Delete')} onClick={() => handleDeleteGroup(g)}><Icon name="trash" size={14} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <h3 className="text-h4" style={{ marginBottom: 'var(--space-2)' }}>{t('Create a new group')}</h3>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setCreatingGroup(true)}>
          <Icon name="plus" size={16} /> {t('Create a new group')}
        </button>
      </div>

      {editing && (
        <EditStudentModal
          student={editing}
          faculties={faculties}
          onClose={() => setEditing(null)}
          onDone={(err) => { setEditing(null); if (err) setActionError(err); else load(); }}
        />
      )}

      {inviting && (
        <InviteStudentModal
          faculties={faculties}
          groups={groups}
          onClose={() => setInviting(false)}
          onDone={(err) => { setInviting(false); if (err) setActionError(err); else { load(); loadGroups(); } }}
        />
      )}

      {creatingGroup && (
        <CreateGroupModal
          onClose={() => setCreatingGroup(false)}
          onDone={(err) => { setCreatingGroup(false); if (err) setGroupError(err); else loadGroups(); }}
        />
      )}

      {editingGroup && (
        <EditGroupModal
          group={editingGroup}
          onClose={() => setEditingGroup(null)}
          onDone={(err) => { setEditingGroup(null); if (err) setGroupError(err); else loadGroups(); }}
        />
      )}

      {managingGroup && (
        <ManageGroupMembersModal
          group={managingGroup}
          onClose={() => setManagingGroup(null)}
          onChanged={() => { loadGroups(); load(); }}
        />
      )}
    </>
  );
}

function InviteStudentModal({ faculties, groups, onClose, onDone }) {
  const t = useTranslations(translations);
  const { locale } = useLanguage();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [currentSemester, setCurrentSemester] = useState('');
  const [facultyId, setFacultyId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [departments, setDepartments] = useState([]);
  const [groupId, setGroupId] = useState('');
  const [studyStartDate, setStudyStartDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!facultyId) { setDepartments([]); return; }
    let cancelled = false;
    api.get(`/api/v1/faculty/${facultyId}`)
      .then((json) => { if (!cancelled) setDepartments(json.data?.departments || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [facultyId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post('/api/v1/students', {
        full_name: fullName,
        email,
        student_number: studentNumber || null,
        academic_year: academicYear || null,
        current_semester: currentSemester || null,
        faculty_id: facultyId || null,
        department_id: departmentId || null,
        group_id: groupId || null,
        study_start_date: studyStartDate || null,
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
        <h2 className="modal-box__title text-h3">{t('Add Student')}</h2>
        <form onSubmit={handleSubmit}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">{t('Full Name')}</label>
              <input className="form-input" value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={150} />
            </div>
            <div className="form-group">
              <label className="form-label">{locale === 'ar' ? 'البريد الإلكتروني' : 'Email'}</label>
              <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={190} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('Student ID')}</label>
              <input className="form-input" value={studentNumber} onChange={(e) => setStudentNumber(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('Academic Year')}</label>
              <input className="form-input" type="number" min="1" max="8" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('Current semester')}</label>
              <input className="form-input" type="number" min="1" max="2" value={currentSemester} onChange={(e) => setCurrentSemester(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">{locale === 'ar' ? 'تاريخ بدء الدراسة (اختياري)' : 'Study start date (optional)'}</label>
              <input className="form-input" type="date" value={studyStartDate} onChange={(e) => setStudyStartDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('Faculty')}</label>
              <select className="form-input" value={facultyId} onChange={(e) => { setFacultyId(e.target.value); setDepartmentId(''); }}>
                <option value="">{t('— No faculty —')}</option>
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
              <label className="form-label">{t('Group')}</label>
              <select className="form-input" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                <option value="">{t('No group')}</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-box__actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>{locale === 'ar' ? 'إلغاء' : 'Cancel'}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? (locale === 'ar' ? 'جارٍ الإرسال…' : 'Sending…') : t('Add Student')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditStudentModal({ student, faculties, onClose, onDone }) {
  const t = useTranslations(translations);
  const { locale } = useLanguage();
  const [fullName, setFullName] = useState(student.full_name || '');
  const [studentNumber, setStudentNumber] = useState(student.student_number || '');
  const [academicYear, setAcademicYear] = useState(student.academic_year ?? '');
  const [currentSemester, setCurrentSemester] = useState(student.current_semester ?? '');
  const [facultyId, setFacultyId] = useState(student.faculty_id ?? '');
  const [departmentId, setDepartmentId] = useState(student.department_id ?? '');
  const [departments, setDepartments] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!facultyId) { setDepartments([]); return; }
    let cancelled = false;
    api.get(`/api/v1/faculty/${facultyId}`)
      .then((json) => { if (!cancelled) setDepartments(json.data?.departments || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [facultyId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/api/v1/students/${student.id}`, {
        full_name: fullName,
        student_number: studentNumber,
        academic_year: academicYear || null,
        current_semester: currentSemester || null,
        faculty_id: facultyId || null,
        department_id: departmentId || null,
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
        <h2 className="modal-box__title text-h3">{t('Edit Student')} — {student.full_name}</h2>
        <form onSubmit={handleSubmit}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">{t('Full Name')}</label>
              <input className="form-input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">{t('Student ID')}</label>
              <input className="form-input" value={studentNumber} onChange={(e) => setStudentNumber(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('Academic Year')}</label>
              <input className="form-input" type="number" min="1" max="8" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('Current semester')}</label>
              <input className="form-input" type="number" min="1" max="2" value={currentSemester} onChange={(e) => setCurrentSemester(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('Faculty')}</label>
              <select className="form-input" value={facultyId} onChange={(e) => { setFacultyId(e.target.value); setDepartmentId(''); }}>
                <option value="">{t('— No faculty —')}</option>
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

function CreateGroupModal({ onClose, onDone }) {
  const t = useTranslations(translations);
  const { locale } = useLanguage();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [maxMembers, setMaxMembers] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post('/api/v1/groups', { name, description: description || null, max_members: maxMembers || null });
      onDone(null);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box card glass-panel" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-box__title text-h3">{t('Create a new group')}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t('Group name')}</label>
            <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={150} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('Description (optional)')}</label>
            <textarea className="form-input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('Max members (leave blank for no cap)')}</label>
            <input className="form-input" type="number" min="0" value={maxMembers} onChange={(e) => setMaxMembers(e.target.value)} />
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-box__actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>{locale === 'ar' ? 'إلغاء' : 'Cancel'}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? (locale === 'ar' ? 'جارٍ الحفظ…' : 'Saving…') : t('Create')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditGroupModal({ group, onClose, onDone }) {
  const t = useTranslations(translations);
  const { locale } = useLanguage();
  const [name, setName] = useState(group.name || '');
  const [description, setDescription] = useState(group.description || '');
  const [maxMembers, setMaxMembers] = useState(group.max_members ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/api/v1/groups/${group.id}`, { name, description: description || null, max_members: maxMembers || null });
      onDone(null);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box card glass-panel" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-box__title text-h3">{t('Edit')} — {group.name}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t('Group name')}</label>
            <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={150} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('Description (optional)')}</label>
            <textarea className="form-input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('Max members (leave blank for no cap)')}</label>
            <input className="form-input" type="number" min="0" value={maxMembers} onChange={(e) => setMaxMembers(e.target.value)} />
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

function ManageGroupMembersModal({ group, onClose, onChanged }) {
  const t = useTranslations(translations);
  const { locale } = useLanguage();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/api/v1/groups/${group.id}/members`)
      .then((json) => setMembers(json.data || []))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [group.id]);

  useEffect(() => { load(); }, [load]);

  async function handleRemove(studentId) {
    setBusyId(studentId);
    setError(null);
    try {
      await api.del(`/api/v1/groups/${group.id}/members/${studentId}`);
      load();
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box card glass-panel" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-box__title text-h3">{group.name}</h2>
        {loading && <p className="text-small">{t('Loading…')}</p>}
        {error && <p className="form-error">{error}</p>}
        {!loading && members.length === 0 && (
          <p className="text-caption">{locale === 'ar' ? 'لا يوجد أعضاء في هذه المجموعة بعد.' : 'No members in this group yet.'}</p>
        )}
        {!loading && members.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {members.map((m) => (
              <li key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{m.full_name} <span className="text-caption">{m.email}</span></span>
                <button type="button" className="btn btn-outline btn-sm" disabled={busyId === m.id} onClick={() => handleRemove(m.id)}>
                  <Icon name="x" size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-caption" style={{ marginTop: 'var(--space-4)' }}>
          {locale === 'ar' ? 'لإضافة طلاب لهذه المجموعة، حدّدهم من جدول الطلاب واستخدم "نقل الطلاب المحددين إلى".' : 'To add students to this group, select them from the students table and use "Move checked students to".'}
        </p>
        <div className="modal-box__actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>{t('Close')}</button>
        </div>
      </div>
    </div>
  );
}
