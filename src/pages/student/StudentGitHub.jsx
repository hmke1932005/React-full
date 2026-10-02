import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { useTranslations, useLanguage } from '../../context/LanguageContext';
import { usePageMeta } from '../../context/PageMetaContext';
import { Pill, EmptyState, Skeleton } from '../../components/student/stUi';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/student/github';

const translations = { ...i18nCommon, ...i18nPage };

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

/**
 * Mirrors app/Views/student/github.php (Student\StudentGitHubController::index()),
 * talking to the real JSON API instead: GET /api/v1/projects/github
 * (App\Controllers\Api\ProjectsApiController::githubOverview(), reusing
 * GithubCodeReviewService::forOwner() exactly like the PHP view). "Run
 * Review" / "Re-run review" / "Try again" all post to the same real
 * POST /api/v1/projects/{id}/code-review/run action.
 */
export default function StudentGitHub() {
  const t = useTranslations(translations);
  const { locale } = useLanguage();
  usePageMeta(t('GitHub Integration'), t('GitHub link and code review status across all of your projects, in one place.'));

  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [runningId, setRunningId] = useState(null);
  const [runError, setRunError] = useState(null);
  const [openFilesFor, setOpenFilesFor] = useState(null);
  const [filesById, setFilesById] = useState({});
  const [filesLoading, setFilesLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/api/v1/projects/github')
      .then((json) => setRepos(json.data || []))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const runReview = async (projectUuid) => {
    setRunningId(projectUuid);
    setRunError(null);
    try {
      await api.post(`/api/v1/projects/${encodeURIComponent(projectUuid)}/code-review/run`, {});
      load();
    } catch (err) {
      setRunError(errorMessage(err));
    } finally {
      setRunningId(null);
    }
  };

  const toggleFiles = async (projectUuid) => {
    if (openFilesFor === projectUuid) {
      setOpenFilesFor(null);
      return;
    }
    setOpenFilesFor(projectUuid);
    if (!filesById[projectUuid]) {
      setFilesLoading(true);
      try {
        const json = await api.get(`/api/v1/projects/${encodeURIComponent(projectUuid)}/files`);
        setFilesById((prev) => ({ ...prev, [projectUuid]: json.data || [] }));
      } catch {
        setFilesById((prev) => ({ ...prev, [projectUuid]: [] }));
      } finally {
        setFilesLoading(false);
      }
    }
  };

  if (loading) return <Skeleton h={110} count={2} />;
  if (error) return <div className="st-alert st-alert--danger"><Icon name="alert-triangle" size={16} /><span>{error}</span></div>;

  const connected = repos.filter((r) => r.is_connected);

  return (
    <div className="st-page">
      {runError && <div className="st-alert st-alert--danger"><Icon name="alert-triangle" size={16} /><span>{runError}</span></div>}

      {repos.length === 0 ? (
        <EmptyState icon="github" title={locale === 'ar' ? 'لا يوجد لديك أي مشاريع حتى الآن.' : "You don't have any projects yet."}>
          <Link to="/student/projects/create" className="btn btn-primary btn-sm">{t('Create a project')}</Link>
        </EmptyState>
      ) : (
        <>
          {connected.length === 0 && (
            <div className="st-alert">
              <Icon name="github" size={16} />
              <span>
                {locale === 'ar'
                  ? 'لسه محدّش من مشاريعك مربوط بمستودع GitHub. اربط مستودع من صفحة تعديل أي مشروع لتفعيل مراجعة الكود.'
                  : "None of your projects are linked to a GitHub repository yet. Link one from a project's edit page to enable code review."}
              </span>
            </div>
          )}

          <div className="st-stack">
            {repos.map((r) => {
              const title = locale === 'ar' ? (r.title_ar || r.title_en) : (r.title_en || r.title_ar);
              const isRunning = runningId === r.project_uuid;
              const cover = r.cover_image_path || '';
              const filesOpen = openFilesFor === r.project_uuid;
              const files = filesById[r.project_uuid] || [];
              return (
                <div key={r.project_uuid} className="st-panel">
                  {cover && (
                    <img
                      src={`/${cover.replace(/^\//, '')}`}
                      alt={title}
                      loading="lazy"
                      style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-3)' }}
                    />
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                    <div>
                      <h2 className="text-h3" style={{ margin: 0 }}>{title}</h2>
                      {r.is_connected && (
                        <p className="text-caption" style={{ marginTop: 4, wordBreak: 'break-all' }}>
                          <Icon name="link" size={12} /> {r.repository_url}
                        </p>
                      )}
                    </div>

                    {!r.is_connected ? (
                      <Pill tone="neutral">{t('Not connected')}</Pill>
                    ) : r.sync_status === 'error' ? (
                      <Pill tone="danger"><Icon name="alert-triangle" size={12} /> {t('Sync error')}</Pill>
                    ) : (
                      <Pill tone="success"><Icon name="check-circle" size={12} /> {t('Connected')}</Pill>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginTop: 'var(--space-2)' }}>
                    {r.live_demo_url && (
                      <a href={r.live_demo_url} target="_blank" rel="noopener noreferrer" className="text-caption" style={{ color: 'var(--color-primary)' }}>
                        <Icon name="link" size={12} /> {t('Visit demo')}
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleFiles(r.project_uuid)}
                      className="text-caption"
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      <Icon name="folder" size={12} /> {filesOpen ? t('Hide files') : t('Files')}
                    </button>
                  </div>

                  {filesOpen && (
                    <div style={{ marginTop: 'var(--space-2)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--border-subtle)' }}>
                      {filesLoading && !filesById[r.project_uuid] ? (
                        <p className="text-caption text-muted">{t('Loading…')}</p>
                      ) : files.length === 0 ? (
                        <p className="text-caption text-muted">{t('No files uploaded yet.')}</p>
                      ) : (
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {files.map((f) => (
                            <li key={f.id}>
                              <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-caption" style={{ color: 'var(--color-primary)' }}>
                                <Icon name="file" size={12} /> {f.original_name} <span className="text-muted">({f.extension} · {f.size_human})</span>
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {!r.is_connected ? (
                    <>
                      <p className="text-small" style={{ marginTop: 'var(--space-3)' }}>{t('Link a GitHub repo from the project edit page to enable analysis.')}</p>
                      <Link to={`/student/projects/${encodeURIComponent(r.project_uuid)}/edit`} className="btn btn-outline btn-sm" style={{ marginTop: 'var(--space-2)' }}>
                        {t('Edit project')}
                      </Link>
                    </>
                  ) : !r.review_status ? (
                    <>
                      <p className="text-small" style={{ marginTop: 'var(--space-3)' }}>{t('Repository linked. Run your first review now.')}</p>
                      <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 'var(--space-3)' }} disabled={isRunning} onClick={() => runReview(r.project_uuid)}>
                        <Icon name="refresh" size={16} /> {isRunning ? t('Loading…') : t('Run Review')}
                      </button>
                    </>
                  ) : r.review_status === 'failed' ? (
                    <>
                      <p className="text-small" style={{ marginTop: 'var(--space-3)' }}>{r.review_summary}</p>
                      <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: 'var(--space-3)' }} disabled={isRunning} onClick={() => runReview(r.project_uuid)}>
                        {isRunning ? t('Loading…') : t('Try again')}
                      </button>
                    </>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
                        <span className="text-small">{r.issues_found ?? 0} {t('issue(s) flagged')}</span>
                        <span className="text-caption text-muted">{timeAgo(r.review_created_at, locale)}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                        <Link to={`/student/projects/${encodeURIComponent(r.project_uuid)}`} className="btn btn-outline btn-sm">
                          {t('View full details')}
                        </Link>
                        <button type="button" className="btn btn-outline btn-sm" disabled={isRunning} onClick={() => runReview(r.project_uuid)}>
                          <Icon name="refresh" size={14} /> {isRunning ? t('Loading…') : t('Re-run review')}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
