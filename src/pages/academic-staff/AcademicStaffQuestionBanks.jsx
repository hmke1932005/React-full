import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { useTranslations } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nExam from '../../i18n/academic-staff/exam-system';

const translations = { ...i18nCommon, ...i18nExam };

/**
 * Round 1 (Foundation) — GET/POST /api/v1/exam-system/question-banks,
 * PATCH/DELETE .../question-banks/{id} (ExamSystemApiController::
 * indexBanks/storeBank/updateBank/destroyBank). Ownership (an instructor
 * only ever sees their own banks) is enforced entirely server-side —
 * findOwnedBank() inside the service — this page doesn't need its own
 * scoping logic.
 */

const CARD = { display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' };

function BankModal({ bank, onClose, onSaved }) {
  const t = useTranslations(translations);
  const isNew = !bank?.id;
  const [title, setTitle] = useState(bank?.title || '');
  const [subject, setSubject] = useState(bank?.subject || '');
  const [description, setDescription] = useState(bank?.description || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = { title: title.trim(), subject: subject.trim() || null, description: description.trim() || null };
    try {
      if (isNew) {
        await api.post('/api/v1/exam-system/question-banks', payload);
      } else {
        await api.patch(`/api/v1/exam-system/question-banks/${bank.id}`, payload);
      }
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box card glass-panel" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-box__title text-h3">{isNew ? t('Create Question Bank') : t('Edit Question Bank')}</h2>
        <form onSubmit={handleSubmit} style={CARD}>
          <div className="form-group">
            <label className="form-label">{t('Title')}</label>
            <input className="form-input" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('Subject')}</label>
            <input className="form-input" maxLength={150} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('Description')}</label>
            <textarea className="form-input" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="modal-box__actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>{t('Cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '…' : t('Save Bank')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AcademicStaffQuestionBanks() {
  const t = useTranslations(translations);
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [editing, setEditing] = useState(null); // bank object | {} for new | null

  const load = useCallback(() => {
    return api.get('/api/v1/exam-system/question-banks').then((json) => setBanks(json.data || []));
  }, []);

  useEffect(() => {
    setLoading(true);
    load().catch((err) => setError(errorMessage(err))).finally(() => setLoading(false));
  }, [load]);

  function handleSaved() {
    setEditing(null);
    load();
  }

  async function handleDelete(bank) {
    if (!window.confirm(t('Delete this question bank? All its questions will be permanently deleted.'))) return;
    setActionError(null);
    try {
      await api.del(`/api/v1/exam-system/question-banks/${bank.id}`);
      load();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  if (loading) return <p className="text-small" style={{ padding: 'var(--space-5)' }}>{t('Loading…')}</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <h1 className="text-h2" style={{ margin: 0 }}>{t('Question Banks')}</h1>
        <button type="button" className="btn btn-primary" onClick={() => setEditing({})}>
          <Icon name="plus" size={16} /> {t('New Bank')}
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}
      {actionError && <p className="form-error">{actionError}</p>}

      {banks.length === 0 ? (
        <div className="card glass-panel empty-state">
          <Icon name="layers" size={32} className="empty-state__icon" />
          <p className="text-small">{t('Create a bank to start adding questions.')}</p>
          <button type="button" className="btn btn-primary" onClick={() => setEditing({})}>
            <Icon name="plus" size={16} /> {t('New Bank')}
          </button>
        </div>
      ) : (
        <div className="card glass-panel" style={CARD}>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('Title')}</th>
                  <th>{t('Subject')}</th>
                  <th>{t('Question Count')}</th>
                  <th>{t('Status')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {banks.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <Link to={`/academic-staff/question-banks/${b.id}`} className="text-small" style={{ fontWeight: 600 }}>
                        {b.title}
                      </Link>
                      {b.description && (
                        <div className="text-caption" style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {b.description}
                        </div>
                      )}
                    </td>
                    <td>{b.subject || <span className="text-caption">—</span>}</td>
                    <td>{b.questions_count || 0}</td>
                    <td>
                      <span className={`badge ${b.status === 'archived' ? 'badge-neutral' : 'badge-success'}`}>
                        {b.status === 'archived' ? t('Archived') : t('Active')}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <Link to={`/academic-staff/question-banks/${b.id}`} className="btn btn-outline btn-sm">
                          {t('Open')}
                        </Link>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(b)}>
                          <Icon name="edit" size={14} />
                        </button>
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(b)}>
                          <Icon name="trash" size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && <BankModal bank={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />}
    </div>
  );
}
