import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import AuthLayout from '../layouts/AuthLayout';
import Icon from '../components/Icon';
import { AuthField, AuthSelect, PasswordField } from '../components/auth/AuthField';
import { useLanguage, useTranslations } from '../context/LanguageContext';
import i18nCommon from '../i18n/common';
import i18nPage from '../i18n/auth/pages';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Mirrors app/Views/auth/register.php + RegisterController::submit().
 *
 * The student-only university/faculty/department/program cascade is wired
 * to the two read-only endpoints RegisterController now exposes for it
 * (routes/api.php):
 *   GET /api/v1/auth/universities                -> RegisterController::universities()
 *   GET /api/v1/auth/university-hierarchy/{id}    -> RegisterController::universityHierarchy()
 * Faculty/department/program stay optional exactly like the PHP form and
 * RegisterController::submit() (only sent to the backend when a
 * university was actually picked), and the department/program lists are
 * filtered client-side by faculty_id/department_id the same way the
 * inline <script> in register.php does it — the hierarchy endpoint
 * returns the whole tree for the university in one call, not scoped
 * lookups per level.
 */
export default function Register() {
  const t = useTranslations(translations);
  const { locale } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [roles, setRoles] = useState([]);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState(searchParams.get('role') || ''); // ?role= comes from SelectRole
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // University/faculty/department/program cascade state (student role only)
  const [universities, setUniversities] = useState([]);
  const [universityId, setUniversityId] = useState('');
  const [faculties, setFaculties] = useState([]);
  const [facultyId, setFacultyId] = useState('');
  const [allDepartments, setAllDepartments] = useState([]); // whole-tree, filtered client-side
  const [allPrograms, setAllPrograms] = useState([]);
  const [departmentId, setDepartmentId] = useState('');
  const [programId, setProgramId] = useState('');
  const [hierarchyLoading, setHierarchyLoading] = useState(false);

  // GET /api/v1/auth/roles (RoleSelectionController::index) — the same
  // selectable account types the PHP form's <select> is populated with.
  useEffect(() => {
    let cancelled = false;
    api.get('/api/v1/auth/roles')
      .then((json) => {
        if (!cancelled) setRoles(json.data || []);
      })
      .catch(() => {
        // Non-fatal — the select just stays empty; submit will still
        // 422 with a clear "choose a valid account type" message.
      });
    return () => { cancelled = true; };
  }, []);

  const isStudent = role === 'student';

  // Load the university list once the student picks that role — mirrors
  // the PHP view rendering university-field only when isStudent, except
  // there it's server-rendered upfront; here we fetch lazily on first need.
  useEffect(() => {
    if (!isStudent || universities.length) return;
    let cancelled = false;
    api.get('/api/v1/auth/universities')
      .then((json) => {
        if (!cancelled) setUniversities(json.data || []);
      })
      .catch(() => {
        // Non-fatal — the university field just stays empty/optional.
      });
    return () => { cancelled = true; };
  }, [isStudent, universities.length]);

  function resetDownstream() {
    setFaculties([]);
    setFacultyId('');
    setAllDepartments([]);
    setAllPrograms([]);
    setDepartmentId('');
    setProgramId('');
  }

  async function handleUniversityChange(e) {
    const id = e.target.value;
    setUniversityId(id);
    resetDownstream();
    if (!id) return;

    setHierarchyLoading(true);
    try {
      const json = await api.get(`/api/v1/auth/university-hierarchy/${id}`);
      // This endpoint returns the raw tree ({faculties, departments, programs})
      // — not the usual {success, data} envelope — so read the top level and
      // fall back to `data` in case it's ever wrapped.
      const tree = json?.faculties ? json : (json?.data || {});
      setFaculties(tree.faculties || []);
      setAllDepartments(tree.departments || []);
      setAllPrograms(tree.programs || []);
    } catch {
      setFaculties([]);
      setAllDepartments([]);
      setAllPrograms([]);
    } finally {
      setHierarchyLoading(false);
    }
  }

  function handleFacultyChange(e) {
    const id = e.target.value;
    setFacultyId(id);
    setDepartmentId('');
    setProgramId('');
  }

  function handleDepartmentChange(e) {
    const id = e.target.value;
    setDepartmentId(id);
    setProgramId('');
  }

  const mismatch = passwordConfirmation !== '' && password !== passwordConfirmation;

  const departmentsForFaculty = facultyId
    ? allDepartments.filter((d) => String(d.faculty_id) === String(facultyId))
    : [];
  const programsForDepartment = departmentId
    ? allPrograms.filter((p) => String(p.department_id) === String(departmentId))
    : [];

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (password !== passwordConfirmation) {
      setError(t("Passwords don't match."));
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        full_name: fullName,
        email,
        role,
        password,
        password_confirmation: passwordConfirmation,
      };
      // Same optionality as RegisterController::submit(): only sent for
      // student, and only once a university was actually chosen.
      if (isStudent && universityId) {
        payload.university_id = universityId;
        if (facultyId) payload.faculty_id = facultyId;
        if (departmentId) payload.department_id = departmentId;
        if (programId) payload.program_id = programId;
      }
      await api.post('/api/v1/auth/register', payload);
      navigate('/auth/login', {
        state: { success: t('Account created! Please check your email to verify your account, then log in.') },
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title={t('Create your account')}
      subtitle={t('Join the University Innovation Platform')}
      error={error}
    >
      <form onSubmit={handleSubmit}>
        <AuthField
          id="full_name"
          type="text"
          label={t('Full name')}
          icon="user"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder={t('Jane Doe')}
          autoComplete="name"
          required
          autoFocus
        />

        <AuthField
          id="email"
          type="email"
          label={t('Email')}
          icon="mail"
          ltr
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          required
        />

        <AuthSelect
          id="role"
          label={t('Account type')}
          icon="users"
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            if (e.target.value !== 'student') {
              setUniversityId('');
              resetDownstream();
            }
          }}
          required
        >
          <option value="">{t('— Select —')}</option>
          {roles.map((r) => (
            <option key={r.slug} value={r.slug}>{r.label?.[locale] ?? r.label?.en ?? r.slug}</option>
          ))}
        </AuthSelect>

        {isStudent && (
          <div className="auth-group">
            <p className="auth-group__title">
              <Icon name="building" size={16} /> {t('Academic details')}
            </p>

            <AuthSelect
              id="university_id"
              label={t('Your university')}
              icon="building"
              value={universityId}
              onChange={handleUniversityChange}
              hint={t("This sends a join request the university approves. You can pick it later from your account if you're not sure yet.")}
            >
              <option value="">{t('— Decide later —')}</option>
              {universities.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </AuthSelect>

            <AuthSelect
              id="faculty_id"
              label={t('Faculty (optional)')}
              value={facultyId}
              onChange={handleFacultyChange}
              disabled={!universityId || !faculties.length}
            >
              <option value="">
                {hierarchyLoading
                  ? t('Loading…')
                  : (universityId && faculties.length ? t('— Select faculty (optional) —') : t('— Select university first —'))}
              </option>
              {faculties.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </AuthSelect>

            <AuthSelect
              id="department_id"
              label={t('Department (optional)')}
              value={departmentId}
              onChange={handleDepartmentChange}
              disabled={!facultyId}
              hint={t("Leave this blank if your department isn't assigned until a later year.")}
            >
              <option value="">{t('— No department —')}</option>
              {departmentsForFaculty.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </AuthSelect>

            <AuthSelect
              id="program_id"
              label={t('Program (optional)')}
              value={programId}
              onChange={(e) => setProgramId(e.target.value)}
              disabled={!departmentId}
            >
              <option value="">{t('— No program —')}</option>
              {programsForDepartment.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </AuthSelect>
          </div>
        )}

        <PasswordField
          id="password"
          label={t('Password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
          minLength={8}
          hint={t('At least 8 characters')}
          showStrength
          showCapsWarning
          required
        />

        <PasswordField
          id="password_confirmation"
          label={t('Confirm password')}
          value={passwordConfirmation}
          onChange={(e) => setPasswordConfirmation(e.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
          minLength={8}
          error={mismatch ? t("Passwords don't match.") : undefined}
          required
        />

        <button type="submit" className={`auth-btn ${submitting ? 'is-loading' : ''}`} disabled={submitting || mismatch}>
          <span>{submitting ? t('Creating account…') : t('Create account')}</span>
          {!submitting && <span className="auth-dir-icon"><Icon name="arrow-right" size={18} /></span>}
        </button>
      </form>

      <div className="auth-footer-link">
        {t('Already have an account?')} <Link to="/auth/login" className="auth-link">{t('Sign in')}</Link>
      </div>
    </AuthLayout>
  );
}
