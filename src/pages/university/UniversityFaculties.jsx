import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { useTranslations, useLanguage } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/university/faculties';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Mirrors app/Views/university/faculties.php, talking to the real JSON
 * API (App\Controllers\Api\FacultyApiController::index()/store() — same
 * FacultyRepository::forUniversityWithCounts() the Blade page uses).
 * List + create only; per-faculty stats/departments/login management live
 * on UniversityFacultyPortfolio.jsx, same split as the legacy pages.
 */

export default function UniversityFaculties() {
  const t = useTranslations(translations);
  const { locale } = useLanguage();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback((archived) => {
    setLoading(true);
    setError(null);
    api.get('/api/v1/faculty', { per_page: 100, status: archived ? 'archived' : undefined })
      .then((json) => setRows(json.data || []))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(showArchived); }, [load, showArchived]);

  async function handleArchive(f) {
    const name = locale === 'ar' ? (f.name_ar || f.name_en) : (f.name_en || f.name_ar);
    const confirmMsg = t('Archive {name}? It will disappear from the list; its departments, students and staff stay saved and you can restore it anytime from the "Archived" tab.').replace('{name}', name);
    if (!window.confirm(confirmMsg)) return;
    setActionError(null);
    setBusyId(f.id);
    try {
      await api.post(`/api/v1/faculty/${f.id}/archive`, {});
      load(showArchived);
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleRestore(f) {
    setActionError(null);
    setBusyId(f.id);
    try {
      await api.post(`/api/v1/faculty/${f.id}/unarchive`, {});
      load(showArchived);
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  const departmentsTotal = rows.reduce((sum, f) => sum + (f.departments_count || 0), 0);

  return (
    <>
      <div className="page-header animate-rise-in">
        <div className="page-header__title">
          <h1 className="text-h1"><Icon name="building" size={26} /> {t('Faculties')}</h1>
          <p className="text-small">
            {t("Your university's faculties — open one to see its stats and departments, and manage its portfolio visibility.")}
          </p>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="card glass-panel" style={{ padding: 'var(--space-5)' }}>
          <div className="text-caption">{t('Faculties')}</div>
          <div className="text-h2">{rows.length}</div>
        </div>
        <div className="card glass-panel" style={{ padding: 'var(--space-5)' }}>
          <div className="text-caption">{t('Departments')}</div>
          <div className="text-h2">{departmentsTotal}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
        <button
          type="button"
          className={`btn btn-sm ${!showArchived ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setShowArchived(false)}
        >
          {t('Active Tab')}
        </button>
        <button
          type="button"
          className={`btn btn-sm ${showArchived ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setShowArchived(true)}
        >
          <Icon name="archive" size={14} /> {t('Archived Tab')}
        </button>
      </div>

      {loading && <p className="text-small">{t('Loading…')}</p>}
      {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}
      {actionError && <p style={{ color: 'var(--color-danger)' }}>{actionError}</p>}

      {!loading && !error && rows.length === 0 && (
        <div className="card glass-panel" style={{ textAlign: 'center', padding: 'var(--space-8)', marginBottom: 'var(--space-6)' }}>
          <p className="text-small text-muted">
            {showArchived ? t('No archived faculties.') : t('No faculties added yet.')}
          </p>
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="table-responsive card glass-panel" style={{ marginBottom: 'var(--space-6)' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('Faculty')}</th>
                <th>{t('Departments')}</th>
                <th>{t('Status')}</th>
                <th>{t('Visibility')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => {
                const name = locale === 'ar' ? (f.name_ar || f.name_en) : (f.name_en || f.name_ar);
                return (
                  <tr key={f.id}>
                    <td><strong>{name}</strong></td>
                    <td>{f.departments_count ?? 0}</td>
                    <td>
                      <span className={`badge ${f.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>
                        {f.status === 'archived' ? t('Archived') : t('Active')}
                      </span>
                    </td>
                    <td>
                      {f.is_public
                        ? <span className="badge badge-success"><Icon name="eye" size={12} /> {t('Public')}</span>
                        : <span className="badge badge-neutral"><Icon name="eye-off" size={12} /> {t('Private')}</span>}
                    </td>
                    <td style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <Link to={`/university/faculties/${f.id}/portfolio`} className="btn btn-outline btn-sm">{t('View Portfolio')}</Link>
                      {showArchived ? (
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          disabled={busyId === f.id}
                          onClick={() => handleRestore(f)}
                        >
                          <Icon name="refresh" size={14} /> {t('Restore')}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          disabled={busyId === f.id}
                          onClick={() => handleArchive(f)}
                        >
                          <Icon name="archive" size={14} /> {t('Archive')}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="card glass-panel" style={{ padding: 'var(--space-6)', maxWidth: 640 }}>
        <h2 className="text-h3" style={{ marginBottom: 'var(--space-4)' }}>{t('Add Faculty')}</h2>
        <AddFacultyForm onDone={() => load(showArchived)} />
      </div>
    </>
  );
}

function AddFacultyForm({ onDone }) {
  const t = useTranslations(translations);
  const { locale } = useLanguage();
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post('/api/v1/faculty', {
        name_en: nameEn,
        name_ar: nameAr,
        description,
        email: email.trim() || undefined,
        password: password || undefined,
        locale,
      });
      setNameEn(''); setNameAr(''); setDescription(''); setEmail(''); setPassword('');
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid-2">
        <div className="form-group">
          <label className="form-label">{t('Faculty Name (English)')}</label>
          <input className="form-input" value={nameEn} onChange={(e) => setNameEn(e.target.value)} required maxLength={200} />
        </div>
        <div className="form-group">
          <label className="form-label">{t('Faculty Name (Arabic)')}</label>
          <input className="form-input" value={nameAr} onChange={(e) => setNameAr(e.target.value)} required maxLength={200} />
        </div>
        <div className="form-group" style={{ gridColumn: 'span 2' }}>
          <label className="form-label">{t('Short Description')}</label>
          <textarea className="form-input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 'var(--space-4)' }}>
        <div className="form-group" style={{ gridColumn: 'span 2' }}>
          <label className="form-label">{t('Faculty Login')}</label>
          <p className="text-small text-muted" style={{ marginTop: 0, marginBottom: 'var(--space-2)' }}>
            {locale === 'ar'
              ? 'اختياري — لو حددت الإيميل، هيتعمل حساب دخول للكلية. سيب الباسورد فاضي عشان يتولّد باسورد مؤقت ويتبعت بالإيميل.'
              : "Optional — add an email to create a login account for this faculty. Leave the password empty to auto-generate a temporary one that's emailed to it."}
          </p>
        </div>
        <div className="form-group">
          <label className="form-label">{t('Email')}</label>
          <input type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={190} />
        </div>
        <div className="form-group">
          <label className="form-label">{t('Password')}</label>
          <input
            type="password"
            className="form-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            maxLength={64}
            autoComplete="new-password"
            placeholder={locale === 'ar' ? 'يتولّد تلقائيًا لو فاضي' : 'Auto-generated if left empty'}
          />
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}
      <button type="submit" className="btn btn-primary" style={{ marginTop: 'var(--space-3)' }} disabled={saving}>
        <Icon name="plus" size={18} /> {saving ? (locale === 'ar' ? 'جارٍ الإضافة…' : 'Adding…') : t('Add Faculty')}
      </button>
    </form>
  );
}
