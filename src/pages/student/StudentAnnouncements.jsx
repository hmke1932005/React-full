import { useEffect, useState, useCallback } from 'react';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { useTranslations, useLanguage } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/student/announcements';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Mirrors app/Views/student/announcements.php, talking to the real JSON API
 * (GET /api/v1/announcements — App\Controllers\Api\AnnouncementsApiController,
 * student branch — same AnnouncementRepository::publishedForUniversity() /
 * AnnouncementService::scopeForStudent() calls as
 * Student\StudentAnnouncementController::index()). Read-only for students
 * (publish/edit/delete is university-only); search + category filter +
 * pagination + attachments map 1:1 to the Blade view's form and cards.
 */

const CATEGORIES = [
  { key: 'all', en: 'All', ar: 'الكل' },
  { key: 'academic', en: 'Academic', ar: 'أكاديمي' },
  { key: 'event', en: 'Event', ar: 'فعالية' },
  { key: 'competition', en: 'Competition', ar: 'مسابقة' },
  { key: 'deadline', en: 'Deadline', ar: 'موعد نهائي' },
  { key: 'training', en: 'Training', ar: 'تدريب' },
  { key: 'workshop', en: 'Workshop', ar: 'ورشة عمل' },
  { key: 'research', en: 'Research', ar: 'بحث' },
];

const KIND_ICON = { image: 'image', video: 'file', pdf: 'file', file: 'file', link: 'link' };

function timeAgo(dateStr, locale) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr.replace(' ', 'T')).getTime()) / 1000;
  const units = locale === 'ar'
    ? [[31536000, 'سنة'], [2592000, 'شهر'], [86400, 'يوم'], [3600, 'ساعة'], [60, 'دقيقة']]
    : [[31536000, 'y'], [2592000, 'mo'], [86400, 'd'], [3600, 'h'], [60, 'm']];
  if (diff < 60) return locale === 'ar' ? 'الآن' : 'just now';
  for (const [secs, label] of units) {
    if (diff >= secs) {
      const n = Math.floor(diff / secs);
      return locale === 'ar' ? `منذ ${n} ${label}` : `${n}${label} ago`;
    }
  }
  return '';
}

export default function StudentAnnouncements() {
  const t = useTranslations(translations);
  const { locale } = useLanguage();
  const [items, setItems] = useState([]);
  const [attachments, setAttachments] = useState({});
  const [meta, setMeta] = useState({ total: 0, page: 1, perPage: 10, unaffiliated: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState('all');
  const [q, setQ] = useState('');
  const [qInput, setQInput] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/api/v1/announcements', { page, per_page: 10, category, q })
      .then((json) => {
        setItems(json.data || []);
        setAttachments(json.meta?.attachments || {});
        setMeta(json.meta || {});
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [page, category, q]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.perPage || 10)));
  const catLabel = (key) => {
    const c = CATEGORIES.find((c) => c.key === key);
    return c ? (locale === 'ar' ? c.ar : c.en) : key;
  };

  return (
    <>
      <div className="page-header animate-rise-in">
        <div className="page-header__title">
          <h1 className="text-h1"><Icon name="bell" size={26} /> {t('University Announcements')}</h1>
          <p className="text-small">{t('The latest academic announcements, events, and opportunities from your university.')}</p>
        </div>
      </div>

      {meta.unaffiliated ? (
        <div className="glass-panel" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
          <p className="text-small text-muted">
            {locale === 'ar'
              ? 'لست منتسبًا لجامعة بعد. اطلب الانضمام من صفحة الملف الشخصي لرؤية إعلانات جامعتك.'
              : "You're not affiliated with a university yet. Request to join one from your profile to see its announcements."}
          </p>
        </div>
      ) : (
        <>
          <form
            style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}
            onSubmit={(e) => { e.preventDefault(); setQ(qInput); setPage(1); }}
          >
            <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 200 }}>
              <label className="form-label">{t('Search')}</label>
              <input className="form-input" type="text" value={qInput} onChange={(e) => setQInput(e.target.value)}
                placeholder={t('Search titles & descriptions')} />
            </div>
            <div className="form-group" style={{ margin: 0, minWidth: 180 }}>
              <label className="form-label">{t('Category')}</label>
              <select className="form-input" value={category}
                onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
                {CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>{locale === 'ar' ? c.ar : c.en}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn btn-secondary"><Icon name="filter" size={14} /> {t('Filter')}</button>
          </form>

          {loading && <p className="text-small" style={{ padding: 'var(--space-5)' }}>{t('Loading…')}</p>}
          {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}

          {!loading && !error && (
            items.length === 0 ? (
              <div className="glass-panel" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
                <p className="text-small text-muted">{t('No announcements right now.')}</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  {items.map((a) => {
                    const atts = attachments[a.id] || [];
                    return (
                      <div key={a.id} className="card glass-panel">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                          <span className="badge badge-neutral">{catLabel(a.category)}</span>
                          <h2 className="text-h3" style={{ margin: 0 }}>{a.title}</h2>
                        </div>
                        <p className="text-caption" style={{ marginTop: 'var(--space-1)' }}>
                          {a.author_name} · {timeAgo(a.published_at || a.created_at, locale)}
                        </p>
                        {a.body && (
                          <p className="text-small" style={{ marginTop: 'var(--space-2)', maxWidth: 720, whiteSpace: 'pre-wrap' }}>{a.body}</p>
                        )}
                        {atts.length > 0 && (
                          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 'var(--space-3)' }}>
                            {atts.map((att) => (
                              att.kind === 'link' ? (
                                <a key={att.id} className="btn btn-ghost btn-sm" href={att.external_url} target="_blank" rel="noopener noreferrer">
                                  <Icon name="link" size={12} /> {att.link_title || att.external_url}
                                </a>
                              ) : (
                                <a key={att.id} className="btn btn-ghost btn-sm" href={`/${att.file_path}`} target="_blank" rel="noopener noreferrer">
                                  <Icon name={KIND_ICON[att.kind] || 'file'} size={12} /> {att.original_name || att.kind}
                                </a>
                              )
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {totalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-5)', alignItems: 'center' }}>
                    <button type="button" className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><Icon name="chevron-left" size={16} /></button>
                    <span className="text-small">{locale === 'ar' ? `صفحة ${page} من ${totalPages}` : `Page ${page} of ${totalPages}`}</span>
                    <button type="button" className="btn btn-outline btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}><Icon name="chevron-right" size={16} /></button>
                  </div>
                )}
              </>
            )
          )}
        </>
      )}
    </>
  );
}
