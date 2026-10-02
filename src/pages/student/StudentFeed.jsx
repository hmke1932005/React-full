import { useEffect, useState, useCallback } from 'react';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { useTranslations, useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/student/feed';

const translations = { ...i18nCommon, ...i18nPage };

/**
 * Mirrors app/Views/student/feed.php, talking to the real JSON API
 * (GET/POST /api/v1/feed/* — App\Controllers\Api\FeedApiController,
 * student branch — same FeedService/FeedRepository calls as
 * Student\StudentFeedController). Nothing invented: tabs (all/events/
 * pinned/saved), search, like/save toggles, comments, share-by-email,
 * and report-a-post all map 1:1 to the Blade view's forms.
 */

const TABS = [
  { key: 'all', en: 'All', ar: 'الكل' },
  { key: 'events', en: 'Events', ar: 'فعاليات' },
  { key: 'pinned', en: 'Pinned', ar: 'مثبتة' },
  { key: 'saved', en: 'Saved', ar: 'محفوظة' },
];

const KIND_ICON = { image: 'image', video: 'play', pdf: 'file', file: 'file', link: 'link' };

function timeAgo(dateStr, locale) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr.replace(' ', 'T')).getTime()) / 1000;
  const units = locale === 'ar'
    ? [[31536000, 'سنة'], [2592000, 'شهر'], [86400, 'يوم'], [3600, 'ساعة'], [60, 'دقيقة']]
    : [[31536000, 'y'], [2592000, 'mo'], [86400, 'd'], [3600, 'h'], [60, 'm']];
  if (diff < 60) return locale === 'ar' ? 'الآن' : 'just now';
  for (const [secs, label] of units) {
    if (diff >= secs) {
      const n = Math.floor(diff / secs);
      return locale === 'ar' ? `منذ ${n} ${label}` : `${n}${label} ago`;
    }
  }
  return '';
}

function Avatar({ name, size = 40 }) {
  const initials = (name || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'var(--color-primary)', color: '#fff', display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 600,
    }}>{initials}</span>
  );
}

function PostCard({ post, locale, t, onLike, onSave, onComment, onDeleteComment, onShare, onReport, currentUserId }) {
  const [openComments, setOpenComments] = useState(false);
  const [openShare, setOpenShare] = useState(false);
  const [openReport, setOpenReport] = useState(false);
  const [commentBody, setCommentBody] = useState('');
  const [shareEmail, setShareEmail] = useState('');
  const [shareNote, setShareNote] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [busy, setBusy] = useState(false);

  const atts = post.attachments || [];
  const images = atts.filter((a) => a.kind === 'image');
  const others = atts.filter((a) => a.kind !== 'image');
  const comments = post.comments || [];

  return (
    <div className="card glass-panel">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
        <Avatar name={post.author_name} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {Number(post.is_pinned) ? <span className="badge badge-primary"><Icon name="pin" size={12} /> {t('Pinned')}</span> : null}
            {Number(post.is_event) ? <span className="badge badge-neutral"><Icon name="calendar" size={12} /> {t('Event')}</span> : null}
            <h2 className="text-h3" style={{ margin: 0 }}>{post.title}</h2>
          </div>
          <p className="text-caption" style={{ marginTop: 'var(--space-1)' }}>{post.author_name} · {timeAgo(post.created_at, locale)}</p>
        </div>
      </div>

      {post.body && <p className="text-small" style={{ marginTop: 'var(--space-3)', whiteSpace: 'pre-wrap' }}>{post.body}</p>}

      {Number(post.is_event) ? (
        <p className="text-caption" style={{ marginTop: 'var(--space-2)' }}>
          <Icon name="calendar" size={12} /> {post.event_starts_at}{post.event_ends_at ? ` → ${post.event_ends_at}` : ''}{post.event_location ? ` · ${post.event_location}` : ''}
        </p>
      ) : null}

      {images.length > 0 && (
        <div className={`feed-media-grid${images.length === 1 ? ' feed-media-grid--single' : ''}`}>
          {images.map((a) => (
            <a key={a.id} href={`/${a.file_path}`} target="_blank" rel="noopener noreferrer">
              <img src={`/${a.file_path}`} alt={a.original_name || t('Post attachment image')} loading="lazy" />
            </a>
          ))}
        </div>
      )}
      {others.length > 0 && (
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 'var(--space-3)' }}>
          {others.map((a) => (
            a.kind === 'link' ? (
              <a key={a.id} className="btn btn-ghost btn-sm" href={a.external_url} target="_blank" rel="noopener noreferrer">
                <Icon name="link" size={12} /> {a.link_title || a.external_url}
              </a>
            ) : (
              <a key={a.id} className="btn btn-ghost btn-sm" href={`/${a.file_path}`} target="_blank" rel="noopener noreferrer">
                <Icon name={KIND_ICON[a.kind] || 'file'} size={12} /> {a.original_name || a.kind}
              </a>
            )
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 'var(--space-4)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-subtle)' }}>
        <button type="button" disabled={busy} className={`btn btn-sm ${post.is_liked ? 'btn-primary' : 'btn-ghost'}`}
          onClick={async () => { setBusy(true); try { await onLike(post); } finally { setBusy(false); } }}>
          <Icon name="heart" size={14} /> {post.likes_count || 0}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpenComments((v) => !v)}>
          <Icon name="message" size={14} /> {post.comments_count || 0}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpenShare((v) => !v)}>
          <Icon name="share" size={14} /> {post.shares_count || 0}
        </button>
        <button type="button" disabled={busy} className={`btn btn-sm ${post.is_saved ? 'btn-primary' : 'btn-ghost'}`}
          onClick={async () => { setBusy(true); try { await onSave(post); } finally { setBusy(false); } }}>
          <Icon name="bookmark" size={14} /> {post.saves_count || 0}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" title={t('Report')} onClick={() => setOpenReport((v) => !v)}>
          <Icon name="alert-triangle" size={14} />
        </button>
      </div>

      {openShare && (
        <form
          style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 'var(--space-3)' }}
          onSubmit={async (e) => {
            e.preventDefault();
            await onShare(post, shareEmail, shareNote);
            setShareEmail(''); setShareNote(''); setOpenShare(false);
          }}
        >
          <input className="form-input" type="email" required placeholder={t("Recipient's email")}
            value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
          <input className="form-input" type="text" placeholder={t('Note (optional)')}
            value={shareNote} onChange={(e) => setShareNote(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
          <button type="submit" className="btn btn-secondary btn-sm">{t('Send')}</button>
        </form>
      )}

      {openReport && (
        <form
          style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 'var(--space-3)' }}
          onSubmit={async (e) => {
            e.preventDefault();
            await onReport(post, reportReason);
            setReportReason(''); setOpenReport(false);
          }}
        >
          <input className="form-input" type="text" required placeholder={t('Why are you reporting this post?')}
            value={reportReason} onChange={(e) => setReportReason(e.target.value)} style={{ flex: 1, minWidth: 220 }} />
          <button type="submit" className="btn btn-secondary btn-sm">{t('Report')}</button>
        </form>
      )}

      {openComments && (
        <div style={{ marginTop: 'var(--space-4)' }}>
          {comments.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
              {comments.map((c) => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-2)', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div>
                    <p className="text-caption" style={{ margin: 0, fontWeight: 600 }}>
                      {c.user_name} <span className="text-muted" style={{ fontWeight: 400 }}>{timeAgo(c.created_at, locale)}</span>
                    </p>
                    <p className="text-small" style={{ margin: '2px 0 0', whiteSpace: 'pre-wrap' }}>{c.body}</p>
                  </div>
                  {Number(c.user_id) === Number(currentUserId) && (
                    <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }}
                      onClick={() => { if (window.confirm(t('Delete this comment?'))) onDeleteComment(post, c); }}>
                      <Icon name="trash" size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          <form
            style={{ display: 'flex', gap: 'var(--space-2)' }}
            onSubmit={async (e) => {
              e.preventDefault();
              if (!commentBody.trim()) return;
              await onComment(post, commentBody);
              setCommentBody('');
            }}
          >
            <input className="form-input" type="text" required maxLength={2000} placeholder={t('Write a comment...')}
              value={commentBody} onChange={(e) => setCommentBody(e.target.value)} style={{ flex: 1 }} />
            <button type="submit" className="btn btn-primary btn-sm">{t('Post')}</button>
          </form>
        </div>
      )}
    </div>
  );
}

export default function StudentFeed() {
  const t = useTranslations(translations);
  const { locale } = useLanguage();
  const { user } = useAuth();
  const currentUserId = user?.id ?? null;
  const [posts, setPosts] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, perPage: 10 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [type, setType] = useState('all');
  const [q, setQ] = useState('');
  const [qInput, setQInput] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/api/v1/feed', { page, per_page: 10, type, q })
      .then((json) => {
        const withExtras = (json.data || []).map((p) => ({
          ...p,
          attachments: (json.meta?.attachments || {})[p.id] || [],
          comments: (json.meta?.comments || {})[p.id] || [],
        }));
        setPosts(withExtras);
        setMeta(json.meta || {});
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [page, type, q]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.perPage || 10)));

  const patchPost = (id, patch) => setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const onLike = async (post) => {
    try {
      const json = await api.post(`/api/v1/feed/${post.id}/like`);
      patchPost(post.id, { is_liked: json.data.liked, likes_count: (post.likes_count || 0) + (json.data.liked ? 1 : -1) });
    } catch (err) { setActionError(errorMessage(err)); }
  };
  const onSave = async (post) => {
    try {
      const json = await api.post(`/api/v1/feed/${post.id}/save`);
      patchPost(post.id, { is_saved: json.data.saved, saves_count: (post.saves_count || 0) + (json.data.saved ? 1 : -1) });
    } catch (err) { setActionError(errorMessage(err)); }
  };
  const onComment = async (post, body) => {
    try {
      await api.post(`/api/v1/feed/${post.id}/comments`, { body });
      const json = await api.get(`/api/v1/feed/${post.id}/comments`);
      patchPost(post.id, { comments: json.data || [], comments_count: (json.data || []).length });
    } catch (err) { setActionError(errorMessage(err)); }
  };
  const onDeleteComment = async (post, comment) => {
    try {
      await api.del(`/api/v1/feed/comments/${comment.id}`);
      const json = await api.get(`/api/v1/feed/${post.id}/comments`);
      patchPost(post.id, { comments: json.data || [], comments_count: (json.data || []).length });
    } catch (err) { setActionError(errorMessage(err)); }
  };
  const onShare = async (post, recipientEmail, note) => {
    try {
      await api.post(`/api/v1/feed/${post.id}/share`, { recipient_email: recipientEmail, note });
      patchPost(post.id, { shares_count: (post.shares_count || 0) + 1 });
    } catch (err) { setActionError(errorMessage(err)); }
  };
  const onReport = async (post, reason) => {
    try {
      await api.post(`/api/v1/feed/${post.id}/report`, { reason });
    } catch (err) { setActionError(errorMessage(err)); }
  };

  return (
    <>
      <div className="page-header animate-rise-in">
        <div className="page-header__title">
          <h1 className="text-h1"><Icon name="message" size={26} /> {t('University Feed')}</h1>
          <p className="text-small">{locale === 'ar' ? 'آخر تحديثات وفعاليات جامعتك.' : "Your university's latest updates and events."}</p>
        </div>
      </div>

      {meta.unaffiliated ? (
        <div className="glass-panel" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
          <p className="text-small text-muted">{locale === 'ar' ? 'حسابك غير مرتبط بجامعة حاليًا، لذا لا يوجد موجز لعرضه.' : "Your account isn't linked to a university yet, so there's no feed to show."}</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-5)', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              {TABS.map((tab) => (
                <button key={tab.key} type="button" className={`btn btn-sm ${type === tab.key ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => { setType(tab.key); setPage(1); }}>
                  {locale === 'ar' ? tab.ar : tab.en}
                </button>
              ))}
            </div>
            <form style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}
              onSubmit={(e) => { e.preventDefault(); setQ(qInput); setPage(1); }}>
              <input className="form-input" type="text" value={qInput} onChange={(e) => setQInput(e.target.value)}
                placeholder={t('Search the feed')} style={{ minWidth: 200 }} />
              <button type="submit" className="btn btn-secondary btn-sm"><Icon name="filter" size={14} /></button>
            </form>
          </div>

          {actionError && <p style={{ color: 'var(--color-danger)' }}>{actionError}</p>}
          {loading && <p className="text-small" style={{ padding: 'var(--space-5)' }}>{t('Loading…')}</p>}
          {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}

          {!loading && !error && (
            posts.length === 0 ? (
              <div className="glass-panel" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--glass-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-4)', color: 'var(--color-accent)' }}>
                  <Icon name="message" size={28} />
                </div>
                <p className="text-small text-muted">{t('No posts to show.')}</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  {posts.map((post) => (
                    <PostCard key={post.id} post={post} locale={locale} t={t} currentUserId={currentUserId}
                      onLike={onLike} onSave={onSave} onComment={onComment} onDeleteComment={onDeleteComment}
                      onShare={onShare} onReport={onReport} />
                  ))}
                </div>
                {totalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-5)', alignItems: 'center' }}>
                    <button type="button" className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><Icon name="chevron-left" size={16} /></button>
                    <span className="text-small">{locale === 'ar' ? `صفحة ${page} من ${totalPages}` : `Page ${page} of ${totalPages}`}</span>
                    <button type="button" className="btn btn-outline btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}><Icon name="chevron-right" size={16} /></button>
                  </div>
                )}
              </>
            )
          )}
        </>
      )}
    </>
  );
}
