import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { useTranslations } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/student/my-exams';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * GET /api/v1/exam-system/attempts/{id}/result (ExamAttemptApiController::
 * result -> ExamAttemptService::studentResult() -> ExamGradingService::
 * studentResultView()). `visible=false` means the attempt is submitted but
 * result_visibility (immediate / after_close / manual) hasn't opened yet
 * for this student — shown as a plain "not available yet" state, not an
 * error, since that's expected and temporary.
 */
export default function StudentExamResult() {
  const { id } = useParams();
  const t = useTranslations(translations);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get(`/api/v1/exam-system/attempts/${id}/result`)
      .then((json) => { if (!cancelled) setResult(json.data); })
      .catch((err) => { if (!cancelled) setError(errorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <p className="text-small" style={{ padding: 'var(--space-5)' }}>{t('Loading…')}</p>;
  if (error) return <p className="form-error" style={{ padding: 'var(--space-5)' }}>{error}</p>;
  if (!result) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', maxWidth: 720, margin: '0 auto' }}>
      <div>
        <Link to="/student/my-exams" className="text-small" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Icon name="chevron-left" size={14} /> {t('Back to My Exams')}
        </Link>
      </div>

      <h1 className="text-h2" style={{ margin: 0 }}>{t('Your Result')}</h1>

      {!result.visible ? (
        <div className="card glass-panel empty-state">
          <Icon name="clock" size={32} className="empty-state__icon" />
          <p className="text-small" style={{ margin: 0, fontWeight: 600 }}>{t('Your result is not available yet.')}</p>
          <p className="text-caption">{t('Your instructor will publish results according to this exam\'s result visibility setting.')}</p>
        </div>
      ) : (
        <>
          <div className="card glass-panel">
            <div className="grid-2">
              <div>
                <p className="text-caption" style={{ margin: 0 }}>{t('Score')}</p>
                <p className="text-h2" style={{ margin: 0 }}>{result.score ?? '—'}</p>
              </div>
              <div>
                <p className="text-caption" style={{ margin: 0 }}>{t('Percentage')}</p>
                <p className="text-h2" style={{ margin: 0 }}>{result.percentage != null ? `${result.percentage}%` : '—'}</p>
              </div>
            </div>
          </div>

          {(result.questions || []).map((q, idx) => (
            <div key={q.exam_question_id} className="card glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                <p className="text-caption" style={{ margin: 0 }}>{t('Question')} {idx + 1}</p>
                {q.is_correct === true && <span className="badge badge-success">{t('Correct')}</span>}
                {q.is_correct === false && <span className="badge badge-danger">{t('Incorrect')}</span>}
                {q.is_correct == null && <span className="badge badge-neutral">{t('Not graded yet')}</span>}
              </div>

              <p className="text-small" style={{ margin: 0, fontWeight: 600, whiteSpace: 'pre-wrap' }}>{q.prompt}</p>

              <p className="text-small" style={{ margin: 0 }}>
                <span className="text-caption">{t('Your answer')}: </span>
                {q.my_answer?.answer_text
                  ? q.my_answer.answer_text
                  : q.my_answer?.selected_option_ids?.length
                    ? (q.options || [])
                        .filter((o) => q.my_answer.selected_option_ids.includes(o.id))
                        .map((o) => o.option_text)
                        .join(', ')
                    : t('No answer submitted')}
              </p>

              {q.feedback && (
                <p className="text-caption" style={{ margin: 0 }}>
                  <strong>{t('Feedback')}:</strong> {q.feedback}
                </p>
              )}

              <p className="text-caption" style={{ margin: 0 }}>
                {t('Marks')}: {q.marks_awarded ?? '—'} {t('out of')} {q.max_marks}
              </p>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
