import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { useLanguage } from '../../context/LanguageContext';
import { Skeleton } from '../../components/student/stUi';
import {
  AttemptPill, Note, PhasePill, examPhase, examTypeLabel, fmtDateTime, fmtNum,
} from '../../components/exam/examUi';

/**
 * Student exam detail: GET my-exams/{id} (metadata only) + GET my-exams/{id}/attempts.
 * Question content is never fetched here — it only exists once an attempt starts.
 */

const VISIBILITY = {
  immediate: { en: 'Immediately after submission', ar: 'فور التسليم' },
  after_close: { en: 'After the exam closes', ar: 'بعد إغلاق الامتحان' },
  manual: { en: 'When your instructor publishes them', ar: 'عندما ينشرها أستاذك' },
};

export default function StudentExamDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { locale } = useLanguage();
  const ar = locale === 'ar';

  const [exam, setExam] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(false);

  const loadAttempts = useCallback(() => api.get(`/api/v1/exam-system/my-exams/${id}/attempts`).then((j) => setAttempts(j.data || [])), [id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.get(`/api/v1/exam-system/my-exams/${id}`).then((j) => { if (!cancelled) setExam(j.data); }),
      loadAttempts().catch(() => {}),
    ]).catch((err) => { if (!cancelled) setError(errorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, loadAttempts]);

  const handleStart = () => {
    if (!window.confirm(ar ? 'بدء الامتحان الآن؟ يبدأ العدّاد فورًا ولا يمكن إيقافه.' : 'Start this exam now? The timer starts immediately and cannot be paused.')) return;
    setStarting(true);
    api.post(`/api/v1/exam-system/my-exams/${id}/attempts`)
      .then((j) => navigate(`/student/exam-attempt/${j.data.id}`))
      .catch((err) => { setError(errorMessage(err)); setStarting(false); });
  };

  if (loading) return <div className="ex-page"><Skeleton h={100} count={3} /></div>;
  if (!exam) return <div className="st-alert st-alert--danger"><Icon name="alert-triangle" size={16} /><span>{error || (ar ? 'الامتحان غير موجود.' : 'Exam not found.')}</span></div>;

  const phase = examPhase(exam);
  const inProgress = attempts.find((a) => a.status === 'in_progress');
  const maxedOut = exam.max_attempts != null && attempts.length >= exam.max_attempts && !inProgress;
  const notOpen = phase === 'scheduled';
  const closed = phase === 'completed';
  const canStart = !inProgress && !maxedOut && !notOpen && !closed;

  const info = [
    [ar ? 'المقرر' : 'Course', exam.subject || '—'],
    [ar ? 'النوع' : 'Type', examTypeLabel(exam.exam_type, ar)],
    [ar ? 'المدة' : 'Duration', `${exam.duration_minutes} ${ar ? 'دقيقة' : 'minutes'}`],
    [ar ? 'عدد الأسئلة' : 'Questions', exam.question_count],
    [ar ? 'الدرجة الكلية' : 'Total points', fmtNum(exam.total_marks)],
    [ar ? 'درجة النجاح' : 'Passing score', exam.passing_score != null ? fmtNum(exam.passing_score) : (ar ? 'غير محددة' : 'Not set')],
    [ar ? 'يفتح' : 'Opens', exam.start_at ? fmtDateTime(exam.start_at, ar) : (ar ? 'فورًا' : 'Immediately')],
    [ar ? 'يغلق' : 'Closes', exam.end_at ? fmtDateTime(exam.end_at, ar) : (ar ? 'بلا موعد' : 'No end date')],
    [ar ? 'المحاولات' : 'Attempts', `${attempts.length}/${exam.max_attempts ?? '∞'}`],
  ];
  const vis = VISIBILITY[exam.result_visibility];

  return (
    <div className="ex-page">
      <div>
        <Link to="/student/my-exams" className="ex-back"><Icon name="chevron-left" size={14} className="icon-flip" /> {ar ? 'العودة إلى الامتحانات' : 'Back to Exams'}</Link>
        <div className="ex-detail-head">
          <div>
            <div className="ex-detail-head__eyebrow"><PhasePill phase={phase} ar={ar} /></div>
            <h1>{exam.title}</h1>
            {exam.description && <p className="ex-detail-head__meta">{exam.description}</p>}
          </div>
          <div className="ex-detail-head__actions">
            {inProgress ? (
              <button type="button" className="btn btn-primary" onClick={() => navigate(`/student/exam-attempt/${inProgress.id}`)}>{ar ? 'متابعة المحاولة' : 'Resume Attempt'}</button>
            ) : canStart ? (
              <button type="button" className="btn btn-primary" disabled={starting} onClick={handleStart}>{starting ? '…' : (ar ? 'ابدأ الامتحان' : 'Start Exam')}</button>
            ) : null}
          </div>
        </div>
      </div>

      {error && <div className="st-alert st-alert--danger"><Icon name="alert-triangle" size={16} /><span>{error}</span></div>}
      {notOpen && <Note tone="warn" icon="clock">{ar ? 'هذا الامتحان لم يفتح بعد. ستتمكن من بدئه في الموعد المحدد.' : 'This exam has not opened yet. You will be able to start it at the scheduled time.'}</Note>}
      {closed && attempts.length === 0 && <Note tone="bad" icon="alert-triangle">{ar ? 'أُغلق هذا الامتحان ولا توجد لديك محاولة.' : 'This exam is closed and you have no attempt.'}</Note>}
      {maxedOut && <Note icon="info">{ar ? 'استنفدت الحد الأقصى من المحاولات.' : 'You have used the maximum number of attempts.'}</Note>}

      <div className="ex-card">
        <div className="ex-card__head"><div><h3 className="ex-card__title">{ar ? 'معلومات الامتحان' : 'Exam information'}</h3></div></div>
        <dl className="ex-info-grid">
          {info.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>
      </div>

      <div className="ex-two-col">
        <div className="ex-card">
          <div className="ex-card__head"><div><h3 className="ex-card__title">{ar ? 'التعليمات' : 'Instructions'}</h3></div></div>
          <div style={{ padding: '12px 20px 20px' }}>
            <p style={{ margin: '0 0 12px', whiteSpace: 'pre-wrap', fontSize: 13.5, lineHeight: 1.6 }}>{exam.instructions || (ar ? 'لا توجد تعليمات إضافية.' : 'No additional instructions.')}</p>
            <ul className="ex-check" style={{ color: 'var(--text-secondary)' }}>
              <li style={{ color: 'inherit' }}><Icon name="clock" size={15} />{ar ? 'يبدأ العدّاد فور بدء المحاولة ولا يمكن إيقافه.' : 'The timer starts when you begin and cannot be paused.'}</li>
              <li style={{ color: 'inherit' }}><Icon name="arrow-left" size={15} className="icon-flip" />{exam.allow_back_navigation ? (ar ? 'يمكنك الرجوع إلى الأسئلة السابقة.' : 'You can go back to previous questions.') : (ar ? 'لا يمكن الرجوع إلى سؤال سابق بعد تجاوزه.' : 'You cannot return to a question once you move on.')}</li>
              <li style={{ color: 'inherit' }}><Icon name="check-circle" size={15} />{exam.auto_submit_on_timeout ? (ar ? 'يُسلَّم الامتحان تلقائيًا عند انتهاء الوقت.' : 'The exam is submitted automatically when time runs out.') : (ar ? 'سيُغلق الامتحان عند انتهاء الوقت.' : 'The exam closes when time runs out.')}</li>
              {vis && <li style={{ color: 'inherit' }}><Icon name="eye" size={15} />{ar ? 'تظهر النتيجة: ' : 'Results appear: '}{ar ? vis.ar : vis.en}</li>}
              {exam.secure_mode_enabled && <li style={{ color: 'inherit' }}><Icon name="shield" size={15} />{ar ? 'وضع آمن: يُراقَب ملء الشاشة وتبديل التبويبات.' : 'Secure mode: fullscreen and tab switching are monitored.'}</li>}
            </ul>
          </div>
        </div>

        <div className="ex-card">
          <div className="ex-card__head"><div><h3 className="ex-card__title">{ar ? 'محاولاتك' : 'Your attempts'}</h3></div></div>
          {attempts.length === 0 ? (
            <p className="ex-card__sub" style={{ padding: '12px 20px 20px' }}>{ar ? 'لا توجد محاولات بعد.' : 'No attempts yet.'}</p>
          ) : (
            <div style={{ padding: '8px 20px 16px' }}>
              {attempts.map((a, idx) => (
                <div key={a.id} className="ex-toggle" style={{ borderTop: idx ? '1px solid var(--border-subtle)' : 0 }}>
                  <span>{ar ? 'المحاولة' : 'Attempt'} {attempts.length - idx}</span>
                  <span className="ex-inline" style={{ gap: 10 }}>
                    <AttemptPill status={a.status} ar={ar} />
                    {a.status === 'in_progress'
                      ? <Link className="ex-link" to={`/student/exam-attempt/${a.id}`}>{ar ? 'متابعة' : 'Resume'}</Link>
                      : <Link className="ex-link" to={`/student/exam-attempt/${a.id}/result`}>{ar ? 'النتيجة' : 'Result'}</Link>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
