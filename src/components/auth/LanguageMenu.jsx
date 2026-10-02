import { useEffect, useRef, useState } from 'react';
import Icon from '../Icon';
import { useLanguage } from '../../context/LanguageContext';

const OPTIONS = [
  { code: 'ar', name: 'العربية' },
  { code: 'en', name: 'English' },
];

/** Compact language dropdown (closes on outside click / Escape). */
export default function LanguageMenu() {
  const { locale, setLocale } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = OPTIONS.find((o) => o.code === locale) || OPTIONS[1];

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="auth-lang" ref={ref}>
      <button
        type="button"
        className="auth-chip"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Language / اللغة"
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="globe" size={16} />
        <span className="auth-chip__text" lang={current.code}>{current.name}</span>
        <Icon name="chevron-down" size={14} />
      </button>
      {open && (
        <ul className="auth-lang__menu" role="menu">
          {OPTIONS.map((o) => (
            <li key={o.code} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={o.code === locale}
                className={`auth-lang__item ${o.code === locale ? 'is-active' : ''}`}
                onClick={() => { setLocale(o.code); setOpen(false); }}
              >
                <span lang={o.code}>{o.name}</span>
                {o.code === locale && <Icon name="check" size={15} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
