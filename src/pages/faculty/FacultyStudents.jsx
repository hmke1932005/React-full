import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { useTranslations, useLanguage } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/faculty/students';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Mirrors app/Views/faculty/students.php's core roster management,
 * talking to the real JSON API (GET/PATCH/DELETE /api/v1/students —
 * StudentsApiController::resolveScope(), the same StudentManagementService
 * the University page uses, scoped to this faculty automatically). Same
 * shape as UniversityStudents.jsx with the difference the PHP view itself
 * calls out: no faculty picker (fixed to the caller's own faculty), and
 * the Faculty/Department columns collapse into one Department (+ Program)
 * placement, sourced from the new GET /api/v1/faculty/my/tree endpoint
 * (a Faculty login can't call GET /api/v1/faculty/{id} the way University
 * does — that route is University-role only). Also has CSV bulk-import
 * (POST /api/v1/bulk/students/import, faculty scoped — the `group` CSV
 * column is ignored for this role, matching the Blade page's copy) and
 * Groups/Teams: index/create only, same restriction GroupsApiController
 * enforces (a group is university-wide — rename/dissolve/members stay
 * University-only, so this page doesn't offer them, matching
 * app/Views/faculty/students.php).
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

function useOwnTree() {
  const [departments, setDepartments] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const reload = useCallback(() => {
    api.get('/api/v1/faculty/my/tree')
      .then((json) => {
        setDepartments(json.data?.departments || []);
        setPrograms(json.data?.programs || []);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { departments, programs, loaded, reload };
}

export default function FacultyStudents() {
  const t = useTranslations(translations);
  const { locale } = useLanguage();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const { departments, programs, reload: reloadTree } = useOwnTree();
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
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
  const [addingDept, setAddingDept] = useState(false);
  const [groupFilter, setGroupFilter] = useState('');
  const [groups, setGroups] = useState([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupError, setGroupError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState(null);

  // StudentsApiController::toRow() (the listing shape) only returns
  // program_id, not a display name — resolve it client-side from the
  // department/program tree we already fetch for the filter + edit-modal
  // selects, same id the PATCH endpoint accepts.
  const programName = useCallback((programId) => {
    if (!programId) return null;
    const p = programs.find((pr) => String(pr.id) === String(programId));
    if (!p) return null;
    return locale === 'ar' ? p.name_ar : p.name_en;
  }, [programs, locale]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/api/v1/students', {
      search: search || undefined,
      department: departmentFilter || undefined, // department_id — see StudentsApiController::index()
      status: statusFilter || undefined,
      group_id: groupFilter || undefined,
      sort, order, page, per_page: PER_PAGE,
    })
      .then((json) => {
        setRows(json.data || []);
        setTotal(json.meta?.total ?? 0);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [search, departmentFilter, statusFilter, groupFilter, sort, order, page]);

  useEffect(() => { load(); }, [load]);

  const loadGroups = useCallback(() => {
    api.get('/api/v1/groups', { per_page: 200 })
      .then((json) => setGroups(json.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => { loadGroups(); }, [loadGroups]);

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
    } catch (err) {
      setImportError(errorMessage(err));
    } finally {
      setImporting(false);
    }
  }

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
    if (!window.confirm(locale === 'ar' ? 'إزالة هذا الطالب من الكلية؟' : 'Remove this student from your faculty?')) return;
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

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <>
      <div className="page-header animate-rise-in">
        <div className="page-header__title">
          <h1 className="text-h1">{t('Students')}</h1>
          <p className="text-small">{total} {locale === 'ar' ? 'طالب' : 'students'}</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary" onClick={() => setInviting(true)}>
            <Icon name="plus" size={16} /> {t('Add Student')}
          </button>
          <button type="button" className="btn btn-outline" onClick={() => setAddingDept(true)}>
            <Icon name="plus" size={16} /> {t('Add a new department')}
          </button>
        </div>
      </div>

      {actionError && <p style={{ color: 'var(--color-danger)' }}>{actionError}</p>}

      <div className="card glass-panel" style={{ marginBottom: 'var(--space-5)', display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="form-input" placeholder={t('Name, student ID, or email')} value={search}
          onChange={(e) => { setPage(1); setSearch(e.target.value); }} style={{ maxWidth: 280 }} />
        <select className="form-input" value={departmentFilter} onChange={(e) => { setPage(1); setDepartmentFilter(e.target.value); }} style={{ maxWidth: 220 }}>
          <option value="">{locale === 'ar' ? 'كل الأقسام' : 'All Departments'}</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{locale === 'ar' ? d.name_ar : d.name_en}</option>)}
        </select>
        <select className="form-input" value={statusFilter} onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }} style={{ maxWidth: 180 }}>
          <option value="">{locale === 'ar' ? 'كل الحالات' : 'All Statuses'}</option>
          <option value="active">{STATUS_META.active[locale]}</option>
          <option value="inactive">{STATUS_META.inactive[locale]}</option>
          <option value="suspended">{STATUS_META.suspended[locale]}</option>
        </select>
        <select className="form-input" value={groupFilter} onChange={(e) => { setPage(1); setGroupFilter(e.target.value); }} style={{ maxWidth: 200 }}>
          <option value="">{t('Group/Team')}</option>
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

      {loading && <p className="text-small">{t('Loading…')}</p>}
      {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}

      {!loading && !error && (
        <div className="table-responsive card glass-panel">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('Full Name')}</th>
                <th>{t('Student ID')}</th>
                <th>{t('Department')}</th>
                <th>{t('Program')}</th>
                <th>{t('Group/Team')}</th>
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
                    <td>{s.full_name}<br /><span className="text-caption">{s.email}</span></td>
                    <td className="text-mono">{s.student_number || '—'}</td>
                    <td>{s.department || '—'}</td>
                    <td>{programName(s.program_id) || '—'}</td>
                    <td>{s.group_name || t('No group')}</td>
                    <td>{s.academic_year ?? '—'}</td>
                    <td>
                      <span className={`badge ${meta.cls}`}>{meta[locale]}</span>
                      {inviteMeta && <> <span className={`badge ${inviteMeta.cls}`}>{inviteMeta[locale]}</span></>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                        <Link to={`/faculty/graduation/${s.id}/review`} className="btn btn-outline btn-sm" title={t('Graduation Review')}><Icon name="award" size={14} /></Link>
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
                <tr><td colSpan={8} className="text-small" style={{ padding: 'var(--space-5)', textAlign: 'center' }}>{t('No matching students yet.')}</td></tr>
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
          {locale === 'ar'
            ? 'ترتيب الأعمدة: full_name, email, student_number, faculty, department, academic_year, current_semester, group — كل الطلاب سيُضافون مباشرةً إلى كليتك بغض النظر عن عمود faculty، والقسم لازم يطابق اسم قسم موجود فعلًا في كليتك (عربي أو إنجليزي)، وإلا سيتم تخطي السطر. عمود group يُتجاهل هنا (المجموعات ميزة جامعة).'
            : 'Column order: full_name, email, student_number, faculty, department, academic_year, current_semester, group — every student is added directly to your faculty regardless of the faculty column, and department must match a department that already exists in your faculty (Arabic or English), or the row is skipped. The group column is ignored here (groups are a University-portal feature).'}
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
        <h2 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>{t('Group/Team')}</h2>
        {groupError && <p className="form-error">{groupError}</p>}
        {groups.length === 0 ? (
          <p className="text-caption" style={{ marginBottom: 'var(--space-4)' }}>
            {locale === 'ar' ? 'لا توجد مجموعات بعد.' : 'No groups yet.'}
          </p>
        ) : (
          <div className="grid-2" style={{ marginBottom: 'var(--space-4)' }}>
            {groups.map((g) => (
              <div key={g.id} className="card" style={{ padding: 'var(--space-3)' }}>
                <strong>{g.name}</strong>
                <p className="text-caption">{g.members_count} {t('members')}{g.max_members ? ` / ${g.max_members}` : ''}</p>
                {g.description && <p className="text-caption">{g.description}</p>}
              </div>
            ))}
          </div>
        )}
        <p className="text-caption" style={{ marginBottom: 'var(--space-3)' }}>
          {locale === 'ar'
            ? 'مشتركة مع الجامعة بالكامل — تعديل الاسم أو حذف المجموعة أو إدارة الأعضاء متاحة فقط من بوابة الجامعة.'
            : "Shared with the whole university — renaming, dissolving, or managing members is only available from the University portal."}
        </p>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setCreatingGroup(true)}>
          <Icon name="plus" size={16} /> {t('Create a new group')}
        </button>
      </div>

      {editing && (
        <EditStudentModal
          student={editing}
          departments={departments}
          programs={programs}
          onClose={() => setEditing(null)}
          onDone={(err) => { setEditing(null); if (err) setActionError(err); else load(); }}
        />
      )}

      {inviting && (
        <InviteStudentModal
          departments={departments}
          programs={programs}
          groups={groups}
          onClose={() => setInviting(false)}
          onDone={(err) => { setInviting(false); if (err) setActionError(err); else load(); }}
        />
      )}

      {addingDept && (
        <AddDepartmentModal
          onClose={() => setAddingDept(false)}
          onDone={(err) => { setAddingDept(false); if (err) setActionError(err); else reloadTree(); }}
        />
      )}

      {creatingGroup && (
        <CreateGroupModal
          onClose={() => setCreatingGroup(false)}
          onDone={(err) => { setCreatingGroup(false); if (err) setGroupError(err); else loadGroups(); }}
        />
      )}
    </>
  );
}

function InviteStudentModal({ departments, programs, groups, onClose, onDone }) {
  const t = useTranslations(translations);
  const { locale } = useLanguage();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [currentSemester, setCurrentSemester] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [programId, setProgramId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [studyStartDate, setStudyStartDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const scopedPrograms = programs.filter((p) => String(p.department_id) === String(departmentId));

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
        department_id: departmentId || null,
        program_id: programId || null,
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
              <label className="form-label">{t('Department')}</label>
              <select className="form-input" value={departmentId} onChange={(e) => { setDepartmentId(e.target.value); setProgramId(''); }}>
                <option value="">{locale === 'ar' ? '— القسم —' : '— Department —'}</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{locale === 'ar' ? d.name_ar : d.name_en}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('Program (optional)')}</label>
              <select className="form-input" value={programId} onChange={(e) => setProgramId(e.target.value)} disabled={!departmentId}>
                <option value="">{locale === 'ar' ? '— بدون برنامج —' : '— No program —'}</option>
                {scopedPrograms.map((p) => <option key={p.id} value={p.id}>{locale === 'ar' ? p.name_ar : p.name_en}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('Group/Team')}</label>
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

function EditStudentModal({ student, departments, programs, onClose, onDone }) {
  const t = useTranslations(translations);
  const { locale } = useLanguage();
  const [fullName, setFullName] = useState(student.full_name || '');
  const [studentNumber, setStudentNumber] = useState(student.student_number || '');
  const [academicYear, setAcademicYear] = useState(student.academic_year ?? '');
  const [currentSemester, setCurrentSemester] = useState(student.current_semester ?? '');
  const [departmentId, setDepartmentId] = useState(student.department_id ?? '');
  const [programId, setProgramId] = useState(student.program_id ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [addingProgram, setAddingProgram] = useState(false);

  const scopedPrograms = programs.filter((p) => String(p.department_id) === String(departmentId));

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
        department_id: departmentId || null,
        program_id: programId || null,
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
              <label className="form-label">{t('Department')}</label>
              <select className="form-input" value={departmentId} onChange={(e) => { setDepartmentId(e.target.value); setProgramId(''); }}>
                <option value="">{locale === 'ar' ? '— القسم —' : '— Department —'}</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{locale === 'ar' ? d.name_ar : d.name_en}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('Program (optional)')}</label>
              <select className="form-input" value={programId} onChange={(e) => setProgramId(e.target.value)} disabled={!departmentId}>
                <option value="">{t('No group') === t('No group') ? (locale === 'ar' ? '— بدون برنامج —' : '— No program —') : ''}</option>
                {scopedPrograms.map((p) => <option key={p.id} value={p.id}>{locale === 'ar' ? p.name_ar : p.name_en}</option>)}
              </select>
              {departmentId && (
                <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 4 }} onClick={() => setAddingProgram(true)}>
                  <Icon name="plus" size={12} /> {t('Add a new program for this department')}
                </button>
              )}
            </div>
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-box__actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>{locale === 'ar' ? 'إلغاء' : 'Cancel'}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? (locale === 'ar' ? 'جارٍ الحفظ…' : 'Saving…') : t('Save')}</button>
          </div>
        </form>

        {addingProgram && (
          <AddProgramModal
            departmentId={departmentId}
            onClose={() => setAddingProgram(false)}
            onDone={() => setAddingProgram(false)}
          />
        )}
      </div>
    </div>
  );
}

function AddDepartmentModal({ onClose, onDone }) {
  const t = useTranslations(translations);
  const { locale } = useLanguage();
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post('/api/v1/faculty/departments', { name_en: nameEn, name_ar: nameAr, description: description || null });
      onDone(null);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box card glass-panel" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-box__title text-h3">{t('Add a new department')}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t('Department name (English)')}</label>
            <input className="form-input" value={nameEn} onChange={(e) => setNameEn(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">{t('Department name (Arabic)')}</label>
            <input className="form-input" value={nameAr} onChange={(e) => setNameAr(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">{t('Description (optional)')}</label>
            <textarea className="form-input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-box__actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>{locale === 'ar' ? 'إلغاء' : 'Cancel'}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? (locale === 'ar' ? 'جارٍ الحفظ…' : 'Saving…') : t('Create Department')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddProgramModal({ departmentId, onClose, onDone }) {
  const t = useTranslations(translations);
  const { locale } = useLanguage();
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post(`/api/v1/faculty/departments/${departmentId}/programs`, { name_en: nameEn, name_ar: nameAr });
      onDone(null);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box card glass-panel" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-box__title text-h3">{t('Add a new program for this department')}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t('Program name (English)')}</label>
            <input className="form-input" value={nameEn} onChange={(e) => setNameEn(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">{t('Program name (Arabic)')}</label>
            <input className="form-input" value={nameAr} onChange={(e) => setNameAr(e.target.value)} required />
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-box__actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>{locale === 'ar' ? 'إلغاء' : 'Cancel'}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? (locale === 'ar' ? 'جارٍ الحفظ…' : 'Saving…') : t('Create Program')}</button>
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
            <label className="form-label">{locale === 'ar' ? 'الحد الأقصى للأعضاء (اتركه فارغًا لإلغاء الحد)' : 'Max members (leave blank for no cap)'}</label>
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
