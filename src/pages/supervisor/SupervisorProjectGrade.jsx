import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Icon from '../../components/Icon';
import { api, errorMessage } from '../../api/client';
import { useTranslations, useLanguage } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/supervisor/project-grade';

const translations = { ...i18nCommon, ...i18nPage };

const BLANK_ROW = { criterion: '', max_score: '', score: '', comments: '' };

/**
 * Port of app/Views/supervisor/project-grade.php — same rubric-builder
 * form (add/remove criterion rows, save-as-draft vs finalize), now
 * talking to GET/POST /api/v1/supervisor/projects/{uuid}/grade
 * (SupervisorProjectGradeApiController, item 14 — Graduation) instead of
 * a server-rendered form post. Same "a final grade can still be
 * re-saved, it just reverts to draft until finalized again" rule as the
 * old view.
 */
export default function SupervisorProjectGrade() {
  const { id } = useParams();
  const t = useTranslations(translations);
  const { locale } = useLanguage();

  const [project, setProject] = useState(null);
  const [grade, setGrade] = useState(null);
  const [criteria, setCriteria] = useState([{ ...BLANK_ROW }]);
  const [overallComments, setOverallComments] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(null); // 'draft' | 'final' | null
  const [saveError, setSaveError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get(`/api/v1/supervisor/projects/${encodeURIComponent(id)}/grade`)
      .then((json) => {
        const data = json.data || {};
        setProject(data.project || null);
        setGrade(data.grade || null);
        setCriteria(data.criteria && data.criteria.length ? data.criteria : [{ ...BLANK_ROW }]);
        setOverallComments(data.grade?.overall_comments || '');
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function updateRow(index, field, value) {
    setCriteria((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function addRow() {
    setCriteria((rows) => [...rows, { ...BLANK_ROW }]);
  }

  function removeRow(index) {
    setCriteria((rows) => (rows.length > 1 ? rows.filter((_, i) => i !== index) : rows));
  }

  async function submit(finalize) {
    if (finalize && !window.confirm(t('Finalize this grade? The student will be notified of the score.'))) {
      return;
    }
    setSaving(finalize ? 'final' : 'draft');
    setSaveError(null);
    try {
      const json = await api.post(`/api/v1/supervisor/projects/${encodeURIComponent(id)}/grade`, {
        criteria,
        overall_comments: overallComments,
        finalize: finalize ? 1 : 0,
      });
      const data = json.data || {};
      setGrade(data.grade || null);
      setCriteria(data.criteria && data.criteria.length ? data.criteria : [{ ...BLANK_ROW }]);
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setSaving(null);
    }
  }

  if (loading) return <p className="text-small">{t('Loading…')}</p>;
  if (error) return <p style={{ color: 'var(--color-danger)' }}>{error}</p>;

  const isFinal = grade?.status === 'final';
  const title = project ? (locale === 'ar' ? (project.title_ar || project.title_en) : (project.title_en || project.title_ar)) : t('Grade project');

  return (
    <>
      <div className="page-header animate-rise-in">
        <div className="page-header__title">
          <h1 className="text-h1">{title}</h1>
          {project && <p className="text-small">{t('Student: ')}{project.owner_name || '—'}</p>}
        </div>
      </div>

      {isFinal && (
        <div className="card glass-panel" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <span className="badge badge-success" style={{ fontSize: 14 }}>{t('Final grade — locked in')}</span>
          <span className="text-small text-muted">
            {t('Total score: ')}
            <strong>{grade.total_score}/{grade.max_score}</strong>
            {grade.letter_grade ? ` (${grade.letter_grade})` : ''}
          </span>
          <span className="text-caption text-muted">
            {t('You can still edit and re-save — it will revert to draft until you finalize again.')}
          </span>
        </div>
      )}

      {saveError && <p style={{ color: 'var(--color-danger)' }}>{saveError}</p>}

      <div className="card glass-panel">
        <h2 className="text-h4" style={{ marginBottom: 'var(--space-3)' }}>{t('Rubric criteria')}</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
          {criteria.map((row, i) => (
            <div
              key={i}
              style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr auto', gap: 'var(--space-2)', alignItems: 'center' }}
            >
              <input
                className="form-input"
                type="text"
                placeholder={t('Criterion name — e.g. Innovation & originality')}
                value={row.criterion}
                onChange={(e) => updateRow(i, 'criterion', e.target.value)}
              />
              <input
                className="form-input"
                type="number"
                step="0.5"
                min="0.5"
                placeholder={t('Max score')}
                value={row.max_score}
                onChange={(e) => updateRow(i, 'max_score', e.target.value)}
              />
              <input
                className="form-input"
                type="number"
                step="0.5"
                min="0"
                placeholder={t('Score')}
                value={row.score ?? ''}
                onChange={(e) => updateRow(i, 'score', e.target.value)}
              />
              <input
                className="form-input"
                type="text"
                placeholder={t('Note (optional)')}
                value={row.comments || ''}
                onChange={(e) => updateRow(i, 'comments', e.target.value)}
              />
              <button type="button" className="btn btn-ghost btn-sm" disabled={criteria.length <= 1} onClick={() => removeRow(i)}>
                <Icon name="x" size={14} />
              </button>
            </div>
          ))}
        </div>

        <button type="button" className="btn btn-outline btn-sm" style={{ marginBottom: 'var(--space-4)' }} onClick={addRow}>
          <Icon name="plus" size={14} /> {t('Add criterion')}
        </button>

        <div className="form-group">
          <label className="form-label">{t('Overall comments')}</label>
          <textarea
            className="form-input"
            rows={4}
            value={overallComments}
            onChange={(e) => setOverallComments(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
          <button type="button" className="btn btn-outline" disabled={saving !== null} onClick={() => submit(false)}>
            {saving === 'draft' ? t('Loading…') : t('Save as draft')}
          </button>
          <button type="button" className="btn btn-primary" disabled={saving !== null} onClick={() => submit(true)}>
            {saving === 'final' ? t('Loading…') : t('Finalize grade')}
          </button>
        </div>
      </div>
    </>
  );
}
