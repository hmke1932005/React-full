import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { useTranslations } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nExam from '../../i18n/academic-staff/exam-system';

const translations = { ...i18nCommon, ...i18nExam };

const STATUS_META = {
  draft: { cls: 'badge-neutral', key: 'Draft' },
  scheduled: { cls: 'badge-primary', key: 'Scheduled' },
  published: { cls: 'badge-success', key: 'Published' },
  active: { cls: 'badge-success', key: 'Published' },
  closed: { cls: 'badge-neutral', key: 'Closed' },
  grading: { cls: 'badge-primary', key: 'Grading' },
  graded: { cls: 'badge-success', key: 'Graded' },
  archived: { cls: 'badge-neutral', key: 'Archived' },
};

/**
 * Generic "pick an exam, then jump straight to <suffix>" hub page.
 *
 * Added because /academic-staff/exams/:id/attempts, /targets and
 * /analytics only ever had entry points buried inside a specific exam
 * (the exam builder's own action buttons, or the per-row icons on the
 * Dashboard/Exams list). The professor asked for these three to have a
 * real, permanent place in the Sidebar itself — but the Sidebar can only
 * link to a static route, and these pages are per-exam. So each sidebar
 * item (Attempts & Grading / Targeting & Publish / Analytics) points at
 * one of these hub routes, which lists every exam and lets you pick one
 * — same "choose the exam, then go" flow the professor described.
 *
 * One component driven by props instead of three near-identical files;
 * see AcademicStaffAttemptsHub.jsx / AcademicStaffTargetsHub.jsx /
 * AcademicStaffAnalyticsHub.jsx for the thin per-route wrappers.
 */
export default function AcademicStaffExamPicker({ suffix, titleKey, descriptionKey, icon }) {
  const t = useTranslations(translations);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get('/api/v1/exam-system/exams')
      .then((json) => { if (!cancelled) setExams(json.data || []); })
      .catch((err) => { if (!cancelled) setError(errorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <p className="text-small" style={{ padding: 'var(--space-5)' }}>{t('Loading…')}</p>;
  if (error) return <p className="form-error" style={{ padding: 'var(--space-5)' }}>{error}</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <div>
        <h1 className="text-h2" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Icon name={icon} size={22} /> {t(titleKey)}
        </h1>
        <p className="text-small" style={{ margin: 'var(--space-1) 0 0' }}>{t(descriptionKey)}</p>
      </div>

      {exams.length === 0 ? (
        <div className="card glass-panel empty-state">
          <Icon name="file" size={32} className="empty-state__icon" />
          <p className="text-small">{t('No exams yet.')}</p>
          <Link to="/academic-staff/exams" className="btn btn-primary">
            <Icon name="plus" size={16} /> {t('New Exam')}
          </Link>
        </div>
      ) : (
        <div className="card glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('Title')}</th>
                  <th>{t('Status')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {exams.map((e) => {
                  const meta = STATUS_META[e.status] || STATUS_META.draft;
                  return (
                    <tr key={e.id}>
                      <td>
                        <span className="text-small" style={{ fontWeight: 600 }}>{e.title}</span>
                        {e.subject && <div className="text-caption">{e.subject}</div>}
                      </td>
                      <td><span className={`badge ${meta.cls}`}>{t(meta.key)}</span></td>
                      <td>
                        <Link to={`/academic-staff/exams/${e.id}/${suffix}`} className="btn btn-outline btn-sm">
                          <Icon name={icon} size={14} /> {t(titleKey)}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
