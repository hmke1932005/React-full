import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { useLanguage, useTranslations } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/university/announcements';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Mirrors app/Views/university/announcements.php, talking to the real
 * JSON API (app/Controllers/Api/AnnouncementsApiController.php — already
 * built, reuses AnnouncementService::publish()/update()/delete() exactly
 * as UniversityAnnouncementController does). Publish is multipart
 * (title/body/category/publish_at/expires_at/target fields/attachment
 * files 0 through 4/link_url[]/link_title[]) since AnnouncementService
 * reads attachments straight off the Request the same way the web
 * controller's form does.
 */

const CATEGORIES = {
  academic: { en: 'Academic', ar: 'أكاديمي' },
  event: { en: 'Event', ar: 'فعالية' },
  competition: { en: 'Competition', ar: 'مسابقة' },
  deadline: { en: 'Deadline', ar: 'موعد نهائي' },
  training: { en: 'Training', ar: 'تدريب' },
  workshop: { en: 'Workshop', ar: 'ورشة عمل' },
  research: { en: 'Research', ar: 'بحث' },
};

const KIND_ICON = { image: 'image', video: 'file', pdf: 'file', file: 'file', link: 'link' };
const PER_PAGE = 10;

export default function UniversityAnnouncements() {
  const t = useTranslations(translations);
  const { locale } = useLanguage();

  const [announcements, setAnnouncements] = useState([]);
  const [attachments, setAttachments] = useState({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [faculties, setFaculties] = useState([]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/api/v1/announcements', { page, per_page: PER_PAGE, q: query || undefined })
      .then((json) => {
        setAnnouncements(json.data || []);
        setTotal(json.meta?.total ?? 0);
        setAttachments(json.meta?.attachments || {});
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [page, query]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get('/api/v1/faculty', { per_page: 100 })
      .then((json) => setFaculties(json.data || []))
      .catch(() => {});
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    setPage(1);
    setQuery(searchInput.trim());
  }

  async function handleDelete(id) {
    if (!confirm(t('Delete this announcement?'))) return;
    setActionError(null);
    try {
      await api.del(`/api/v1/announcements/${id}`);
      load();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  return (
    <>
      <div className="page-header animate-rise-in">
        <div className="page-header__title">
          <h1 className="text-h1">{t('University Announcements')}</h1>
          <p className="text-small">{t('Publish categorized announcements, and optionally schedule them for later.')}</p>
        </div>
      </div>

      <div className="card glass-panel" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-6)' }}>
        <h2 className="text-h3" style={{ margin: '0 0 var(--space-4)' }}>{t('New Announcement')}</h2>
        <NewAnnouncementForm faculties={faculties} onDone={() => { setPage(1); load(); }} onError={(msg) => setActionError(msg)} />
      </div>

      {actionError && <p style={{ color: 'var(--color-danger)' }}>{actionError}</p>}

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 200 }}>
          <label className="form-label">{t('Search')}</label>
          <input className="form-input" type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder={t('Search titles & descriptions')} />
        </div>
        <button type="submit" className="btn btn-secondary"><Icon name="filter" size={14} /> {t('Search')}</button>
      </form>

      {loading && <p className="text-small">{t('Loading…')}</p>}
      {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}

      {!loading && !error && announcements.length === 0 && (
        <div className="glass-panel" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
          <p className="text-small">{t('No announcements yet.')}</p>
        </div>
      )}

      {!loading && !error && announcements.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {announcements.map((a) => {
            const atts = attachments[a.id] || [];
            const isScheduledFuture = a.publish_at && new Date(a.publish_at).getTime() > Date.now() && !a.published_at;
            const catLabel = CATEGORIES[a.category]?.[locale] || CATEGORIES[a.category]?.en || a.category;
            const isExpired = a.expires_at && new Date(a.expires_at).getTime() <= Date.now();
            const hasScope = a.target_faculty_id || a.target_department_id || a.target_academic_year;

            return (
              <div key={a.id} className="card glass-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                      <span className="badge badge-neutral">{catLabel}</span>
                      {isScheduledFuture && <span className="badge badge-primary"><Icon name="clock" size={12} /> {t('Scheduled')}</span>}
                      {a.expires_at && (
                        <span className={`badge ${isExpired ? 'badge-neutral' : 'badge-warning'}`}>
                          <Icon name="clock" size={12} /> {isExpired ? t('Expired') : `${t('Expires ')}${a.expires_at.slice(0, 16).replace('T', ' ')}`}
                        </span>
                      )}
                      {hasScope && <span className="badge badge-neutral"><Icon name="filter" size={12} /> {t('Scoped audience')}</span>}
                      <h3 className="text-h3" style={{ margin: 0 }}>{a.title}</h3>
                    </div>
                    <p className="text-caption" style={{ marginTop: 'var(--space-1)' }}>
                      {a.author_name} ·{' '}
                      {isScheduledFuture
                        ? `${t('Publishes at ')}${a.publish_at.slice(0, 16).replace('T', ' ')}`
                        : (a.published_at || a.created_at || '').slice(0, 16).replace('T', ' ')}
                    </p>
                    {a.body && <p className="text-small" style={{ marginTop: 'var(--space-2)', maxWidth: 640, whiteSpace: 'pre-wrap' }}>{a.body}</p>}
                    {atts.length > 0 && (
                      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 'var(--space-3)' }}>
                        {atts.map((att, i) => (
                          att.kind === 'link' ? (
                            <a key={i} className="btn btn-ghost btn-sm" href={att.external_url} target="_blank" rel="noopener noreferrer">
                              <Icon name="link" size={12} /> {att.link_title || att.external_url}
                            </a>
                          ) : (
                            <a key={i} className="btn btn-ghost btn-sm" href={`/${att.file_path}`} target="_blank" rel="noopener noreferrer">
                              <Icon name={KIND_ICON[att.kind] || 'file'} size={12} /> {att.original_name || att.kind}
                            </a>
                          )
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>
                    <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => handleDelete(a.id)}>
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-5)', alignItems: 'center' }}>
          <button type="button" className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><Icon name="chevron-left" size={16} /></button>
          <span className="text-small">{page} / {totalPages}</span>
          <button type="button" className="btn btn-outline btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}><Icon name="chevron-right" size={16} /></button>
        </div>
      )}
    </>
  );
}

function NewAnnouncementForm({ faculties, onDone, onError }) {
  const t = useTranslations(translations);
  const { locale } = useLanguage();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('academic');
  const [body, setBody] = useState('');
  const [publishAt, setPublishAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [facultyId, setFacultyId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [departments, setDepartments] = useState([]);
  const [academicYear, setAcademicYear] = useState('');
  const [files, setFiles] = useState([null, null, null, null, null]);
  const [links, setLinks] = useState([{ url: '', title: '' }, { url: '', title: '' }, { url: '', title: '' }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!facultyId) { setDepartments([]); setDepartmentId(''); return; }
    let cancelled = false;
    api.get(`/api/v1/faculty/${facultyId}`)
      .then((json) => { if (!cancelled) setDepartments(json.data?.departments || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [facultyId]);

  function updateFile(i, file) {
    setFiles((prev) => { const next = [...prev]; next[i] = file; return next; });
  }

  function updateLink(i, field, value) {
    setLinks((prev) => { const next = [...prev]; next[i] = { ...next[i], [field]: value }; return next; });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('title', title);
      fd.append('category', category);
      fd.append('body', body);
      if (publishAt) fd.append('publish_at', publishAt);
      if (expiresAt) fd.append('expires_at', expiresAt);
      if (facultyId) fd.append('target_faculty_id', facultyId);
      if (departmentId) fd.append('target_department_id', departmentId);
      if (academicYear) fd.append('target_academic_year', academicYear);
      files.forEach((file, i) => { if (file) fd.append(`attachment_${i}`, file); });
      links.forEach((link) => {
        if (link.url) { fd.append('link_url[]', link.url); fd.append('link_title[]', link.title || ''); }
      });

      await api.postForm('/api/v1/announcements', fd);

      setTitle(''); setCategory('academic'); setBody(''); setPublishAt(''); setExpiresAt('');
      setFacultyId(''); setDepartmentId(''); setAcademicYear('');
      setFiles([null, null, null, null, null]);
      setLinks([{ url: '', title: '' }, { url: '', title: '' }, { url: '', title: '' }]);
      onDone();
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">{t('Title')}</label>
          <input className="form-input" type="text" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">{t('Category')}</label>
          <select className="form-input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {Object.entries(CATEGORIES).map(([key, val]) => <option key={key} value={key}>{val[locale] || val.en}</option>)}
          </select>
        </div>
      </div>

      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">{t('Description')}</label>
        <textarea className="form-input" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>

      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">{t('Schedule publish (optional)')}</label>
        <input className="form-input" type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} />
        <p className="text-caption" style={{ marginTop: 'var(--space-1)' }}>{t('Leave empty to publish immediately.')}</p>
      </div>

      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">{t('Expires at (optional)')}</label>
        <input className="form-input" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
        <p className="text-caption" style={{ marginTop: 'var(--space-1)' }}>{t('Leave empty to never expire.')}</p>
      </div>

      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">{t('Visibility scope (optional — leave blank to show everyone)')}</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
          <select className="form-input" value={facultyId} onChange={(e) => setFacultyId(e.target.value)}>
            <option value="">{t('All faculties')}</option>
            {faculties.map((f) => <option key={f.id} value={f.id}>{locale === 'ar' ? (f.name_ar || f.name_en) : f.name_en}</option>)}
          </select>
          <select className="form-input" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} disabled={!facultyId}>
            <option value="">{t('All departments')}</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{locale === 'ar' ? (d.name_ar || d.name_en) : d.name_en}</option>)}
          </select>
          <select className="form-input" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}>
            <option value="">{t('All academic years')}</option>
            {[1, 2, 3, 4, 5, 6].map((y) => <option key={y} value={y}>{locale === 'ar' ? `السنة ${y}` : `Year ${y}`}</option>)}
          </select>
        </div>
      </div>

      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">{t('Attachments (images, video, PDF, documents)')}</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {files.map((_, i) => (
            <input
              key={i}
              className="form-input"
              type="file"
              accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.webm,.mov,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip"
              onChange={(e) => updateFile(i, e.target.files?.[0] || null)}
            />
          ))}
        </div>
        <p className="text-caption" style={{ marginTop: 'var(--space-1)' }}>{t('Up to 5 files per announcement.')}</p>
      </div>

      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">{t('External links (optional)')}</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {links.map((link, i) => (
            <div key={i} style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <input className="form-input" type="url" placeholder="https://..." value={link.url} onChange={(e) => updateLink(i, 'url', e.target.value)} style={{ flex: 2, minWidth: 200 }} />
              <input className="form-input" type="text" placeholder={t('Link title (optional)')} value={link.title} onChange={(e) => updateLink(i, 'title', e.target.value)} style={{ flex: 1, minWidth: 160 }} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          <Icon name="plus" size={16} /> {saving ? t('Loading…') : t('Publish')}
        </button>
      </div>
    </form>
  );
}
