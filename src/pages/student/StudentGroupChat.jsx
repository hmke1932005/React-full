import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import Icon from '../../components/Icon';
import { useTranslations, useLanguage } from '../../context/LanguageContext';
import i18nCommon from '../../i18n/common';
import i18nPage from '../../i18n/student/group-chat';

const translations = { ...i18nCommon, ...i18nPage };
const MESSAGING_BASE = '/api/v1/messaging';

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

/**
 * Mirrors app/Views/student/group-chat.php. GET /api/v1/group-chat
 * (App\Controllers\Api\StudentGroupChatApiController::resolve()) resolves
 * (creating if needed) the student's project-group conversation, exactly
 * as Student\StudentGroupChatController::index() does via
 * StudentGroupChatService::getOrCreateForGroup(). Everything after that —
 * sending — reuses the same shared /api/v1/messaging/conversations/{id}/*
 * surface Messages.jsx already talks to (Common\MessagingController); group
 * chat is not a separate messaging engine, just a conversation the student
 * always lands in. Polling every 5s replaces the Blade view's 10s
 * full-page reload.
 */
export default function StudentGroupChat() {
  const t = useTranslations(translations);
  const { locale } = useLanguage();

  const [conversationId, setConversationId] = useState(null);
  const [groupName, setGroupName] = useState('');
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const boxRef = useRef(null);
  const pollRef = useRef(null);

  const load = useCallback((silent) => {
    if (!silent) setLoading(true);
    return api.get('/api/v1/group-chat')
      .then((json) => {
        setConversationId(json.data.conversation_id);
        setGroupName(json.data.group_name || 'Group Chat');
        setParticipants(json.data.participants || []);
        setMessages(json.data.messages || []);
        setError(null);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => { if (!silent) setLoading(false); });
  }, []);

  useEffect(() => { load(false); }, [load]);

  useEffect(() => {
    if (!conversationId) return undefined;
    pollRef.current = setInterval(() => load(true), 5000);
    return () => clearInterval(pollRef.current);
  }, [conversationId, load]);

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [messages]);

  const onSend = async (e) => {
    e.preventDefault();
    const value = body.trim();
    if (!value || !conversationId) return;
    setSending(true);
    const fd = new FormData();
    fd.append('body', value);
    try {
      const res = await api.postForm(`${MESSAGING_BASE}/conversations/${conversationId}/messages`, fd);
      setMessages((prev) => [...prev, res.data]);
      setBody('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (body.trim()) onSend(e);
    }
  };

  if (loading) return <p className="text-small" style={{ padding: 'var(--space-5)' }}>{t('Loading…')}</p>;

  if (error && !conversationId) {
    return (
      <div className="card glass-panel" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
        <Icon name="users" size={40} />
        <p className="text-small text-muted" style={{ marginTop: 'var(--space-3)' }}>{error}</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-header animate-rise-in">
        <div className="page-header__title">
          <h1 className="text-h1"><Icon name="users" size={24} /> {groupName}</h1>
          <p className="text-small">
            {participants.length > 0
              ? participants.map((p) => p.full_name || p.name).join(' · ')
              : t('Your project group')}
          </p>
        </div>
        <div className="page-header__actions">
          <Link to="/student/group-hub" className="btn btn-ghost btn-sm"><Icon name="file" size={16} /> {t('Group Hub')}</Link>
          <Link to="/student/messages" className="btn btn-ghost btn-sm"><Icon name="message" size={16} /> {t('All Messages')}</Link>
        </div>
      </div>

      {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}

      <div className="card glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <span className="text-caption text-muted">{t('Members:')}</span>
          {participants.map((p) => (
            <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--glass-bg)', borderRadius: 'var(--radius-full)', padding: '2px 10px', fontSize: 'var(--text-caption)' }}>
              <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--color-primary)', color: 'var(--color-on-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
                {(p.full_name || p.name || '?').slice(0, 1)}
              </span>
              {p.full_name || p.name}
            </span>
          ))}
        </div>

        <div ref={boxRef} style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', minHeight: 380, maxHeight: 540, overflowY: 'auto' }}>
          {messages.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--text-muted)', padding: 'var(--space-8) 0' }}>
              <Icon name="users" size={40} />
              <p className="text-h3" style={{ margin: 'var(--space-3) 0 var(--space-1)' }}>{t('Start chatting with your group!')}</p>
              <p className="text-small">{t('This is your private project group channel.')}</p>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} style={{ display: 'flex', flexDirection: 'column', maxWidth: '72%', alignSelf: m.is_mine ? 'flex-end' : 'flex-start', alignItems: m.is_mine ? 'flex-end' : 'flex-start' }}>
                {!m.is_mine && (
                  <span className="text-caption" style={{ fontWeight: 700, color: 'var(--color-primary)', marginBottom: 2 }}>{m.sender_name}</span>
                )}
                <div style={{
                  padding: 'var(--space-3) var(--space-4)',
                  borderRadius: 'var(--radius-lg)',
                  background: m.is_mine ? 'var(--color-primary)' : 'var(--glass-bg)',
                  color: m.is_mine ? 'var(--color-on-primary)' : 'inherit',
                  borderBottomRightRadius: m.is_mine ? 4 : 'var(--radius-lg)',
                  borderBottomLeftRadius: m.is_mine ? 'var(--radius-lg)' : 4,
                }}>
                  <p className="text-small" style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.body}</p>
                </div>
                <span className="text-caption text-muted" style={{ marginTop: 2 }}>{timeAgo(m.created_at, locale)}</span>
              </div>
            ))
          )}
        </div>

        <form onSubmit={onSend} style={{ padding: 'var(--space-3) var(--space-4)', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end' }}>
          <textarea
            className="form-textarea"
            rows={2}
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('Message your group… (Enter to send)')}
            style={{ flex: 1, resize: 'none', minHeight: 52, maxHeight: 120 }}
          />
          <button type="submit" className="btn btn-primary" disabled={sending || !body.trim()} style={{ alignSelf: 'flex-end', height: 44 }}>
            <Icon name="message" size={18} /> {t('Send')}
          </button>
        </form>
      </div>
    </>
  );
}
