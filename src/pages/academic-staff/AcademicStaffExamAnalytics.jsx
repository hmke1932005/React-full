import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { useTranslations } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nExam from '../../i18n/academic-staff/exam-system';

const translations = { ...i18nCommon, ...i18nExam };

/**
 * Round 8 (Phases 25/27) — GET /api/v1/exam-system/exams/{id}/analytics
 * (ExamAnalyticsApiController::examAnalytics -> ExamAnalyticsService::
 * examAnalytics()). One call returns both the exam-level archive numbers
 * (total/started/submitted/graded/average/median/highest/lowest/pass-rate/
 * failure-rate/average-time) and the per-question breakdown with the
 * hardest/easiest question flagged — this page just renders that payload,
 * no client-side computation of its own.
 *
 * correct_pct/incorrect_pct are null for essay/short_answer questions
 * (the backend only computes them for objective types) — shown as "—"
 * rather than 0%, since 0% would misleadingly read as "everyone got this
 * wrong" for a type where "correct/incorrect" doesn't apply at all.
 */

const CARD = { display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' };
const TYPE_LABELS = { mcq: 'Multiple Choice', true_false: 'True / False', short_answer: 'Short Answer', essay: 'Essay' };

function StatCard({ label, value }) {
  return (
    <div className="card glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <p className="text-caption" style={{ margin: 0 }}>{label}</p>
      <p className="text-h2" style={{ margin: 0 }}>{value}</p>
    </div>
  );
}

function pct(v) {
  return v === null || v === undefined ? '—' : `${v}%`;
}

function formatSeconds(s) {
  if (s === null || s === undefined) return '—';
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

export default function AcademicStaffExamAnalytics() {
  const { id } = useParams();
  const t = useTranslations(translations);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    return api.get(`/api/v1/exam-system/exams/${id}/analytics`).then((json) => setData(json.data));
  }, [id]);

  useEffect(() => {
    setLoading(true);
    load().catch((err) => setError(errorMessage(err))).finally(() => setLoading(false));
  }, [load]);

  if (loading) return <p className="text-small" style={{ padding: 'var(--space-5)' }}>{t('Loading…')}</p>;
  if (error) return <p className="form-error" style={{ padding: 'var(--space-5)' }}>{error}</p>;
  if (!data) return null;

  const questions = data.questions?.items || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <div>
        <Link to={`/academic-staff/exams/${id}/attempts`} className="text-small" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Icon name="chevron-left" size={14} /> {t('Back to Attempts & Grading')}
        </Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <h1 className="text-h2" style={{ margin: 0 }}>{t('Exam Analytics')}</h1>
        <Link to={`/academic-staff/exams/${id}/targets`} className="btn btn-outline btn-sm">
          <Icon name="filter" size={14} /> {t('Manage Targeting & Publish')}
        </Link>
      </div>

      <div className="grid-3">
        <StatCard label={t('Total Students')} value={data.total_students ?? '—'} />
        <StatCard label={t('Total Attempts')} value={data.total_attempts ?? 0} />
        <StatCard label={t('Graded')} value={data.graded_count ?? 0} />
        <StatCard label={t('Submitted')} value={data.submitted_count ?? 0} />
        <StatCard label={t('Not Submitted')} value={data.not_submitted_count ?? 0} />
        <StatCard label={t('Submission Rate')} value={pct(data.submission_rate)} />
        <StatCard label={t('Average Score')} value={pct(data.average_score)} />
        <StatCard label={t('Median Score')} value={pct(data.median_score)} />
        <StatCard label={t('Highest Score')} value={pct(data.highest_score)} />
        <StatCard label={t('Lowest Score')} value={pct(data.lowest_score)} />
        <StatCard label={t('Pass Rate')} value={pct(data.pass_rate)} />
        <StatCard label={t('Failure Rate')} value={pct(data.failure_rate)} />
        <StatCard label={t('Average Time')} value={formatSeconds(data.average_time_seconds)} />
      </div>

      <div className="card glass-panel" style={CARD}>
        <h2 className="text-h3" style={{ margin: 0 }}>{t('Question Breakdown')}</h2>

        {questions.length === 0 ? (
          <p className="text-small">{t('No answered questions yet.')}</p>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('Prompt')}</th>
                  <th>{t('Type')}</th>
                  <th>{t('Answered')}</th>
                  <th>{t('Correct %')}</th>
                  <th>{t('Incorrect %')}</th>
                  <th>{t('Average Score')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {questions.map((q) => (
                  <tr key={q.exam_question_id}>
                    <td style={{ maxWidth: 320 }}>
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.prompt}</span>
                    </td>
                    <td>{t(TYPE_LABELS[q.type] || q.type)}</td>
                    <td>{q.answered_count}</td>
                    <td>{pct(q.correct_pct)}</td>
                    <td>{pct(q.incorrect_pct)}</td>
                    <td>{pct(q.average_score_pct)}</td>
                    <td>
                      {data.questions.most_difficult_question === q.exam_question_id && (
                        <span className="badge badge-danger">{t('Hardest')}</span>
                      )}
                      {data.questions.easiest_question === q.exam_question_id && (
                        <span className="badge badge-success">{t('Easiest')}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
