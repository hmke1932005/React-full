import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { useTranslations, useLanguage } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/faculty/project-view';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Mirrors app/Views/faculty/project-view.php, talking to the real JSON
 * API (GET /api/v1/faculty/approvals/{id} — App\Controllers\Api\
 * FacultyApprovalsApiController::show()), reached from the
 * FacultyApprovals queue's "View" link. Decision actions POST to the
 * same controller's approve/reject/request-changes, mirroring the
 * detail-page AI-acknowledgment gate the original Blade forms enforce.
 * Same as UniversityProjectView.jsx except: no "Faculty" row in the
 * Student card (it's always the caller's own faculty) and no
 * "Supervisor" row in Project Info — the faculty PHP view omits both.
 */

const STATUS_META = {
  draft: { cls: 'badge-neutral', en: 'Draft', ar: 'مسودة' },
  submitted: { cls: 'badge-primary', en: 'Submitted', ar: 'مقدَّم' },
  published: { cls: 'badge-success', en: 'Published', ar: 'منشور' },
  rejected: { cls: 'badge-danger', en: 'Rejected', ar: 'مرفوض' },
};

export default function FacultyProjectView() {
  const t = useTranslations(translations);
  const { locale } = useLanguage();
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get(`/api/v1/faculty/approvals/${encodeURIComponent(id)}`)
      .then((json) => { if (!cancelled) setData(json.data); })
      .catch((err) => { if (!cancelled) setError(errorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <p className="text-small" style={{ padding: 'var(--space-5)' }}>{t('Loading…')}</p>;
  if (error) return <p style={{ color: 'var(--color-danger)', padding: 'var(--space-5)' }}>{error}</p>;
  if (!data) return null;

  const p = data.project || {};
  const files = data.files || [];
  const aiReadiness = data.ai_readiness;
  const aiClassification = data.ai_classification;
  const hasAiInfo = !!aiReadiness || !!aiClassification;
  const canApprove = !!data.can_approve;
  const requiresAck = !!data.requires_ai_acknowledgment;
  const status = p.status || 'draft';
  const meta = STATUS_META[status] || STATUS_META.draft;

  async function handleDecide(action) {
    setBusy(true);
    setActionError(null);
    try {
      await api.post(`/api/v1/faculty/approvals/${encodeURIComponent(id)}/${action}`, { ai_acknowledgment: ack ? 1 : 0 });
      navigate('/faculty/approvals');
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-header animate-rise-in">
        <div className="page-header__title">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="badge badge-neutral">{p.category?.[locale]}</span>
            <span className={`badge ${meta.cls}`}>{meta[locale]}</span>
            <span className="text-caption text-mono">{p.id}</span>
          </div>
          <h1 className="text-h1">{p.title?.[locale]}</h1>
          <p className="text-small" style={{ maxWidth: 640 }}>{p.summary?.[locale]}</p>
        </div>
        <div className="page-header__actions" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 'var(--space-2)' }}>
          {status === 'submitted' && canApprove && (
            <>
              {requiresAck && (
                <label className="text-caption" style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                  {locale === 'ar' ? 'راجعت مؤشرات الذكاء الاصطناعي أدناه بشكل مستقل قبل اتخاذ القرار' : "I've reviewed the AI indicators below independently before deciding"}
                </label>
              )}
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button type="button" className="btn btn-primary" disabled={(requiresAck && !ack) || busy} onClick={() => handleDecide('approve')}>
                  <Icon name="check" size={18} /> {t('Approve')}
                </button>
                <button type="button" className="btn btn-outline" disabled={(requiresAck && !ack) || busy} onClick={() => handleDecide('request-changes')}>
                  <Icon name="edit" size={18} /> {t('Request Changes')}
                </button>
                <button type="button" className="btn btn-danger" disabled={(requiresAck && !ack) || busy} onClick={() => handleDecide('reject')}>
                  <Icon name="x" size={18} /> {t('Reject')}
                </button>
              </div>
            </>
          )}
          <Link to="/faculty/approvals" className="btn btn-outline">{t('Back to Approvals')}</Link>
        </div>
      </div>

      {actionError && <p style={{ color: 'var(--color-danger)' }}>{actionError}</p>}

      <div className="grid-2">
        <div>
          <div className="glass-panel" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-5)' }}>
            <h2 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>{t('Project Summary')}</h2>
            <p className="text-small" style={{ whiteSpace: 'pre-line' }}>{p.summary?.[locale]}</p>
            {p.tags?.length > 0 && (
              <>
                <div className="divider" />
                <h2 className="text-h3" style={{ marginBottom: 'var(--space-2)' }}>{t('Tags')}</h2>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {p.tags.map((tag) => <span key={tag} className="badge badge-neutral">{tag}</span>)}
                </div>
              </>
            )}
            {p.repository_url && (
              <>
                <div className="divider" />
                <a href={p.repository_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
                  <Icon name="link" size={14} /> {t('Repository')}
                </a>
              </>
            )}
          </div>

          <div className="glass-panel" style={{ padding: 'var(--space-5)' }}>
            <h2 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>{t('Files')}</h2>
            {files.length === 0 ? (
              <p className="text-caption">{t('No files uploaded on this project.')}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {files.map((f) => (
                  <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', background: 'var(--glass-bg)', textDecoration: 'none', color: 'inherit' }}>
                    <span><Icon name="file" size={14} /> {f.original_name}</span>
                    <span className="text-caption text-mono">{f.extension} · {f.size_human}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <div className="card glass-panel">
            <h2 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>{t('Student')}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <span style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--color-primary)', color: 'var(--color-on-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>
                {(p.owner_name || '?').slice(0, 1)}
              </span>
              <div>
                <p className="text-small" style={{ margin: 0, fontWeight: 600 }}>{p.owner_name || '—'}</p>
                <span className="text-caption">{p.owner_email}</span>
              </div>
            </div>
            {p.owner_department && (
              <p className="text-small" style={{ display: 'flex', justifyContent: 'space-between', margin: 'var(--space-3) 0 0' }}><span className="text-caption">{t('Department')}</span> {p.owner_department}</p>
            )}
          </div>

          {hasAiInfo && (
            <div className="card glass-panel" style={{ borderInlineStart: '3px solid var(--color-accent)' }}>
              <h2 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}><Icon name="sparkles" size={16} /> {t('AI Indicators')}</h2>
              <p className="text-caption text-muted" style={{ marginBottom: 'var(--space-3)' }}>
                {locale === 'ar' ? 'استرشادية فقط — القرار النهائي دائمًا بشري. راجعها قبل الاعتماد أو الرفض.' : 'Advisory only — the final decision is always human. Review before approving or rejecting.'}
              </p>
              {aiReadiness && (
                <p className="text-small" style={{ display: 'flex', justifyContent: 'space-between', margin: '0 0 var(--space-2)' }}>
                  <span className="text-caption">{t('Readiness score')}</span>
                  <strong>{Number(aiReadiness.overall_score).toFixed(1)}/100</strong>
                </p>
              )}
              {aiClassification && (
                <p className="text-small" style={{ display: 'flex', justifyContent: 'space-between', margin: 0 }}>
                  <span className="text-caption">{t('Predicted category')}</span>
                  <span>{aiClassification.predicted_category}{aiClassification.confidence !== null && aiClassification.confidence !== undefined ? ` · ${Math.round(aiClassification.confidence)}%` : ''}</span>
                </p>
              )}
            </div>
          )}

          <div className="card glass-panel">
            <h2 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>{t('Project Info')}</h2>
            <p className="text-small" style={{ display: 'flex', justifyContent: 'space-between', margin: '0 0 var(--space-2)' }}><span className="text-caption">{t('Category')}</span> {p.category?.[locale]}</p>
            <p className="text-small" style={{ display: 'flex', justifyContent: 'space-between', margin: 0 }}><span className="text-caption">{t('Status')}</span> <span className={`badge ${meta.cls}`}>{meta[locale]}</span></p>
          </div>
        </aside>
      </div>
    </>
  );
}
