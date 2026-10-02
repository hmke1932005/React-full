import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../api/client';
import Icon from '../components/Icon';
import ReadinessRing from '../components/ReadinessRing';
import ProjectCard from '../components/ProjectCard';
import SiteFooter from '../components/SiteFooter';
import LandingNav from '../components/LandingNav';
import { roleHome } from '../config/roleHome';

/**
 * Port of app/Views/public/landing.php — same copy, same Readiness Ring hero visual
 * (restyled in the Admin design language, classes .lp2-*, see styles/css/landing.css), same featured-projects grid
 * (GET /api/v1/public/landing). PublicLandingController redirects an
 * already-authenticated visitor straight to their dashboard instead of
 * rendering the page at all; mirrored here via useAuth() + <Navigate>,
 * since a SPA route can't do that server-side redirect before rendering.
 * Was previously hardcoded to "/dashboard" regardless of role, which sent
 * an already-authenticated student to the generic pilot Dashboard.jsx
 * instead of /student/dashboard — now routed through the same roleHome()
 * map Login.jsx/TwoFactor.jsx use, keyed off the decoded JWT's role claim.
 */
export default function Landing() {
  const { status, user } = useAuth();
  const { locale } = useLanguage();
  const isAr = locale === 'ar';
  const t = (en, ar) => (isAr ? ar : en);

  const [featured, setFeatured] = useState([]);

  useEffect(() => {
    let alive = true;
    api.get('/api/v1/public/landing')
      .then((json) => { if (alive) setFeatured(json.data?.featured || []); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (status === 'authenticated') {
    return <Navigate to={roleHome(user?.role)} replace />;
  }

  const steps = [
    ['upload', t('Upload your project', 'ارفع مشروعك'), t('Document your idea, attach your files, link your GitHub if you like.', 'وثّق فكرتك، أضف ملفاتك، واربط الكود على GitHub لو حابب.')],
    ['sparkles', t('Get your score', 'خد تقييمك'), t('AI analyzes feasibility, market fit, documentation, and innovation instantly.', 'الذكاء الاصطناعي يحلل الجدوى والسوق والتوثيق والابتكار فورًا.')],
    ['check-circle', t('University sign-off', 'اعتماد الجامعة'), t('Your university reviews and approves it before it goes public.', 'جامعتك تراجع وتعتمد المشروع قبل ما ينشر للعامة.')],
    ['eye', t('Get discovered', 'اتكتشف'), t('Your university and the wider platform see exactly this kind of work.', 'جامعتك ومنصات المنصة الأوسع تشوف مشاريع زي بتاعتك بالظبط.')],
  ];

  const roles = [
    ['award', t('Student', 'طالب'), t('Publish your graduation project and build a real portfolio.', 'انشر مشروع تخرجك وابني بورتفوليو حقيقي.')],
    ['building', t('University', 'جامعة'), t("Review and approve your students' projects with ease.", 'راجع واعتمد مشاريع طلابك بسهولة.')],
  ];

  const signals = [
    [t('Technical feasibility', 'الجدوى التقنية'), 91],
    [t('Market potential', 'إمكانات السوق'), 84],
    [t('Documentation', 'جودة التوثيق'), 88],
    [t('Innovation level', 'مستوى الابتكار'), 85],
  ];

  const stats = [
    ['2,400+', t('Projects scored', 'مشروع اتقيّم')],
    ['60+', t('Partner universities', 'جامعة شريكة')],
    ['1,500+', t('Active students', 'طالب نشط')],
    ['< 60' + t('s', 'ث'), t('Time to your first score', 'وقت التقييم')],
  ];

  return (
    <div className="lp2">
      <LandingNav anchors />

      <header className="lp2-hero">
        <div className="lp2-shell lp2-hero__grid">
          <div className="animate-rise-in">
            <span className="lp2-pill"><Icon name="sparkles" size={14} /> {t('Scored by AI the moment you publish', 'يقيّمه الذكاء الاصطناعي فور نشره')}</span>
            <h1>
              {t('Your final-year project deserves more than a grade. ', 'مشروعك مش هيفضل في الدرج. ')}
              <span>{t('Get it scored, get it seen.', 'هيتقيّم، ويتشاف.')}</span>
            </h1>
            <p className="lp2-lead">
              {t(
                'Publish your graduation project on UIP, get an instant AI Readiness Score, and put it in front of your university and the wider platform.',
                'انشر مشروع تخرجك على UIP، خُد درجة جاهزية فورية من الذكاء الاصطناعي، وخليه قدام جامعتك والمنصة كلها.'
              )}
            </p>
            <div className="lp2-hero__ctas">
              <Link to="/auth/register" className="btn btn-primary btn-lg"><Icon name="sparkles" size={18} /> {t('Create your free account', 'انشئ حسابك المجاني')}</Link>
              <Link to="/auth/login" className="btn btn-outline btn-lg">{t('I already have an account', 'عندي حساب بالفعل')}</Link>
            </div>
            <p className="lp2-note"><Icon name="check-circle" size={14} /> {t('Free for students, always. No credit card required.', 'مجاني للطلاب دايمًا. مفيش بطاقة ائتمان مطلوبة.')}</p>
          </div>

          <div className="lp2-mock animate-rise-in" style={{ animationDelay: '.12s' }} aria-label={t('Sample readiness score', 'عينة من درجة الجاهزية')}>
            <div className="lp2-mock__bar">
              <span className="lp2-mock__title">{t('AI Readiness Score', 'درجة الجاهزية')}</span>
              <span className="lp2-mock__sample">{t('Sample', 'عينة')}</span>
            </div>
            <div className="lp2-mock__body">
              <ReadinessRing score={87} size={150} caption={t('Readiness', 'الجاهزية')} />
              <div className="lp2-signals">
                {signals.map(([label, value]) => (
                  <div className="lp2-signal" key={label}>
                    <div className="lp2-signal__top"><span>{label}</span><strong>{value}</strong></div>
                    <div className="lp2-signal__track"><span style={{ width: `${value}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="lp2-mock__foot">
              <span className="lp2-badge"><Icon name="check-circle" size={13} /> {t('Ready to publish', 'جاهز للنشر')}</span>
              <span>{t('A sample of the score your project gets seconds after upload.', 'عينة من التقييم اللي مشروعك بياخده بعد ثواني من الرفع.')}</span>
            </div>
          </div>
        </div>

        <div className="lp2-shell">
          <div className="lp2-stats">
            {stats.map(([num, label]) => (
              <div key={label}><div className="lp2-stats__num">{num}</div><div className="lp2-stats__label">{label}</div></div>
            ))}
          </div>
        </div>
      </header>

      <main>
        <section className="lp2-section lp2-shell" id="how">
          <div className="lp2-head">
            <span className="lp2-eyebrow">{t('The process', 'العملية')}</span>
            <h2>{t('From upload to opportunity, in four steps', 'من الرفع للفرصة، في أربع خطوات')}</h2>
          </div>
          <div className="lp2-steps">
            {steps.map(([icon, title, desc], i) => (
              <div className="lp2-card lp2-step" key={title}>
                <div className="lp2-step__top">
                  <span className="lp2-icon"><Icon name={icon} size={18} /></span>
                  <span className="lp2-step__num">0{i + 1}</span>
                </div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {featured.length > 0 && (
          <section className="lp2-section lp2-shell" id="featured">
            <div className="lp2-head lp2-head--row">
              <div>
                <span className="lp2-eyebrow">{t('Featured', 'مشاريع مميزة')}</span>
                <h2>{t('Some of the best work published on the platform', 'من أفضل اللي اتنشر على المنصة')}</h2>
              </div>
              <Link to="/projects" className="btn btn-outline">{t('Explore all projects', 'استكشف كل المشاريع')} <Icon name="arrow-right" size={16} /></Link>
            </div>
            <div className="public-projects-grid">
              {featured.map((p, i) => (
                <ProjectCard key={p.uuid || p.slug || i} project={p} locale={locale} index={i} showUniversity />
              ))}
            </div>
          </section>
        )}

        <section className="lp2-section lp2-shell" id="roles">
          <div className="lp2-head">
            <span className="lp2-eyebrow">{t("Who it's for", 'مين يستفيد')}</span>
            <h2>{t('One platform, every side of the innovation loop', 'منصة واحدة، لكل طرف في منظومة الابتكار')}</h2>
          </div>
          <div className="lp2-roles">
            {roles.map(([icon, title, desc]) => (
              <div className="lp2-card lp2-role" key={title}>
                <span className="lp2-icon"><Icon name={icon} size={20} /></span>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="lp2-shell lp2-cta-wrap">
          <div className="lp2-cta">
            <h2>{t('Ready to see how far your project can go?', 'جاهز تعرف مشروعك واصل لفين؟')}</h2>
            <p>{t('Signup takes under a minute. Your first score takes even less.', 'التسجيل بياخد أقل من دقيقة، والتقييم الأول بياخد أقل من دقيقة كمان.')}</p>
            <Link to="/auth/register" className="btn btn-lg">{t('Create your free account now', 'انشئ حسابك المجاني الآن')}</Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
