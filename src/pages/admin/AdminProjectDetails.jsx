import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Icon from '../../components/Icon';
import useRowLookup from '../../components/admin/useRowLookup';
import { ModerateModal, STATUS_BADGE } from './AdminProjects';
import { useTranslations } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/admin/project-approval';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Moderation Project Details (/admin/projects/:id). Built from the existing project list
 * (/api/v1/admin/approvals) — no detail endpoint is assumed. The moderation panel uses the
 * existing logged, reason-required override (same ModerateModal as the list). Moderation
 * flags, severity, "Clear flag" and the quality score from the design have no data source
 * and are not shown.
 */

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '—');
const pick = (v) => (v == null ? null : typeof v === 'object' ? (v.en || v.ar || null) : String(v));

function Fact({ label, children }) {
  return <div className="adm-fact"><small>{label}</small><strong>{children ?? '—'}</strong></div>;
}

export default function AdminProjectDetails() {
  const t = useTranslations(translations);
  const { id } = useParams();
  const { row: p, loading, error, notFound, reload } = useRowLookup('/api/v1/admin/approvals', id);
  const [moderating, setModerating] = useState(false);
  const [notice, setNotice] = useState(null);

  const back = <Link to="/admin/projects" className="adm-link-back"><Icon name="chevron-left" size={14} /> Back to projects</Link>;
  if (loading && !p) return <p className="text-small">{t('Loading…')}</p>;
  if (error) return <>{back}<p className="form-error">{error}</p></>;
  if (notFound || !p) return <>{back}<p className="adm-empty">This project was not found.</p></>;

  const title = pick(p.title) || '—';
  const known = new Set(['id', 'title', 'university', 'status', 'decided']);
  // Any extra scalar field the API returns is shown; nothing is invented.
  const extras = Object.entries(p)
    .filter(([k, v]) => !known.has(k) && v != null && v !== '' && typeof v !== 'object')
    .slice(0, 8);

  return (
    <>
      {back}
      <div className="page-header animate-rise-in">
        <div className="page-header__title"><h1 className="text-h1">Moderation Project Details</h1></div>
        <div className="page-header__actions">
          <button type="button" className="btn btn-primary" onClick={() => setModerating(true)}><Icon name="shield" size={16} /> Moderate</button>
        </div>
      </div>
      {notice && <p className="adm-empty" style={{ color: 'var(--color-success)' }}>{notice}</p>}

      <div className="adm-profile">
        <span className="adm-avatar adm-avatar--lg"><Icon name="folder" size={22} /></span>
        <div>
          <h2>{title}</h2>
          <p>{pick(p.university) || '—'}</p>
          <div className="adm-profile__badges"><span className={`badge ${STATUS_BADGE[p.status] || 'badge-neutral'}`}>{cap(p.status)}</span></div>
        </div>
      </div>

      <div className="adm-grid">
        <div className="adm-panel">
          <div className="adm-panel__head"><div><h3>Project information</h3></div></div>
          <div className="adm-facts">
            <Fact label="Title (English)">{pick(p.title && { en: p.title.en })}</Fact>
            <Fact label="Title (Arabic)">{pick(p.title && { en: p.title.ar })}</Fact>
            <Fact label="University">{pick(p.university)}</Fact>
            <Fact label={t('Status')}>{cap(p.status)}</Fact>
            <Fact label="Last decision">{p.decided}</Fact>
            {extras.map(([k, v]) => <Fact key={k} label={k.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())}>{String(v)}</Fact>)}
          </div>
        </div>

        <div className="adm-panel">
          <div className="adm-panel__head"><div><h3>Moderation actions</h3><p>Every decision needs a reason and is written to the audit log.</p></div></div>
          <ul className="adm-list">
            <li className="adm-list__item"><span>Approve &amp; publish</span><span className="adm-muted">visible on the platform</span></li>
            <li className="adm-list__item"><span>Request changes</span><span className="adm-muted">back to owner as draft</span></li>
            <li className="adm-list__item"><span>Remove project</span><span className="adm-muted">rejected, not published</span></li>
          </ul>
        </div>
      </div>

      {moderating && <ModerateModal project={p} onClose={() => setModerating(false)} onDone={() => { setModerating(false); setNotice('Decision recorded and written to the audit log.'); reload(); }} />}
    </>
  );
}
