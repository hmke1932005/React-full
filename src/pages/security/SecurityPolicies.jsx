import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { useTranslations, useLanguage } from '../../context/LanguageContext';
import { PageHead, Modal, EmptyState, ErrorNote, fmtDateTime } from '../../components/security/ui';
import i18nCommon from '../../i18n/common';
import i18nSecurity from '../../i18n/security/common';
import i18nPage from '../../i18n/security/policies';
import i18nDesign from '../../i18n/security/design';

const translations = {
  ...i18nCommon, ...i18nSecurity, ...i18nPage, ...i18nDesign,
  'Password rules, session timeouts, and lockout thresholds.': 'قواعد كلمات المرور ومهلة الجلسات وحدود القفل.',
  'Unsaved changes': 'تغييرات غير محفوظة', 'Discard': 'تجاهل', 'Confirm high-impact change': 'تأكيد تغيير عالي التأثير',
  'This policy applies platform-wide and affects every signed-in user. Are you sure you want to save it?': 'هذه السياسة تُطبَّق على المنصة كلها وتؤثر على كل المستخدمين. هل أنت متأكد من حفظها؟',
  'Confirm': 'تأكيد', 'Unlock account': 'فك قفل الحساب', 'The user will be able to sign in again immediately.': 'سيتمكن المستخدم من تسجيل الدخول مجددًا فورًا.',
  'Authentication': 'المصادقة', 'Sessions': 'الجلسات', 'Network access': 'الوصول للشبكة', 'Limits & uploads': 'الحدود والرفع', 'Advanced': 'متقدمة',
  'Saved.': 'تم الحفظ.', 'On': 'مفعّل', 'Off': 'معطّل',
};

/**
 * Security Policies — /api/v1/security/policies/* (SecurityPoliciesApiController).
 * Same endpoints and payloads as before; the redesign groups the panels into
 * sections (sub-nav), adds an unsaved-changes bar with Discard, a confirm step
 * for high-impact policies, and replaces window.confirm with a dialog.
 * `can_edit` (security_admin/admin) still gates every write.
 */

const BASE = '/api/v1/security/policies';

const SECTIONS = [
  { key: 'auth', icon: 'key', en: 'Authentication', ar: 'المصادقة' },
  { key: 'session', icon: 'clock', en: 'Sessions', ar: 'الجلسات' },
  { key: 'network', icon: 'globe', en: 'Network access', ar: 'الوصول للشبكة' },
  { key: 'limits', icon: 'trend', en: 'Limits & uploads', ar: 'الحدود والرفع' },
  { key: 'advanced', icon: 'settings', en: 'Advanced', ar: 'متقدمة' },
];
const CATEGORY_ICON = { authentication: 'key', session: 'clock', access_control: 'shield', monitoring: 'eye' };
const CATEGORY_LABEL = {
  authentication: { en: 'Authentication', ar: 'المصادقة' },
  session: { en: 'Session', ar: 'الجلسات' },
  access_control: { en: 'Access Control', ar: 'التحكم بالوصول' },
  monitoring: { en: 'Monitoring', ar: 'المراقبة' },
};
const MFA_ROLE_LABELS = {
  student: { en: 'Student', ar: 'طالب' },
  admin: { en: 'Administrator', ar: 'مسؤول النظام' },
  security_admin: { en: 'Security Administrator', ar: 'مسؤول الأمان' },
  security_officer: { en: 'Security Officer', ar: 'ضابط أمان' },
  data_analyst: { en: 'Data Analyst', ar: 'محلل بيانات' },
};
const DEVICE_TYPE_LABELS = {
  desktop: { en: 'Desktop', ar: 'كمبيوتر مكتبي' },
  mobile: { en: 'Mobile', ar: 'هاتف محمول' },
  tablet: { en: 'Tablet', ar: 'جهاز لوحي' },
  unknown: { en: 'Unknown/Other', ar: 'غير معروف/آخر' },
};

/** Lets a panel ask its host to remount it (= discard local edits). */
const PanelCtx = createContext({ discard: () => {}, notify: () => {} });

function PanelHost({ notify, children }) {
  const [gen, setGen] = useState(0);
  const value = useRef({ discard: () => setGen((g) => g + 1), notify });
  value.current.notify = notify;
  return <PanelCtx.Provider value={value.current}><div key={gen}>{children}</div></PanelCtx.Provider>;
}

function Field({ children, style }) {
  return <div className="sec-field" style={style}>{children}</div>;
}

function Checkbox({ id, checked, onChange, label, disabled }) {
  return (
    <div className="sec-switch-row">
      <label htmlFor={id}>{label}</label>
      <span className="switch">
        <input type="checkbox" id={id} checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
        <span className="switch__track" />
      </span>
    </div>
  );
}

function PolicyCard({ icon, title, description, onSubmit, canEdit, saveLabel, saving, error, highImpact, t, children }) {
  const ctx = useContext(PanelCtx);
  const [dirty, setDirty] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const wasSaving = useRef(false);

  // saving true → false with no error means the PATCH succeeded.
  useEffect(() => {
    if (wasSaving.current && !saving && !error) { setDirty(false); ctx.notify(t('Saved.')); }
    wasSaving.current = saving;
  }, [saving, error]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = (e) => {
    e.preventDefault();
    if (!canEdit) return;
    if (highImpact) { setConfirming(e); return; }
    onSubmit(e);
  };

  return (
    <section className="sec-card" style={{ marginBottom: 16 }}>
      <div className="sec-card__head">
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name={icon} size={17} /> {title}</h2>
          {description && <p style={{ maxWidth: '70ch' }}>{description}</p>}
        </div>
      </div>
      <form onSubmit={submit} onChange={() => canEdit && setDirty(true)}>
        <div className="sec-card__body">
          {children}
          <ErrorNote>{error}</ErrorNote>
        </div>
        {canEdit && (
          <div className="sec-savebar">
            <span className="grow">{dirty && <span className="sec-unsaved"><Icon name="alert" size={14} /> {t('Unsaved changes')}</span>}</span>
            <button type="button" className="btn btn-outline" disabled={!dirty || saving} onClick={ctx.discard}>{t('Discard')}</button>
            <button type="submit" className="btn btn-primary" disabled={!dirty || saving}>{saving ? t('Saving…') : saveLabel}</button>
          </div>
        )}
      </form>
      <Modal open={!!confirming} tone="danger" onClose={() => setConfirming(false)} title={t('Confirm high-impact change')}
        footer={(<><button type="button" className="btn btn-outline" onClick={() => setConfirming(false)}>{t('Cancel')}</button>
          <button type="button" className="btn btn-primary" onClick={() => { const ev = confirming; setConfirming(false); onSubmit(ev); }}>{t('Confirm')}</button></>)}>
        <div className="sec-modal__notice">{t('This policy applies platform-wide and affects every signed-in user. Are you sure you want to save it?')}</div>
        <strong>{title}</strong>
      </Modal>
    </section>
  );
}

function usePanelSave(path) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const save = useCallback(async (payload) => {
    setSaving(true);
    setError(null);
    try {
      await api.patch(`${BASE}${path}`, payload);
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    } finally {
      setSaving(false);
    }
  }, [path]);
  return { saving, error, save };
}

export default function SecurityPolicies() {
  const t = useTranslations(translations);
  const { locale } = useLanguage();
  const [params, setParams] = useSearchParams();
  const section = SECTIONS.some((x) => x.key === params.get('section')) ? params.get('section') : 'auth';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [toast, setToast] = useState(null);

  const load = useCallback(() => {
    setLoadError(null);
    return api.get(BASE)
      .then((json) => setData(json.data))
      .catch((err) => setLoadError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!toast) return undefined; const id = setTimeout(() => setToast(null), 2600); return () => clearTimeout(id); }, [toast]);

  const head = (
    <PageHead eyebrow={t('Account / Configuration')} title={t('Security Policies')} subtitle={t('Password rules, session timeouts, and lockout thresholds.')}
      actions={data && !data.can_edit ? <span className="pill pill--neutral"><Icon name="eye" size={13} />&nbsp;{t('Read-only')}</span> : null} />
  );
  if (loading) return <div className="sec-page">{head}<section className="sec-card"><div className="sec-card__body" style={{ display: 'grid', gap: 14 }}>{[60, 80, 45].map((w) => <span key={w} className="sec-skel" style={{ width: `${w}%` }} />)}</div></section></div>;
  if (loadError) return <div className="sec-page">{head}<ErrorNote>{loadError}</ErrorNote></div>;
  if (!data) return null;

  const canEdit = !!data.can_edit;
  const notify = (msg) => setToast(msg);
  const locked = data.locked_accounts || [];
  const host = (id, node) => <PanelHost key={id} notify={notify}>{node}</PanelHost>;

  const grouped = {};
  (data.generic_policies || []).forEach((p) => {
    const cat = p.category || 'uncategorized';
    grouped[cat] = grouped[cat] || [];
    grouped[cat].push(p);
  });

  return (
    <div className="sec-page">
      {head}
      <div className="sec-split">
        <nav className="sec-card sec-subnav" aria-label={t('Security Policies')}>
          {SECTIONS.map((x) => (
            <button key={x.key} type="button" className={section === x.key ? 'is-active' : ''} aria-current={section === x.key ? 'page' : undefined}
              onClick={() => { const n = new URLSearchParams(params); n.set('section', x.key); setParams(n); }}>
              <Icon name={x.icon} size={16} /> {x[locale] || x.en}
              {x.key === 'auth' && locked.length > 0 && <span className="pill pill--danger" style={{ marginInlineStart: 'auto' }}>{locked.length}</span>}
            </button>
          ))}
        </nav>

        <div style={{ minWidth: 0 }}>
          {section === 'auth' && (<>
            {host('lockout', <LockoutPanel t={t} canEdit={canEdit} initial={data.lockout_policy} />)}
            <LockedAccountsCard t={t} canEdit={canEdit} locked={locked} onUnlocked={load} />
            {host('password', <PasswordPanel t={t} canEdit={canEdit} initial={data.password_policy} />)}
            {host('mfa', <MfaPanel t={t} canEdit={canEdit} initial={data.mfa_policy} roles={data.mfa_enforceable_roles || []} locale={locale} />)}
          </>)}
          {section === 'session' && host('session', <SessionPanel t={t} canEdit={canEdit} initial={data.session_policy} />)}
          {section === 'network' && (<>
            {host('ip', <IpRestrictionPanel t={t} canEdit={canEdit} initial={data.ip_restriction_policy} />)}
            {host('country', <CountryRestrictionPanel t={t} canEdit={canEdit} initial={data.country_restriction_policy} />)}
            {host('device', <DeviceRestrictionPanel t={t} canEdit={canEdit} initial={data.device_restriction_policy} locale={locale} />)}
          </>)}
          {section === 'limits' && (<>
            {host('rate', <RateLimitPanel t={t} canEdit={canEdit} initial={data.rate_limit_policy} />)}
            {host('upload', <UploadPanel t={t} canEdit={canEdit} initial={data.upload_policy} />)}
          </>)}
          {section === 'advanced' && (Object.keys(grouped).length === 0
            ? <section className="sec-card"><EmptyState icon="settings">{t('No policies defined yet.')}</EmptyState></section>
            : Object.entries(grouped).map(([cat, items]) => (
              <GenericCategoryCard key={cat} t={t} locale={locale} cat={cat} items={items} canEdit={canEdit} onSaved={() => { notify(t('Saved.')); load(); }} />
            )))}
        </div>
      </div>
      {toast && <div className="sec-toast" role="status"><Icon name="check-circle" size={18} /> {toast}</div>}
    </div>
  );
}

function LockoutPanel({ t, canEdit, initial, locked }) {
  const p = { max_attempts: 5, duration_unit: 'minutes', duration_value: 15, permanent_lock: false, auto_unlock: true, notify_inapp: true, notify_email: true, lock_message_ar: '', lock_message_en: '', support_email: '', support_phone: '', ...initial };
  const [maxAttempts, setMaxAttempts] = useState(p.max_attempts);
  const [durationValue, setDurationValue] = useState(p.duration_value);
  const [durationUnit, setDurationUnit] = useState(p.duration_unit);
  const [permanentLock, setPermanentLock] = useState(!!p.permanent_lock);
  const [autoUnlock, setAutoUnlock] = useState(!!p.auto_unlock);
  const [notifyInapp, setNotifyInapp] = useState(!!p.notify_inapp);
  const [notifyEmail, setNotifyEmail] = useState(!!p.notify_email);
  const [supportEmail, setSupportEmail] = useState(p.support_email);
  const [supportPhone, setSupportPhone] = useState(p.support_phone);
  const [lockMessageAr, setLockMessageAr] = useState(p.lock_message_ar);
  const [lockMessageEn, setLockMessageEn] = useState(p.lock_message_en);
  const { saving, error, save } = usePanelSave('/lockout');

  const handleSubmit = (e) => {
    e.preventDefault();
    save({
      max_attempts: maxAttempts, duration_value: durationValue, duration_unit: durationUnit,
      permanent_lock: permanentLock, auto_unlock: autoUnlock, notify_inapp: notifyInapp, notify_email: notifyEmail,
      support_email: supportEmail, support_phone: supportPhone, lock_message_ar: lockMessageAr, lock_message_en: lockMessageEn,
    });
  };

  return (
    <PolicyCard t={t} highImpact icon="lock" title={t('Failed Login / Account Lockout Policy')} description={t('The system automatically locks an account after the number of failed login attempts below, and notifies the user in-app and by email.')} onSubmit={handleSubmit} canEdit={canEdit} saveLabel={t('Save lockout policy')} saving={saving} error={error}>
      <div className="sec-grid-2">
        <Field>
          <label>{t('Maximum failed login attempts')}</label>
          <input type="number" min={1} max={50} className="sec-input" value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} disabled={!canEdit} />
        </Field>
        <Field>
          <label>{t('Temporary lock duration')}</label>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <input type="number" min={1} max={3650} className="sec-input" style={{ width: 90 }} value={durationValue} onChange={(e) => setDurationValue(e.target.value)} disabled={!canEdit} />
            <select className="sec-input" value={durationUnit} onChange={(e) => setDurationUnit(e.target.value)} disabled={!canEdit}>
              <option value="minutes">{t('Minutes')}</option>
              <option value="hours">{t('Hours')}</option>
              <option value="days">{t('Days')}</option>
            </select>
          </div>
        </Field>
        <Checkbox id="permanent_lock" checked={permanentLock} onChange={setPermanentLock} disabled={!canEdit} label={t('Permanent lock instead of temporary (requires manual unlock)')} />
        <Checkbox id="auto_unlock" checked={autoUnlock} onChange={setAutoUnlock} disabled={!canEdit} label={t('Automatic unlock after the configured time')} />
        <Checkbox id="notify_inapp" checked={notifyInapp} onChange={setNotifyInapp} disabled={!canEdit} label={t('Notify security team in-app')} />
        <Checkbox id="notify_email" checked={notifyEmail} onChange={setNotifyEmail} disabled={!canEdit} label={t('Send an email to the locked-out user')} />
        <Field>
          <label>{t('Support email')}</label>
          <input type="email" className="sec-input" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} disabled={!canEdit} />
        </Field>
        <Field>
          <label>{t('Support phone')}</label>
          <input type="text" className="sec-input" value={supportPhone} onChange={(e) => setSupportPhone(e.target.value)} disabled={!canEdit} />
        </Field>
      </div>
      <Field style={{ marginTop: 'var(--space-3)' }}>
        <label>{t('Friendly lock message (Arabic)')}</label>
        <textarea className="sec-input" rows={2} value={lockMessageAr} onChange={(e) => setLockMessageAr(e.target.value)} disabled={!canEdit} />
      </Field>
      <Field>
        <label>{t('Friendly lock message (English)')}</label>
        <textarea className="sec-input" rows={2} value={lockMessageEn} onChange={(e) => setLockMessageEn(e.target.value)} disabled={!canEdit} />
      </Field>
    </PolicyCard>
  );
}

function PasswordPanel({ t, canEdit, initial }) {
  const p = { min_length: 8, require_upper: true, require_lower: true, require_number: true, require_special: true, expire_days: 0, reuse_prevent_count: 3, warn_days_before_expiry: 7, ...initial };
  const [minLength, setMinLength] = useState(p.min_length);
  const [expireDays, setExpireDays] = useState(p.expire_days);
  const [reuseCount, setReuseCount] = useState(p.reuse_prevent_count);
  const [warnDays, setWarnDays] = useState(p.warn_days_before_expiry);
  const [reqUpper, setReqUpper] = useState(!!p.require_upper);
  const [reqLower, setReqLower] = useState(!!p.require_lower);
  const [reqNumber, setReqNumber] = useState(!!p.require_number);
  const [reqSpecial, setReqSpecial] = useState(!!p.require_special);
  const { saving, error, save } = usePanelSave('/password');

  const handleSubmit = (e) => {
    e.preventDefault();
    save({ min_length: minLength, expire_days: expireDays, reuse_prevent_count: reuseCount, warn_days_before_expiry: warnDays, require_upper: reqUpper, require_lower: reqLower, require_number: reqNumber, require_special: reqSpecial });
  };

  return (
    <PolicyCard t={t} highImpact icon="key" title={t('Password Complexity & Expiration Policy')} description={t('These rules apply at registration, password change, and password reset, across every portal.')} onSubmit={handleSubmit} canEdit={canEdit} saveLabel={t('Save password policy')} saving={saving} error={error}>
      <div className="sec-grid-2">
        <Field>
          <label>{t('Minimum password length')}</label>
          <input type="number" min={6} max={64} className="sec-input" value={minLength} onChange={(e) => setMinLength(e.target.value)} disabled={!canEdit} />
        </Field>
        <Field>
          <label>{t('Password expiration (days)')}</label>
          <input type="number" min={0} max={3650} className="sec-input" value={expireDays} onChange={(e) => setExpireDays(e.target.value)} disabled={!canEdit} />
          <span className="text-caption">{t('0 = never expires')}</span>
        </Field>
        <Field>
          <label>{t('Prevent reuse of last N passwords')}</label>
          <input type="number" min={0} max={24} className="sec-input" value={reuseCount} onChange={(e) => setReuseCount(e.target.value)} disabled={!canEdit} />
          <span className="text-caption">{t('0 = no reuse check')}</span>
        </Field>
        <Field>
          <label>{t('Warn before expiry (days)')}</label>
          <input type="number" min={0} max={90} className="sec-input" value={warnDays} onChange={(e) => setWarnDays(e.target.value)} disabled={!canEdit} />
        </Field>
        <Checkbox id="require_upper" checked={reqUpper} onChange={setReqUpper} disabled={!canEdit} label={t('Require an uppercase letter')} />
        <Checkbox id="require_lower" checked={reqLower} onChange={setReqLower} disabled={!canEdit} label={t('Require a lowercase letter')} />
        <Checkbox id="require_number" checked={reqNumber} onChange={setReqNumber} disabled={!canEdit} label={t('Require a number')} />
        <Checkbox id="require_special" checked={reqSpecial} onChange={setReqSpecial} disabled={!canEdit} label={t('Require a special character')} />
      </div>
    </PolicyCard>
  );
}

function UploadPanel({ t, canEdit, initial }) {
  const p = { max_size_kb: 10240, restrict_extensions: false, allowed_extensions: 'pdf,doc,docx,xls,xlsx,ppt,pptx,jpg,jpeg,png,webp,gif,svg,zip,csv,json,xml', ...initial };
  const [maxSizeKb, setMaxSizeKb] = useState(p.max_size_kb);
  const [restrict, setRestrict] = useState(!!p.restrict_extensions);
  const [allowed, setAllowed] = useState(p.allowed_extensions);
  const { saving, error, save } = usePanelSave('/upload');

  const handleSubmit = (e) => {
    e.preventDefault();
    save({ max_size_kb: maxSizeKb, restrict_extensions: restrict, allowed_extensions: allowed });
  };

  return (
    <PolicyCard t={t} icon="upload" title={t('File Upload Restrictions')} description={t('The default maximum file size and allowed file types, applied across every upload (avatars, logos, project files, reports, attachments).')} onSubmit={handleSubmit} canEdit={canEdit} saveLabel={t('Save upload policy')} saving={saving} error={error}>
      <div className="sec-grid-2">
        <Field>
          <label>{t('Maximum file size (KB)')}</label>
          <input type="number" min={1} max={512000} className="sec-input" value={maxSizeKb} onChange={(e) => setMaxSizeKb(e.target.value)} disabled={!canEdit} />
          <span className="text-caption text-mono">≈ {(Number(maxSizeKb || 0) / 1024).toFixed(1)} MB</span>
        </Field>
        <Checkbox id="restrict_extensions" checked={restrict} onChange={setRestrict} disabled={!canEdit} label={t('Restrict to the allowed types below')} />
      </div>
      <Field style={{ marginTop: 'var(--space-3)' }}>
        <label>{t('Allowed file types (comma-separated)')}</label>
        <input type="text" className="sec-input" value={allowed} onChange={(e) => setAllowed(e.target.value)} disabled={!canEdit} placeholder="pdf,docx,jpg,png,zip" />
        <span className="text-caption">{t('Applied as an extra restriction on top of each category\'s own types, only when the option above is on — it can only narrow, never widen, what a category already allows.')}</span>
      </Field>
    </PolicyCard>
  );
}

function SessionPanel({ t, canEdit, initial }) {
  const p = { timeout_minutes: 60, concurrent_limit: 0, enforce_concurrent_limit: false, ...initial };
  const [timeoutMinutes, setTimeoutMinutes] = useState(p.timeout_minutes);
  const [concurrentLimit, setConcurrentLimit] = useState(p.concurrent_limit);
  const [enforce, setEnforce] = useState(!!p.enforce_concurrent_limit);
  const { saving, error, save } = usePanelSave('/session');

  const handleSubmit = (e) => {
    e.preventDefault();
    save({ timeout_minutes: timeoutMinutes, concurrent_limit: concurrentLimit, enforce_concurrent_limit: enforce });
  };

  return (
    <PolicyCard t={t} icon="clock" title={t('Session Timeout & Concurrent Session Policy')} description={t('The system automatically ends any idle session after the configured time, and can also cap how many sessions a single user may have active at once.')} onSubmit={handleSubmit} canEdit={canEdit} saveLabel={t('Save session policy')} saving={saving} error={error}>
      <div className="sec-grid-2">
        <Field>
          <label>{t('Session idle timeout (minutes)')}</label>
          <input type="number" min={1} max={43200} className="sec-input" value={timeoutMinutes} onChange={(e) => setTimeoutMinutes(e.target.value)} disabled={!canEdit} />
        </Field>
        <Field>
          <label>{t('Maximum concurrent sessions')}</label>
          <input type="number" min={0} max={50} className="sec-input" value={concurrentLimit} onChange={(e) => setConcurrentLimit(e.target.value)} disabled={!canEdit} />
          <span className="text-caption">{t('0 = unlimited')}</span>
        </Field>
        <Checkbox id="enforce_concurrent_limit" checked={enforce} onChange={setEnforce} disabled={!canEdit} label={t('Enforce the concurrent session limit (auto-signs out the oldest sessions on a new login)')} />
      </div>
    </PolicyCard>
  );
}

function MfaPanel({ t, canEdit, initial, roles, locale }) {
  const p = { enforced_roles: [], grace_period_days: 7, ...initial };
  const [enforced, setEnforced] = useState(new Set(p.enforced_roles));
  const [graceDays, setGraceDays] = useState(p.grace_period_days);
  const { saving, error, save } = usePanelSave('/mfa');

  function toggleRole(role) {
    setEnforced((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role); else next.add(role);
      return next;
    });
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    save({ enforced_roles: Array.from(enforced), grace_period_days: graceDays });
  };

  if (!roles.length) {
    return (
      <section className="sec-card" style={{ marginBottom: 16 }}>
        <div className="sec-card__head"><h2><Icon name="shield" size={17} /> {t('MFA Requirements Policy')}</h2></div>
        <EmptyState icon="shield">{t('No enforceable roles are configured.')}</EmptyState>
      </section>
    );
  }

  return (
    <PolicyCard t={t} highImpact icon="shield" title={t('MFA Requirements Policy')} description={t('Choose which roles must have two-factor authentication enabled. A user without it gets a grace period to enroll; once it elapses, their access is restricted to the 2FA setup page until they enroll.')} onSubmit={handleSubmit} canEdit={canEdit} saveLabel={t('Save MFA policy')} saving={saving} error={error}>
      <Field style={{ marginBottom: 'var(--space-4)' }}>
        <label className="sec-label">{t('Roles required to use MFA')}</label>
        <div className="sec-chips">
          {roles.map((roleSlug) => (
            <label key={roleSlug} className="sec-chip">
              <input type="checkbox" checked={enforced.has(roleSlug)} onChange={() => toggleRole(roleSlug)} disabled={!canEdit} />
              {MFA_ROLE_LABELS[roleSlug]?.[locale] ?? MFA_ROLE_LABELS[roleSlug]?.en ?? roleSlug}
            </label>
          ))}
        </div>
      </Field>
      <Field style={{ maxWidth: 280 }}>
        <label>{t('Enrollment grace period (days)')}</label>
        <input type="number" min={0} max={90} className="sec-input" value={graceDays} onChange={(e) => setGraceDays(e.target.value)} disabled={!canEdit} />
        <span className="text-caption">{t('0 = required immediately, no grace')}</span>
      </Field>
    </PolicyCard>
  );
}

function RateLimitPanel({ t, canEdit, initial }) {
  const p = { enabled: true, requests_per_minute: 60, ...initial };
  const [enabled, setEnabled] = useState(!!p.enabled);
  const [rpm, setRpm] = useState(p.requests_per_minute);
  const { saving, error, save } = usePanelSave('/rate-limit');

  const handleSubmit = (e) => {
    e.preventDefault();
    save({ enabled, requests_per_minute: rpm });
  };

  return (
    <PolicyCard t={t} icon="trend" title={t('API Rate Limits Policy')} description={t('Caps how many requests a single IP address may make per minute across every /api route. Applied live via RateLimitMiddleware.')} onSubmit={handleSubmit} canEdit={canEdit} saveLabel={t('Save rate limit policy')} saving={saving} error={error}>
      <div className="sec-grid-2">
        <Checkbox id="rl_enabled" checked={enabled} onChange={setEnabled} disabled={!canEdit} label={t('Enable rate limiting')} />
        <Field>
          <label>{t('Max requests per minute (per IP)')}</label>
          <input type="number" min={1} max={10000} className="sec-input" value={rpm} onChange={(e) => setRpm(e.target.value)} disabled={!canEdit} />
        </Field>
      </div>
    </PolicyCard>
  );
}

function IpRestrictionPanel({ t, canEdit, initial }) {
  const p = { mode: 'disabled', allowlist: [], denylist: [], ...initial };
  const [mode, setMode] = useState(p.mode);
  const [allowlist, setAllowlist] = useState((p.allowlist || []).join(', '));
  const [denylist, setDenylist] = useState((p.denylist || []).join(', '));
  const { saving, error, save } = usePanelSave('/ip-restriction');

  const handleSubmit = (e) => {
    e.preventDefault();
    save({ mode, allowlist, denylist });
  };

  return (
    <PolicyCard t={t} highImpact icon="monitor" title={t('IP Restrictions Policy')} description={t('A broader allow/deny list with CIDR support (e.g. 41.32.0.0/16), separate from the single-address "Blocked IPs" list below. Applied at login.')} onSubmit={handleSubmit} canEdit={canEdit} saveLabel={t('Save IP restriction policy')} saving={saving} error={error}>
      <Field style={{ maxWidth: 280, marginBottom: 'var(--space-3)' }}>
        <label>{t('Mode')}</label>
        <select className="sec-input" value={mode} onChange={(e) => setMode(e.target.value)} disabled={!canEdit}>
          <option value="disabled">{t('Disabled')}</option>
          <option value="allowlist">{t('Allowlist only')}</option>
          <option value="denylist">{t('Denylist')}</option>
        </select>
      </Field>
      <div className="sec-grid-2">
        <Field>
          <label>{t('Allowlist (comma-separated)')}</label>
          <textarea className="sec-input" rows={3} value={allowlist} onChange={(e) => setAllowlist(e.target.value)} disabled={!canEdit} placeholder="41.32.0.0/16, 197.0.0.0/8, 102.44.1.1" />
        </Field>
        <Field>
          <label>{t('Denylist (comma-separated)')}</label>
          <textarea className="sec-input" rows={3} value={denylist} onChange={(e) => setDenylist(e.target.value)} disabled={!canEdit} placeholder="203.0.113.0/24" />
        </Field>
      </div>
    </PolicyCard>
  );
}

function CountryRestrictionPanel({ t, canEdit, initial }) {
  const p = { mode: 'disabled', allowed_countries: [], blocked_countries: [], fail_open: true, ...initial };
  const [mode, setMode] = useState(p.mode);
  const [failOpen, setFailOpen] = useState(!!p.fail_open);
  const [allowed, setAllowed] = useState((p.allowed_countries || []).join(', '));
  const [blocked, setBlocked] = useState((p.blocked_countries || []).join(', '));
  const { saving, error, save } = usePanelSave('/country-restriction');

  const handleSubmit = (e) => {
    e.preventDefault();
    save({ mode, fail_open: failOpen, allowed_countries: allowed, blocked_countries: blocked });
  };

  return (
    <PolicyCard t={t} highImpact icon="globe" title={t('Country Restrictions Policy')} description={t('Restricts login to (or from) specific countries, backed by a real IP → country lookup (GeoIpService) with result caching. When the country can\'t be determined (lookup provider down, or a private/local address), "fail open" decides whether the login is allowed or denied.')} onSubmit={handleSubmit} canEdit={canEdit} saveLabel={t('Save country restriction policy')} saving={saving} error={error}>
      <div className="sec-grid-2">
        <Field>
          <label>{t('Mode')}</label>
          <select className="sec-input" value={mode} onChange={(e) => setMode(e.target.value)} disabled={!canEdit}>
            <option value="disabled">{t('Disabled')}</option>
            <option value="allowlist">{t('Allowlist only')}</option>
            <option value="denylist">{t('Denylist')}</option>
          </select>
        </Field>
        <Checkbox id="cr_fail_open" checked={failOpen} onChange={setFailOpen} disabled={!canEdit} label={t('Allow login when country can\'t be resolved (fail open)')} />
      </div>
      <div className="sec-grid-2">
        <Field>
          <label>{t('Allowed countries (comma-separated ISO codes)')}</label>
          <textarea className="sec-input" rows={2} value={allowed} onChange={(e) => setAllowed(e.target.value)} disabled={!canEdit} placeholder="EG, SA, AE" />
        </Field>
        <Field>
          <label>{t('Blocked countries (comma-separated ISO codes)')}</label>
          <textarea className="sec-input" rows={2} value={blocked} onChange={(e) => setBlocked(e.target.value)} disabled={!canEdit} placeholder="KP" />
        </Field>
      </div>
    </PolicyCard>
  );
}

function DeviceRestrictionPanel({ t, canEdit, initial, locale }) {
  const p = { mode: 'disabled', allowed_device_types: [], blocked_device_types: [], ...initial };
  const [mode, setMode] = useState(p.mode);
  const [allowedTypes, setAllowedTypes] = useState(new Set(p.allowed_device_types || []));
  const [blockedTypes, setBlockedTypes] = useState(new Set(p.blocked_device_types || []));
  const { saving, error, save } = usePanelSave('/device-restriction');

  function toggle(setFn, type) {
    setFn((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    save({ mode, allowed_device_types: Array.from(allowedTypes), blocked_device_types: Array.from(blockedTypes) });
  };

  return (
    <PolicyCard t={t} highImpact icon="smartphone" title={t('Device Restrictions Policy')} description={t('Restricts login by device type (desktop / mobile / tablet), classified from the request\'s User-Agent — a blanket platform-level rule, separate from the upcoming "Trusted Devices" feature (a single user remembering one specific device to skip repeat MFA).')} onSubmit={handleSubmit} canEdit={canEdit} saveLabel={t('Save device restriction policy')} saving={saving} error={error}>
      <Field style={{ maxWidth: 280, marginBottom: 'var(--space-3)' }}>
        <label>{t('Mode')}</label>
        <select className="sec-input" value={mode} onChange={(e) => setMode(e.target.value)} disabled={!canEdit}>
          <option value="disabled">{t('Disabled')}</option>
          <option value="allowlist">{t('Allowlist only')}</option>
          <option value="denylist">{t('Denylist')}</option>
        </select>
      </Field>
      <div className="sec-grid-2">
        <Field>
          <label className="sec-label">{t('Allowed device types')}</label>
          {Object.entries(DEVICE_TYPE_LABELS).map(([type, lbl]) => (
            <div key={type} className="sec-check">
              <input type="checkbox" id={`dr_allow_${type}`} checked={allowedTypes.has(type)} onChange={() => toggle(setAllowedTypes, type)} disabled={!canEdit} />
              <label htmlFor={`dr_allow_${type}`} >{lbl[locale] || lbl.en}</label>
            </div>
          ))}
        </Field>
        <Field>
          <label className="sec-label">{t('Blocked device types')}</label>
          {Object.entries(DEVICE_TYPE_LABELS).map(([type, lbl]) => (
            <div key={type} className="sec-check">
              <input type="checkbox" id={`dr_block_${type}`} checked={blockedTypes.has(type)} onChange={() => toggle(setBlockedTypes, type)} disabled={!canEdit} />
              <label htmlFor={`dr_block_${type}`} >{lbl[locale] || lbl.en}</label>
            </div>
          ))}
        </Field>
      </div>
    </PolicyCard>
  );
}

function LockedAccountsCard({ t, canEdit, locked, onUnlocked }) {
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [target, setTarget] = useState(null);

  function unlock() {
    setBusyId(target.id);
    setError(null);
    api.post(`${BASE}/unlock/${target.id}`)
      .then(() => { setTarget(null); onUnlocked(); })
      .catch((err) => { setError(errorMessage(err)); setTarget(null); })
      .finally(() => setBusyId(null));
  }

  return (
    <section className="sec-card sec-card--flush" style={{ marginBottom: 16 }}>
      <div className="sec-card__head" style={{ paddingBottom: 14 }}>
        <div><h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="alert-triangle" size={17} /> {t('Currently Locked Accounts')} <span className="pill pill--neutral">{locked.length}</span></h2></div>
      </div>
      <div style={{ padding: error ? '0 22px 12px' : 0 }}><ErrorNote>{error}</ErrorNote></div>
      {locked.length === 0 ? (
        <EmptyState icon="lock">{t('No accounts are currently locked.')}</EmptyState>
      ) : (
        <div className="sec-table-wrap">
          <table className="sec-table">
            <thead><tr><th>{t('User')}</th><th>{t('Reason')}</th><th>{t('Locked at')}</th><th>{t('Status')}</th>{canEdit && <th />}</tr></thead>
            <tbody>
              {locked.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.full_name}</strong><span className="sub mono">{u.email}</span></td>
                  <td>{u.lock_reason || '—'}</td>
                  <td className="muted">{fmtDateTime(u.locked_at)}</td>
                  <td>{Number(u.lock_permanent) === 1 ? <span className="pill pill--danger">{t('Permanent')}</span> : <span className="pill pill--warn">{t('Until ')}{fmtDateTime(u.locked_until)}</span>}</td>
                  {canEdit && <td className="col-actions"><button type="button" className="btn-tint" disabled={busyId === u.id} onClick={() => setTarget(u)}>{t('Unlock')}</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={!!target} onClose={() => setTarget(null)} title={t('Unlock account')}
        footer={(<><button type="button" className="btn btn-outline" onClick={() => setTarget(null)}>{t('Cancel')}</button><button type="button" className="btn btn-primary" disabled={!!busyId} onClick={unlock}>{t('Unlock')}</button></>)}>
        {target && (<><div className="sec-modal__notice">{t('The user will be able to sign in again immediately.')}</div><strong>{target.full_name}</strong> <span className="muted mono">{target.email}</span></>)}
      </Modal>
    </section>
  );
}

function GenericCategoryCard({ t, locale, cat, items, canEdit, onSaved }) {
  return (
    <section className="sec-card" style={{ marginBottom: 16 }}>
      <div className="sec-card__head"><h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name={CATEGORY_ICON[cat] || 'settings'} size={17} /> {CATEGORY_LABEL[cat]?.[locale] ?? CATEGORY_LABEL[cat]?.en ?? cat}</h2></div>
      <div className="sec-card__body">
        {items.map((p) => <GenericPolicyRow key={p.policy_key} t={t} locale={locale} policy={p} canEdit={canEdit} onSaved={onSaved} />)}
      </div>
    </section>
  );
}

function GenericPolicyRow({ t, locale, policy, canEdit, onSaved }) {
  const [value, setValue] = useState(policy.value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    api.patch(BASE, { policy_key: policy.policy_key, value })
      .then(() => onSaved())
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setSaving(false));
  }

  return (
    <form onSubmit={handleSubmit} className="sec-setting">
      <div>
        <strong>{(locale === 'ar' && policy.name_ar) || policy.name_en}</strong>
        <span className="mono">{policy.policy_key}</span>
        {error && <span style={{ display: 'block', color: 'var(--sev-critical)' }}>{error}</span>}
      </div>
      {canEdit ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="text" className="sec-input" style={{ width: 110 }} value={value} onChange={(e) => setValue(e.target.value)} aria-label={policy.policy_key} />
          <button type="submit" className="btn btn-outline" disabled={saving || String(value) === String(policy.value)} aria-label={t('Save')}><Icon name="check" size={15} /></button>
        </div>
      ) : (
        <span className="pill pill--info mono">{policy.value}</span>
      )}
    </form>
  );
}
