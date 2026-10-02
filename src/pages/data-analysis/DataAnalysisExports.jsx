import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { Drawer } from '../../components/insight/charts';
import { useTranslations } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/data-analysis/exports';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Mirrors app/Views/data-analysis/exports.php, talking to the real JSON
 * API (app/Controllers/Api/DataAnalysisExportsApiController.php,
 * /api/v1/data-analysis/exports/*). Type labels are the controller's own
 * TYPE_LABELS constant (real strings, not invented).
 */

const TYPE_LABELS = {
  platform_kpis: 'Platform KPIs',
  user_growth: 'User Growth (12 months)',
  category_distribution: 'Category Distribution',
  university_leaderboard: 'University Leaderboard',
  full_platform_export: 'Everything (Projects + Universities)',
};
const STATUS_BADGE = { completed: 'badge-success', pending: 'badge-warning', failed: 'badge-danger' };

export default function DataAnalysisExports() {
  const t = useTranslations(translations);
  const [exportsRows, setExportsRows] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [allowedTypes, setAllowedTypes] = useState([]);
  const [allowedFormats, setAllowedFormats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [scheduling, setScheduling] = useState(false);
  const [selected, setSelected] = useState([]);
  const [newForm, setNewForm] = useState({ types: [], format: 'csv', email: '' });
  const [creating, setCreating] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/api/v1/data-analysis/exports')
      .then((json) => {
        setExportsRows(json.data?.exports || []);
        setSchedules(json.data?.schedules || []);
        setAllowedTypes(json.meta?.allowed_types || []);
        setAllowedFormats(json.meta?.allowed_formats || []);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function runAction(promise) {
    setActionError(null);
    try {
      await promise;
      setSelected([]);
      load();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  function toggleType(type) {
    setNewForm((f) => ({ ...f, types: f.types.includes(type) ? f.types.filter((x) => x !== type) : [...f.types, type] }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (newForm.types.length === 0) return;
    setCreating(true);
    setActionError(null);
    try {
      await api.post('/api/v1/data-analysis/exports', {
        export_type: newForm.types,
        format: newForm.format,
        recipient_email: newForm.email || null,
      });
      setNewForm({ types: [], format: 'csv', email: '' });
      setDrawerOpen(false);
      load();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  function toggleSelect(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <>
      <div className="page-header animate-rise-in">
        <div className="page-header__title">
          <h1>{t('Exports')}</h1>
          <p className="text-small">{t('Real CSV, Excel, and PDF exports of platform metrics, ready to download immediately.')}</p>
        </div>
        <div className="page-header__actions">
          <button type="button" className="btn btn-primary" onClick={() => setDrawerOpen(true)}>
            <Icon name="plus" size={16} /> {t('New / Batch Export')}
          </button>
        </div>
      </div>

      {actionError && <p style={{ color: 'var(--color-danger)' }}>{actionError}</p>}

      <div style={{ marginBottom: 'var(--space-6)' }}>
        <div className="card glass-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
            <h3 className="text-h3" style={{ margin: 0 }}>{t('Scheduled Exports')}</h3>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setScheduling(true)}>
              <Icon name="plus-circle" size={16} /> {t('Create schedule')}
            </button>
          </div>
          {schedules.length === 0 && <p className="text-caption">{t('No schedules yet.')}</p>}
          {schedules.map((s) => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <div>
                <p className="text-small" style={{ margin: 0, fontWeight: 600 }}>{TYPE_LABELS[s.export_type] || s.export_type}</p>
                <span className="text-caption">
                  {s.frequency === 'custom' ? t('every %d days').replace('%d', s.custom_interval_days) : s.frequency} · {s.recipient_email} · {Number(s.is_active) ? t('Active') : t('Paused')}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button type="button" className="btn btn-ghost btn-sm" title={t('Run now')} onClick={() => runAction(api.post(`/api/v1/data-analysis/exports/schedules/${s.id}/run-now`))}>
                  <Icon name="refresh" size={16} />
                </button>
                <button type="button" className="btn btn-ghost btn-sm" title={Number(s.is_active) ? t('Pause') : t('Resume')} onClick={() => runAction(api.post(`/api/v1/data-analysis/exports/schedules/${s.id}/toggle`))}>
                  <Icon name={Number(s.is_active) ? 'x-circle' : 'check-circle'} size={16} />
                </button>
                <button type="button" className="btn btn-ghost btn-sm" title={t('Delete')} onClick={() => { if (confirm(t('Delete this schedule?'))) runAction(api.del(`/api/v1/data-analysis/exports/schedules/${s.id}`)); }}>
                  <Icon name="trash" size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {loading && <p className="text-small">…</p>}
      {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}

      {!loading && !error && (
        <div className="card glass-panel">
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
            {selected.length > 0 && (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => { if (confirm(`${selected.length} ${t('selected export(s)?')}`)) runAction(api.post('/api/v1/data-analysis/exports/delete-selected', { ids: selected })); }}>
                <Icon name="trash" size={16} /> {t('Delete Selected')}
              </button>
            )}
            {exportsRows.length > 0 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { if (confirm(t('Delete all exports? This cannot be undone.'))) runAction(api.post('/api/v1/data-analysis/exports/delete-all')); }}>
                <Icon name="trash" size={16} /> {t('Delete All')}
              </button>
            )}
          </div>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr><th></th><th>{t('Data (select more than one for a batch export)')}</th><th>{t('Format')}</th><th>{t('Status')}</th><th>{t('Date')}</th><th></th></tr>
              </thead>
              <tbody>
                {exportsRows.map((r) => (
                  <tr key={r.id}>
                    <td><input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggleSelect(r.id)} /></td>
                    <td>
                      {TYPE_LABELS[r.export_type] || r.export_type}
                      {r.batch_id && <span className="badge badge-neutral" style={{ marginInlineStart: 'var(--space-2)' }}>{t('batch')}</span>}
                      {r.email_to && <span className="badge badge-neutral" style={{ marginInlineStart: 'var(--space-2)' }}>{t('emailed')}</span>}
                    </td>
                    <td>{String(r.format).toUpperCase()}</td>
                    <td><span className={`badge ${STATUS_BADGE[r.status] || 'badge-neutral'}`}>{r.status}</span></td>
                    <td>{r.created_at ? r.created_at.slice(0, 10) : ''}</td>
                    <td><div className="row-actions">
                      {r.status === 'completed' && r.file_path && (
                        <a className="btn btn-ghost btn-sm" href={`/${r.file_path}`} download title={t('Download')}>
                          <Icon name="download" size={16} />
                        </a>
                      )}
                      <button type="button" className="btn btn-ghost btn-sm" title={t('Delete')} onClick={() => { if (confirm(t('Delete this export?'))) runAction(api.del(`/api/v1/data-analysis/exports/${r.id}`)); }}>
                        <Icon name="trash" size={16} />
                      </button>
                    </div></td>
                  </tr>
                ))}
                {exportsRows.length === 0 && (
                  <tr><td colSpan={6} className="text-small" style={{ padding: 'var(--space-5)', textAlign: 'center' }}>{t('No exports yet.')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Drawer open={drawerOpen} title={t('New / Batch Export')} subtitle={t('Your export will be generated in the background.')} onClose={() => setDrawerOpen(false)}>
        <form onSubmit={handleCreate}>
            <div className="form-group">
              <label className="form-label">{t('Data (select more than one for a batch export)')}</label>
              {allowedTypes.map((type) => (
                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: '4px 0' }}>
                  <input type="checkbox" id={`type-${type}`} checked={newForm.types.includes(type)} onChange={() => toggleType(type)} />
                  <label htmlFor={`type-${type}`}>{TYPE_LABELS[type] || type}</label>
                </div>
              ))}
            </div>
            <div className="form-group">
              <label className="form-label">{t('Format')}</label>
              <select className="form-input" value={newForm.format} onChange={(e) => setNewForm((f) => ({ ...f, format: e.target.value }))}>
                {allowedFormats.map((f) => <option key={f} value={f}>{f.toUpperCase()}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('Email delivery (optional)')}</label>
              <input className="form-input" type="text" value={newForm.email} onChange={(e) => setNewForm((f) => ({ ...f, email: e.target.value }))} placeholder={t('One or more emails, comma-separated')} />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={creating || newForm.types.length === 0}>
              <Icon name="download" size={16} /> {creating ? '…' : t('Export Now')}
            </button>
          </form>
      </Drawer>

      {scheduling && (
        <ScheduleModal
          allowedTypes={allowedTypes}
          allowedFormats={allowedFormats}
          onClose={() => setScheduling(false)}
          onDone={(err) => { setScheduling(false); if (err) setActionError(err); else load(); }}
        />
      )}
    </>
  );
}

function ScheduleModal({ allowedTypes, allowedFormats, onClose, onDone }) {
  const t = useTranslations(translations);
  const [exportType, setExportType] = useState(allowedTypes[0] || '');
  const [frequency, setFrequency] = useState('weekly');
  const [customDays, setCustomDays] = useState(7);
  const [format, setFormat] = useState(allowedFormats[0] || 'csv');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post('/api/v1/data-analysis/exports/schedules', {
        export_type: exportType,
        frequency,
        format,
        recipient_email: email,
        custom_interval_days: frequency === 'custom' ? customDays : null,
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
        <h2 className="modal-box__title text-h3">{t('Create schedule')}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t('Data (select more than one for a batch export)')}</label>
            <select className="form-input" value={exportType} onChange={(e) => setExportType(e.target.value)}>
              {allowedTypes.map((tp) => <option key={tp} value={tp}>{TYPE_LABELS[tp] || tp}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Frequency</label>
            <select className="form-input" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          {frequency === 'custom' && (
            <div className="form-group">
              <label className="form-label">{t('Every how many days')}</label>
              <input className="form-input" type="number" min={1} max={365} value={customDays} onChange={(e) => setCustomDays(Number(e.target.value))} />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">{t('Format')}</label>
            <select className="form-input" value={format} onChange={(e) => setFormat(e.target.value)}>
              {allowedFormats.map((f) => <option key={f} value={f}>{f.toUpperCase()}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{t('One or more emails, comma-separated')}</label>
            <input className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-box__actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>{t('Cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '…' : t('Save changes')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
