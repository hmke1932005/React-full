# Auth pages redesign (Login / Register / Forgot / Reset / 2FA / Verify / Confirm email / Select role)

الملفات دي اتطبقت على نسخة المشروع الأخيرة (اللي فيها Security redesign)؛ ما اتلمسش أي ملف تاني.

## ملفات جديدة
- src/components/auth/AuthField.jsx (AuthField / AuthSelect / PasswordField: أيقونة، إظهار كلمة المرور، Caps Lock، مقياس قوة كلمة المرور، رسائل خطأ inline)
- src/components/auth/AuthIllustration.jsx (رسمة SVG بتتلون مع الدارك/لايت)
- src/components/auth/LanguageMenu.jsx (قائمة اللغة AR/EN)
- src/components/auth/AuthStatus.jsx (شاشات النتيجة: تم التأكيد / رابط غير صالح / افحص بريدك)
- src/i18n/auth/shared.js, src/i18n/auth/pages.js (ترجمات عربي)

## ملفات معدّلة
- src/layouts/AuthLayout.jsx, src/styles/css/pages/auth.css
- src/pages/{Login,Register,ForgotPassword,ResetPassword,TwoFactor,VerifyEmail,ConfirmEmailChange,SelectRole}.jsx
- src/i18n/layouts/auth-layout.js, src/i18n/auth/login.js (مفاتيح جديدة)

## ملاحظات
- كل الصفحات بقت مترجمة (كان Login بس اللي مترجم).
- Register بيقرأ ?role= اللي جاي من SelectRole.
- ForgotPassword بعد الإرسال بيعرض شاشة "افحص بريدك" بدل رسالة صغيرة.
- اتفحصت من 320px لـ 1920px، عربي وإنجليزي، فاتح وداكن: مفيش scroll أفقي.
