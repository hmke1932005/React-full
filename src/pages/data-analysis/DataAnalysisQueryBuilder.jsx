import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { useTranslations } from '../../context/LanguageContext';
import { useLanguage } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/data-analysis/query-builder/index';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Mirrors app/Views/data-analysis/query-builder/index.php, talking to
 * the real JSON API (app/Controllers/Api/DataAnalysisQueriesApiController.php,
 * /api/v1/data-analysis/queries/*), which wraps QueryBuilderService /
 * QueryBuilderRepository exactly as the web SqlQueryBuilderController
 * does. Table/column allow-lists, operators, and the 500-row cap all
 * come from the real catalog/spec contract — nothing invented here.
 * Read-only: SELECT only, same allow-listed Data Explorer datasets.
 *
 * Scope note: the visual builder covers table/columns/where/group
 * by/order by/limit (the common case). Multi-table JOINs and HAVING
 * are supported by the backend spec but not exposed in this first
 * pass of the visual UI — use the raw SQL editor for those until a
 * follow-up adds join/having controls.
 */

const OPERATORS = [
  { value: 'eq', label: '=' },
  { value: 'neq', label: '!=' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '>=' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '<=' },
  { value: 'contains', label: 'LIKE %..%' },
  { value: 'starts', label: 'LIKE ..%' },
  { value: 'null', label: 'IS NULL' },
  { value: 'not_null', label: 'IS NOT NULL' },
];

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DataAnalysisQueryBuilder() {
  const t = useTranslations(translations);
  const { locale } = useLanguage();
  const label = (obj) => obj?.[locale] || obj?.en || '';

  const [catalog, setCatalog] = useState({});
  const [templates, setTemplates] = useState([]);
  const [saved, setSaved] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);

  const [mode, setMode] = useState('raw'); // 'raw' | 'builder'
  const [sql, setSql] = useState('');
  const [table, setTable] = useState('');
  const [columns, setColumns] = useState([]);
  const [where, setWhere] = useState([]); // [{column, op, value}]
  const [groupBy, setGroupBy] = useState([]);
  const [orderBy, setOrderBy] = useState([]); // [{column, dir}]
  const [limit, setLimit] = useState(100);

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null); // {ok, sql, rows, columns, row_count, execution_time_ms, error}
  const [savedQueryId, setSavedQueryId] = useState(null);

  const [saveOpen, setSaveOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/api/v1/data-analysis/queries')
      .then((json) => {
        setCatalog(json.data?.catalog || {});
        setTemplates(json.data?.templates || []);
        setSaved(json.data?.saved || []);
        setHistory(json.data?.history || []);
        const firstTable = Object.values(json.data?.catalog || {})[0];
        if (firstTable) setTable((prev) => prev || firstTable.table);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const tableCols = Object.values(catalog).find((c) => c.table === table)?.columns || [];

  function toggleColumn(c) {
    setColumns((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  function addWhere() { setWhere((prev) => [...prev, { column: tableCols[0] || '', op: 'eq', value: '' }]); }
  function updateWhere(i, patch) { setWhere((prev) => prev.map((w, idx) => (idx === i ? { ...w, ...patch } : w))); }
  function removeWhere(i) { setWhere((prev) => prev.filter((_, idx) => idx !== i)); }

  function addOrderBy() { setOrderBy((prev) => [...prev, { column: tableCols[0] || '', dir: 'asc' }]); }
  function updateOrderBy(i, patch) { setOrderBy((prev) => prev.map((o, idx) => (idx === i ? { ...o, ...patch } : o))); }
  function removeOrderBy(i) { setOrderBy((prev) => prev.filter((_, idx) => idx !== i)); }

  function buildSpec() {
    return {
      table,
      columns,
      where: where.filter((w) => w.column && (w.op === 'null' || w.op === 'not_null' || w.value !== '')),
      group_by: groupBy,
      order_by: orderBy.filter((o) => o.column),
      limit: Number(limit) || 100,
    };
  }

  async function handleRun() {
    setRunning(true);
    setActionError(null);
    setResult(null);
    try {
      const payload = mode === 'builder'
        ? { mode: 'builder', spec: buildSpec(), saved_query_id: savedQueryId }
        : { mode: 'raw', sql, saved_query_id: savedQueryId };
      const json = await api.post('/api/v1/data-analysis/queries/run', payload);
      setResult(json.data);
      if (json.data?.sql) setSql(json.data.sql);
      load();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setRunning(false);
    }
  }

  async function handleExport(format) {
    setActionError(null);
    try {
      const payload = mode === 'builder'
        ? { format, mode: 'builder', spec: buildSpec() }
        : { format, mode: 'raw', sql };
      const res = await api.post('/api/v1/data-analysis/queries/export', payload);
      if (res instanceof Response) {
        const blob = await res.blob();
        downloadBlob(blob, `query_result.${format}`);
      } else {
        downloadBlob(new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' }), 'query_result.json');
      }
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  function loadSaved(q) {
    setActionError(null);
    api.get(`/api/v1/data-analysis/queries/saved/${q.id}`)
      .then((json) => {
        const data = json.data;
        setSavedQueryId(data.id);
        setSql(data.sql_text || '');
        if (data.builder_state && data.builder_state.table) {
          setMode('builder');
          const spec = data.builder_state;
          setTable(spec.table || '');
          setColumns(spec.columns || []);
          setWhere(spec.where || []);
          setGroupBy(spec.group_by || []);
          setOrderBy(spec.order_by || []);
          setLimit(spec.limit || 100);
        } else {
          setMode('raw');
        }
        setResult(null);
      })
      .catch((err) => setActionError(errorMessage(err)));
  }

  function deleteSaved(id) {
    if (!confirm(t('Delete'))) return;
    api.del(`/api/v1/data-analysis/queries/saved/${id}`)
      .then(() => load())
      .catch((err) => setActionError(errorMessage(err)));
  }

  return (
    <>
      <div className="page-header animate-rise-in">
        <div className="page-header__title">
          <h1 className="text-h1">{t('SQL Query Builder')}</h1>
          <p className="text-small">{t("Build SELECT queries visually or write raw SQL, restricted to the platform's allow-listed core datasets.")}</p>
          <p className="text-caption">{t('Read-only: SELECT statements only, against the same allow-listed Data Explorer tables, capped at 500 rows per run.')}</p>
        </div>
      </div>

      {actionError && <p style={{ color: 'var(--color-danger)' }}>{actionError}</p>}
      {loading && <p className="text-small">…</p>}
      {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}

      {!loading && !error && (
        <div className="grid-2" style={{ alignItems: 'start', gap: 'var(--space-4)' }}>
          <div>
            <div className="card glass-panel" style={{ marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                <button type="button" className={`btn btn-sm ${mode === 'raw' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setMode('raw')}>{t('SQL Editor')}</button>
                <button type="button" className={`btn btn-sm ${mode === 'builder' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setMode('builder')}>{t('Visual Builder')}</button>
              </div>

              {mode === 'raw' && (
                <div className="form-group">
                  <textarea
                    className="form-input"
                    style={{ fontFamily: 'monospace', minHeight: 160 }}
                    value={sql}
                    onChange={(e) => setSql(e.target.value)}
                    placeholder="SELECT ..."
                  />
                </div>
              )}

              {mode === 'builder' && (
                <>
                  <div className="form-group">
                    <label className="form-label">{t('Base table')}</label>
                    <select className="form-input" value={table} onChange={(e) => { setTable(e.target.value); setColumns([]); setWhere([]); setGroupBy([]); setOrderBy([]); }}>
                      {Object.values(catalog).map((c) => <option key={c.key} value={c.table}>{label(c.label)}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">{t('Columns (leave empty for all)')}</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                      {tableCols.map((c) => (
                        <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input type="checkbox" checked={columns.includes(c)} onChange={() => toggleColumn(c)} /> {c}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">{t('Where')}</label>
                    {where.map((w, i) => (
                      <div key={i} style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', flexWrap: 'wrap' }}>
                        <select className="form-input" value={w.column} onChange={(e) => updateWhere(i, { column: e.target.value })}>
                          {tableCols.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select className="form-input" value={w.op} onChange={(e) => updateWhere(i, { op: e.target.value })}>
                          {OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        {w.op !== 'null' && w.op !== 'not_null' && (
                          <input className="form-input" value={w.value} onChange={(e) => updateWhere(i, { value: e.target.value })} />
                        )}
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeWhere(i)}><Icon name="trash" size={14} /></button>
                      </div>
                    ))}
                    <button type="button" className="btn btn-outline btn-sm" onClick={addWhere}><Icon name="plus" size={14} /> {t('Add')}</button>
                  </div>

                  <div className="form-group">
                    <label className="form-label">{t('Group by')}</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                      {tableCols.map((c) => (
                        <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input type="checkbox" checked={groupBy.includes(c)} onChange={() => setGroupBy((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]))} /> {c}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">{t('Order by')}</label>
                    {orderBy.map((o, i) => (
                      <div key={i} style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                        <select className="form-input" value={o.column} onChange={(e) => updateOrderBy(i, { column: e.target.value })}>
                          {tableCols.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select className="form-input" value={o.dir} onChange={(e) => updateOrderBy(i, { dir: e.target.value })}>
                          <option value="asc">ASC</option>
                          <option value="desc">DESC</option>
                        </select>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeOrderBy(i)}><Icon name="trash" size={14} /></button>
                      </div>
                    ))}
                    <button type="button" className="btn btn-outline btn-sm" onClick={addOrderBy}><Icon name="plus" size={14} /> {t('Add')}</button>
                  </div>

                  <div className="form-group">
                    <label className="form-label">{t('Row limit')}</label>
                    <input className="form-input" type="number" min={1} max={500} value={limit} onChange={(e) => setLimit(e.target.value)} />
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-primary" disabled={running} onClick={handleRun}>
                  <Icon name="terminal" size={16} /> {running ? '…' : t('Run')}
                </button>
                <button type="button" className="btn btn-outline" onClick={() => setSaveOpen(true)}>
                  <Icon name="download" size={16} style={{ transform: 'rotate(180deg)' }} /> {t('Save Query')}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => handleExport('csv')}><Icon name="download" size={16} /> CSV</button>
                <button type="button" className="btn btn-ghost" onClick={() => handleExport('json')}><Icon name="download" size={16} /> JSON</button>
              </div>
            </div>

            <div className="card glass-panel">
              <h3 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>{t('Results')}</h3>
              {!result && <p className="text-caption">{t('Run a query to see results here.')}</p>}
              {result && !result.ok && (
                <p style={{ color: 'var(--color-danger)' }}>{t('error')}: {result.error}</p>
              )}
              {result && result.ok && (
                <>
                  <p className="text-caption">
                    {result.row_count} {t('rows')} · {result.execution_time_ms}ms
                  </p>
                  {result.sql && (
                    <details style={{ marginBottom: 'var(--space-3)' }}>
                      <summary className="text-caption">{t('Preview generated SQL')}</summary>
                      <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{result.sql}</pre>
                    </details>
                  )}
                  <div className="table-responsive">
                    <table className="data-table">
                      <thead>
                        <tr>{(result.columns || []).map((c) => <th key={c}>{c}</th>)}</tr>
                      </thead>
                      <tbody>
                        {(result.rows || []).map((row, i) => (
                          <tr key={i}>
                            {(result.columns || []).map((c) => <td key={c}>{String(row[c] ?? '')}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>

          <div>
            {templates.length > 0 && (
              <div className="card glass-panel" style={{ marginBottom: 'var(--space-4)' }}>
                <h3 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>{t('Query Templates')}</h3>
                {templates.map((tpl, i) => (
                  <div key={i} style={{ padding: 'var(--space-2) 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <p className="text-small" style={{ margin: 0, fontWeight: 600 }}>{tpl.name}</p>
                    <p className="text-caption">{tpl.description}</p>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => { setMode('raw'); setSql(tpl.sql_text); setSavedQueryId(null); }}>{t('Load into editor')}</button>
                  </div>
                ))}
              </div>
            )}

            <div className="card glass-panel" style={{ marginBottom: 'var(--space-4)' }}>
              <h3 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>{t('Saved Queries')}</h3>
              {saved.length === 0 && <p className="text-caption">{t('No saved queries yet.')}</p>}
              {saved.map((q) => (
                <div key={q.id} style={{ padding: 'var(--space-2) 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <p className="text-small" style={{ margin: 0, fontWeight: 600 }}>
                    {q.name} {Number(q.is_shared) ? <span className="badge badge-neutral">{t('shared')}</span> : null}
                  </p>
                  {q.description && <p className="text-caption">{q.description}</p>}
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => loadSaved(q)}>{t('Load into editor')}</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => deleteSaved(q.id)}><Icon name="trash" size={14} /></button>
                  </div>
                </div>
              ))}
            </div>

            <div className="card glass-panel">
              <h3 className="text-h3" style={{ marginBottom: 'var(--space-3)' }}>{t('Query History')}</h3>
              {history.length === 0 && <p className="text-caption">{t('No runs yet.')}</p>}
              {history.map((h, i) => (
                <div key={i} style={{ padding: 'var(--space-2) 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span className={`badge ${h.status === 'success' ? 'badge-success' : 'badge-danger'}`}>{h.status === 'success' ? t('success') : t('error')}</span>
                  <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, margin: '4px 0' }}>{h.sql_text}</pre>
                  <p className="text-caption">
                    {h.row_count != null ? `${h.row_count} ${t('rows')}` : ''} {h.execution_time_ms != null ? `· ${h.execution_time_ms}ms` : ''} {h.created_at ? `· ${h.created_at.slice(0, 16)}` : ''}
                  </p>
                  {h.error_message && <p className="text-caption" style={{ color: 'var(--color-danger)' }}>{h.error_message}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {saveOpen && (
        <SaveQueryModal
          sql={mode === 'builder' && result?.sql ? result.sql : sql}
          builderState={mode === 'builder' ? buildSpec() : null}
          datasetKey={Object.values(catalog).find((c) => c.table === table)?.key || null}
          onClose={() => setSaveOpen(false)}
          onDone={(err) => { setSaveOpen(false); if (err) setActionError(err); else load(); }}
        />
      )}
    </>
  );
}

function SaveQueryModal({ sql, builderState, datasetKey, onClose, onDone }) {
  const t = useTranslations(translations);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isShared, setIsShared] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post('/api/v1/data-analysis/queries/save', {
        name,
        sql,
        description: description || null,
        builder_state: builderState,
        dataset_key: datasetKey,
        is_shared: isShared,
      });
      onDone(null);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box card glass-panel" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-box__title text-h3">{t('Save Query')}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t('Name')}</label>
            <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">{t('Description (optional)')}</label>
            <textarea className="form-input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <input type="checkbox" id="q_shared" checked={isShared} onChange={(e) => setIsShared(e.target.checked)} />
            <label className="form-label" htmlFor="q_shared" style={{ margin: 0 }}>{t('Share with other data analysts')}</label>
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-box__actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>{t('Cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '…' : t('Save')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
