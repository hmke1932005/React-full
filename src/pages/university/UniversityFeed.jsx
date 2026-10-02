import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { useLanguage, useTranslations } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/university/feed';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Mirrors app/Views/university/feed.php, talking to the real JSON API
 * (app/Controllers/Api/FeedApiController.php — already built, reuses
 * FeedService::publish()/update()/delete()/setPinned()/publishDraft()/
 * unpublish() exactly as UniversityFeedController does). Publish is
 * multipart (title/body/is_event/event_starts_at/event_ends_at/
 * event_location/save_as_draft/target fields/attachment files 0-4/
 * link_url[]/link_title[]) since FeedService reads it straight off the
 * Request the same way the web controller's form does. Moderation queue
 * (Feed Reports) lives on its own page — UniversityFeedReports.jsx —
 * same split as the legacy pages.
 */

const KIND_ICON = { image: 'image', video: 'play', pdf: 'file', file: 'file', link: 'link' };
const PER_PAGE = 10;

function initials(name) {
  return (name || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

export default function UniversityFeed() {
  const t = useTranslations(translations);
  const { locale } = useLanguage();

  const [posts, setPosts] = useState([]);
  const [attachments, setAttachments] = useState({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [faculties, setFaculties] = useState([]);
  const [busyId, setBusyId] = useState(null);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/api/v1/feed', { page, per_page: PER_PAGE, q: query || undefined })
      .then((json) => {
        setPosts(json.data || []);
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

  async function runAction(id, promise) {
    setBusyId(id);
    setActionError(null);
    try {
      await promise;
      load();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id) {
    if (!confirm(t('Delete this post?'))) return;
    runAction(id, api.del(`/api/v1/feed/${id}`));
  }

  return (
    <>
      <div className="page-header animate-rise-in">
        <div className="page-header__title">
          <h1 className="text-h1">{t('University Feed')}</h1>
          <p className="text-small">{t('Publish updates and events that every student at your university sees on their dashboard.')}</p>
        </div>
        <Link to="/university/feed/reports" className="btn btn-secondary">
          <Icon name="alert-triangle" size={14} /> {t('Reports')}
        </Link>
      </div>

      <div className="card glass-panel" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-6)' }}>
        <h2 className="text-h3" style={{ margin: '0 0 var(--space-4)' }}>{t('New Post')}</h2>
        <NewPostForm faculties={faculties} onDone={() => { setPage(1); load(); }} onError={(msg) => setActionError(msg)} />
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

      {!loading && !error && posts.length === 0 && (
        <div className="glass-panel" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
          <p className="text-small">{t('No posts yet.')}</p>
        </div>
      )}

      {!loading && !error && posts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {posts.map((p) => {
            const atts = attachments[p.id] || [];
            const images = atts.filter((a) => a.kind === 'image');
            const others = atts.filter((a) => a.kind !== 'image');
            const isDraft = Number(p.status ?? 1) === 0;
            const hasScope = p.target_faculty_id || p.target_department_id || p.target_academic_year;
            const busy = busyId === p.id;

            return (
              <div key={p.id} className="card glass-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', minWidth: 0 }}>
                    <span style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, background: 'var(--color-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600 }}>
                      {initials(p.author_name)}
                    </span>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                        {isDraft && <span className="badge badge-warning"><Icon name="file" size={12} /> {t('Draft')}</span>}
                        {Number(p.is_pinned) ? <span className="badge badge-primary"><Icon name="pin" size={12} /> {t('Pinned')}</span> : null}
                        {Number(p.is_event) ? <span className="badge badge-neutral"><Icon name="calendar" size={12} /> {t('Event')}</span> : null}
                        <h3 className="text-h3" style={{ margin: 0 }}>{p.title}</h3>
                      </div>
                      <p className="text-caption" style={{ marginTop: 'var(--space-1)' }}>
                        {p.author_name} · {(p.created_at || '').slice(0, 16).replace('T', ' ')}
                        {p.is_edited ? <> · <em>{t('edited')}{p.edited_at ? ` ${p.edited_at.slice(0, 16).replace('T', ' ')}` : ''}</em></> : null}
                        {hasScope ? <> · <Icon name="filter" size={12} /> {t('Scoped audience')}</> : null}
                      </p>
                      {p.body && <p className="text-small" style={{ marginTop: 'var(--space-2)', maxWidth: 640, whiteSpace: 'pre-wrap' }}>{p.body}</p>}
                      {Number(p.is_event) ? (
                        <p className="text-caption" style={{ marginTop: 'var(--space-2)' }}>
                          <Icon name="calendar" size={12} /> {p.event_starts_at || ''}{p.event_ends_at ? ` → ${p.event_ends_at}` : ''}{p.event_location ? ` · ${p.event_location}` : ''}
                        </p>
                      ) : null}
                      {images.length > 0 && (
                        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 'var(--space-3)', maxWidth: 640 }}>
                          {images.map((a, i) => (
                            <a key={i} href={`/${a.file_path}`} target="_blank" rel="noopener noreferrer">
                              <img src={`/${a.file_path}`} alt={a.original_name || t('Post attachment image')} loading="lazy" style={{ maxWidth: 160, maxHeight: 120, borderRadius: 'var(--radius-md)', objectFit: 'cover' }} />
                            </a>
                          ))}
                        </div>
                      )}
                      {others.length > 0 && (
                        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 'var(--space-3)' }}>
                          {others.map((a, i) => (
                            a.kind === 'link' ? (
                              <a key={i} className="btn btn-ghost btn-sm" href={a.external_url} target="_blank" rel="noopener noreferrer">
                                <Icon name="link" size={12} /> {a.link_title || a.external_url}
                              </a>
                            ) : (
                              <a key={i} className="btn btn-ghost btn-sm" href={`/${a.file_path}`} target="_blank" rel="noopener noreferrer">
                                <Icon name={KIND_ICON[a.kind] || 'file'} size={12} /> {a.original_name || a.kind}
                              </a>
                            )
                          ))}
                        </div>
                      )}
                      <p className="text-caption" style={{ marginTop: 'var(--space-3)' }}>
                        <Icon name="heart" size={12} /> {Number(p.likes_count || 0)}
                        &nbsp;<Icon name="message" size={12} /> {Number(p.comments_count || 0)}
                        &nbsp;<Icon name="share" size={12} /> {Number(p.shares_count || 0)}
                        &nbsp;<Icon name="bookmark" size={12} /> {Number(p.saves_count || 0)}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0, flexWrap: 'wrap' }}>
                    {isDraft ? (
                      <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => runAction(p.id, api.post(`/api/v1/feed/${p.id}/publish`))}>{t('Publish')}</button>
                    ) : (
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busy} title={t('Move to draft')} onClick={() => runAction(p.id, api.post(`/api/v1/feed/${p.id}/unpublish`))}>{t('To draft')}</button>
                    )}
                    {Number(p.is_pinned) ? (
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busy} title={t('Unpin')} onClick={() => runAction(p.id, api.post(`/api/v1/feed/${p.id}/unpin`))}><Icon name="pin" size={14} /></button>
                    ) : (
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busy} title={t('Pin')} onClick={() => runAction(p.id, api.post(`/api/v1/feed/${p.id}/pin`))}><Icon name="pin" size={14} /></button>
                    )}
                    <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} disabled={busy} onClick={() => handleDelete(p.id)}>
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

function NewPostForm({ faculties, onDone, onError }) {
  const t = useTranslations(translations);
  const { locale } = useLanguage();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isEvent, setIsEvent] = useState(false);
  const [eventStartsAt, setEventStartsAt] = useState('');
  const [eventEndsAt, setEventEndsAt] = useState('');
  const [eventLocation, setEventLocation] = useState('');
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

  function resetForm() {
    setTitle(''); setBody(''); setIsEvent(false);
    setEventStartsAt(''); setEventEndsAt(''); setEventLocation('');
    setFacultyId(''); setDepartmentId(''); setAcademicYear('');
    setFiles([null, null, null, null, null]);
    setLinks([{ url: '', title: '' }, { url: '', title: '' }, { url: '', title: '' }]);
  }

  async function submit(saveAsDraft) {
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('title', title);
      fd.append('body', body);
      fd.append('is_event', isEvent ? '1' : '0');
      if (isEvent) {
        if (eventStartsAt) fd.append('event_starts_at', eventStartsAt);
        if (eventEndsAt) fd.append('event_ends_at', eventEndsAt);
        if (eventLocation) fd.append('event_location', eventLocation);
      }
      fd.append('save_as_draft', saveAsDraft ? '1' : '0');
      if (facultyId) fd.append('target_faculty_id', facultyId);
      if (departmentId) fd.append('target_department_id', departmentId);
      if (academicYear) fd.append('target_academic_year', academicYear);
      files.forEach((file, i) => { if (file) fd.append(`attachment_${i}`, file); });
      links.forEach((link) => {
        if (link.url) { fd.append('link_url[]', link.url); fd.append('link_title[]', link.title || ''); }
      });

      await api.postForm('/api/v1/feed', fd);
      resetForm();
      onDone();
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(false); }} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">{t('Title')}</label>
        <input className="form-input" type="text" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
      </div>

      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">{t('Description')}</label>
        <textarea className="form-input" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>

      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <input type="checkbox" className="form-checkbox" checked={isEvent} onChange={(e) => setIsEvent(e.target.checked)} />
          {t('This post is an event')}
        </label>
      </div>
      {isEvent && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{t('Starts at')}</label>
            <input className="form-input" type="datetime-local" value={eventStartsAt} onChange={(e) => setEventStartsAt(e.target.value)} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{t('Ends at')}</label>
            <input className="form-input" type="datetime-local" value={eventEndsAt} onChange={(e) => setEventEndsAt(e.target.value)} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{t('Location')}</label>
            <input className="form-input" type="text" value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} />
          </div>
        </div>
      )}

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
        <p className="text-caption" style={{ marginTop: 'var(--space-1)' }}>{t('Up to 5 files per post.')}</p>
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

      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          <Icon name="plus" size={16} /> {saving ? t('Loading…') : t('Publish')}
        </button>
        <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => submit(true)}>
          <Icon name="file" size={16} /> {t('Save as draft')}
        </button>
      </div>
    </form>
  );
}
