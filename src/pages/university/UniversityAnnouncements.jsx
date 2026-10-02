import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { EmptyState, Pill, StModal } from '../../components/student/stUi';
import { useLanguage, useTranslations } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/university/announcements';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * University Announcements — talks to the real JSON API
 * (app/Controllers/Api/AnnouncementsApiController.php, /api/v1/announcements).
 * Publishing is multipart: title/body/category/publish_at/expires_at/target_*,
 * attachment_0..4 and link_url[] / link_title[] — unchanged from the previous
 * version, only the UI is new. Built on the shared student/faculty portal
 * system (styles/css/student-portal.css) + styles/css/university-announcements.css.
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

const KIND_ICON = { image: 'image', video: 'play', pdf: 'file', file: 'file', link: 'link' };
const PER_PAGE = 10;
const MAX_FILES = 5;
const MAX_LINKS = 3;
const BODY_CLAMP_CHARS = 220;
const ACCEPT = '.jpg,.jpeg,.png,.gif,.webp,.mp4,.webm,.mov,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip';

const fmtDate = (v) => (v ? String(v).slice(0, 16).replace('T', ' ') : '');
const fmtSize = (bytes) => (bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export default function UniversityAnnouncements() {
  const t = useTranslations(translations);
  const { locale } = useLanguage();

  const [announcements, setAnnouncements] = useState([]);
  const [attachments, setAttachments] = useState({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [faculties, setFaculties] = useState([]);
  const [composeOpen, setComposeOpen] = useState(false);
  const [deleting, setDeleting] = useState(null); // announcement being confirmed
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [expanded, setExpanded] = useState({});

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const catLabel = (key) => CATEGORIES[key]?.[locale] || CATEGORIES[key]?.en || key;
  const facultyName = (id) => {
    const f = faculties.find((x) => String(x.id) === String(id));
    return f ? (locale === 'ar' ? (f.name_ar || f.name_en) : f.name_en) : null;
  };

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/api/v1/announcements', {
      page, per_page: PER_PAGE, q: query || undefined, category: category === 'all' ? undefined : category,
    })
      .then((json) => {
        setAnnouncements(json.data || []);
        setTotal(json.meta?.total ?? 0);
        setAttachments(json.meta?.attachments || {});
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [page, query, category]);

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

  function pickCategory(key) {
    setCategory(key);
    setPage(1);
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    setActionError(null);
    try {
      await api.del(`/api/v1/announcements/${deleting.id}`);
      setDeleting(null);
      load();
    } catch (err) {
      setActionError(errorMessage(err));
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  const filtered = query !== '' || category !== 'all';

  return (
    <div className="st-page">
      <div className="page-header animate-rise-in" style={{ marginBottom: 0 }}>
        <div className="page-header__title">
          <h1 className="text-h1">{t('University Announcements')}</h1>
          <p className="text-small">{t('Publish categorized announcements, and optionally schedule them for later.')}</p>
        </div>
        <div className="page-header__actions">
          <button type="button" className="btn btn-primary" onClick={() => setComposeOpen(true)}>
            <Icon name="plus" size={16} /> {t('New Announcement')}
          </button>
        </div>
      </div>

      {actionError && (
        <div className="ua-alert" role="alert">
          <Icon name="alert-triangle" size={18} />
          <span>{actionError}</span>
          <button type="button" className="ua-icon-btn" style={{ width: 28, height: 28 }} aria-label={t('Dismiss')} onClick={() => setActionError(null)}><Icon name="x" size={14} /></button>
        </div>
      )}

      <div className="ua-toolbar">
        <form className="st-toolbar" onSubmit={handleSearch} role="search">
          <div className="st-search">
            <Icon name="search" size={16} />
            <input className="form-input" type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder={t('Search titles & descriptions')} aria-label={t('Search')} />
          </div>
          <button type="submit" className="btn btn-outline"><Icon name="search" size={14} /> <span className="btn-label">{t('Search')}</span></button>
        </form>
        <div className="ua-filters" role="group" aria-label={t('Category')}>
          <button type="button" className={`ua-filter${category === 'all' ? ' is-active' : ''}`} aria-pressed={category === 'all'} onClick={() => pickCategory('all')}>{t('All')}</button>
          {Object.keys(CATEGORIES).map((key) => (
            <button key={key} type="button" className={`ua-filter${category === key ? ' is-active' : ''}`} aria-pressed={category === key} onClick={() => pickCategory(key)}>{catLabel(key)}</button>
          ))}
        </div>
        {!loading && !error && total > 0 && (
          <p className="ua-summary">{total} {t('announcements')}{filtered ? ` · ${t('filtered')}` : ''}</p>
        )}
      </div>

      {loading && (
        <div className="ua-list" aria-busy="true" aria-label={t('Loading…')}>
          {[0, 1, 2].map((i) => <div key={i} className="st-skel ua-skel" />)}
        </div>
      )}

      {error && (
        <div className="st-empty" role="alert">
          <Icon name="alert-triangle" size={30} />
          <strong>{t('Could not load announcements')}</strong>
          <p>{error}</p>
          <button type="button" className="btn btn-outline btn-sm" onClick={load}><Icon name="refresh" size={14} /> {t('Try again')}</button>
        </div>
      )}

      {!loading && !error && announcements.length === 0 && (
        <EmptyState
          icon="bell"
          title={filtered ? t('No announcements match') : t('No announcements yet.')}
          text={filtered ? t('Try a different search or category.') : t('Publish your first announcement to reach students and staff.')}
        >
          {filtered
            ? <button type="button" className="btn btn-outline btn-sm" onClick={() => { setSearchInput(''); setQuery(''); setCategory('all'); setPage(1); }}>{t('Clear filters')}</button>
            : <button type="button" className="btn btn-primary btn-sm" onClick={() => setComposeOpen(true)}><Icon name="plus" size={14} /> {t('New Announcement')}</button>}
        </EmptyState>
      )}

      {!loading && !error && announcements.length > 0 && (
        <div className="ua-list">
          {announcements.map((a) => {
            const atts = attachments[a.id] || [];
            const isScheduledFuture = a.publish_at && new Date(a.publish_at).getTime() > Date.now() && !a.published_at;
            const isExpired = a.expires_at && new Date(a.expires_at).getTime() <= Date.now();
            const hasScope = a.target_faculty_id || a.target_department_id || a.target_academic_year;
            const scopeBits = [
              a.target_faculty_id ? facultyName(a.target_faculty_id) : null,
              a.target_academic_year ? (locale === 'ar' ? `السنة ${a.target_academic_year}` : `Year ${a.target_academic_year}`) : null,
            ].filter(Boolean);
            const long = (a.body || '').length > BODY_CLAMP_CHARS || (a.body || '').split('\n').length > 4;
            const open = !!expanded[a.id];

            return (
              <article key={a.id} className={`ua-card${isScheduledFuture ? ' is-scheduled' : ''}${isExpired ? ' is-expired' : ''}`}>
                <span className="ua-card__bar" aria-hidden="true" />
                <div className="ua-card__main">
                  <div className="ua-card__top">
                    <div className="ua-card__pills">
                      <Pill>{catLabel(a.category)}</Pill>
                      {isScheduledFuture && <Pill tone="warning"><Icon name="clock" size={11} /> {t('Scheduled')}</Pill>}
                      {isExpired && <Pill tone="neutral">{t('Expired')}</Pill>}
                      {hasScope && <Pill tone="outline"><Icon name="users" size={11} /> {scopeBits.length ? scopeBits.join(' · ') : t('Scoped audience')}</Pill>}
                    </div>
                    <button type="button" className="ua-icon-btn ua-icon-btn--danger" aria-label={`${t('Delete')}: ${a.title}`} onClick={() => setDeleting(a)}>
                      <Icon name="trash" size={16} />
                    </button>
                  </div>

                  <h2 className="ua-card__title">{a.title}</h2>

                  <p className="ua-card__meta">
                    {a.author_name && <span><Icon name="user" size={13} /> {a.author_name}</span>}
                    <span>
                      <Icon name="calendar" size={13} />
                      {isScheduledFuture ? `${t('Publishes at ')}${fmtDate(a.publish_at)}` : fmtDate(a.published_at || a.created_at)}
                    </span>
                    {a.expires_at && !isExpired && <span><Icon name="clock" size={13} /> {t('Expires ')}{fmtDate(a.expires_at)}</span>}
                  </p>

                  {a.body && <p className={`ua-body${long && !open ? ' is-clamped' : ''}`}>{a.body}</p>}
                  {long && (
                    <button type="button" className="ua-more" aria-expanded={open} onClick={() => setExpanded((p) => ({ ...p, [a.id]: !open }))}>
                      {open ? t('Show less') : t('Show more')}
                    </button>
                  )}

                  {atts.length > 0 && (
                    <div className="ua-files">
                      {atts.map((att, i) => (att.kind === 'link' ? (
                        <a key={i} className="ua-file" href={att.external_url} target="_blank" rel="noopener noreferrer">
                          <Icon name="link" size={14} /> <span>{att.link_title || att.external_url}</span>
                        </a>
                      ) : (
                        <a key={i} className="ua-file" href={`/${att.file_path}`} target="_blank" rel="noopener noreferrer">
                          <Icon name={KIND_ICON[att.kind] || 'file'} size={14} /> <span>{att.original_name || att.kind}</span>
                        </a>
                      )))}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {totalPages > 1 && !loading && !error && (
        <nav className="ua-pager" aria-label={t('Pagination')}>
          <button type="button" className="btn btn-outline btn-sm" disabled={page <= 1} aria-label={t('Previous page')} onClick={() => setPage((p) => p - 1)}><Icon name="chevron-left" size={16} className="icon-flip" /></button>
          <span>{page} / {totalPages}</span>
          <button type="button" className="btn btn-outline btn-sm" disabled={page >= totalPages} aria-label={t('Next page')} onClick={() => setPage((p) => p + 1)}><Icon name="chevron-right" size={16} className="icon-flip" /></button>
        </nav>
      )}

      {composeOpen && (
        <ComposeSheet
          faculties={faculties}
          onClose={() => setComposeOpen(false)}
          onDone={() => { setComposeOpen(false); setPage(1); load(); }}
        />
      )}

      {deleting && (
        <StModal
          title={t('Delete this announcement?')}
          onClose={() => !deleteBusy && setDeleting(null)}
          actions={(
            <>
              <button type="button" className="btn btn-outline" disabled={deleteBusy} onClick={() => setDeleting(null)}>{t('Cancel')}</button>
              <button type="button" className={`btn st-btn-danger st-btn-solid${deleteBusy ? ' is-loading' : ''}`} disabled={deleteBusy} onClick={confirmDelete}>{t('Delete')}</button>
            </>
          )}
        >
          <strong style={{ color: 'var(--text-primary)' }}>{deleting.title}</strong>
          <p style={{ marginTop: 6 }}>{t('This removes it for everyone who can see it. This cannot be undone.')}</p>
        </StModal>
      )}
    </div>
  );
}

function ComposeSheet({ faculties, onClose, onDone }) {
  const t = useTranslations(translations);
  const { locale } = useLanguage();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('academic');
  const [body, setBody] = useState('');
  const [when, setWhen] = useState('now'); // 'now' | 'later'
  const [publishAt, setPublishAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [facultyId, setFacultyId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [departments, setDepartments] = useState([]);
  const [academicYear, setAcademicYear] = useState('');
  const [files, setFiles] = useState([]);
  const [links, setLinks] = useState([{ url: '', title: '' }]);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const titleRef = useRef(null);

  useEffect(() => {
    titleRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape' && !saving) onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose, saving]);

  useEffect(() => {
    if (!facultyId) { setDepartments([]); setDepartmentId(''); return undefined; }
    let cancelled = false;
    api.get(`/api/v1/faculty/${facultyId}`)
      .then((json) => { if (!cancelled) setDepartments(json.data?.departments || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [facultyId]);

  function addFiles(list) {
    const incoming = Array.from(list || []);
    if (!incoming.length) return;
    setFiles((prev) => [...prev, ...incoming].slice(0, MAX_FILES));
  }

  function updateLink(i, field, value) {
    setLinks((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (when === 'later' && !publishAt) { setError(t('Choose when to publish.')); return; }
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('title', title);
      fd.append('category', category);
      fd.append('body', body);
      if (when === 'later' && publishAt) fd.append('publish_at', publishAt);
      if (expiresAt) fd.append('expires_at', expiresAt);
      if (facultyId) fd.append('target_faculty_id', facultyId);
      if (departmentId) fd.append('target_department_id', departmentId);
      if (academicYear) fd.append('target_academic_year', academicYear);
      files.forEach((file, i) => fd.append(`attachment_${i}`, file));
      links.forEach((link) => {
        if (link.url) { fd.append('link_url[]', link.url); fd.append('link_title[]', link.title || ''); }
      });
      await api.postForm('/api/v1/announcements', fd);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <div className="ua-sheet-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <form className="ua-sheet" role="dialog" aria-modal="true" aria-labelledby="ua-compose-title" onSubmit={handleSubmit}>
        <div className="ua-sheet__head">
          <div>
            <h2 id="ua-compose-title">{t('New Announcement')}</h2>
            <p>{t('Visible to students and staff in your university.')}</p>
          </div>
          <button type="button" className="ua-icon-btn" aria-label={t('Close')} onClick={onClose} disabled={saving}><Icon name="x" size={18} /></button>
        </div>

        <div className="ua-sheet__body">
          <section className="ua-section">
            <div className="ua-field">
              <label htmlFor="ua_title">{t('Title')}</label>
              <input id="ua_title" ref={titleRef} className="ua-input" type="text" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
              <span className="ua-count">{title.length}/200</span>
            </div>
            <div className="ua-field">
              <span className="ua-label" id="ua_cat_label">{t('Category')}</span>
              <div className="ua-cats" role="group" aria-labelledby="ua_cat_label">
                {Object.entries(CATEGORIES).map(([key, val]) => (
                  <button key={key} type="button" className="ua-cat" aria-pressed={category === key} onClick={() => setCategory(key)}>{val[locale] || val.en}</button>
                ))}
              </div>
            </div>
            <div className="ua-field">
              <label htmlFor="ua_body">{t('Description')}</label>
              <textarea id="ua_body" className="ua-textarea" value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
          </section>

          <section className="ua-section">
            <div className="ua-section__head"><h3>{t('Timing')}</h3></div>
            <div className="ua-seg" role="group" aria-label={t('Timing')}>
              <button type="button" aria-pressed={when === 'now'} onClick={() => setWhen('now')}>{t('Publish now')}</button>
              <button type="button" aria-pressed={when === 'later'} onClick={() => setWhen('later')}>{t('Schedule')}</button>
            </div>
            <div className="ua-grid">
              {when === 'later' && (
                <div className="ua-field">
                  <label htmlFor="ua_pub">{t('Publish at')}</label>
                  <input id="ua_pub" className="ua-input" type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} required />
                </div>
              )}
              <div className="ua-field">
                <label htmlFor="ua_exp">{t('Expires at (optional)')}</label>
                <input id="ua_exp" className="ua-input" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
                <small>{t('Leave empty to never expire.')}</small>
              </div>
            </div>
          </section>

          <section className="ua-section">
            <div className="ua-section__head">
              <h3>{t('Audience')}</h3>
              <small>{t('Leave blank to show everyone')}</small>
            </div>
            <div className="ua-grid ua-grid--3">
              <div className="ua-field">
                <label htmlFor="ua_fac">{t('Faculty')}</label>
                <select id="ua_fac" className="ua-select" value={facultyId} onChange={(e) => setFacultyId(e.target.value)}>
                  <option value="">{t('All faculties')}</option>
                  {faculties.map((f) => <option key={f.id} value={f.id}>{locale === 'ar' ? (f.name_ar || f.name_en) : f.name_en}</option>)}
                </select>
              </div>
              <div className="ua-field">
                <label htmlFor="ua_dep">{t('Department')}</label>
                <select id="ua_dep" className="ua-select" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} disabled={!facultyId}>
                  <option value="">{t('All departments')}</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{locale === 'ar' ? (d.name_ar || d.name_en) : d.name_en}</option>)}
                </select>
              </div>
              <div className="ua-field">
                <label htmlFor="ua_year">{t('Academic year')}</label>
                <select id="ua_year" className="ua-select" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}>
                  <option value="">{t('All academic years')}</option>
                  {[1, 2, 3, 4, 5, 6].map((y) => <option key={y} value={y}>{locale === 'ar' ? `السنة ${y}` : `Year ${y}`}</option>)}
                </select>
              </div>
            </div>
          </section>

          <section className="ua-section">
            <div className="ua-section__head">
              <h3>{t('Attachments (images, video, PDF, documents)')}</h3>
              <small>{files.length}/{MAX_FILES}</small>
            </div>
            <label
              className={`ua-drop${dragging ? ' is-drag' : ''}${files.length >= MAX_FILES ? ' is-full' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
            >
              <Icon name="upload" size={22} />
              <strong>{t('Choose files or drop them here')}</strong>
              <span>{t('Up to 5 files per announcement.')}</span>
              <input type="file" multiple accept={ACCEPT} disabled={files.length >= MAX_FILES} onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
            </label>
            {files.length > 0 && (
              <div className="ua-picked">
                {files.map((f, i) => (
                  <div key={`${f.name}-${i}`} className="ua-picked__row">
                    <Icon name="file" size={16} />
                    <b title={f.name}>{f.name}</b>
                    <small>{fmtSize(f.size)}</small>
                    <button type="button" className="ua-icon-btn ua-icon-btn--danger" style={{ width: 32, height: 32 }} aria-label={`${t('Remove')} ${f.name}`} onClick={() => setFiles((p) => p.filter((_, idx) => idx !== i))}><Icon name="x" size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="ua-section">
            <div className="ua-section__head"><h3>{t('External links (optional)')}</h3></div>
            {links.map((link, i) => (
              <div key={i} className="ua-linkrow">
                <input className="ua-input" type="url" inputMode="url" placeholder="https://…" value={link.url} onChange={(e) => updateLink(i, 'url', e.target.value)} aria-label={t('Link URL')} dir="ltr" />
                <input className="ua-input" type="text" placeholder={t('Link title (optional)')} value={link.title} onChange={(e) => updateLink(i, 'title', e.target.value)} aria-label={t('Link title (optional)')} />
                <button type="button" className="ua-icon-btn ua-icon-btn--danger" aria-label={t('Remove')} disabled={links.length === 1 && !link.url && !link.title} onClick={() => setLinks((p) => (p.length === 1 ? [{ url: '', title: '' }] : p.filter((_, idx) => idx !== i)))}><Icon name="trash" size={16} /></button>
              </div>
            ))}
            {links.length < MAX_LINKS && (
              <button type="button" className="ua-add" onClick={() => setLinks((p) => [...p, { url: '', title: '' }])}><Icon name="plus" size={14} /> {t('Add link')}</button>
            )}
          </section>

          {error && <div className="ua-alert" role="alert"><Icon name="alert-triangle" size={18} /><span>{error}</span></div>}
        </div>

        <div className="ua-sheet__foot">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>{t('Cancel')}</button>
          <button type="submit" className={`btn btn-primary${saving ? ' is-loading' : ''}`} disabled={saving || !title.trim()}>
            <Icon name={when === 'later' ? 'clock' : 'send'} size={16} /> {when === 'later' ? t('Schedule') : t('Publish')}
          </button>
        </div>
      </form>
    </div>
  );
}
