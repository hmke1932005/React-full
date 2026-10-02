import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { ConfirmModal } from '../../components/admin/adminUi';

/**
 * Admin FAQ Management (spec section 16) — Platform Admin only.
 * Talks to the real JSON API (app/Controllers/Admin/FaqIntentController.php,
 * routes/api.php '/admin/faq-intents' group — same AuthMiddleware +
 * AdminMiddleware gate every other /admin/* API group uses). This is the
 * management surface for the Smart Predefined Answer / FAQ Resolution
 * Layer (see App\Services\Faq\FaqResolverService, which every AI Assistant
 * message is checked against before the AI API is ever called).
 *
 * Three views, matching FaqIntentController's three read endpoints:
 *  - Intents:      full CRUD over faq_intents (index/store/show/update/
 *                   destroy/setActive)
 *  - Unmatched:    faq_unmatched_log, so admins can spot recurring misses
 *                   and turn them into new intents (spec section 18) — the
 *                   "Create intent" quick action on a row pre-fills the
 *                   create form from that logged question.
 *  - Most Used:    hit_count/last_hit_at per intent, sorted by usage, so
 *                   admins can see what's actually landing.
 *
 * Roles list matches AdminAiAssistantSettings.jsx's PORTALS constant
 * (config/roles.php 'available' list) — the same set of real UIP roles,
 * reused here for the FAQ role-targeting field (spec section 9).
 */

const ROLES = [
  'student', 'university', 'admin',
  'security_admin', 'security_officer', 'data_analyst',
  'supervisor', 'academic_staff', 'faculty',
];

const CARD = { display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' };

function toLines(arr) {
  return (arr || []).join('\n');
}
function fromLines(text) {
  return text.split('\n').map((s) => s.trim()).filter(Boolean);
}

export default function AdminFaqIntents() {
  const [view, setView] = useState('intents'); // 'intents' | 'unmatched' | 'top'
  const [intents, setIntents] = useState([]);
  const [unmatched, setUnmatched] = useState([]);
  const [topMatched, setTopMatched] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // intent object, or {} for new, or null
  const [prefill, setPrefill] = useState(null); // seed data from an unmatched row
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const loadIntents = useCallback(() => {
    return api.get('/api/v1/admin/faq-intents').then((json) => setIntents(json.data || []));
  }, []);
  const loadUnmatched = useCallback(() => {
    return api.get('/api/v1/admin/faq-intents/unmatched', { limit: 100 }).then((json) => setUnmatched(json.data || []));
  }, []);
  const loadTopMatched = useCallback(() => {
    return api.get('/api/v1/admin/faq-intents/top-matched').then((json) => setTopMatched(json.data || []));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([loadIntents(), loadUnmatched(), loadTopMatched()])
      .catch((err) => { if (!cancelled) setError(errorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [loadIntents, loadUnmatched, loadTopMatched]);

  const filteredIntents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return intents;
    return intents.filter((i) => (
      i.intent_key.toLowerCase().includes(q)
      || i.category.toLowerCase().includes(q)
      || (i.question_ar || '').includes(search.trim())
      || (i.question_en || '').toLowerCase().includes(q)
    ));
  }, [intents, search]);

  async function toggleActive(intent) {
    setActionError(null);
    try {
      await api.post(`/api/v1/admin/faq-intents/${intent.id}/active`, { is_active: !intent.is_active });
      await loadIntents();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  async function confirmDelete() {
    setDeleteBusy(true);
    setActionError(null);
    try {
      await api.del(`/api/v1/admin/faq-intents/${deleting.id}`);
      await loadIntents();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setDeleteBusy(false);
      setDeleting(null);
    }
  }

  function openCreate() {
    setPrefill(null);
    setEditing({});
  }

  function createFromUnmatched(row) {
    const isAr = row.language === 'ar';
    setPrefill({
      question_ar: isAr ? row.sample_question : '',
      question_en: !isAr ? row.sample_question : '',
      role: row.role ? [row.role] : [],
      category: 'general',
    });
    setEditing({});
  }

  return (
    <>
      <div className="page-header animate-rise-in">
        <div className="page-header__title">
          <h1 className="text-h1">FAQ / Smart Answer Layer</h1>
          <p className="text-small">
            Predefined answers the AI Assistant returns instantly, before ever calling the AI API.
            {intents.length > 0 && ` ${intents.filter((i) => i.is_active).length} active of ${intents.length} intents.`}
          </p>
        </div>
        {view === 'intents' && (
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <Icon name="plus" size={16} /> New Intent
          </button>
        )}
      </div>

      {error && <p className="form-error">{error}</p>}
      {actionError && <p className="form-error">{actionError}</p>}

      <div className="adm-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={view === 'intents'} className={`adm-tab${view === 'intents' ? ' is-active' : ''}`} onClick={() => setView('intents')}>
          Intents ({intents.length})
        </button>
        <button type="button" role="tab" aria-selected={view === 'unmatched'} className={`adm-tab${view === 'unmatched' ? ' is-active' : ''}`} onClick={() => setView('unmatched')}>
          Unmatched Questions ({unmatched.length})
        </button>
        <button type="button" role="tab" aria-selected={view === 'top'} className={`adm-tab${view === 'top' ? ' is-active' : ''}`} onClick={() => setView('top')}>
          Most Used
        </button>
      </div>

      {loading ? (
        <p className="text-small">Loading…</p>
      ) : view === 'intents' ? (
        <IntentsTable
          rows={filteredIntents}
          search={search}
          setSearch={setSearch}
          onEdit={setEditing}
          onToggle={toggleActive}
          onDelete={setDeleting}
        />
      ) : view === 'unmatched' ? (
        <UnmatchedTable rows={unmatched} onCreateIntent={createFromUnmatched} />
      ) : (
        <TopMatchedTable rows={topMatched} />
      )}

      {deleting && (
        <ConfirmModal
          title="Confirm action"
          message={`Delete FAQ intent "${deleting.intent_key}"? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          busy={deleteBusy}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        />
      )}

      {editing && (
        <IntentModal
          intent={editing}
          prefill={prefill}
          onClose={() => { setEditing(null); setPrefill(null); }}
          onDone={async () => {
            setEditing(null);
            setPrefill(null);
            await loadIntents();
          }}
        />
      )}
    </>
  );
}

function IntentsTable({ rows, search, setSearch, onEdit, onToggle, onDelete }) {
  return (
    <div className="adm-panel" style={CARD}>
      <input
        className="form-input"
        type="text"
        placeholder="Search intent key, category, or question…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ maxWidth: 420 }}
      />

      {rows.length === 0 ? (
        <p className="text-small">No FAQ intents match.</p>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Intent</th>
                <th>Category</th>
                <th>Role</th>
                <th>Priority</th>
                <th>Threshold</th>
                <th>Hits</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id}>
                  <td>
                    <strong>{i.intent_key}</strong>
                    <div className="text-caption" style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {i.question_en || i.question_ar}
                    </div>
                  </td>
                  <td>{i.category}</td>
                  <td>{i.role && i.role.length ? i.role.join(', ') : <span className="text-caption">any</span>}</td>
                  <td>{i.priority}</td>
                  <td>{i.confidence_threshold}</td>
                  <td>{i.hit_count}</td>
                  <td>
                    <button
                      type="button"
                      className={`badge ${i.is_active ? 'badge-success' : 'badge-neutral'}`}
                      style={{ border: 'none', cursor: 'pointer' }}
                      onClick={() => onToggle(i)}
                      title="Click to toggle"
                    >
                      {i.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="adm-actions">
                    <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                      <button type="button" className="btn btn-ghost btn-sm" title="Edit" onClick={() => onEdit(i)}>
                        <Icon name="edit" size={14} />
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" title="Delete" onClick={() => onDelete(i)}>
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function UnmatchedTable({ rows, onCreateIntent }) {
  return (
    <div className="adm-panel">
      <p className="text-caption" style={{ marginBottom: 'var(--space-3)' }}>
        Questions the resolver could not confidently answer, most frequent first. Use these to spot recurring
        misses and turn them into new predefined intents.
      </p>
      {rows.length === 0 ? (
        <p className="text-small">No unmatched questions logged yet.</p>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Sample question</th>
                <th>Lang</th>
                <th>Role</th>
                <th>Portal</th>
                <th>Closest intent</th>
                <th>Score</th>
                <th>Times seen</th>
                <th>Last seen</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ maxWidth: 280 }}>{r.sample_question}</td>
                  <td>{r.language}</td>
                  <td>{r.role || <span className="text-caption">any</span>}</td>
                  <td>{r.portal || '—'}</td>
                  <td>{r.best_candidate_key || <span className="text-caption">none</span>}</td>
                  <td>{r.best_candidate_score ?? '—'}</td>
                  <td>{r.hit_count}</td>
                  <td className="text-caption">{r.last_seen_at}</td>
                  <td>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => onCreateIntent(r)}>
                      <Icon name="plus" size={14} /> Create Intent
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TopMatchedTable({ rows }) {
  return (
    <div className="adm-panel">
      {rows.length === 0 ? (
        <p className="text-small">No FAQ hits recorded yet.</p>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Intent</th>
                <th>Category</th>
                <th>Hits</th>
                <th>Last hit</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.intent_key}>
                  <td><strong>{r.intent_key}</strong></td>
                  <td>{r.category}</td>
                  <td>{r.hit_count}</td>
                  <td className="text-caption">{r.last_hit_at || 'never'}</td>
                  <td>
                    <span className={`badge ${r.is_active ? 'badge-success' : 'badge-neutral'}`}>
                      {r.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function IntentModal({ intent, prefill, onClose, onDone }) {
  const isNew = !intent.id;
  const seed = prefill || intent;

  const [intentKey, setIntentKey] = useState(intent.intent_key || '');
  const [category, setCategory] = useState(seed.category || 'general');
  const [role, setRole] = useState(intent.role || seed.role || []);
  const [questionAr, setQuestionAr] = useState(seed.question_ar || '');
  const [questionEn, setQuestionEn] = useState(seed.question_en || '');
  const [answerAr, setAnswerAr] = useState(intent.answer_ar || '');
  const [answerEn, setAnswerEn] = useState(intent.answer_en || '');
  const [aliasesAr, setAliasesAr] = useState(toLines(intent.aliases_ar));
  const [aliasesEn, setAliasesEn] = useState(toLines(intent.aliases_en));
  const [aliasesMixed, setAliasesMixed] = useState(toLines(intent.aliases_mixed));
  const [keywords, setKeywords] = useState(toLines(intent.keywords));
  const [priority, setPriority] = useState(intent.priority ?? 0);
  const [threshold, setThreshold] = useState(intent.confidence_threshold ?? 0.75);
  const [isActive, setIsActive] = useState(intent.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function toggleRole(r) {
    setRole((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      intent_key: intentKey.trim().toUpperCase().replace(/\s+/g, '_'),
      category: category.trim() || 'general',
      role,
      question_ar: questionAr,
      question_en: questionEn,
      answer_ar: answerAr,
      answer_en: answerEn,
      aliases_ar: fromLines(aliasesAr),
      aliases_en: fromLines(aliasesEn),
      aliases_mixed: fromLines(aliasesMixed),
      keywords: fromLines(keywords),
      priority: Number(priority),
      confidence_threshold: Number(threshold),
      is_active: isActive,
    };
    try {
      if (isNew) {
        await api.post('/api/v1/admin/faq-intents', payload);
      } else {
        await api.put(`/api/v1/admin/faq-intents/${intent.id}`, payload);
      }
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box card glass-panel" style={{ maxWidth: 720, maxHeight: '88vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-box__title text-h3">{isNew ? 'New FAQ Intent' : `Edit ${intent.intent_key}`}</h2>
        <form onSubmit={handleSubmit} style={CARD}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Intent key</label>
              <input
                className="form-input" required disabled={!isNew}
                placeholder="ADD_GRADUATION_PROJECT"
                value={intentKey}
                onChange={(e) => setIntentKey(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <input className="form-input" required value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Roles (leave empty = every role)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              {ROLES.map((r) => (
                <label key={r} className="text-small" style={{ display: 'flex', alignItems: 'center', gap: 4, border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-full)', padding: '4px 10px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={role.includes(r)} onChange={() => toggleRole(r)} />
                  {r}
                </label>
              ))}
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Question (Arabic)</label>
              <input className="form-input" dir="rtl" value={questionAr} onChange={(e) => setQuestionAr(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Question (English)</label>
              <input className="form-input" value={questionEn} onChange={(e) => setQuestionEn(e.target.value)} />
            </div>
          </div>
          <p className="text-caption" style={{ margin: 0 }}>At least one of the two questions above is required.</p>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Answer (Arabic)</label>
              <textarea className="form-input" dir="rtl" rows={4} value={answerAr} onChange={(e) => setAnswerAr(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Answer (English)</label>
              <textarea className="form-input" rows={4} value={answerEn} onChange={(e) => setAnswerEn(e.target.value)} />
            </div>
          </div>
          <p className="text-caption" style={{ margin: 0 }}>At least one of the two answers above is required.</p>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Arabic aliases (one phrasing per line)</label>
              <textarea className="form-input" dir="rtl" rows={5} value={aliasesAr} onChange={(e) => setAliasesAr(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">English aliases (one phrasing per line)</label>
              <textarea className="form-input" rows={5} value={aliasesEn} onChange={(e) => setAliasesEn(e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Mixed Arabic/English &amp; Arabizi aliases (one per line)</label>
            <textarea className="form-input" rows={3} value={aliasesMixed} onChange={(e) => setAliasesMixed(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Keywords — one per line; use word+word for a required combination (e.g. add+project)</label>
            <textarea className="form-input" rows={3} value={keywords} onChange={(e) => setKeywords(e.target.value)} />
            <p className="text-caption" style={{ margin: 'var(--space-1) 0 0' }}>
              A single-word entry never triggers a match on its own — only word+word combinations can.
            </p>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Priority (higher wins on a tie)</label>
              <input className="form-input" type="number" value={priority} onChange={(e) => setPriority(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Confidence threshold (0–1)</label>
              <input className="form-input" type="number" min="0" max="1" step="0.01" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
            </div>
          </div>

          <label className="text-small" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontWeight: 600 }}>
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active (eligible to answer chat messages)
          </label>

          {error && <p className="form-error">{error}</p>}

          <div className="modal-box__actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '…' : 'Save Intent'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
