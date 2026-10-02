import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import Breadcrumb from '../../components/Breadcrumb';
import ReadinessRing from '../../components/ReadinessRing';
import { useLanguage } from '../../context/LanguageContext';
import { usePageMeta } from '../../context/PageMetaContext';
import { StatusPill, Score, Stepper, Pill, loc, timeAgo } from '../../components/student/stUi';

const LINK_TYPE_ICON = { github: 'github', gitlab: 'github', live_demo: 'globe', website: 'globe' };

const TEAM_STATUS_BADGE = {
  pending: { cls: 'badge-primary', en: 'Invite pending', ar: 'دعوة معلّقة' },
  accepted: { cls: 'badge-success', en: 'Confirmed', ar: 'مؤكد' },
  rejected: { cls: 'badge-danger', en: 'Declined', ar: 'مرفوض' },
};

const TABS = [
  { key: 'overview', en: 'Overview', ar: 'نظرة عامة' },
  { key: 'files', en: 'Files', ar: 'الملفات' },
  { key: 'gallery', en: 'Gallery', ar: 'معرض الوسائط' },
  { key: 'analytics', en: 'Analytics', ar: 'الإحصائيات', ownerOnly: true },
  { key: 'links', en: 'Links', ar: 'الروابط' },
  { key: 'team', en: 'Team', ar: 'الفريق' },
  { key: 'approval', en: 'Approval Status', ar: 'حالة الاعتماد', ownerOnly: true },
  { key: 'discussion', en: 'Discussion', ar: 'المناقشة' },
  { key: 'activity', en: 'Activity', ar: 'النشاط' },
  { key: 'code-review', en: 'Code Review', ar: 'مراجعة الكود' },
];

/**
 * Mirrors app/Views/student/project-details.php, talking to the real
 * private JSON API (App\Controllers\Api\ProjectsApiController) instead of
 * the PHP-rendered view: GET /api/v1/projects/{id} (+ /files, /media,
 * /links, /team, /discussion, /activity, /analytics,
 * /approval, /code-review). This is the page StudentProjects.jsx's project
 * cards link to — previously missing, so clicking a project fell through
 * to the catch-all route back to the dashboard.
 *
 * Analytics/Approval-Status are owner-only tabs (matches
 * the underlying endpoints, which 404 for anyone but the owner) and are
 * hidden entirely for an accepted-team-member viewer. Note the PHP view's
 * "Approval Timeline" tab is hardcoded placeholder markup (fixed made-up
 * dates), not backed by any real data — the "approval" tab here shows the
 * project's actual status and latest reviewer decision instead, since
 * that's the only piece the backend genuinely tracks.
 */
export default function StudentProjectDetail() {
  const { id } = useParams();
  const { locale } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const t = (en, ar) => (locale === 'ar' ? ar : en);

  const [flash, setFlash] = useState(location.state?.flash || null);
  useEffect(() => {
    if (location.state?.flash) navigate(location.pathname, { replace: true, state: {} });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [tab, setTab] = useState('overview');
  const [project, setProject] = useState(null);
  const [files, setFiles] = useState([]);
  const [media, setMedia] = useState([]);
  const [links, setLinks] = useState([]);
  const [team, setTeam] = useState([]);
  const [discussion, setDiscussion] = useState([]);
  const [activity, setActivity] = useState([]);
  const [codeReview, setCodeReview] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [approval, setApproval] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get(`/api/v1/projects/${id}`),
      api.get(`/api/v1/projects/${id}/files`).catch(() => ({ data: [] })),
      api.get(`/api/v1/projects/${id}/media`).catch(() => ({ data: [] })),
      api.get(`/api/v1/projects/${id}/links`).catch(() => ({ data: [] })),
      api.get(`/api/v1/projects/${id}/team`).catch(() => ({ data: [] })),
      api.get(`/api/v1/projects/${id}/discussion`).catch(() => ({ data: [] })),
      api.get(`/api/v1/projects/${id}/activity`).catch(() => ({ data: [] })),
      api.get(`/api/v1/projects/${id}/code-review`).catch(() => ({ data: null })),
      // Owner-only — a viewing team member gets a 404 here, which is fine;
      // the tabs themselves are hidden for non-owners (see TABS' ownerOnly).
      api.get(`/api/v1/projects/${id}/analytics`).catch(() => ({ data: null })),
      api.get(`/api/v1/projects/${id}/approval`).catch(() => ({ data: null })),
    ])
      .then(([p, f, m, l, tm, d, a, cr, an, ap]) => {
        setProject(p.data);
        setFiles(f.data || []);
        setMedia(m.data || []);
        setLinks(l.data || []);
        setTeam(tm.data || []);
        setDiscussion(d.data || []);
        setActivity(a.data || []);
        setCodeReview(cr.data || null);
        setAnalyticsData(an.data || null);
        setApproval(ap.data || null);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  usePageMeta(project ? (project.title?.[locale] || project.title?.en || t('Project', 'المشروع')) : t('Project', 'المشروع'), t('Project details and review status.', 'تفاصيل المشروع وحالة المراجعة.'));

  async function runAction(promise, { confirmMsg, onDone } = {}) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setActionError(null);
    setActionBusy(true);
    try {
      await promise;
      if (onDone) onDone(); else load();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setActionBusy(false);
    }
  }

  if (loading) return <p className="text-small" style={{ padding: 'var(--space-5)' }}>{t('Loading…', 'جارِ التحميل…')}</p>;
  if (error) {
    return (
      <div style={{ padding: 'var(--space-5)' }}>
        <p style={{ color: 'var(--color-danger)' }}>{error}</p>
        <Link to="/student/projects" className="btn btn-outline" style={{ marginTop: 'var(--space-3)' }}>{t('Back to My Projects', 'رجوع لمشاريعي')}</Link>
      </div>
    );
  }
  if (!project) return null;

  const title = project.title?.[locale] || project.title?.en || '';
  const isOwner = project.viewer_role === 'owner';
  const canEdit = isOwner && ['draft', 'submitted', 'under_review', 'rejected'].includes(project.status);
  const canSubmit = isOwner && project.status === 'draft';
  const canArchive = isOwner && project.status !== 'archived';
  const canUnarchive = isOwner && project.status === 'archived';

  return (
    <>
      <Breadcrumb
        locale={locale}
        items={[
          { en: 'Dashboard', ar: 'لوحة التحكم', url: '/student/dashboard' },
          { en: 'My Projects', ar: 'مشاريعي', url: '/student/projects' },
          { en: title, ar: title },
        ]}
      />

      <section className="st-panel st-project-head">
        <div className="st-row" style={{ alignItems: 'flex-start', gap: 16 }}>
          <div style={{ minWidth: 0 }}>
            <div className="st-row" style={{ justifyContent: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: 20, fontWeight: 800 }}>{title}</h2>
              <StatusPill status={project.status} locale={locale} />
            </div>
            <p className="st-muted" style={{ fontSize: 12.5, marginTop: 6 }}>
              {[loc(project.category, locale), project.supervisor_name, project.updated_at && `${t('Updated', 'آخر تحديث')} ${timeAgo(project.updated_at, locale)}`].filter(Boolean).join(' · ')}
            </p>
            {(project.summary?.[locale] || project.summary?.en) && (
              <p style={{ fontSize: 13.5, marginTop: 10, maxWidth: 720 }}>{project.summary?.[locale] || project.summary?.en}</p>
            )}
          </div>
          {project.score > 0 && <Score value={project.score} large />}
        </div>
        <div className="st-page__actions" style={{ justifyContent: 'flex-start' }}>
          {canSubmit && (
            <button type="button" className="btn btn-primary" disabled={actionBusy} onClick={() => runAction(api.post(`/api/v1/projects/${id}/submit`))}>
              <Icon name="check" size={18} /> {t('Submit for Approval', 'إرسال للاعتماد')}
            </button>
          )}
          {isOwner && (
            <Link to={`/student/ai-analysis?project=${id}`} className="btn btn-outline">
              <Icon name="sparkles" size={18} /> {t('AI Analysis', 'تحليل الذكاء الاصطناعي')}
            </Link>
          )}
          {canEdit ? (
            <Link to={`/student/projects/${id}/edit`} className="btn btn-outline"><Icon name="edit" size={18} /> {t('Edit', 'تعديل')}</Link>
          ) : (
            <button className="btn btn-outline" disabled title={t('Published projects cannot be edited directly', 'المشاريع المنشورة لا يمكن تعديلها مباشرة')}>
              <Icon name="edit" size={18} /> {t('Edit', 'تعديل')}
            </button>
          )}
          {canArchive && (
            <button type="button" className="btn btn-outline" disabled={actionBusy} onClick={() => runAction(api.post(`/api/v1/projects/${id}/archive`), { confirmMsg: t('Archive this project?', 'أرشفة هذا المشروع؟') })}>
              <Icon name="archive" size={16} /> {t('Archive', 'أرشفة')}
            </button>
          )}
          {canUnarchive && (
            <button type="button" className="btn btn-outline" disabled={actionBusy} onClick={() => runAction(api.post(`/api/v1/projects/${id}/unarchive`))}>
              <Icon name="refresh" size={16} /> {t('Restore to Draft', 'استرجاع كمسودة')}
            </button>
          )}
          {isOwner && (
            <button
              type="button" disabled={actionBusy}
              className="btn btn-outline st-btn-danger"
              onClick={() => runAction(api.del(`/api/v1/projects/${id}`), {
                confirmMsg: t('Delete this project permanently? This cannot be undone.', 'حذف هذا المشروع نهائياً؟ لا يمكن التراجع عن هذا الإجراء.'),
                onDone: () => navigate('/student/projects', { state: { flash: { type: 'success', message: t('Project deleted.', 'تم حذف المشروع.') } } }),
              })}
            >
              <Icon name="trash" size={18} /> {t('Delete', 'حذف')}
            </button>
          )}
        </div>
      </section>

      {flash && (
        <div
          className="glass-panel"
          style={{
            padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-4)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)',
            borderInlineStart: `3px solid ${flash.type === 'warning' ? 'var(--color-warning, #d97706)' : 'var(--color-success)'}`,
          }}
        >
          <p className="text-small" style={{ margin: 0 }}>{flash.message}</p>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setFlash(null)}><Icon name="x" size={14} /></button>
        </div>
      )}

      {actionError && <p className="text-small" style={{ color: 'var(--color-danger)', marginBottom: 'var(--space-3)' }}>{actionError}</p>}

      <div className="st-tabs" role="tablist">
        {TABS.filter((tb) => !tb.ownerOnly || isOwner).map((tb) => (
          <button key={tb.key} type="button" className={`st-tab${tab === tb.key ? ' is-active' : ''}`} role="tab" aria-selected={tab === tb.key} onClick={() => setTab(tb.key)}>
            {t(tb.en, tb.ar)}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        {tab === 'overview' && <OverviewTab project={project} locale={locale} t={t} />}
        {tab === 'files' && <FilesTab id={id} files={files} canEdit={canEdit} t={t} reload={load} setActionError={setActionError} />}
        {tab === 'gallery' && <GalleryTab media={media} t={t} />}
        {tab === 'analytics' && isOwner && <AnalyticsTab data={analyticsData} locale={locale} t={t} />}
        {tab === 'links' && <LinksTab id={id} links={links} canEdit={canEdit} t={t} reload={load} setActionError={setActionError} />}
        {tab === 'team' && <TeamTab id={id} team={team} canEdit={canEdit} t={t} reload={load} setActionError={setActionError} />}
        {tab === 'approval' && isOwner && <ApprovalTab approval={approval} canEdit={canEdit} id={id} locale={locale} t={t} />}
        {tab === 'discussion' && <DiscussionTab id={id} discussion={discussion} t={t} reload={load} setActionError={setActionError} />}
        {tab === 'activity' && <ActivityTab activity={activity} t={t} />}
        {tab === 'code-review' && <CodeReviewTab id={id} project={project} review={codeReview} canEdit={canEdit} t={t} reload={load} setActionError={setActionError} />}
      </div>
    </>
  );
}

function OverviewTab({ project, locale, t }) {
  const tags = project.technologies || [];
  const allTags = [...tags, ...(project.tags || [])];
  const FLOW = ['draft', 'submitted', 'under_review', 'published'];
  const steps = [
    { label: t('Draft', 'مسودة') }, { label: t('Submitted', 'تم التقديم') },
    { label: t('Under Review', 'قيد المراجعة') }, { label: t('Published', 'منشور') },
  ];
  const cur = project.status === 'published' ? steps.length : project.status === 'rejected' ? 2 : Math.max(0, FLOW.indexOf(project.status));
  return (
    <div className="st-stack">
    {project.status === 'published' && project.slug && (
      <div className="st-banner">
        <div><span className="st-banner__text">{t('Your project is live and publicly viewable.', 'مشروعك منشور ويمكن للجميع مشاهدته.')}</span></div>
        <Link to={`/projects/${project.slug}`} className="btn btn-primary">{t('View Public Project', 'عرض المشروع العام')}</Link>
      </div>
    )}
    {project.status === 'rejected' && (
      <div className="st-alert st-alert--warning"><Icon name="alert-triangle" size={16} /><span>{t('Changes were requested on this project. Update it and resubmit.', 'تم طلب تعديلات على هذا المشروع. حدّثه وأعد إرساله.')}</span></div>
    )}
    <section className="st-panel">
      <div className="st-panel__head"><h2>{t('Approval Progress', 'مراحل الاعتماد')}</h2>{project.status === 'rejected' && <Pill tone="warning">{t('Changes requested', 'مطلوب تعديلات')}</Pill>}</div>
      <Stepper steps={steps} current={cur} warn={project.status === 'rejected'} />
    </section>
    <div className="grid-2">
      <div className="glass-panel" style={{ padding: 'var(--space-5)' }}>
        <h2 className="text-h3">{t('Problem & Solution', 'وصف المشروع')}</h2>
        <p className="text-small">{project.description || project.summary?.[locale] || project.summary?.en || ''}</p>
        <div className="divider" />
        <h2 className="text-h3">{t('Tech Stack', 'التقنيات المستخدمة')}</h2>
        {allTags.length > 0 ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 'var(--space-2)' }}>
            {allTags.map((tag, i) => <span key={i} className="badge badge-neutral">{tag}</span>)}
          </div>
        ) : (
          <p className="text-small" style={{ marginTop: 'var(--space-2)' }}>{t('No technologies added yet.', 'لم تُضف أي تقنيات بعد.')}</p>
        )}
      </div>
      <aside style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div className="card glass-panel">
          <h2 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>{t('Project Info', 'معلومات المشروع')}</h2>
          <dl className="kv-list">
            <dt>{t('Category', 'التصنيف')}</dt><dd>{project.category?.[locale] || project.category?.en || '—'}</dd>
            <dt>{t('Supervisor', 'المشرف')}</dt><dd>{project.supervisor_name || '—'}</dd>
            <dt>{t('Created', 'تاريخ الإنشاء')}</dt><dd>{project.created_at ? new Date(project.created_at).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US') : '—'}</dd>
            <dt>{t('Published', 'تاريخ النشر')}</dt><dd>{project.published_at ? new Date(project.published_at).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US') : '—'}</dd>
          </dl>
        </div>
      </aside>
    </div>
    </div>
  );
}

function FilesTab({ id, files, canEdit, t, reload, setActionError }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  async function handleUpload(fileList) {
    if (!fileList || !fileList.length) return;
    setUploading(true);
    setActionError(null);
    for (const file of fileList) {
      const fd = new FormData();
      fd.append('file', file);
      try {
        await api.postForm(`/api/v1/projects/${id}/files`, fd);
      } catch (err) {
        setActionError(errorMessage(err));
      }
    }
    setUploading(false);
    reload();
  }

  async function handleDelete(fileId) {
    if (!window.confirm(t('Delete this file?', 'حذف هذا الملف؟'))) return;
    try {
      await api.del(`/api/v1/projects/${id}/files/${fileId}`);
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  return (
    <div className="st-stack">
      {canEdit && (
        <div
          className="st-dropzone" role="button" tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleUpload(e.dataTransfer.files); }}
        >
          <Icon name="upload" size={22} />
          <strong style={{ color: 'var(--text-primary)', fontSize: 13.5 }}>{uploading ? t('Uploading…', 'جارِ الرفع…') : t('Drag & drop files here', 'اسحب وأفلت الملفات هنا')}</strong>
          <small>{t('or click to browse — multiple files allowed', 'أو اضغط للاختيار من جهازك — عدة ملفات مسموح')}</small>
          <input ref={inputRef} type="file" multiple style={{ display: 'none' }} onChange={(e) => handleUpload(e.target.files)} />
        </div>
      )}

      {files.length === 0 ? (
        <div className="st-empty">
          <Icon name="file" size={28} />
          <strong>{t('No files uploaded yet.', 'لا توجد ملفات مرفوعة بعد.')}</strong>
        </div>
      ) : (
        <div className="st-panel st-panel--flush st-table-wrap">
          <table className="st-table">
            <thead>
              <tr>
                <th>{t('File', 'الملف')}</th>
                <th>{t('Type', 'النوع')}</th>
                <th>{t('Size', 'الحجم')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.id}>
                  <td style={{ whiteSpace: 'normal' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600 }}><Icon name="file" size={16} /> {f.original_name}</span></td>
                  <td className="st-muted">{String(f.extension || '').toUpperCase()}</td>
                  <td className="st-muted">{f.size_human}</td>
                  <td>
                    <span style={{ display: 'inline-flex', gap: 14 }}>
                      {f.url && <a href={f.url} target="_blank" rel="noopener noreferrer" className="st-link">{t('Download', 'تنزيل')}</a>}
                      {canEdit && <button type="button" className="st-link st-btn-danger" onClick={() => handleDelete(f.id)}>{t('Delete', 'حذف')}</button>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function GalleryTab({ media, t }) {
  const [lightbox, setLightbox] = useState(null);
  if (media.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon"><Icon name="image" size={24} /></div>
        <p className="text-small">{t('No media uploaded yet.', 'لا توجد وسائط مرفوعة بعد.')}</p>
      </div>
    );
  }
  const current = lightbox !== null ? media[lightbox] : null;
  return (
    <>
      <div className="pp-gallery">
        {media.map((m, i) => {
          const thumb = m.file_type === 'image' ? m.url : m.thumbnail_url;
          return (
            <button key={m.id} type="button" className="pp-gallery__item" onClick={() => setLightbox(i)}>
              {thumb ? <img src={thumb} alt={m.caption || ''} loading="lazy" /> : <div className="pp-gallery__placeholder"><Icon name="file" size={22} /></div>}
              {(m.caption || m.original_name) && <span className="pp-gallery__caption">{m.caption || m.original_name}</span>}
            </button>
          );
        })}
      </div>
      {current && (
        <div className="pp-lightbox" onClick={(e) => { if (e.target === e.currentTarget) setLightbox(null); }}>
          <button type="button" className="pp-lightbox__close" onClick={() => setLightbox(null)}><Icon name="x" size={22} /></button>
          <div className="pp-lightbox__stage">
            {current.file_type === 'image' && <img src={current.url} alt={current.caption || ''} />}
            {current.file_type === 'video' && current.url && <video src={current.url} controls autoPlay />}
          </div>
        </div>
      )}
    </>
  );
}

function AnalyticsTab({ data, t }) {
  if (!data) return <p className="text-small">{t('Analytics are not available yet.', 'الإحصائيات غير متاحة بعد.')}</p>;

  const summary = data.summary || {};
  const trend = data.trend || [];
  const top = data.top || [];
  const cards = [
    { key: 'total_views', icon: 'eye', en: 'Total Views', ar: 'إجمالي المشاهدات' },
    { key: 'unique_views', icon: 'user', en: 'Unique Views', ar: 'مشاهدات فريدة' },
    { key: 'github_clicks', icon: 'github', en: 'GitHub Clicks', ar: 'نقرات GitHub' },
    { key: 'demo_clicks', icon: 'globe', en: 'Demo Clicks', ar: 'نقرات العرض' },
    { key: 'file_downloads', icon: 'download', en: 'Downloads', ar: 'تنزيلات' },
    { key: 'contact_requests', icon: 'mail', en: 'Contact Requests', ar: 'طلبات تواصل' },
  ];
  const maxViews = Math.max(1, ...trend.map((d) => Number(d.views) || 0));

  return (
    <div className="glass-panel" style={{ padding: 'var(--space-5)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
        {cards.map((c) => (
          <div key={c.key} style={{ textAlign: 'center' }}>
            <div className="text-h2">{Number(summary[c.key]) || 0}</div>
            <span className="text-caption"><Icon name={c.icon} size={12} /> {t(c.en, c.ar)}</span>
          </div>
        ))}
      </div>

      {trend.length > 0 && trend.some((d) => Number(d.views) > 0) && (
        <>
          <h2 className="text-h3">{t('Views (last 14 days)', 'المشاهدات (آخر 14 يوم)')}</h2>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 100, marginTop: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            {trend.map((d, i) => (
              <div key={i} title={`${d.date}: ${d.views}`} style={{ flex: 1, background: 'var(--color-primary)', opacity: 0.7, borderRadius: 2, height: `${Math.max(4, (Number(d.views) / maxViews) * 100)}%` }} />
            ))}
          </div>
        </>
      )}

      {top.length > 0 && (
        <>
          <h2 className="text-h3">{t('Top Interactions', 'أكثر التفاعلات')}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
            {top.map((row, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', padding: '4px 0' }}>
                <span className="text-small">{row.label || row.type}</span>
                <span className="text-small text-mono">{row.count}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ApprovalTab({ approval, canEdit, id, locale, t }) {
  const decision = approval?.latest_decision;
  const decisionLabel = {
    approved: { en: 'Approved', ar: 'تم الاعتماد' },
    rejected: { en: 'Rejected', ar: 'مرفوض' },
    changes_requested: { en: 'Changes requested', ar: 'مطلوب تعديلات' },
  }[decision?.decision] || null;

  return (
    <section className="st-panel">
      <dl className="st-kv">
        <dt>{t('Current Status', 'الحالة الحالية')}</dt>
        <dd>{approval?.status ? <StatusPill status={approval.status} locale={locale} /> : '—'}</dd>
        <dt>{t('Submitted', 'تاريخ الإرسال')}</dt>
        <dd>{approval?.submitted_at ? new Date(approval.submitted_at).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US') : '—'}</dd>
      </dl>
      <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '18px 0' }} />
      {decision ? (
        <div className="st-stack" style={{ gap: 10 }}>
          <h2>{t('Latest Reviewer Decision', 'أحدث قرار من المراجع')}</h2>
          <div className="st-row" style={{ justifyContent: 'flex-start', gap: 10 }}>
            <Pill tone={decision.decision === 'approved' ? 'success' : decision.decision === 'rejected' ? 'danger' : 'warning'}>{decisionLabel ? t(decisionLabel.en, decisionLabel.ar) : decision.decision}</Pill>
            {decision.decided_at && <span className="st-muted" style={{ fontSize: 12 }}>{new Date(decision.decided_at).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US')}</span>}
          </div>
          <p style={{ fontSize: 13.5 }}>{decision.comments || t('No written reason was attached by the reviewer.', 'لم يُرفق سبب مكتوب من المراجع.')}</p>
          {canEdit && (
            <Link to={`/student/projects/${id}/edit`} className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start' }}>
              <Icon name="edit" size={14} /> {t('Edit the project now', 'عدّل المشروع الآن')}
            </Link>
          )}
        </div>
      ) : (
        <p className="st-muted" style={{ fontSize: 13.5 }}>{t('No reviewer decision has been recorded yet.', 'لم يُسجَّل أي قرار من مراجع حتى الآن.')}</p>
      )}
    </section>
  );
}

const LINK_TYPE_LABELS = {
  github: { en: 'GitHub', ar: 'GitHub' }, gitlab: { en: 'GitLab', ar: 'GitLab' },
  live_demo: { en: 'Live Demo', ar: 'عرض تجريبي' }, website: { en: 'Website', ar: 'موقع إلكتروني' },
  mobile_app: { en: 'Mobile App', ar: 'تطبيق جوال' }, documentation: { en: 'Documentation', ar: 'توثيق' },
  video_demo: { en: 'Video Demo', ar: 'فيديو توضيحي' }, presentation: { en: 'Presentation', ar: 'عرض تقديمي' },
  research_paper: { en: 'Research Paper', ar: 'ورقة بحثية' }, other: { en: 'Other', ar: 'أخرى' },
};

function LinksTab({ id, links, canEdit, t, reload, setActionError }) {
  const [type, setType] = useState('other');
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editRow, setEditRow] = useState({ type: 'other', url: '', label: '', is_primary: false });

  async function addLink(e) {
    e.preventDefault();
    if (!url.trim()) return;
    setSaving(true);
    setActionError(null);
    try {
      await api.post(`/api/v1/projects/${id}/links`, { type, url: url.trim(), label: label.trim() || undefined });
      setUrl(''); setLabel('');
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function startEdit(l) {
    setEditingId(l.id);
    setEditRow({ type: l.type, url: l.url, label: l.label || '', is_primary: !!l.is_primary });
  }

  async function saveEdit(linkId) {
    setSaving(true);
    setActionError(null);
    try {
      await api.patch(`/api/v1/projects/${id}/links/${linkId}`, {
        type: editRow.type, url: editRow.url.trim(), label: editRow.label.trim() || undefined, is_primary: editRow.is_primary,
      });
      setEditingId(null);
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function deleteLink(linkId) {
    if (!window.confirm(t('Delete this link?', 'حذف هذا الرابط؟'))) return;
    try {
      await api.del(`/api/v1/projects/${id}/links/${linkId}`);
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  return (
    <div className="card glass-panel">
      {canEdit && (
        <form onSubmit={addLink} style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-4)', paddingBottom: 'var(--space-4)', borderBottom: '1px solid var(--border-subtle)' }}>
          <select className="form-select" style={{ flex: '0 0 auto' }} value={type} onChange={(e) => setType(e.target.value)}>
            {Object.entries(LINK_TYPE_LABELS).map(([k, l]) => <option key={k} value={k}>{t(l.en, l.ar)}</option>)}
          </select>
          <input type="url" className="form-input" style={{ flex: 1, minWidth: 200 }} placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} required />
          <input type="text" className="form-input" style={{ flex: 1, minWidth: 140 }} placeholder={t('Label (optional)', 'تسمية (اختياري)')} value={label} onChange={(e) => setLabel(e.target.value)} />
          <button type="submit" className="btn btn-outline btn-sm" disabled={saving}><Icon name="plus" size={14} /> {t('Add', 'إضافة')}</button>
        </form>
      )}
      {links.length === 0 ? (
        <p className="text-small">{t('No links added yet.', 'لا توجد روابط بعد.')}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {links.map((l) => (
            editingId === l.id ? (
              <div key={l.id} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', padding: 'var(--space-3) 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <select className="form-select" value={editRow.type} onChange={(e) => setEditRow((r) => ({ ...r, type: e.target.value }))}>
                  {Object.entries(LINK_TYPE_LABELS).map(([k, lbl]) => <option key={k} value={k}>{t(lbl.en, lbl.ar)}</option>)}
                </select>
                <input className="form-input" type="url" value={editRow.url} onChange={(e) => setEditRow((r) => ({ ...r, url: e.target.value }))} required />
                <input className="form-input" type="text" value={editRow.label} onChange={(e) => setEditRow((r) => ({ ...r, label: e.target.value }))} maxLength={150} />
                <label className="text-caption" style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={editRow.is_primary} onChange={(e) => setEditRow((r) => ({ ...r, is_primary: e.target.checked }))} /> {t('Primary link', 'الرابط الأساسي')}
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn btn-outline btn-sm" disabled={saving} onClick={() => saveEdit(l.id)}><Icon name="check" size={14} /> {t('Save', 'حفظ')}</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>{t('Cancel', 'إلغاء')}</button>
                </div>
              </div>
            ) : (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <Icon name={LINK_TYPE_ICON[l.type] || 'link'} size={16} />
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-small" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.label}</a>
                {l.is_primary && <span className="badge badge-primary"><Icon name="star" size={10} /></span>}
                {canEdit && (
                  <>
                    <button type="button" className="text-caption" style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer' }} onClick={() => startEdit(l)}>{t('Edit', 'تعديل')}</button>
                    <button type="button" className="text-caption" style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer' }} onClick={() => deleteLink(l.id)}>{t('Delete', 'حذف')}</button>
                  </>
                )}
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}

const TEAM_ROLE_LABELS = {
  student_member: { en: 'Student Team Member', ar: 'عضو فريق (طالب)' },
  teaching_assistant: { en: 'Teaching Assistant', ar: 'معيد' },
  principal_investigator: { en: 'Principal Investigator', ar: 'الباحث الرئيسي' },
  professor: { en: 'Professor', ar: 'أستاذ دكتور' },
  external_collaborator: { en: 'External Collaborator', ar: 'متعاون خارجي' },
  collaborator: { en: 'Collaborator', ar: 'متعاون' },
};

function TeamTab({ id, team, canEdit, t, reload, setActionError }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('student_member');
  const [year, setYear] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [saving, setSaving] = useState(false);

  async function invite(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setSaving(true);
    setActionError(null);
    try {
      await api.post(`/api/v1/projects/${id}/team/invite`, { email: email.trim(), role, locale: 'ar' });
      setEmail('');
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function addManual(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setActionError(null);
    try {
      await api.post(`/api/v1/projects/${id}/team/manual`, {
        name: name.trim(), role, academic_year: year || undefined, student_number: studentNumber.trim() || undefined, locale: 'ar',
      });
      setName(''); setYear(''); setStudentNumber('');
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(memberId) {
    if (!window.confirm(t('Remove this member?', 'إزالة هذا العضو؟'))) return;
    try {
      await api.del(`/api/v1/projects/${id}/team/${memberId}`);
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  const initialsOf = (n) => String(n || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';
  return (
    <div className="st-stack">
      {team.length === 0 ? (
        <div className="st-empty">
          <Icon name="users" size={28} />
          <strong>{t('No team members added yet.', 'لا يوجد أعضاء فريق بعد.')}</strong>
        </div>
      ) : (
        <div className="st-grid st-grid--2">
          {team.map((m) => {
            const st = TEAM_STATUS_BADGE[m.status] || { cls: 'badge-neutral', en: m.status, ar: m.status };
            const tone = /success/.test(st.cls) ? 'success' : /warning/.test(st.cls) ? 'warning' : /danger/.test(st.cls) ? 'danger' : 'neutral';
            return (
              <div key={m.id} className="st-panel st-row" style={{ padding: 16, gap: 12 }}>
                <div className="st-row" style={{ justifyContent: 'flex-start', gap: 12, minWidth: 0 }}>
                  <span className="sidebar__user-avatar" style={{ width: 38, height: 38 }}>{initialsOf(m.display_name)}</span>
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ fontSize: 13.5, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.display_name}</strong>
                    <span className="st-muted" style={{ fontSize: 12 }}>{t((TEAM_ROLE_LABELS[m.role] || {}).en || m.role, (TEAM_ROLE_LABELS[m.role] || {}).ar || m.role)}</span>
                  </div>
                </div>
                <div className="st-row" style={{ gap: 8, flexShrink: 0 }}>
                  <Pill tone={tone}>{t(st.en, st.ar)}</Pill>
                  {canEdit && <button type="button" className="st-link st-btn-danger" onClick={() => remove(m.id)} aria-label={t('Remove', 'إزالة')}><Icon name="trash" size={15} /></button>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {canEdit && (
        <section className="st-panel">
          <h2 style={{ marginBottom: 14 }}>{t('Add team members', 'إضافة أعضاء للفريق')}</h2>
          <form onSubmit={invite} className="st-toolbar" style={{ paddingBottom: 16, marginBottom: 16, borderBottom: '1px solid var(--border-subtle)' }}>
            <input type="email" className="form-input" style={{ flex: 1, minWidth: 200 }} placeholder={t("Teammate's registered email", 'بريد زميل مسجّل على المنصة')} value={email} onChange={(e) => setEmail(e.target.value)} required />
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}><Icon name="mail" size={14} /> {t('Invite', 'دعوة')}</button>
          </form>
          <form onSubmit={addManual} className="st-form">
            <div className="st-form__grid">
              <input type="text" className="form-input" placeholder={t("Teammate's name", 'اسم الزميل')} value={name} onChange={(e) => setName(e.target.value)} required />
              <select className="form-select" value={role} onChange={(e) => setRole(e.target.value)}>
                {Object.entries(TEAM_ROLE_LABELS).map(([k, l]) => <option key={k} value={k}>{t(l.en, l.ar)}</option>)}
              </select>
              <input type="number" min={1} max={10} className="form-input" placeholder={t('Academic year', 'السنة الدراسية')} value={year} onChange={(e) => setYear(e.target.value)} />
              <input type="text" className="form-input" placeholder={t('Student ID', 'الرقم الجامعي')} value={studentNumber} onChange={(e) => setStudentNumber(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-outline btn-sm" disabled={saving} style={{ alignSelf: 'flex-start' }}><Icon name="plus" size={16} /> {t('Add member without an account', 'إضافة عضو بدون حساب')}</button>
          </form>
        </section>
      )}
    </div>
  );
}

function DiscussionTab({ id, discussion, t, reload, setActionError }) {
  const [message, setMessage] = useState('');
  const [posting, setPosting] = useState(false);

  async function post(e) {
    e.preventDefault();
    if (!message.trim()) return;
    setPosting(true);
    setActionError(null);
    try {
      await api.post(`/api/v1/projects/${id}/discussion`, { message: message.trim() });
      setMessage('');
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="card glass-panel">
      <form onSubmit={post} style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
        <input type="text" className="form-input" style={{ flex: 1 }} placeholder={t('Write a message to your team…', 'اكتب رسالة لفريقك…')} value={message} onChange={(e) => setMessage(e.target.value)} required />
        <button type="submit" className="btn btn-primary btn-sm" disabled={posting}><Icon name="send" size={14} /> {t('Send', 'إرسال')}</button>
      </form>
      {discussion.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon"><Icon name="message" size={24} /></div>
          <p className="text-small">{t('No messages yet on this project.', 'لا توجد رسائل بعد على هذا المشروع.')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {discussion.map((msg) => (
            <div key={msg.id} style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-small" style={{ fontWeight: 600 }}>{msg.author_name}</span>
                <span className="text-caption">{msg.created_at ? new Date(msg.created_at).toLocaleString() : ''}</span>
              </div>
              <p className="text-small" style={{ margin: 0 }}>{msg.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityTab({ activity, t }) {
  if (activity.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon"><Icon name="clock" size={24} /></div>
        <p className="text-small">{t('No activity recorded yet.', 'لا يوجد نشاط مسجل بعد.')}</p>
      </div>
    );
  }
  return (
    <div className="glass-panel" style={{ padding: 'var(--space-5)' }}>
      <div className="timeline">
        {activity.map((ev, i) => (
          <div key={ev.id || i} className="timeline-item is-done">
            <div className="timeline-item__dot"><Icon name="clock" size={14} /></div>
            <div>
              <p className="text-small" style={{ margin: 0, color: 'var(--text-primary)' }}>{ev.description || ev.type || ev.action || ''}</p>
              <span className="text-caption">{ev.created_at ? new Date(ev.created_at).toLocaleString() : ''}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CodeReviewTab({ id, project, review, canEdit, t, reload, setActionError }) {
  const [running, setRunning] = useState(false);
  const hasRepo = !!project.repo_url;

  async function run() {
    setRunning(true);
    setActionError(null);
    try {
      await api.post(`/api/v1/projects/${id}/code-review/run`);
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="card glass-panel">
      {!hasRepo && !review ? (
        <p className="text-small">{t('Link a GitHub repo from the project edit page to enable analysis.', 'اربط مستودع GitHub من صفحة تعديل المشروع لتفعيل التحليل.')}</p>
      ) : !review ? (
        <>
          <p className="text-small">{t('Repository linked. Run your first review now.', 'المستودع مربوط. شغّل أول مراجعة الآن.')}</p>
          {canEdit && <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 'var(--space-3)' }} disabled={running} onClick={run}><Icon name="terminal" size={16} /> {t('Run Review', 'تشغيل المراجعة')}</button>}
        </>
      ) : review.status === 'failed' ? (
        <>
          <span className="badge badge-danger"><Icon name="alert-triangle" size={12} /> {t('Last attempt failed', 'فشلت آخر محاولة')}</span>
          <p className="text-small" style={{ marginTop: 'var(--space-2)' }}>{review.summary}</p>
          {canEdit && <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: 'var(--space-3)' }} disabled={running} onClick={run}>{t('Try again', 'إعادة المحاولة')}</button>}
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <ReadinessRing score={review.scores?.overall || 0} size={72} />
            <div>
              <div className="text-h3">{review.scores?.overall || 0}/100</div>
              <span className="text-caption">{review.issues_found} {t('issue(s) flagged', 'ملاحظة')}</span>
            </div>
          </div>
          {(review.issues || []).length > 0 ? (
            <ul style={{ margin: 0, paddingInlineStart: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              {review.issues.map((issue, i) => <li key={i} className="text-small">{issue.message_ar || issue.message_en || issue.message || ''}</li>)}
            </ul>
          ) : (
            <p className="text-small" style={{ color: 'var(--color-success)' }}>{t('No issues found — all checks passed.', 'لا ملاحظات — كل الفحوصات ناجحة.')}</p>
          )}
          {canEdit && <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: 'var(--space-3)' }} disabled={running} onClick={run}><Icon name="refresh" size={14} /> {t('Re-run review', 'إعادة التحليل')}</button>}
        </>
      )}
    </div>
  );
}
