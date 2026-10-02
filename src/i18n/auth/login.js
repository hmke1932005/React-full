// Login page strings — Login.jsx previously had no translation wiring at
// all (every string was a hardcoded English literal), so toggling the
// language on /auth/login changed the <html dir>/<html lang> and the
// AuthLayout chrome around it, but never the form text itself.
// Shape matches useTranslations(dict) in context/LanguageContext.jsx.
export default {
  'Welcome back': 'أهلاً بعودتك',
  'Sign in to access your dashboard': 'سجّل الدخول للوصول إلى لوحة التحكم بتاعتك',
  'Password': 'كلمة المرور',
  'Forgot password?': 'نسيت كلمة المرور؟',
  'Sign in': 'تسجيل الدخول',
  'Signing in…': 'جارٍ تسجيل الدخول…',
  "Don't have an account?": 'مفيش حساب لسه؟',
  'Create one': 'أنشئ واحد',
  'Show password': 'إظهار كلمة المرور',
  'Hide password': 'إخفاء كلمة المرور',
  'Something went wrong. Please try again.': 'حصل خطأ ما. حاول تاني.',
  'Email': 'البريد الإلكتروني',
};
