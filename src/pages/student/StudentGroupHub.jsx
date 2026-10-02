import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { useTranslations, useLanguage } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/student/group-hub';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Mirrors app/Views/student/group-hub.php, talking to the real JSON API
 * (GET/POST/PATCH/DELETE /api/v1/group-hub/* — App\Controllers\Api\
 * GroupHubApiController, reusing GroupCollaborationService exactly as
 * Student\StudentGroupHubController does). Four tabs — Timeline,
 * Announcements, Files, Tasks — same as the Blade view's data-tabs markup,
 * ported to React state instead of the site-wide tabs JS.
 *
 * The web view's delete forms prompt() for an optional reason; here that
 * becomes a plain window.prompt() call passed as the `reason` body field.
 */

const STATUS_LABEL = {
  todo: { en: 'To Do', ar: 'قيد الانتظار' },
  in_progress: { en: 'In Progress', ar: 'جاري التنفيذ' },
  done: { en: 'Done', ar: 'مكتملة' },
};

const TIMELINE_ICON = { announcement: 'bell', file: 'file', task: 'check', task_done: 'check' };

function timeAgo(dateStr, locale) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr.replace(' ', 'T')).getTime()) / 1000;
  const units = locale === 'ar'
    ? [[31536000, 'سنة'], [2592000, 'شهر'], [86400, 'يوم'], [3600, 'ساعة'], [60, 'دقيقة']]
    : [[31536000, 'y'], [2592000, 'mo'], [86400, 'd'], [3600, 'h'], [60, 'm']];
  if (diff < 60) return locale === 'ar' ? 'الآن' : 'just now';
  for (const [secs, label] of units) {
    if (diff >= secs) {
      const n = Math.floor(diff / secs);
      return locale === 'ar' ? `منذ ${n} ${label}` : `${n}${label} ago`;
    }
  }
  return '';
}

function promptReason(locale) {
  const question = locale === 'ar' ? 'حذف؟ (اختياري: اكتب السبب)' : 'Delete? (optional: reason)';
  return window.prompt(question, '');
}

const TABS = [
  { key: 'timeline', icon: 'clock', en: 'Timeline', ar: 'النشاط' },
  { key: 'announcements', icon: 'bell', en: 'Announcements', ar: 'الإعلانات' },
  { key: 'files', icon: 'file', en: 'Files', ar: 'الملفات' },
  { key: 'tasks', icon: 'check', en: 'Tasks', ar: 'المهام' },
];

export default function StudentGroupHub() {
  const t = useTranslations(translations);
  const { locale } = useLanguage();
  const [activeTab, setActiveTab] = useState('timeline');
  const [hub, setHub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);

  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [fileToUpload, setFileToUpload] = useState(null);
  const [fileDesc, setFileDesc] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('0');
  const [taskDue, setTaskDue] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/api/v1/group-hub')
      .then((json) => setHub(json.data))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const postAnnouncement = async (e) => {
    e.preventDefault();
    if (!annTitle.trim()) return;
    try {
      await api.post('/api/v1/group-hub/announcements', { title: annTitle, body: annBody });
      setAnnTitle(''); setAnnBody('');
      load();
    } catch (err) { setActionError(errorMessage(err)); }
  };

  const deleteAnnouncement = async (a) => {
    const reason = promptReason(locale);
    if (reason === null) return;
    try {
      await api.del(`/api/v1/group-hub/announcements/${a.id}`, { reason });
      load();
    } catch (err) { setActionError(errorMessage(err)); }
  };

  const uploadFile = async (e) => {
    e.preventDefault();
    if (!fileToUpload) return;
    const formData = new FormData();
    formData.append('file', fileToUpload);
    if (fileDesc) formData.append('description', fileDesc);
    try {
      await api.postForm('/api/v1/group-hub/files', formData);
      setFileToUpload(null); setFileDesc('');
      load();
    } catch (err) { setActionError(errorMessage(err)); }
  };

  const deleteFile = async (f) => {
    const reason = promptReason(locale);
    if (reason === null) return;
    try {
      await api.del(`/api/v1/group-hub/files/${f.id}`, { reason });
      load();
    } catch (err) { setActionError(errorMessage(err)); }
  };

  const createTask = async (e) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    try {
      await api.post('/api/v1/group-hub/tasks', {
        title: taskTitle,
        assignee_user_id: taskAssignee,
        due_date: taskDue || undefined,
      });
      setTaskTitle(''); setTaskAssignee('0'); setTaskDue('');
      load();
    } catch (err) { setActionError(errorMessage(err)); }
  };

  const setTaskStatus = async (taskItem, status) => {
    try {
      await api.patch(`/api/v1/group-hub/tasks/${taskItem.id}/status`, { status });
      load();
    } catch (err) { setActionError(errorMessage(err)); }
  };

  const deleteTask = async (taskItem) => {
    const reason = promptReason(locale);
    if (reason === null) return;
    try {
      await api.del(`/api/v1/group-hub/tasks/${taskItem.id}`, { reason });
      load();
    } catch (err) { setActionError(errorMessage(err)); }
  };

  if (loading) return <p className="text-small" style={{ padding: 'var(--space-5)' }}>{t('Loading…')}</p>;
  if (error) return <p style={{ color: 'var(--color-danger)' }}>{error}</p>;
  if (!hub) return null;

  const members = hub.members || [];
  const announcements = hub.announcements || [];
  const files = hub.files || [];
  const tasks = hub.tasks || [];
  const timeline = hub.timeline || [];

  return (
    <>
      <div className="page-header animate-rise-in">
        <div className="page-header__title">
          <h1 className="text-h1"><Icon name="users" size={24} /> {hub.group_name}</h1>
          <p className="text-small">{locale === 'ar' ? 'إعلانات، ملفات، ومهام مجموعتك في مكان واحد.' : "Your group's announcements, files, and tasks in one place."}</p>
        </div>
        <div className="page-header__actions">
          <Link to="/student/group-chat" className="btn btn-primary btn-sm"><Icon name="message" size={16} /> {t('Group Chat')}</Link>
        </div>
      </div>

      {actionError && <p style={{ color: 'var(--color-danger)' }}>{actionError}</p>}

      <div className="card glass-panel">
        <div className="tabs">
          {TABS.map((tab) => (
            <button key={tab.key} type="button" className={`tab-link${activeTab === tab.key ? ' is-active' : ''}`}
              onClick={() => setActiveTab(tab.key)}>
              <Icon name={tab.icon} size={14} /> {locale === 'ar' ? tab.ar : tab.en}
            </button>
          ))}
        </div>

        {activeTab === 'timeline' && (
          <div style={{ paddingTop: 'var(--space-5)' }}>
            {timeline.length === 0 ? (
              <p className="text-small text-muted">{t('No activity yet.')}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {timeline.map((tl, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
                    <span style={{ flexShrink: 0, width: 32, height: 32, borderRadius: '50%', background: 'var(--glass-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={TIMELINE_ICON[tl.type] || 'clock'} size={14} />
                    </span>
                    <div>
                      <p className="text-small" style={{ margin: 0 }}>
                        <strong>{tl.actor_name}</strong>{' '}
                        {tl.type === 'announcement' ? t('posted an announcement:')
                          : tl.type === 'file' ? t('uploaded a file:')
                          : tl.type === 'task_done' ? t('completed a task:')
                          : t('created a task:')}{' '}
                        {tl.title}
                      </p>
                      <span className="text-caption text-muted">{timeAgo(tl.at, locale)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'announcements' && (
          <div style={{ paddingTop: 'var(--space-5)' }}>
            <form onSubmit={postAnnouncement} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-5)', maxWidth: 600 }}>
              <input className="form-input" type="text" required maxLength={200} placeholder={t('Title')}
                value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} />
              <textarea className="form-input" rows={3} placeholder={t('Details (optional)')}
                value={annBody} onChange={(e) => setAnnBody(e.target.value)} />
              <div><button type="submit" className="btn btn-primary btn-sm"><Icon name="plus" size={14} /> {t('Post')}</button></div>
            </form>

            {announcements.length === 0 ? (
              <p className="text-small text-muted">{t('No group announcements yet.')}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {announcements.map((a) => (
                  <div key={a.id} className="card" style={{ padding: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
                    <div>
                      <h2 className="text-h4" style={{ margin: 0 }}>{a.title}</h2>
                      <span className="text-caption text-muted">{a.author_name} · {timeAgo(a.created_at, locale)}</span>
                      {a.body && <p className="text-small" style={{ marginTop: 'var(--space-2)', whiteSpace: 'pre-wrap' }}>{a.body}</p>}
                    </div>
                    <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => deleteAnnouncement(a)}>
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'files' && (
          <div style={{ paddingTop: 'var(--space-5)' }}>
            <form onSubmit={uploadFile} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
              <input className="form-input" type="file" required style={{ flex: 1, minWidth: 200 }}
                onChange={(e) => setFileToUpload(e.target.files?.[0] || null)} />
              <input className="form-input" type="text" placeholder={t('Description (optional)')} style={{ flex: 1, minWidth: 200 }}
                value={fileDesc} onChange={(e) => setFileDesc(e.target.value)} />
              <button type="submit" className="btn btn-primary btn-sm"><Icon name="upload" size={14} /> {t('Upload')}</button>
            </form>

            {files.length === 0 ? (
              <p className="text-small text-muted">{t('No shared files yet.')}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {files.map((f) => (
                  <div key={f.id} className="card" style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <a href={f.url || `/${f.file_path}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <Icon name="file" size={16} />
                      <span className="text-small">{f.original_name}</span>
                    </a>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      <span className="text-caption text-muted">{f.uploader_name} · {timeAgo(f.created_at, locale)}</span>
                      <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => deleteFile(f)}>
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'tasks' && (
          <div style={{ paddingTop: 'var(--space-5)' }}>
            <form onSubmit={createTask} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
              <input className="form-input" type="text" required maxLength={200} placeholder={t('Task title')} style={{ flex: 2, minWidth: 200 }}
                value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
              <select className="form-input" style={{ flex: 1, minWidth: 160 }} value={taskAssignee} onChange={(e) => setTaskAssignee(e.target.value)}>
                <option value="0">{t('Unassigned')}</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>{m.full_name}</option>
                ))}
              </select>
              <input className="form-input" type="date" style={{ flex: 1, minWidth: 150 }} value={taskDue} onChange={(e) => setTaskDue(e.target.value)} />
              <button type="submit" className="btn btn-primary btn-sm"><Icon name="plus" size={14} /> {t('Add')}</button>
            </form>

            {tasks.length === 0 ? (
              <p className="text-small text-muted">{t('No tasks yet.')}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {tasks.map((taskItem) => (
                  <div key={taskItem.id} className="card" style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span className="badge badge-neutral">{STATUS_LABEL[taskItem.status]?.[locale] || STATUS_LABEL[taskItem.status]?.en || taskItem.status}</span>
                        <strong className="text-small">{taskItem.title}</strong>
                      </div>
                      <span className="text-caption text-muted">
                        {taskItem.assignee_name || t('Unassigned')}
                        {taskItem.due_date ? ` · ${t('Due')} ${taskItem.due_date}` : ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                      <select className="form-input" style={{ padding: '4px 8px', fontSize: 'var(--text-caption)' }}
                        value={taskItem.status} onChange={(e) => setTaskStatus(taskItem, e.target.value)}>
                        {Object.entries(STATUS_LABEL).map(([key, label]) => (
                          <option key={key} value={key}>{label[locale] || label.en}</option>
                        ))}
                      </select>
                      <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => deleteTask(taskItem)}>
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
