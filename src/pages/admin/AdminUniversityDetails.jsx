import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { Avatar, ConfirmModal } from '../../components/admin/adminUi';
import useRowLookup from '../../components/admin/useRowLookup';
import { ReverificationModal, StatusPill } from './AdminUniversities';
import { useTranslations } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/admin/university-verification';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * University Details / Verification Request Details (/admin/universities/:id).
 * An institution's verification request IS its university record, so one page serves both
 * the Institutions list and the Verification & Approvals queue (?from=approvals changes
 * only the back link). Data comes from the existing list endpoint (no detail endpoint is
 * assumed); actions are the existing verify / reject / reverification / delete calls.
 * Documents, risk score, flags and "request more information" from the design have no
 * data or endpoint and are not shown.
 */

const fmt = (v) => (v ? String(v).slice(0, 10) : null);

function Fact({ label, children }) {
  return <div className="adm-fact"><small>{label}</small><strong>{children ?? '—'}</strong></div>;
}

export default function AdminUniversityDetails() {
  const t = useTranslations(translations);
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const fromApprovals = location.state?.from === 'approvals';
  const backTo = fromApprovals ? '/admin/approvals' : '/admin/universities';
  const backLabel = fromApprovals ? 'Back to verification & approvals' : 'Back to institutions';

  const { row: u, loading, error, notFound, reload } = useRowLookup('/api/v1/admin/universities', id);
  const [confirm, setConfirm] = useState(null);
  const [reverify, setReverify] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  const back = <Link to={backTo} className="adm-link-back"><Icon name="chevron-left" size={14} /> {backLabel}</Link>;
  if (loading && !u) return <p className="text-small">{t('Loading…')}</p>;
  if (error) return <>{back}<p className="form-error">{error}</p></>;
  if (notFound || !u) return <>{back}<p className="adm-empty">This institution was not found (it may have been deleted).</p></>;

  const name = u.official_name_en || u.official_name_ar || '—';
  const pending = u.verification_status === 'pending';

  const CONFIRM = {
    verify: { title: 'Verify institution', message: `Mark ${name} as a verified institution?`, label: t('Verify') },
    reject: { title: 'Reject institution', message: `Reject the verification request from ${name}?`, label: t('Reject'), danger: true },
    delete: { title: 'Delete institution', message: `Delete ${name}? This also bans its linked account.`, label: t('Delete'), danger: true },
  };
  const cfg = confirm ? CONFIRM[confirm] : null;

  async function runConfirmed() {
    setBusy(true);
    setActionError(null);
    try {
      if (confirm === 'delete') {
        await api.del(`/api/v1/admin/universities/${u.id}`);
        navigate(backTo);
        return;
      }
      await api.post(`/api/v1/admin/universities/${u.id}/${confirm}`);
      setConfirm(null);
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  }

  // Only the dates the API actually returns are listed in the timeline.
  const timeline = [
    { label: 'Request submitted', date: fmt(u.created_at) },
    { label: u.verification_status === 'rejected' ? 'Request rejected' : 'Institution verified', date: fmt(u.verified_at || u.reviewed_at || u.decided_at) },
    { label: 'Last re-verification', date: fmt(u.last_verified_at) },
  ].filter((x) => x.date);

  return (
    <>
      {back}
      <div className="page-header animate-rise-in">
        <div className="page-header__title"><h1 className="text-h1">{fromApprovals ? 'Verification Request Details' : 'University Details'}</h1></div>
        <div className="page-header__actions">
          <button type="button" className="btn btn-outline" onClick={() => setReverify(true)}><Icon name="refresh" size={16} /> Re-verification</button>
          {pending && (
            <>
              <button type="button" className="btn btn-outline adm-btn-danger" onClick={() => setConfirm('reject')}><Icon name="x-circle" size={16} /> {t('Reject')}</button>
              <button type="button" className="btn btn-primary" onClick={() => setConfirm('verify')}><Icon name="check-circle" size={16} /> {t('Verify')}</button>
            </>
          )}
        </div>
      </div>
      {actionError && <p className="form-error">{actionError}</p>}

      <div className="adm-profile">
        <Avatar name={name} large />
        <div>
          <h2>{name}</h2>
          {u.official_name_ar && u.official_name_en && <p>{u.official_name_ar}</p>}
          <div className="adm-profile__badges"><StatusPill status={u.verification_status} /></div>
        </div>
      </div>

      <div className="adm-kpis">
        <div className="adm-kpi"><div className="adm-kpi__top">Students <Icon name="users" size={16} /></div><div className="adm-kpi__value">{(u.students_count ?? 0).toLocaleString()}</div></div>
        <div className="adm-kpi"><div className="adm-kpi__top">Projects <Icon name="folder" size={16} /></div><div className="adm-kpi__value">{(u.projects_count ?? 0).toLocaleString()}</div></div>
      </div>

      <div className="adm-grid">
        <div className="adm-panel">
          <div className="adm-panel__head"><div><h3>{fromApprovals ? 'Requester information' : 'Institution information'}</h3></div></div>
          <div className="adm-facts">
            <Fact label="Name (English)">{u.official_name_en}</Fact>
            <Fact label="Name (Arabic)">{u.official_name_ar}</Fact>
            <Fact label="Location">{[u.city, u.country].filter(Boolean).join(', ') || null}</Fact>
            <Fact label="Submitted">{fmt(u.created_at)}</Fact>
            <Fact label="Re-verification period">{u.verification_period_days ? `${u.verification_period_days} days` : 'Platform default'}</Fact>
            <Fact label="Auto re-verify">{Number(u.auto_reverify_enabled) ? 'On' : 'Off'}</Fact>
          </div>
        </div>

        <div className="adm-panel">
          <div className="adm-panel__head"><div><h3>Verification history</h3></div></div>
          {timeline.length === 0 ? <p className="adm-empty">No history recorded.</p> : (
            <ul className="adm-list">
              {timeline.map((x) => (
                <li key={x.label} className="adm-list__item"><span>{x.label}</span><span className="adm-muted">{x.date}</span></li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="adm-panel adm-danger">
        <div className="adm-panel__head">
          <div><h3>Danger zone</h3><p>Deleting an institution also bans its linked account.</p></div>
          <button type="button" className="btn btn-outline btn-sm adm-btn-danger" onClick={() => setConfirm('delete')}><Icon name="trash" size={14} /> {t('Delete')}</button>
        </div>
      </div>

      {reverify && <ReverificationModal university={u} onClose={() => setReverify(false)} onSaved={() => { setReverify(false); reload(); }} />}
      {cfg && <ConfirmModal title={cfg.title} message={cfg.message} confirmLabel={cfg.label} danger={cfg.danger} busy={busy} onConfirm={runConfirmed} onClose={() => setConfirm(null)} />}
    </>
  );
}
