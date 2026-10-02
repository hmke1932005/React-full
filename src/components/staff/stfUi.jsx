import { Link } from 'react-router-dom';
import Icon from '../Icon';

/**
 * Presentational pieces for the Academic Staff design (styles: styles/css/staff-portal.css,
 * scoped to .app-shell--staff). Shared panels/tables/pills come from stUi.jsx + student-portal.css.
 */

/** Breadcrumb + big title + subtitle + right-aligned actions. */
export function StaffHead({ crumbs = [], title, subtitle, eyebrow, actions }) {
  return (
    <div className="stf-head">
      <div className="stf-head__main">
        {crumbs.length > 0 && (
          <nav className="stf-crumbs" aria-label="Breadcrumb">
            {crumbs.map((c, i) => (
              <span key={i} style={{ display: 'inline-flex', gap: 6 }}>
                {i > 0 && <span aria-hidden="true">›</span>}
                {c.to ? <Link to={c.to}>{c.label}</Link> : <strong>{c.label}</strong>}
              </span>
            ))}
          </nav>
        )}
        {eyebrow && <div className="stf-eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="stf-head__actions">{actions}</div>}
    </div>
  );
}

/** KPI card — tone: '' | 'warn' | 'good' | 'bad'. */
export function StaffKpi({ value, label, icon, tone = '' }) {
  return (
    <div className="stf-kpi">
      <div>
        <div className="stf-kpi__value">{value}</div>
        <div className="stf-kpi__label">{label}</div>
      </div>
      {icon && <span className={`stf-kpi__icon${tone ? ` stf-kpi__icon--${tone}` : ''}`}><Icon name={icon} size={19} /></span>}
    </div>
  );
}

export function initialsOf(name) {
  const parts = String(name || '').replace(/^(Dr\.?|Prof\.?|د\.?)\s*/i, '').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

const AVATAR_COLORS = ['#4353FF', '#6F7CFF', '#12A37A', '#F59E0B', '#E5484D', '#5B6275'];
export function PersonAvatar({ name, size }) {
  let h = 0;
  for (const ch of String(name || '')) h = (h * 31 + ch.charCodeAt(0)) % AVATAR_COLORS.length;
  return <span className="stf-avatar" style={{ background: AVATAR_COLORS[h], ...(size ? { width: size, height: size } : {}) }}>{initialsOf(name)}</span>;
}

/** "Tomorrow · 10:00 AM" / "3 days · 09:00 AM" / "Sep 30 · 10:00 AM". */
export function whenLabel(iso, locale) {
  if (!iso) return '';
  const d = new Date(String(iso).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return String(iso);
  const ar = locale === 'ar';
  const time = d.toLocaleTimeString(ar ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const days = Math.round((startOf(d) - startOf(new Date())) / 86400000);
  let day;
  if (days === 0) day = ar ? 'اليوم' : 'Today';
  else if (days === 1) day = ar ? 'غدًا' : 'Tomorrow';
  else if (days > 1 && days < 7) day = ar ? `بعد ${days} أيام` : `${days} days`;
  else day = d.toLocaleDateString(ar ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' });
  return `${day} · ${time}`;
}
