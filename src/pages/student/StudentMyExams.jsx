import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { useTranslations, useLanguage } from '../../context/LanguageContext';
import { usePageMeta } from '../../context/PageMetaContext';
import { Pill, EmptyState, Skeleton } from '../../components/student/stUi';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/student/my-exams';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Round 2 — GET /api/v1/exam-system/my-exams (StudentExamApiController::
 * index() -> StudentExamService::listMyExams()). Only published/scheduled
 * exams the student is eligible for (exam_targets), metadata only — no
 * question content, see StudentExamService's docblock. Starting an attempt
 * is Round 3 (exam_attempts) — not wired here yet, same "don't expose a
 * half-built feature" rule the instructor-side pages already follow.
 */

const STATUS_META = {
  scheduled: { cls: 'badge-primary', key: 'Scheduled' },
  published: { cls: 'badge-success', key: 'Published' },
};

export default function StudentMyExams() {
  const t = useTranslations(translations);
  const { locale } = useLanguage();
  usePageMeta(locale === 'ar' ? 'الامتحانات' : 'Exams', t('Exams your instructors have published for you.'));
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get('/api/v1/exam-system/my-exams')
      .then((json) => { if (!cancelled) setExams(json.data || []); })
      .catch((err) => { if (!cancelled) setError(errorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <Skeleton h={90} count={2} />;
  if (error) return <div className="st-alert st-alert--danger"><Icon name="alert-triangle" size={16} /><span>{error}</span></div>;

  return (
    <div className="st-page">
      {exams.length === 0 ? (
        <EmptyState icon="file" title={t('No exams available right now.')} />
      ) : (
        <div className="st-panel st-panel--flush st-table-wrap">
          <table className="st-table">
            <thead>
              <tr>
                <th>{t('Title')}</th>
                <th>{t('Duration')}</th>
                <th>{t('Starts')}</th>
                <th>{t('Status')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {exams.map((e) => {
                const meta = STATUS_META[e.status] || STATUS_META.published;
                return (
                  <tr key={e.id}>
                    <td>
                      <Link to={`/student/my-exams/${e.id}`} style={{ fontWeight: 600, color: 'inherit', textDecoration: 'none' }}>{e.title}</Link>
                      {e.subject && <div className="st-muted" style={{ fontSize: 12 }}>{e.subject}</div>}
                    </td>
                    <td>{e.duration_minutes} {t('minutes')}</td>
                    <td>{e.start_at ? new Date(e.start_at).toLocaleString() : t('Opens immediately')}</td>
                    <td><Pill tone={meta.cls === 'badge-success' ? 'success' : ''}>{t(meta.key)}</Pill></td>
                    <td><Link to={`/student/my-exams/${e.id}`} className="btn btn-outline btn-sm">{t('View Details')}</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
