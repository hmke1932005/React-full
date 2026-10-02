import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { useTranslations, useLanguage } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/student/contacts';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Mirrors app/Views/student/contacts.php, talking to GET /api/v1/contacts
 * (App\Controllers\Api\ContactsApiController::index(), reusing exactly the
 * same repository calls as Student\StudentInstitutionalContactsController::
 * index() — StudentRepository::fullHierarchyForUser(),
 * StaffAssignmentRepository::currentHolderByRankName(),
 * SupervisorAssignmentRepository::supervisorsForStudent(),
 * StudentGroupRepository::members()).
 *
 * The Blade view's one-click "Message" links go to
 * /student/messages/new?recipient_email=...&recipient_name=... — the React
 * Messages.jsx client has no matching deep-link/compose-prefill route, so
 * here "Message" prompts for the message body (same window.prompt()
 * pattern StudentGroupHub.jsx already uses for delete reasons) and starts
 * the conversation directly via POST /api/v1/messaging/conversations/direct
 * (MessagingController::startDirect, same endpoint createDirect() in
 * Messages.jsx calls), then hands off to /student/messages.
 */
export default function StudentContacts() {
  const t = useTranslations(translations);
  const { locale } = useLanguage();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/api/v1/contacts')
      .then((json) => setData(json.data))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const messageContact = async (email, name) => {
    if (!email) return;
    const body = window.prompt(
      locale === 'ar' ? `اكتب رسالتك إلى ${name}` : `Message to ${name}`,
      ''
    );
    if (!body || !body.trim()) return;
    try {
      await api.post('/api/v1/messaging/conversations/direct', { recipient_email: email, body: body.trim() });
      navigate('/student/messages');
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  if (loading) return <p className="text-small" style={{ padding: 'var(--space-5)' }}>{t('Loading…')}</p>;
  if (error) return <p style={{ color: 'var(--color-danger)' }}>{error}</p>;
  if (!data) return null;

  const { hierarchy, university, faculty, department_head: departmentHead, supervisors = [], group_members: groupMembers = [] } = data;

  const nameFor = (obj, enKey, arKey) => (locale === 'ar' ? obj?.[arKey] : obj?.[enKey]) || '—';

  return (
    <>
      <div className="page-header animate-rise-in">
        <div className="page-header__title">
          <h1 className="text-h1"><Icon name="building" size={24} /> {t('My Contacts')}</h1>
          <p className="text-small">{t('Your university, faculty, department, supervisors, and group members — all in one place.')}</p>
        </div>
      </div>

      {actionError && <p style={{ color: 'var(--color-danger)' }}>{actionError}</p>}

      {!hierarchy ? (
        <div className="card glass-panel" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
          <p className="text-small text-muted">{t('No institutional data is linked to your account yet.')}</p>
        </div>
      ) : (
        <>
          <div className="card glass-panel" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-5)' }}>
            <h2 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>{t('Institutional Chain')}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)' }}>
              <div>
                <div className="text-small text-muted">{t('University')}</div>
                <div className="text-body">{nameFor(hierarchy, 'university_name_en', 'university_name_ar')}</div>
              </div>
              <div>
                <div className="text-small text-muted">{t('Faculty')}</div>
                <div className="text-body">{nameFor(hierarchy, 'faculty_name_en', 'faculty_name_ar')}</div>
              </div>
              <div>
                <div className="text-small text-muted">{t('Department')}</div>
                <div className="text-body">{nameFor(hierarchy, 'department_name_en', 'department_name_ar')}</div>
              </div>
              <div>
                <div className="text-small text-muted">{t('Program')}</div>
                <div className="text-body">{nameFor(hierarchy, 'program_name_en', 'program_name_ar')}</div>
              </div>
              <div>
                <div className="text-small text-muted">{t('Academic Year')}</div>
                <div className="text-body">{hierarchy.academic_year ?? '—'}</div>
              </div>
              <div>
                <div className="text-small text-muted">{t('Semester')}</div>
                <div className="text-body">{hierarchy.current_semester ?? '—'}</div>
              </div>
              <div>
                <div className="text-small text-muted">{t('Group')}</div>
                <div className="text-body">{hierarchy.group_name || '—'}</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-5)', marginBottom: 'var(--space-5)' }}>
            <div className="card glass-panel">
              <h2 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}><Icon name="building" size={18} /> {t('University')}</h2>
              {university ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                  <div>
                    <strong>{locale === 'ar' ? university.name_ar : university.name_en}</strong>
                    <p className="text-small text-muted">{university.email}</p>
                  </div>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => messageContact(university.email, university.name_en)}>
                    <Icon name="message" size={14} /> {t('Message')}
                  </button>
                </div>
              ) : (
                <p className="text-small text-muted">{t('No linked university account.')}</p>
              )}
            </div>

            <div className="card glass-panel">
              <h2 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}><Icon name="building" size={18} /> {t('Faculty')}</h2>
              {faculty ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                  <div>
                    <strong>{locale === 'ar' ? faculty.name_ar : faculty.name_en}</strong>
                    <p className="text-small text-muted">{faculty.email}</p>
                  </div>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => messageContact(faculty.email, faculty.name_en)}>
                    <Icon name="message" size={14} /> {t('Message')}
                  </button>
                </div>
              ) : (
                <p className="text-small text-muted">{t('No linked faculty account.')}</p>
              )}
            </div>

            <div className="card glass-panel">
              <h2 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}><Icon name="user" size={18} /> {t('Head of Department')}</h2>
              {departmentHead ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                  <div>
                    <strong>{departmentHead.full_name}</strong>
                    <p className="text-small text-muted">{departmentHead.email}</p>
                  </div>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => messageContact(departmentHead.email, departmentHead.full_name)}>
                    <Icon name="message" size={14} /> {t('Message')}
                  </button>
                </div>
              ) : (
                <p className="text-small text-muted">{t('No Head of Department currently assigned.')}</p>
              )}
            </div>

            <div className="card glass-panel">
              <h2 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}><Icon name="user" size={18} /> {t('Supervisors')}</h2>
              {supervisors.length === 0 ? (
                <p className="text-small text-muted">{t('No supervisor currently assigned to you.')}</p>
              ) : (
                <div>
                  {supervisors.map((sup) => (
                    <div key={sup.id || sup.email} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--border-subtle)' }}>
                      <div>
                        <strong>{sup.full_name}</strong>
                        <p className="text-small text-muted">{sup.email}</p>
                      </div>
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => messageContact(sup.email, sup.full_name)}>
                        <Icon name="message" size={14} /> {t('Message')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card glass-panel">
            <h2 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}><Icon name="users" size={18} /> {t('My Group Members')}</h2>
            {!hierarchy.group_id ? (
              <p className="text-small text-muted">{locale === 'ar' ? 'لست عضوًا في مجموعة مشروع بعد.' : "You're not part of a project group yet."}</p>
            ) : groupMembers.length === 0 ? (
              <p className="text-small text-muted">{t('No other members in your group yet.')}</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-3)' }}>
                {groupMembers.map((m) => (
                  <div key={m.user_id || m.email} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', padding: 'var(--space-3)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
                    <div>
                      <strong>{m.full_name || ''}</strong>
                      {m.email && <p className="text-small text-muted">{m.email}</p>}
                    </div>
                    {m.email && (
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => messageContact(m.email, m.full_name || '')}>
                        <Icon name="message" size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="text-small text-muted" style={{ marginTop: 'var(--space-4)' }}>
              {t('Want to message a student outside your group?')}
            </p>
          </div>
        </>
      )}
    </>
  );
}
