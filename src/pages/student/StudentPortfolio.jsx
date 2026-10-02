import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { useTranslations, useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { usePageMeta } from '../../context/PageMetaContext';
import { Pill, EmptyState, Skeleton } from '../../components/student/stUi';
import { initials } from '../../components/Sidebar';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/student/portfolio';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Mirrors app/Views/student/portfolio.php, talking to /api/v1/portfolios/*
 * (App\Controllers\Api\PortfoliosApiController, reusing PortfolioService
 * exactly as Student\StudentPortfolioController does). GET /me for the
 * combined portfolio + eligible + featured projects; PATCH /me for
 * headline/about/is_public; POST /projects/{id}/feature to toggle a
 * published project's featured state — same three calls the Blade view's
 * three <form>s submit to.
 */
function ProjectMiniCard({ p, locale, t }) {
  const title = (locale === 'ar' ? p.title?.ar : p.title?.en) || p.title?.en || '';
  const category = (locale === 'ar' ? p.category?.ar : p.category?.en) || '';
  const tags = Array.isArray(p.tags) ? p.tags : [];
  const cover = p.cover_image_path || '';
  const liveUrl = p.live_demo_url || '';
  return (
    <div className="st-pcard">
      {cover && (
        <img src={`/${cover.replace(/^\//, '')}`} alt={title} loading="lazy" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 10 }} />
      )}
      {category && <span className="st-tag" style={{ alignSelf: 'flex-start' }}>{category}</span>}
      <h3>{title}</h3>
      {tags.length > 0 && (
        <div className="st-chips">{tags.slice(0, 4).map((tag, i) => <Pill key={i} tone="neutral">{String(tag)}</Pill>)}</div>
      )}
      {liveUrl && (
        <a href={liveUrl} target="_blank" rel="noopener noreferrer" className="st-link"><Icon name="link" size={12} /> {t('Visit demo')}</a>
      )}
    </div>
  );
}

export default function StudentPortfolio() {
  const t = useTranslations(translations);
  const { locale } = useLanguage();
  const { user } = useAuth();
  const ar = locale === 'ar';
  usePageMeta(ar ? 'الملف الإبداعي' : 'Portfolio', t('Your public page for showcasing your published projects.'));
  const [tab, setTab] = useState('view');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  const [headline, setHeadline] = useState('');
  const [about, setAbout] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/api/v1/portfolios/me')
      .then((json) => {
        setData(json.data);
        setHeadline(json.data.portfolio?.headline || '');
        setAbout(json.data.portfolio?.about || '');
        setIsPublic(!!json.data.portfolio?.is_public);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setActionError(null);
    try {
      await api.patch('/api/v1/portfolios/me', { headline, about, is_public: isPublic });
      setSavedAt(Date.now());
      load();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleFeature = async (dbId) => {
    setActionError(null);
    try {
      await api.post(`/api/v1/portfolios/projects/${dbId}/feature`);
      load();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  const copyLink = () => {
    if (!data?.share_url) return;
    navigator.clipboard?.writeText(data.share_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <Skeleton h={120} count={2} />;
  if (error) return <div className="st-alert st-alert--danger"><Icon name="alert-triangle" size={16} /><span>{error}</span></div>;
  if (!data) return null;

  const eligible = data.eligible_projects || [];
  const featured = data.featured_projects || [];
  const name = user?.full_name || user?.name || '';
  const TABS = [
    { key: 'view', label: ar ? 'عرض' : 'View' },
    { key: 'edit', label: ar ? 'تعديل' : 'Edit' },
    { key: 'preview', label: ar ? 'المعاينة العامة' : 'Public Preview' },
  ];
  const headlineSaved = data.portfolio?.headline || '';
  const aboutSaved = data.portfolio?.about || '';

  const featuredGrid = featured.length === 0 ? (
    <EmptyState icon="award" title={t('No featured projects yet — pick from your published projects below.')} text={ar ? 'اختر من مشاريعك المنشورة من تبويب «تعديل».' : 'Pick from your published projects in the Edit tab.'}>
      <button type="button" className="btn btn-outline btn-sm" onClick={() => setTab('edit')}>{ar ? 'اختيار مشاريع' : 'Choose projects'}</button>
    </EmptyState>
  ) : (
    <div className="st-cards">{featured.map((p) => <ProjectMiniCard key={p.id} p={p} locale={locale} t={t} />)}</div>
  );

  return (
    <div className="st-page">
      <div className="st-tabs" role="tablist">
        {TABS.map((tb) => (
          <button key={tb.key} type="button" role="tab" aria-selected={tab === tb.key} className={`st-tab${tab === tb.key ? ' is-active' : ''}`} onClick={() => setTab(tb.key)}>{tb.label}</button>
        ))}
      </div>

      {actionError && <div className="st-alert st-alert--danger"><Icon name="alert-triangle" size={16} /><span>{actionError}</span></div>}

      {tab === 'view' && (
        <>
          <section className="st-panel">
            <div className="st-row" style={{ gap: 16, flexWrap: 'wrap' }}>
              <div className="st-row" style={{ gap: 14, minWidth: 0 }}>
                <span className="sidebar__user-avatar" style={{ width: 56, height: 56, fontSize: 18 }}>{initials(user || {})}</span>
                <div style={{ minWidth: 0 }}>
                  <h2 style={{ fontSize: 18 }}>{name}</h2>
                  <p className="st-muted" style={{ fontSize: 13, marginTop: 2 }}>{headlineSaved || (ar ? 'لم تضف عنوانًا تعريفيًا بعد' : 'No headline yet')}</p>
                </div>
              </div>
              <div className="st-row" style={{ gap: 10 }}>
                <Pill tone={isPublic ? 'success' : 'neutral'}><Icon name={isPublic ? 'eye' : 'eye-off'} size={12} /> {isPublic ? t('Public') : t('Private')}</Pill>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setTab('edit')}>{ar ? 'تعديل الملف' : 'Edit Portfolio'}</button>
              </div>
            </div>
            {aboutSaved && <p style={{ fontSize: 13.5, marginTop: 14, maxWidth: 760 }}>{aboutSaved}</p>}
          </section>

          {isPublic && data.share_url ? (
            <div className="st-file-row">
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.share_url}</span>
              <button type="button" className="st-link" onClick={copyLink}><Icon name="link" size={13} /> {copied ? t('Copied!') : (ar ? 'نسخ الرابط' : 'Copy Link')}</button>
            </div>
          ) : (
            <div className="st-alert"><Icon name="eye-off" size={16} /><span>{t('Turn on "Public visibility" above to get a shareable link.')}</span></div>
          )}

          <section>
            <h2 style={{ fontSize: 15, marginBottom: 10 }}>{t('Featured Projects')}</h2>
            {featuredGrid}
          </section>
        </>
      )}

      {tab === 'edit' && (
        <div className="st-stack">
          <section className="st-panel">
            <h2 style={{ marginBottom: 14 }}>{t('Headline & About')}</h2>
            <form className="st-form" onSubmit={saveProfile}>
              <div className="st-field">
                <label className="st-label">{t('Headline')}</label>
                <input className="form-input" type="text" maxLength={255} placeholder={t('e.g. Computer Systems Engineer interested in Applied AI & IoT')} value={headline} onChange={(e) => setHeadline(e.target.value)} />
              </div>
              <div className="st-field">
                <label className="st-label">{t('About')}</label>
                <textarea className="form-textarea" rows={4} value={about} onChange={(e) => setAbout(e.target.value)} />
              </div>
              <label className="st-row" style={{ cursor: 'pointer' }}>
                <span>
                  <span className="st-label" style={{ display: 'block' }}>{t('Make portfolio public')}</span>
                  <small className="st-muted">{t('When on, others can view your featured projects.')}</small>
                </span>
                <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
              </label>
              <div className="st-form__footer" style={{ borderTop: 'none', paddingTop: 0 }}>
                <span className="st-muted" style={{ fontSize: 12.5 }}>{savedAt ? (ar ? 'تم الحفظ.' : 'Saved.') : ''}</span>
                <button type="submit" className="btn btn-primary" disabled={saving}><Icon name="check" size={16} /> {t('Save Changes')}</button>
              </div>
            </form>
          </section>

          <section className="st-panel">
            <h2 style={{ marginBottom: 4 }}>{t('All Published Projects')}</h2>
            <p className="st-muted" style={{ fontSize: 12.5, marginBottom: 14 }}>{t('Only published (approved) projects are eligible for the portfolio.')}</p>
            {eligible.length === 0 ? (
              <p className="st-muted" style={{ fontSize: 13 }}>
                {t("You don't have any published projects yet.")}{' '}
                <Link to="/student/projects" className="st-link">{t('View my projects')}</Link>
              </p>
            ) : (
              <ul className="st-list">
                {eligible.map((p) => (
                  <li key={p.db_id} className="st-row">
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ fontSize: 13.5 }}>{(ar ? p.title?.ar : p.title?.en) || p.title?.en}</strong>
                      <div className="st-muted" style={{ fontSize: 11.5 }}>{p.id}</div>
                    </div>
                    <button type="button" className={`btn ${p.is_featured ? 'btn-outline' : 'btn-primary'} btn-sm`} onClick={() => toggleFeature(p.db_id)}>
                      <Icon name={p.is_featured ? 'x' : 'plus'} size={14} /> {p.is_featured ? t('Remove from Featured') : t('Add to Featured')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {tab === 'preview' && (
        <section className="st-panel" style={{ maxWidth: 640, margin: '0 auto', width: '100%', textAlign: 'center' }}>
          <span className="sidebar__user-avatar" style={{ width: 72, height: 72, fontSize: 24, margin: '0 auto 12px' }}>{initials(user || {})}</span>
          <h2 style={{ fontSize: 18 }}>{name}</h2>
          <p className="st-muted" style={{ fontSize: 13, marginTop: 4 }}>{headlineSaved}</p>
          {aboutSaved && <p style={{ fontSize: 13.5, marginTop: 12 }}>{aboutSaved}</p>}
          <div style={{ marginTop: 20, textAlign: 'start' }}>
            {featured.length === 0
              ? <p className="st-muted" style={{ fontSize: 13, textAlign: 'center' }}>{t('No featured projects yet — pick from your published projects below.')}</p>
              : <div className="st-stack">{featured.map((p) => <ProjectMiniCard key={p.id} p={p} locale={locale} t={t} />)}</div>}
          </div>
          {!isPublic && <p className="st-muted" style={{ fontSize: 12, marginTop: 16 }}>{ar ? 'الملف خاص حاليًا — لن يراه أحد غيرك.' : 'Your portfolio is currently private — only you can see this.'}</p>}
        </section>
      )}
    </div>
  );
}
